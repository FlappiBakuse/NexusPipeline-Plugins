using System.Globalization;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;

namespace NexusPipeline.Plugin.GameActivities;

internal static class OfficialGachaParser
{
    private sealed record Banner(string Title, string Category, string Start, string End,
        DateTimeOffset? StartInstant = null, DateTimeOffset? EndInstant = null, string? Zone = null,
        string Availability = "limited", string? CatalogId = null);

    public static IEnumerable<JsonObject> Parse(GameSource source, OfficialNotice notice, string sourceRef)
    {
        IEnumerable<Banner> banners = notice.Banner is { } data
            ? [new(notice.Title, data.Category, data.Start, data.End ?? "", Availability: data.Availability, CatalogId: data.Id)]
            : source.GameId switch
        {
            "stella-sora" => Stella(notice),
            "blue-archive" when source.ProgressionId == "cn" => BlueArchiveChina(notice),
            "blue-archive" when source.ProgressionId == "jp" => BlueArchiveJapan(notice),
            "blue-archive" when source.ProgressionId == "global" => BlueArchiveGlobal(notice),
            "genshin-impact" => Genshin(notice),
            "honkai-star-rail" => StarRail(notice),
            "zenless-zone-zero" => Zenless(notice),
            "arknights-endfield" => Endfield(notice),
            "wuthering-waves" => WutheringWaves(notice),
            "neverness-to-everness" when source.ProgressionId == "global" => NteGlobal(notice),
            "neverness-to-everness" when source.ProgressionId == "cn" => NteChina(notice),
            _ => []
        };
        foreach (var banner in banners)
        {
            string eventId = notice.Banner?.StableEventId ?? "official:" + ActivityNormalizer.Hash(source.GameId + "/" + source.ProgressionId + "/"
                + (banner.CatalogId is { } catalogId ? "catalog/" + catalogId : notice.Url + "/" + banner.Title));
            yield return ActivityNormalizer.Object(new
            {
                eventId,
                title = banner.Title,
                description = notice.Text[..Math.Min(8000, notice.Text.Length)],
                descriptionTruncated = notice.Text.Length > 8000,
                channel = "in-game",
                category = banner.Category,
                availability = banner.Availability,
                importance = "routine",
                isOfficialFeatured = false,
                versionRelation = "unknown",
                periodKey = (string?)null,
                times = new { start = Time(banner.Start, sourceRef, banner.StartInstant, banner.Zone, notice, source), playEnd = Time(banner.End, sourceRef, banner.EndInstant, banner.Zone, notice, source), claimEnd = (object?)null },
                cover = (object?)null,
                officialUrl = notice.Banner?.LinkKind == "missing" ? null : notice.Banner?.OfficialUrl ?? notice.Url,
                officialLinkKind = notice.Banner?.LinkKind ?? (source.GameId == "wuthering-waves" ? "version-notice" : "exact-activity"),
                provenance = new[]
                {
                    ActivityNormalizer.Evidence("/title", sourceRef, "notice:banner-title"),
                    ActivityNormalizer.Evidence("/description", sourceRef, "notice:text"),
                    ActivityNormalizer.Evidence("/officialUrl", sourceRef, "notice:url"),
                    ActivityNormalizer.Evidence("/category", sourceRef, "notice:banner-type", "derived", "official-gacha-template-v2"),
                    ActivityNormalizer.Evidence("/availability", sourceRef, "notice:banner-type", "derived", "official-gacha-template-v3"),
                    ActivityNormalizer.Evidence("/channel", sourceRef, "notice:banner-type", "derived", "official-gacha-template-v2"),
                    ActivityNormalizer.Evidence("/importance", sourceRef, "notice:banner-type", "derived", "official-gacha-template-v2"),
                    ActivityNormalizer.Evidence("/versionRelation", sourceRef, "notice:text", "derived", "unverified-period-v1")
                }
            });
        }
    }

    private static JsonObject? Time(string raw, string sourceRef, DateTimeOffset? instant, string? zone, OfficialNotice notice, GameSource source)
    {
        if (raw.Length == 0) return null;
        if (instant is null) return OfficialTimeParser.Parse(raw, notice, sourceRef, source: source);
        return ActivityNormalizer.Object(new
        {
            instantUtc = instant is { } time ? ActivityNormalizer.Utc(time) : null,
            rawValue = raw,
            timeBasis = instant is null ? "unknown" : zone == "UTC" ? "utc" : "explicit-offset",
            sourceZone = instant is null ? null : zone,
            precision = Regex.IsMatch(raw, @"\d{1,2}:\d{2}") ? "minute" : "unknown",
            certainty = instant is null ? "unknown" : "confirmed",
            sourceRef
        });
    }

