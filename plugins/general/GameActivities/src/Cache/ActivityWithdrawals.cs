using System.Text.Json.Nodes;
using System.Text.RegularExpressions;

namespace NexusPipeline.Plugin.GameActivities;

internal static class ActivityWithdrawals
{
    private static bool Cancellation(OfficialNotice notice) => Regex.IsMatch(notice.Title,
        @"活动(?:取消|撤回)公告|(?:活动|イベント).{0,40}(?:開催中止|開催取りやめ)|(?:Event|Recruitment) Cancellation Notice",
        RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);

    public static bool IsWithdrawal(OfficialNotice notice) => notice.IsWithdrawn || Cancellation(notice);

    public static JsonObject Empty(GameSource source) => ActivityNormalizer.Object(new
    {
        formatVersion = 1, source.GameId, source.ProgressionId, contentLocale = source.Locale, entries = Array.Empty<object>()
    });

    public static void Validate(JsonObject ledger, GameSource source)
    {
        if (ledger["formatVersion"]?.GetValue<int>() != 1 || ActivityPolicy.Text(ledger["gameId"]) != source.GameId
            || ActivityPolicy.Text(ledger["progressionId"]) != source.ProgressionId || ActivityPolicy.Text(ledger["contentLocale"]) != source.Locale
            || ledger["entries"] is not JsonArray entries || entries.Count > 128
            || entries.OfType<JsonObject>().Sum(entry => entry["activities"]?.AsArray().Count ?? 0) > 250)
            throw new ActivityException("withdrawal_cache_invalid", 500);
    }

    public static JsonObject Record(JsonObject ledger, JsonObject feed, OfficialResult? official, GameSource source, DateTimeOffset now)
    {
        Validate(ledger, source);
        var result = ledger.DeepClone().AsObject();
        var entries = result["entries"]!.AsArray();
        foreach (var notice in official?.Notices ?? [])
        {
            var targets = notice.IsWithdrawn ? new[] { notice.Url } : Cancellation(notice) ? notice.LinkedNoticeUrls ?? [] : [];
            foreach (string target in targets)
            {
                if (!Uri.TryCreate(target, UriKind.Absolute, out var uri) || uri.Scheme != "https" || uri.UserInfo.Length > 0
                    || uri.Host != new Uri(notice.Url).Host) continue;
                var entry = entries.OfType<JsonObject>().FirstOrDefault(value => ActivityPolicy.Text(value["targetUrl"]) == target);
                var matches = feed["activities"]!.AsArray().OfType<JsonObject>().Where(item => ExactTarget(item, target)).ToArray();
                // Cancellation pages also link navigation; only a known announcement is a withdrawal target.
                bool knownNotice = feed["activities"]!.AsArray().OfType<JsonObject>().Any(item => ActivityPolicy.Text(item["officialUrl"]) == target);
                if (entry is null && !notice.IsWithdrawn && !knownNotice) continue;
                if (entry is null)
                {
                    entry = ActivityNormalizer.Object(new
                    {
                        targetUrl = target, periodKey = ActivityPolicy.Text(feed["contentPeriod"]?["key"]),
                        source = new
                        {
                            sourceId = "withdrawal:" + ActivityNormalizer.Hash(notice.Url)[..24],
                            providerId = "official-" + source.File.ToLowerInvariant(), providerVersion = OfficialTimeParser.Version,
                            kind = notice.SourceUrl is { } endpoint && endpoint != notice.Url ? "official-api" : "official-notice",
                            url = notice.SourceUrl ?? notice.Url, locale = notice.Locale, retrievedAt = ActivityNormalizer.Utc(now),
                            sourceUpdatedAt = notice.PublishedAt is { } published ? ActivityNormalizer.Utc(published) : null,
                            note = (notice.IsWithdrawn ? "Explicit publisher deletion marker: " : "Explicit cancellation notice: ") + notice.Url + "; target: " + target
                        },
                        activities = Array.Empty<object>()
                    });
                    entries.Add(entry);
                }
                var snapshots = entry["activities"]!.AsArray();
                foreach (var item in matches)
                    if (!snapshots.Any(value => ActivityPolicy.Text(value?["eventId"]) == ActivityPolicy.Text(item["eventId"]))) snapshots.Add(item.DeepClone());
            }
        }
        Validate(result, source);
        return result;
    }

    private static bool ExactTarget(JsonObject item, string target) => ActivityPolicy.Text(item["officialLinkKind"]) == "exact-activity"
        && ActivityPolicy.Text(item["officialUrl"]) == target;

