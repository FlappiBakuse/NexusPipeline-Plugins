using System.Text.Json.Nodes;
using System.Text.RegularExpressions;

namespace NexusPipeline.Plugin.GameActivities;

internal sealed record OfficialEventMatch(string Text, OfficialSchedule? Schedule, string LinkKind);

internal static class OfficialEventParser
{
    public static OfficialEventMatch? Match(GameSource source, JsonObject activity, OfficialNotice notice, string currentVersion = "")
    {
        string title = ActivityPolicy.Text(activity["title"]);
        string core = Core(title);
        if (source.GameId == "blue-archive") return BlueArchive(source, activity, notice, title, core);

        string? section = null;
        if (notice.Title == title || Quoted(notice.Title, core)) section = notice.Text;
        else
        {
            var lines = notice.Text.Split('\n');
            for (int i = 0; i < lines.Length; i++)
            {
                string heading = lines[i].TrimStart(' ', '■', '●', '▌', '✦', '-', '•');
                if (heading != title && heading != core && !Quoted(heading, core)) continue;
                if (heading.Length > core.Length + 45 || Regex.IsMatch(heading, @"修复|优化|获得|奖励|完成|问题|participate|obtain", RegexOptions.IgnoreCase)) continue;
                int end = i + 1;
                while (end < lines.Length && !Regex.IsMatch(lines[end], @"^[●✦■]|^- |^\d+[.、]「")) end++;
                var candidate = string.Join('\n', lines[i..end]);
                if (Schedule(candidate) is null) continue;
                section = candidate;
                break;
            }
        }
        if (section is null) return null;
        var schedule = Schedule(section);
        if (schedule is not null && !SameBatch(activity, schedule.Start, notice)
            && !SameVersionStart(activity, schedule.Start, notice, currentVersion)) return null;
        return new(section, schedule, notice.Title == title || Quoted(notice.Title, core) ? "exact-activity" : "version-notice");
    }

    private static OfficialEventMatch? BlueArchive(GameSource source, JsonObject activity, OfficialNotice notice, string title, string core)
    {
        if (source.ProgressionId == "cn")
        {
            string headline = Regex.Replace(notice.Title, @"^【预告】", "");
            headline = Regex.Replace(headline, @"^限时(?:复刻)?活动[：:]", "").Trim();
            if (Clean(headline) != Clean(core)) return null;
            var play = LineRange(notice.Text, "活动持续时间：");
            if (play is null || !SameBatch(activity, play.Start, notice)) return null;
            var claim = LineRange(notice.Text, "商店兑换时间：");
            return new(notice.Text, play with { ClaimEnd = claim?.PlayEnd }, "exact-activity");
        }
        if (source.ProgressionId == "jp")
        {
            // SRA localizes the Japanese title; this alias is restricted to the rerun and its opening batch.
            bool alias = Clean(title) == Clean("【复刻】「我们是神秘学研究会！ ～学院的不思议与古老的咒文～」")
                && notice.Title == "【復刻イベント】「我らオカルト研究会！ ～学院の不思議と古の呪文～」紹介";
            if (!alias && !Quoted(notice.Title, core)) return null;
            var play = LineRange(notice.Text, "▼開催期間");
            if (play is null || !SameBatch(activity, play.Start, notice)) return null;
            var claim = LineRange(notice.Text, "▼報酬交換期間");
            return new(notice.Text, play with { ClaimEnd = claim?.PlayEnd }, "exact-activity");
        }
        if (source.ProgressionId == "global")
        {
            // Both names identify the returning event in Nexon's English and Traditional Chinese patch notes.
            const string english = "A Flower Blooms Among the Hundred: Fair and Square Aquatic Showdown";
            bool alias = Clean(title) == Clean("百中绽放的一朵 ~光明正大的水上对决~ -复刻-");
            if (!alias || !notice.Title.Contains("Patch Notes", StringComparison.Ordinal)) return null;
            var header = Regex.Match(notice.Text, @"(?:^|\n)\d+\. Returning Event Story – " + Regex.Escape(english) + @"\n");
            if (!header.Success) return null;
            string section = notice.Text[(header.Index + header.Length)..];
            int next = Regex.Match(section, @"\n\d+\. ").Index;
            if (next > 0) section = section[..next];
            var play = LineRange(section, "- Event Period:");
            if (play is null || !SameBatch(activity, play.Start, notice)) return null;
            var claim = LineRange(section, "- Shop, Treasure Hunt, and Event Reward Claim and Exchange Period:");
            return new(english + "\n" + section, play with { ClaimEnd = claim?.PlayEnd }, "version-notice");
        }
        return null;
    }