    private static IEnumerable<Banner> Stella(OfficialNotice notice)
    {
        if (!notice.Title.Contains("限时招募", StringComparison.Ordinal)) yield break;
        var match = Regex.Match(notice.Text, @"▌招募时间\s+(?<start>\d{4}/\d{2}/\d{2} (?:\d{2}:\d{2}|维护结束后))\s*[~～]\s*(?<end>\d{4}/\d{2}/\d{2} \d{2}:\d{2})");
        if (!match.Success) yield break;
        string category = notice.Text.Contains("5星旅人", StringComparison.Ordinal) ? "gacha-character"
            : notice.Text.Contains("5星秘纹", StringComparison.Ordinal) ? "gacha-weapon" : "gacha-other";
        yield return new(notice.Title, category, match.Groups["start"].Value, match.Groups["end"].Value);
    }

    private static IEnumerable<Banner> BlueArchiveChina(OfficialNotice notice)
    {
        if (notice.Title is "【预告】3★必得招募即将开启！" or "【预告】3★限定必得招募即将开启！")
        {
            var special = OfficialEventParser.LineRange(notice.Text, notice.Title.Contains("限定", StringComparison.Ordinal)
                ? "3★限定成员必得招募券可使用时间：" : "■ 活动时间");
            if (special is not null) yield return new(notice.Title.Replace("【预告】", "", StringComparison.Ordinal).Replace("即将开启！", "", StringComparison.Ordinal), "gacha-character", special.Start, special.PlayEnd);
            yield break;
        }
        if (!notice.Title.Contains("限时招募", StringComparison.Ordinal)) yield break;
        var match = Regex.Match(notice.Text, @"■ 招募时间\s+(?<start>\d{2}月\d{2}日 (?:\d{2}:\d{2}|维护结束后))\s*[~～]\s*(?<end>\d{2}月\d{2}日 \d{2}:\d{2})");
        if (!match.Success) yield break;
        var name = Regex.Match(notice.Text, @"(?:限时(?:限定)?(?:复刻)?|庆典(?:复刻)?)招募【(?<name>[^】]+)】");
        yield return new(name.Success ? name.Groups["name"].Value : notice.Title, "gacha-character", match.Groups["start"].Value, match.Groups["end"].Value);
    }

    private static IEnumerable<Banner> BlueArchiveJapan(OfficialNotice notice)
    {
        if (!notice.Title.StartsWith("ピックアップ募集紹介", StringComparison.Ordinal)) yield break;
        var period = Regex.Match(notice.Text, @"▼実施期間\s+(?<start>[^\n]+?)\s*[~～]\s*(?<end>\d{4}年\d{1,2}月\d{1,2}日[^\n]*)");
        if (!period.Success) yield break;
        foreach (Match name in Regex.Matches(notice.Text, @"ピックアップ名[：:]\s*[「『](?<title>[^」』]+)[」』]"))
            yield return new(name.Groups["title"].Value, "gacha-character", period.Groups["start"].Value, period.Groups["end"].Value);
    }

    private static IEnumerable<Banner> BlueArchiveGlobal(OfficialNotice notice)
    {
        if (!notice.Title.Contains("Pick-Up Recruitment Notice", StringComparison.Ordinal) || notice.PublishedAt is null) yield break;
        var sections = Regex.Split(notice.Text, @"(?=\* (?:Unique )?Pick-Up Recruitment Period:)");
        foreach (string section in sections.Skip(1))
        {
            var period = Regex.Match(section, @"^\* (?:Unique )?Pick-Up Recruitment Period:\s*(?<sm>\d{1,2})/(?<sd>\d{1,2})\s*\([^)]*\)\s*(?<st>\d{1,2}:\d{2}\s*[AP]M|After Maintenance)\s*[–-]\s*(?<em>\d{1,2})/(?<ed>\d{1,2})\s*\([^)]*\)\s*(?<et>\d{1,2}:\d{2}\s*[AP]M)\s*\(UTC\)");
            if (!period.Success) continue;
            var start = GlobalTime(period, "s", notice.PublishedAt.Value.Year);
            int endYear = int.Parse(period.Groups["em"].Value, CultureInfo.InvariantCulture) < int.Parse(period.Groups["sm"].Value, CultureInfo.InvariantCulture)
                ? notice.PublishedAt.Value.Year + 1 : notice.PublishedAt.Value.Year;
            var end = GlobalTime(period, "e", endYear);
            string raw = period.Value.Trim();
            foreach (Match name in Regex.Matches(section, @"(?:^|\n)\d+\)\s*(?:\[Returning\]\s*)?(?<title>[^\n]+(?:Unique )?Pick-Up Recruitment)"))
                yield return new(name.Groups["title"].Value, "gacha-character", raw, raw, start, end, "UTC");
        }
    }