    public static void Apply(JsonObject feed, JsonObject ledger)
    {
        if (ActivityPolicy.Text(feed["gameId"]) != ActivityPolicy.Text(ledger["gameId"])
            || ActivityPolicy.Text(feed["progressionId"]) != ActivityPolicy.Text(ledger["progressionId"])
            || ActivityPolicy.Text(feed["contentLocale"]) != ActivityPolicy.Text(ledger["contentLocale"]))
            throw new ActivityException("withdrawal_cache_invalid", 500);
        var activities = feed["activities"]!.AsArray();
        var entries = ledger["entries"]!.AsArray().OfType<JsonObject>().ToArray();
        var diagnostics = feed["health"]!["diagnostics"]!.AsArray();
        foreach (var old in diagnostics.Where(value => ActivityPolicy.Text(value?["code"]) == "official_withdrawal").ToArray()) diagnostics.Remove(old);
        foreach (var entry in entries)
        {
            var previous = new JsonObject
            {
                ["gameId"] = ledger["gameId"]!.DeepClone(), ["progressionId"] = ledger["progressionId"]!.DeepClone(),
                ["contentLocale"] = ledger["contentLocale"]!.DeepClone(),
                ["contentPeriod"] = new JsonObject { ["key"] = ActivityPolicy.Text(entry["periodKey"]) },
                ["activities"] = entry["activities"]!.DeepClone()
            };
            EventIdentityResolver.Reconcile(feed, previous);
            var ids = previous["activities"]!.AsArray().Select(value => ActivityPolicy.Text(value?["eventId"])).ToHashSet(StringComparer.Ordinal);
            var removed = activities.OfType<JsonObject>().Where(item => ids.Contains(ActivityPolicy.Text(item["eventId"]))
                || ExactTarget(item, ActivityPolicy.Text(entry["targetUrl"]))
                || ActivityPolicy.Text(item["eventId"]).StartsWith("official:", StringComparison.Ordinal)
                    && ActivityPolicy.Text(item["officialUrl"]) == ActivityPolicy.Text(entry["targetUrl"])).ToArray();
            foreach (var item in removed) activities.Remove(item);
            string withdrawnSource = "official:" + ActivityNormalizer.Hash(ActivityPolicy.Text(entry["targetUrl"]))[..24];
            foreach (var item in activities.OfType<JsonObject>()) WithdrawFields(item, withdrawnSource);
            var coverageRefs = feed["coverage"]!["gacha"]!["sourceRefs"]!.AsArray();
            bool directoryWithdrawn = coverageRefs.Any(value => ActivityPolicy.Text(value) == withdrawnSource);
            foreach (var reference in coverageRefs.Where(value => ActivityPolicy.Text(value) == withdrawnSource).ToArray()) coverageRefs.Remove(reference);
            if (removed.Any(ActivityPolicy.Gacha) || directoryWithdrawn)
            {
                feed["coverage"]!["gacha"]!["status"] = "partial";
                feed["coverage"]!["gacha"]!["note"] = "Explicitly withdrawn pools excluded; the current directory requires renewed qualification.";
            }
            if (!entries.TakeLast(8).Contains(entry)) continue;
            var evidence = entry["source"]!;
            string sourceRef = ActivityPolicy.Text(evidence["sourceId"]);
            bool referenced = feed["sources"]!.AsArray().Any(value => ActivityPolicy.Text(value?["sourceId"]) == sourceRef);
            if (!referenced && feed["sources"]!.AsArray().Count < 64) { feed["sources"]!.AsArray().Add(evidence.DeepClone()); referenced = true; }
            if (diagnostics.Count >= 64) diagnostics.RemoveAt(0);
            diagnostics.Add(ActivityNormalizer.Object(new { code = "official_withdrawal", sourceRef = referenced ? sourceRef : null, message = ActivityPolicy.Text(entry["targetUrl"]) }));
        }
    }

    private static void WithdrawFields(JsonObject item, string sourceRef)
    {
        var provenance = item["provenance"]!.AsArray();
        var fields = provenance.Where(value => ActivityPolicy.Text(value?["sourceRef"]) == sourceRef)
            .Select(value => ActivityPolicy.Text(value?["field"])).ToHashSet(StringComparer.Ordinal);
        foreach (string field in new[] { "start", "playEnd", "claimEnd" })
        {
            if (ActivityPolicy.Text(item["times"]?[field]?["sourceRef"]) != sourceRef) continue;
            var original = provenance.FirstOrDefault(value => ActivityPolicy.Text(value?["field"]) == "/times/" + field
                && ActivityPolicy.Text(value?["locator"]) == "aggregate:original-time");
            var fallback = original?["note"] is { } note ? JsonNode.Parse(ActivityPolicy.Text(note)) : null;
            if (fallback is not null)
            {
                fallback["instantUtc"] = null; fallback["timeBasis"] = "unknown"; fallback["sourceZone"] = null; fallback["certainty"] = "unknown";
            }
            item["times"]![field] = fallback;
        }
        if (fields.Contains("/officialUrl")) { item["officialUrl"] = null; item["officialLinkKind"] = "missing"; }
        if (fields.Contains("/description")) { item["description"] = null; item["descriptionTruncated"] = false; }
        if (fields.Contains("/category")) item["category"] = "other";
        if (fields.Contains("/availability")) item["availability"] = "unknown";
        if (fields.Contains("/importance")) item["importance"] = "unknown";
        if (fields.Contains("/isOfficialFeatured")) item["isOfficialFeatured"] = false;
        foreach (var evidence in provenance.Where(value => ActivityPolicy.Text(value?["sourceRef"]) == sourceRef).ToArray()) provenance.Remove(evidence);
    }
}
