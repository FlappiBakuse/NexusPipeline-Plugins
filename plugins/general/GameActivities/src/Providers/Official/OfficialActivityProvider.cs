using System.Text.Json.Nodes;
using System.Text.RegularExpressions;

namespace NexusPipeline.Plugin.GameActivities;

internal sealed record OfficialNotice(string Title, string Text, string Url, string Locale,
    string? SourceUrl = null, DateTimeOffset? PublishedAt = null, bool HasImages = false, OfficialBannerDocument? Banner = null, string? SourceNote = null,
    bool IsWithdrawn = false, string[]? LinkedNoticeUrls = null);
internal sealed record OfficialBannerDocument(string Id, string Category, string Start, string? End, string Availability,
    string LinkKind = "exact-activity", string? OfficialUrl = null, string? StableEventId = null);
internal sealed record OfficialCatalog(string Url, string[] BannerIds, string Note, string? Version = null, string[]? EvidenceUrls = null);
internal sealed record OfficialResult(OfficialNotice[] Notices, string Status, string Note, OfficialCatalog? Catalog = null);

internal sealed class OfficialActivityProvider(ActivityHttp http)
{
    public Task<OfficialResult> FetchAsync(GameSource source, CancellationToken ct, OfficialResult? previous = null) => new OfficialSourceReader(http).ReadAsync(source, ct, previous);