    private static DateTimeOffset? GlobalTime(Match match, string prefix, int year)
    {
        string value = $"{year}/{match.Groups[prefix + "m"].Value}/{match.Groups[prefix + "d"].Value} {match.Groups[prefix + "t"].Value}";
        return DateTimeOffset.TryParseExact(value, "yyyy/M/d h:mm tt", CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out var time) ? time : null;
    }

    private static IEnumerable<Banner> Genshin(OfficialNotice notice)
    {
        if (!notice.Title.Contains("祈愿", StringComparison.Ordinal)) yield break;
        var name = Regex.Match(notice.Title, "「(?<name>[^」]+)」(?:活动)?祈愿");
        if (!name.Success || !notice.Text.Contains("祈愿获取概率", StringComparison.Ordinal)) yield break;
        string category = notice.Text.Contains("限定5星武器", StringComparison.Ordinal) ? "gacha-weapon" : "gacha-character";
        // Announcement images may contain the schedule; missing text is not a date range.
        yield return new(name.Groups["name"].Value, category, "", "");
    }

    private static IEnumerable<Banner> StarRail(OfficialNotice notice)
    {
        if (notice.Title.StartsWith("「星际幻宠」乐园：", StringComparison.Ordinal)
            && notice.Text.Contains("▌「星际潮玩」抽取活动说明", StringComparison.Ordinal))
        {
            var period = Regex.Match(notice.Text, @"■活动时间\s+(?<period>\d+\.\d+版本期间)");
            if (period.Success) yield return new("星际潮玩", "gacha-other", period.Groups["period"].Value, period.Groups["period"].Value);
            yield break;
        }
        if (!Regex.IsMatch(notice.Title, @"^\d+\.\d+版本活动跃迁")) yield break;
        var summaries = notice.Text.Split('\n').Where(line => line.StartsWith("限定5星角色", StringComparison.Ordinal)).ToArray();
        foreach (Match line in Regex.Matches(notice.Text, @"(?:^|\n)●\s*「(?<name>[^」]+)」(?<type>角色|光锥)活动跃迁期间，限定5星(?:角色|光锥)「(?<featured>[^」]+)」"))
        {
            string featured = line.Groups["featured"].Value;
            var matching = summaries.Where(value => value.Contains("「" + featured + "」", StringComparison.Ordinal)).ToArray();
            string? summary = matching.Length == 1 ? matching[0] : null;
            var period = Regex.Match(summary ?? "", @"跃迁时间为\s*(?<start>[^\n]+?)\s*-\s*(?<end>\d{4}/\d{2}/\d{2} \d{2}:\d{2})");
            yield return new(line.Groups["name"].Value, line.Groups["type"].Value == "角色" ? "gacha-character" : "gacha-weapon",
                period.Success ? period.Groups["start"].Value : "", period.Success ? period.Groups["end"].Value : "");
        }
    }

    private static IEnumerable<Banner> Zenless(OfficialNotice notice)
    {
        if (!Regex.IsMatch(notice.Title, @"^\d+\.\d+版本限时频段")) yield break;
        var period = Regex.Match(notice.Text, @"本期代理人与音擎调频活动时间为：(?<start>[^\n]+?)\s*[~～]\s*(?<end>\d{4}[/-]\d{2}[/-]\d{2} \d{2}:\d{2})");
        foreach (Match section in Regex.Matches(notice.Text, @"活动期间，限定S级(?<type>代理人|音擎)(?<names>[^\n]+?)以及默认A级"))
        {
            foreach (Match name in Regex.Matches(section.Groups["names"].Value, @"\[(?<name>[^\]]+)\]"))
                yield return new(name.Groups["name"].Value + " · " + section.Groups["type"].Value + "调频",
                    section.Groups["type"].Value == "代理人" ? "gacha-character" : "gacha-weapon",
                    period.Success ? period.Groups["start"].Value : "", period.Success ? period.Groups["end"].Value : "");
        }
    }