    private static OfficialSchedule? Schedule(string section)
    {
        OfficialSchedule? play = null;
        foreach (string marker in new[] { "限时活动时间", "活动持续时间", "活动时间", "▼//活动时间", "▼開催期間", "Duration:", "Available:", "开放时间" })
        {
            play = LineRange(section, marker);
            if (play is not null) break;
        }
        if (play is null) return null;
        foreach (string marker in new[] { "活动商店与奖励兑换时间", "物资兑换处开放时间", "奖励领取时间", "奖励兑换时间", "商店兑换时间", "▼//奖励领取时间", "▼報酬交換期間" })
        {
            var claim = LineRange(section, marker);
            if (claim is not null) return play with { ClaimEnd = claim.PlayEnd };
        }
        return play;
    }

    internal static OfficialSchedule? LineRange(string text, string marker)
    {
        int start = text.IndexOf(marker, StringComparison.Ordinal);
        if (start < 0) return null;
        string remaining = text[(start + marker.Length)..].TrimStart(' ', ':', '：', '\n');
        string line = remaining.Split('\n')[0];
        return OfficialTimeParser.Range(line);
    }

    private static bool SameBatch(JsonObject activity, string start, OfficialNotice notice)
    {
        var date = Regex.Match(start, @"(?:20\d{2}[年/\-])?(?<month>\d{1,2})[月/\-](?<day>\d{1,2})(?:日)?");
        if (!date.Success)
        {
            var english = Regex.Match(start, @"^(?<month>January|February|March|April|May|June|July|August|September|October|November|December) (?<day>\d{1,2})");
            if (english.Success && DateTime.TryParseExact(english.Groups["month"].Value + " " + english.Groups["day"].Value, "MMMM d", System.Globalization.CultureInfo.InvariantCulture, System.Globalization.DateTimeStyles.None, out var calendar))
                date = Regex.Match(calendar.ToString("MM/dd", System.Globalization.CultureInfo.InvariantCulture), @"(?<month>\d{2})/(?<day>\d{2})");
        }
        var old = Regex.Match(ActivityPolicy.Text(activity["times"]?["start"]?["rawValue"]), @"^(?<year>20\d{2})-(?<month>\d{2})-(?<day>\d{2})");
        if (!date.Success || !old.Success) return false;
        int? year = OfficialTimeParser.Year(notice);
        return year?.ToString(System.Globalization.CultureInfo.InvariantCulture) == old.Groups["year"].Value
            && int.Parse(date.Groups["month"].Value, System.Globalization.CultureInfo.InvariantCulture) == int.Parse(old.Groups["month"].Value, System.Globalization.CultureInfo.InvariantCulture)
            && int.Parse(date.Groups["day"].Value, System.Globalization.CultureInfo.InvariantCulture) == int.Parse(old.Groups["day"].Value, System.Globalization.CultureInfo.InvariantCulture);
    }

    private static bool SameVersionStart(JsonObject activity, string start, OfficialNotice notice, string currentVersion)
    {
        string original = ActivityPolicy.Text(activity["times"]?["start"]?["rawValue"]);
        return currentVersion.Length > 0 && start.Contains(currentVersion + "版本更新后", StringComparison.Ordinal)
            && original.Length >= 4 && OfficialTimeParser.Year(notice)?.ToString(System.Globalization.CultureInfo.InvariantCulture) == original[..4];
    }

    private static string Core(string title)
    {
        var quoted = Regex.Match(title, @"[「【](?<core>[^」】]+)[」】]");
        if (quoted.Success && title[(quoted.Index + quoted.Length)..].IndexOfAny([':', '：']) >= 0) return title;
        if (quoted.Success && quoted.Groups["core"].Value != "复刻") return quoted.Groups["core"].Value;
        if (quoted.Success) title = title[(quoted.Index + quoted.Length)..];
        return title.Trim(' ', '「', '」');
    }

    private static string Clean(string value) => Regex.Replace(Regex.Replace(value.Normalize(), @"\\u[fF][eE][fF][fF]", ""), @"[\s\uFEFF]", "");
    private static bool Quoted(string heading, string core) => core.Length >= 3
        && Regex.IsMatch(heading, "[「【\"\\[]" + Regex.Escape(core) + "[」】\"\\]]");
}