    public static void Merge(JsonObject feed, OfficialResult official, GameSource source, DateTimeOffset now)
    {
        var sources = feed["sources"]!.AsArray();
        var events = feed["activities"]!.AsArray();
        string stamp = ActivityNormalizer.Utc(now);
        int gacha = 0;
        if (official.Catalog is { } catalog) sources.Add(ActivityNormalizer.Object(new
        {
            sourceId = "official:" + ActivityNormalizer.Hash(catalog.Url)[..24], providerId = "official-" + source.File.ToLowerInvariant(),
            providerVersion = OfficialTimeParser.Version, kind = "official-api", url = catalog.Url, locale = source.Locale,
            retrievedAt = stamp, sourceUpdatedAt = (string?)null, note = catalog.Note
        }));
        foreach (var notice in official.Notices)
        {
            if (ActivityWithdrawals.IsWithdrawal(notice)) continue;
            string id = "official:" + ActivityNormalizer.Hash(notice.Url)[..24];
            if (sources.Any(s => ActivityPolicy.Text(s?["sourceId"]) == id)) continue;
            sources.Add(ActivityNormalizer.Object(new
            {
                sourceId = id,
                providerId = "official-" + source.File.ToLowerInvariant(),
                providerVersion = OfficialTimeParser.Version,
                kind = notice.SourceUrl is { } fetched && fetched != notice.Url ? "official-api" : "official-notice",
                url = notice.SourceUrl ?? notice.Url,
                locale = notice.Locale,
                retrievedAt = stamp,
                sourceUpdatedAt = notice.PublishedAt is { } published ? ActivityNormalizer.Utc(published) : null,
                note = (notice.SourceNote ?? "Official progression endpoint; linked notice: " + notice.Url)
                    + "; Unzoned calendar times use configured default " + GameSources.OfficialDefaultZone(source) + ", not an official timezone declaration."
            }));
            foreach (var item in events.OfType<JsonObject>().Where(item => ActivityPolicy.Text(item["eventId"]).StartsWith("sra:", StringComparison.Ordinal)))
            {
                var match = OfficialEventParser.Match(source, item, notice, ActivityPolicy.Text(feed["version"]?["number"]));
                if (match is null) continue;
                if (ActivityPolicy.Text(item["officialLinkKind"]) == "exact-activity") continue;
                string description = match.Text[..Math.Min(match.Text.Length, 8000)];
                item["description"] = description;
                item["descriptionTruncated"] = description.Length < match.Text.Length;
                item["officialUrl"] = notice.Url;
                item["officialLinkKind"] = match.LinkKind;
                var evidence = item["provenance"]!.AsArray();
                evidence.Add(ActivityNormalizer.Evidence("/description", id, "notice:text"));
                evidence.Add(ActivityNormalizer.Evidence("/officialUrl", id, "notice:url"));
                if (match.Schedule is { } schedule)
                {
                    MergeTime(feed, item, "start", schedule.Start, notice, id, schedule.Start + " ~ " + schedule.PlayEnd, source);
                    MergeTime(feed, item, "playEnd", schedule.PlayEnd, notice, id, schedule.Start + " ~ " + schedule.PlayEnd, source);
                    MergeTime(feed, item, "claimEnd", schedule.ClaimEnd, notice, id, schedule.ClaimEnd, source);
                }
                string version = ActivityPolicy.Text(feed["version"]?["number"]);
                if (version.Length > 0 && Regex.IsMatch(notice.Title, @"(?<![0-9.])" + Regex.Escape(version) + @"(?![0-9.])"))
                {
                    item["versionRelation"] = "current";
                    item["periodKey"] = ActivityPolicy.Text(feed["contentPeriod"]?["key"]);
                    evidence.Add(ActivityNormalizer.Evidence("/versionRelation", id, "notice:title", "derived", "official-version-title-v1"));
                    evidence.Add(ActivityNormalizer.Evidence("/periodKey", id, "notice:title", "derived", "official-version-title-v1"));
                }
            }
            bool versionBound = source.GameId is "honkai-star-rail" or "zenless-zone-zero" or "wuthering-waves" or "neverness-to-everness";
            string currentVersion = ActivityPolicy.Text(feed["version"]?["number"]);
            if (notice.Banner is not null && official.Catalog?.Version is { } catalogVersion && catalogVersion != currentVersion) continue;
            if (versionBound && notice.Banner is null && (currentVersion.Length == 0 || !Regex.IsMatch(notice.Title, @"(?<![0-9.])" + Regex.Escape(currentVersion) + @"(?![0-9.])"))
                && !(source.GameId == "honkai-star-rail" && notice.Title.StartsWith("「星际幻宠」乐园：", StringComparison.Ordinal) && notice.Text.Contains(currentVersion + "版本期间", StringComparison.Ordinal))) continue;
            foreach (var banner in OfficialGachaParser.Parse(source, notice, id))
            {
                if (source.GameId == "wuthering-waves" && notice.Banner is null && official.Catalog is not null
                    && official.Notices.Any(candidate => candidate.Banner is not null && candidate.Title == ActivityPolicy.Text(banner["title"]))) continue;
                string eventId = ActivityPolicy.Text(banner["eventId"]);
                if (events.Any(item => ActivityPolicy.Text(item?["eventId"]) == eventId)) continue;
                if (source.GameId == "honkai-star-rail" && ActivityPolicy.Text(banner["title"]) == "星际潮玩")
                {
                    var aliases = events.OfType<JsonObject>().Where(item => ActivityPolicy.Text(item["title"]) == "「星际幻宠」乐园：星际潮玩"
                        && ActivityPolicy.Text(item["versionRelation"]) == "current" && notice.Text.Contains(currentVersion + "版本期间", StringComparison.Ordinal)).ToArray();
                    if (aliases.Length == 1)
                    {
                        var aggregate = aliases[0];
                        var evidence = aggregate["provenance"]!.AsArray();
                        foreach (var field in new[] { "category", "availability", "officialUrl", "officialLinkKind", "description", "descriptionTruncated" })
                            aggregate[field] = banner[field]?.DeepClone();
                        evidence.Add(ActivityNormalizer.Evidence("/category", id, "notice:pet-draw", "derived", "official-pet-draw-v1"));
                        evidence.Add(ActivityNormalizer.Evidence("/availability", id, "notice:pet-draw", "derived", "official-pet-draw-v1"));
                        evidence.Add(ActivityNormalizer.Evidence("/description", id, "notice:text"));
                        evidence.Add(ActivityNormalizer.Evidence("/officialUrl", id, "notice:url"));
                        foreach (string field in new[] { "start", "playEnd" })
                            if (!ActivityPolicy.Text(aggregate["times"]?[field]?["sourceRef"]).StartsWith("official:", StringComparison.Ordinal))
                                MergeTime(feed, aggregate, field, ActivityPolicy.Text(banner["times"]?[field]?["rawValue"]), notice, id, null, source);
                        gacha++;
                        continue;
                    }
                }
                events.Add(banner);
                gacha++;
            }
        }
        MergePetSchedule(feed, official, source);
        var bannerSources = events.OfType<JsonObject>().Where(ActivityPolicy.Gacha)
            .SelectMany(item => item["provenance"]!.AsArray()).Select(p => ActivityPolicy.Text(p?["sourceRef"]))
            .Where(id => id.StartsWith("official:", StringComparison.Ordinal)).Distinct().ToArray();
        bool catalogComplete = official.Catalog is { BannerIds.Length: > 0 } complete
            && (complete.Version is null || complete.Version == ActivityPolicy.Text(feed["version"]?["number"]))
            && complete.BannerIds.All(bannerId => official.Notices.Any(notice => notice.Banner?.Id == bannerId
                && events.Any(item => ActivityPolicy.Text(item?["eventId"]) == (notice.Banner.StableEventId
                    ?? "official:" + ActivityNormalizer.Hash(source.GameId + "/" + source.ProgressionId + "/catalog/" + bannerId)))));
        if (catalogComplete && official.Catalog is { } catalogEvidence)
            bannerSources = [.. bannerSources, "official:" + ActivityNormalizer.Hash(catalogEvidence.Url)[..24],
                .. (catalogEvidence.EvidenceUrls ?? []).Select(url => "official:" + ActivityNormalizer.Hash(url)[..24])];
        var directory = catalogComplete ? null : OfficialGachaDirectory.Qualify(feed, official, source);
        if (directory is not null) bannerSources = [.. bannerSources, .. directory.SourceRefs];
        feed["coverage"]!["gacha"] = ActivityNormalizer.Object(new
        {
            status = catalogComplete || directory is not null ? "complete" : official.Status == "unavailable" ? "unavailable" : "partial",
            asOf = stamp,
            sourceRefs = bannerSources.Length > 0 ? bannerSources.Distinct().ToArray() : sources.OfType<JsonObject>().Where(s => ActivityPolicy.Text(s["kind"]) != "aggregate")
                .Select(s => ActivityPolicy.Text(s["sourceId"])).Take(1).ToArray(),
            note = catalogComplete ? official.Catalog!.Note : directory is not null ? directory.Note : gacha > 0
                ? "Official banner notices parsed; bounded catalog, image-only schedules and unqualified server clocks prevent a complete-coverage assertion."
                : official.Note
        });
        if (official.Notices.Any(notice => notice.HasImages)) feed["health"]!["diagnostics"]!.AsArray().Add(ActivityNormalizer.Object(new
        {
            code = "official_images_not_interpreted", sourceRef = (string?)null, message = "Official notices contain images; dates or banner details present only in images are not inferred."
        }));
        if (events.Count > 250) throw new ActivityException("feed_too_large", 502);
        ActivityNormalizer.Finalize(feed, now);
    }