    private static IEnumerable<Banner> Endfield(OfficialNotice notice)
    {
        var period = Regex.Match(notice.Text, @"(?:▼//开放时间|· 开放时间：)\s*(?<start>[^\n]+?)\s+-\s+(?<end>[^\n]+)");
        if (!notice.Title.Contains("版本更新说明", StringComparison.Ordinal))
        {
            foreach (Match name in Regex.Matches(notice.Title, @"「(?<name>[^」]+)」(?<type>特许寻访|重构寻访#\d+|重构申领#\d+)"))
                yield return new(name.Value, name.Groups["type"].Value.Contains("申领", StringComparison.Ordinal) ? "gacha-weapon" : "gacha-character",
                    period.Success ? period.Groups["start"].Value : "", period.Success ? period.Groups["end"].Value : "");
            if (notice.Title.Contains("申领」限时特卖说明", StringComparison.Ordinal) && notice.Text.Contains("随机获得", StringComparison.Ordinal))
            {
                var name = Regex.Match(notice.Title, "「(?<name>[^」]+)」");
                var open = Regex.Match(notice.Text, @"· 开放时间：(?<value>[^\n]+)");
                string value = open.Groups["value"].Value;
                int ending = value.IndexOf("，于", StringComparison.Ordinal);
                if (name.Success) yield return new(name.Value, "gacha-weapon", ending < 0 ? value : value[..ending], ending < 0 ? "" : value[(ending + 1)..]);
            }
        }
    }

    private static IEnumerable<Banner> WutheringWaves(OfficialNotice notice)
    {
        if (!Regex.IsMatch(notice.Title, @"\d+\.\d+版本内容说明$")) yield break;
        foreach (Match name in Regex.Matches(notice.Text, @"可通过(?:\[|「)(?<name>[^\]」]+)(?:\]|」)(?<type>角色|武器)活动唤取获得"))
            yield return new(name.Groups["name"].Value, name.Groups["type"].Value == "角色" ? "gacha-character" : "gacha-weapon", "", "");
    }

    private static IEnumerable<Banner> NteGlobal(OfficialNotice notice)
    {
        if (!Regex.IsMatch(notice.Title, @"^Ver\. \d+\.\d+ .+ Patch Notes$")) yield break;
        int year = Regex.Match(notice.Url, @"/20\d{2}\d{4}/") is { Success: true } date
            ? int.Parse(date.Value[1..5], CultureInfo.InvariantCulture) : 0;
        foreach (string section in Regex.Split(notice.Text, @"(?=● )").Skip(1))
        {
            string heading = section.Split('\n')[0];
            string category = heading.Contains("Limited S-Class Character", StringComparison.Ordinal) ? "gacha-character"
                : heading.Contains("Limited S-Class Arc", StringComparison.Ordinal) ? "gacha-weapon"
                : heading.Contains("Mystery Box", StringComparison.Ordinal) || heading.Contains("Mystery Boxes", StringComparison.Ordinal) ? "gacha-other" : "";
            if (category.Length == 0) continue;
            var period = Regex.Match(section, @"Available: (?<start>[^\n]+?)\s*–\s*(?<end>[A-Z][a-z]+ \d{1,2}, \d{2}:\d{2}) \(UTC\+8\)");
            if (!period.Success) continue;
            string start = period.Groups["start"].Value, end = period.Groups["end"].Value;
            yield return new(heading[2..].Trim(), category, start + " (UTC+8)", end + " (UTC+8)",
                EnglishOffsetTime(start, year), EnglishOffsetTime(end, year), "UTC+08:00");
        }
    }

    private static IEnumerable<Banner> NteChina(OfficialNotice notice)
    {
        if (!Regex.IsMatch(notice.Title, @"《异环》\d+\.\d+版本「[^」]+」更新公告$")) yield break;
        foreach (string section in Regex.Split(notice.Text, @"(?=● )").Skip(1))
        {
            string heading = section.Split('\n')[0];
            string category = heading.Contains("限定S级角色", StringComparison.Ordinal) ? "gacha-character"
                : heading.Contains("限定S级弧盘", StringComparison.Ordinal) ? "gacha-weapon"
                : heading.Contains("盲盒", StringComparison.Ordinal) ? "gacha-other" : "";
            if (category.Length == 0) continue;
            var period = Regex.Match(section, @"(?:开放|活动)时间：(?<start>[^\n]+?)\s*-\s*(?<end>\d{1,2}月\d{1,2}日\d{2}:\d{2})");
            if (!period.Success) continue;
            yield return new(heading[2..].Trim(), category, period.Groups["start"].Value, period.Groups["end"].Value);
        }
    }

    private static DateTimeOffset? EnglishOffsetTime(string value, int year)
    {
        if (year == 0 || !DateTime.TryParseExact(year + " " + value, "yyyy MMMM d, HH:mm", CultureInfo.InvariantCulture, DateTimeStyles.None, out var clock)) return null;
        return new DateTimeOffset(clock, TimeSpan.FromHours(8));
    }
}