    private static void MergePetSchedule(JsonObject feed, OfficialResult official, GameSource source)
    {
        if (source.GameId != "honkai-star-rail") return;
        string version = ActivityPolicy.Text(feed["version"]?["number"]);
        if (version.Length == 0 || !official.Notices.Any(notice => !ActivityWithdrawals.IsWithdrawal(notice)
            && notice.Title.StartsWith("「星际幻宠」乐园：", StringComparison.Ordinal) && notice.Text.Contains(version + "版本期间", StringComparison.Ordinal))) return;
        var activities = feed["activities"]!.AsArray().OfType<JsonObject>().Where(item => ActivityPolicy.Text(item["title"]) == "「星际幻宠」乐园：星际潮玩"
            && ActivityPolicy.Text(item["versionRelation"]) == "current").ToArray();
        if (activities.Length != 1) return;
        var schedules = official.Notices.Where(notice => !ActivityWithdrawals.IsWithdrawal(notice)
            && notice.Title.StartsWith(version + "版本", StringComparison.Ordinal) && notice.Title.EndsWith("版本更新说明", StringComparison.Ordinal))
            .Select(notice => new { Notice = notice, Section = Regex.Match(notice.Text, @"(?:^|\n)■「星际幻宠」乐园\n(?<section>.*?)(?=\n■|\z)", RegexOptions.Singleline) })
            .Where(value => value.Section.Success && value.Section.Groups["section"].Value.Contains("「星际潮玩」", StringComparison.Ordinal))
            .Select(value => new { value.Notice, Schedule = OfficialEventParser.LineRange(value.Section.Groups["section"].Value, "开放时间") })
            .Where(value => value.Schedule is not null).ToArray();
        if (schedules.Length != 1) return;
        var schedule = schedules[0].Schedule!;
        string sourceRef = "official:" + ActivityNormalizer.Hash(schedules[0].Notice.Url)[..24];
        MergeTime(feed, activities[0], "start", schedule.Start, schedules[0].Notice, sourceRef, schedule.Start + " ~ " + schedule.PlayEnd, source);
        MergeTime(feed, activities[0], "playEnd", schedule.PlayEnd, schedules[0].Notice, sourceRef, schedule.Start + " ~ " + schedule.PlayEnd, source);
    }

    private static void MergeTime(JsonObject feed, JsonObject activity, string field, string? raw, OfficialNotice notice, string sourceRef, string? context, GameSource source)
    {
        var time = OfficialTimeParser.Parse(raw, notice, sourceRef, context, source);
        if (time is null) return;
        var times = activity["times"]!.AsObject();
        if (times[field] is JsonObject previous)
        {
            string previousSource = ActivityPolicy.Text(previous["sourceRef"]);
            var original = ActivityNormalizer.Evidence("/times/" + field, previousSource,
                previousSource.StartsWith("official:", StringComparison.Ordinal) ? "official:previous-time" : "aggregate:original-time");
            original["note"] = previous.ToJsonString(ActivityNormalizer.Json);
            activity["provenance"]!.AsArray().Add(original);
            var before = ActivityPolicy.Instant(previous);
            var after = ActivityPolicy.Instant(time);
            if (before is not null && (after is null || Math.Abs((before.Value - after.Value).TotalSeconds) >= 60))
                feed["health"]!["diagnostics"]!.AsArray().Add(ActivityNormalizer.Object(new
                {
                    code = after is null ? "official_time_basis_unverified" : "official_time_conflict",
                    sourceRef,
                    message = ActivityPolicy.Text(activity["title"]) + " / " + field + ": previous " + ActivityPolicy.Text(previous["rawValue"]) + "; official " + raw
                }));
        }
        times[field] = time;
        activity["provenance"]!.AsArray().Add(ActivityNormalizer.Evidence("/times/" + field, sourceRef, "notice:schedule"));
    }
}
