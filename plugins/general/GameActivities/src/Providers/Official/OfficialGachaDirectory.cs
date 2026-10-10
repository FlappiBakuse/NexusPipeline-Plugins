using System.Text.Json.Nodes;
using System.Text.RegularExpressions;

namespace NexusPipeline.Plugin.GameActivities;

internal sealed record OfficialDirectoryProof(string Note, string[] SourceRefs);

internal static class OfficialGachaDirectory
{
    public static OfficialDirectoryProof? Qualify(JsonObject feed, OfficialResult official, GameSource source)
    {
        var events = feed["activities"]!.AsArray().OfType<JsonObject>().Where(ActivityPolicy.Gacha).ToArray();
        string version = ActivityPolicy.Text(feed["version"]?["number"]);
        string topic = ActivityPolicy.Text(feed["overview"]?["title"]).Trim('「', '」', ' ');
        if (source.GameId is "honkai-star-rail" or "zenless-zone-zero" && version.Length > 0)
        {
            var hoyo = HoyoPhase(feed, official, source, version, events);
            if (hoyo is not null) return hoyo;
        }
        foreach (var notice in official.Notices)
        {
            var expected = OfficialGachaParser.Parse(source, notice, Ref(notice)).ToArray();
            if (source.GameId == "blue-archive" && source.ProgressionId == "cn" && notice.Title.EndsWith("维护更新说明", StringComparison.Ordinal))
            {
                var proof = ChinaRecruitment(feed, official, source, notice, events);
                if (proof is not null) return proof;
            }
            if (source.GameId == "blue-archive" && source.ProgressionId == "global" && notice.Title.EndsWith(" Patch Notes", StringComparison.Ordinal)
                && feed["activities"]!.AsArray().OfType<JsonObject>().Any(item => !ActivityPolicy.Gacha(item) && ActivityPolicy.Text(item["officialUrl"]) == notice.Url))
            {
                int start = notice.Text.IndexOf("2. Student Recruitment\n", StringComparison.Ordinal);
                int end = start < 0 ? -1 : notice.Text.IndexOf("\n3. ", start, StringComparison.Ordinal);
                if (start < 0 || end <= start) continue;
                var schedules = Regex.Matches(notice.Text[start..end], @"(?:^|\n)- (?:\[Returning\] )?(?<title>[^\n]+?Recruitment) Schedule: (?<period>[^\n]+)").ToArray();
                var matched = schedules.Select(schedule =>
                {
                    var period = OfficialTimeParser.Range(schedule.Groups["period"].Value);
                    if (period is null) return Array.Empty<JsonObject>();
                    var endTime = OfficialTimeParser.Parse(period.PlayEnd, notice, Ref(notice));
                    return events.Where(item => ActivityPolicy.Text(item["title"]) == schedule.Groups["title"].Value
                        && ActivityPolicy.Instant(item["times"]?["playEnd"]) is { } actualEnd
                        && actualEnd == ActivityPolicy.Instant(endTime)).ToArray();
                }).ToArray();
                if (schedules.Length == 0 || matched.Any(items => items.Length != 1)) continue;
                string[] evidence = matched.SelectMany(items => items[0]["provenance"]!.AsArray()).Select(item => ActivityPolicy.Text(item?["sourceRef"]))
                    .Where(id => id.StartsWith("official:", StringComparison.Ordinal)).Distinct().ToArray();
                return new("Current global patch notes enumerate every new and returning pickup schedule; every named batch and UTC closing time is cross-checked against its dedicated recruitment announcement. Combined student pickups remain one pool. Permanent recruitment is outside this limited directory.", [Ref(notice), .. evidence]);
            }
            if (source.GameId == "neverness-to-everness" && version.Length > 0
                && Regex.IsMatch(notice.Title, @"(?<![0-9.])" + Regex.Escape(version) + @"(?![0-9.])")
                && (notice.Title.EndsWith(" Patch Notes", StringComparison.Ordinal) || notice.Title.EndsWith("更新公告", StringComparison.Ordinal)))
            {
                var headings = notice.Text.Split('\n').Where(line => line.StartsWith("● ", StringComparison.Ordinal)
                    && Regex.IsMatch(line, @"限定S级(?:角色|弧盘)|盲盒|Limited S-Class (?:Character|Arc)|Mystery Box")).ToArray();
                if (headings.Length == 0 || expected.Length != headings.Length || !AllPresent(expected, events)) continue;
                if (!expected.Any(item => ActivityPolicy.Text(item["category"]) == "gacha-character")
                    || !expected.Any(item => ActivityPolicy.Text(item["category"]) == "gacha-weapon")) continue;
                return new("Current version comprehensive patch notes: every announced limited character board, Arc program and mystery box heading has a separate parsed batch. Permanent pools are outside this directory; relative openings and server clocks are qualified separately.", [Ref(notice)]);
            }
            if (source.GameId == "blue-archive" && source.ProgressionId == "jp" && notice.Title.StartsWith("ピックアップ募集紹介", StringComparison.Ordinal))
            {
                var count = Regex.Match(notice.Text, @"計(?<count>\d+)名のピックアップ募集");
                var period = OfficialEventParser.LineRange(notice.Text, "▼実施期間");
                bool sameBatch = period is not null && feed["activities"]!.AsArray().OfType<JsonObject>().Where(item => !ActivityPolicy.Gacha(item))
                    .Any(item => ActivityPolicy.Text(item["times"]?["start"]?["rawValue"]) == period.Start);
                if (!sameBatch || !count.Success || expected.Length != int.Parse(count.Groups["count"].Value, System.Globalization.CultureInfo.InvariantCulture)
                    || !AllPresent(expected, events)) continue;
                return new("Current Japanese pickup announcement explicitly enumerates the number of students and all named pickup pools; every pool was parsed for the same event opening batch. Permanent Archive recruitment is outside this limited directory.", [Ref(notice)]);
            }
            if (source.GameId == "stella-sora" && topic.Length > 0 && notice.Title.EndsWith("维护更新说明", StringComparison.Ordinal)
                && notice.Text.Contains("「" + topic + "」", StringComparison.Ordinal))
            {
                int start = notice.Text.IndexOf("✦ 全新旅人与秘纹", StringComparison.Ordinal);
                int end = notice.Text.IndexOf("✦ 全新剧情", StringComparison.Ordinal);
                if (start < 0 || end <= start) continue;
                string[] names = Regex.Matches(notice.Text[start..end], @"限时招募活动「(?<name>[^」]+)」")
                    .Select(match => match.Groups["name"].Value).Distinct().ToArray();
                var details = official.Notices.Where(item => names.Any(name => item.Title == "「" + name + "」限时招募开启")).ToArray();
                var parsed = details.SelectMany(item => OfficialGachaParser.Parse(source, item, Ref(item))).ToArray();
                if (names.Length == 0 || details.Length != names.Length || parsed.Length != names.Length || !AllPresent(parsed, events)) continue;
                return new("Current campaign maintenance bulletin enumerates all new and returning limited traveler and sigil recruitments; every name is cross-checked against its individual structured detail and schedule. Permanent recruitments are outside this directory.", [Ref(notice), .. details.Select(Ref)]);
            }
            if (source.GameId == "arknights-endfield" && topic.Length > 0 && notice.Title == "「" + topic + "」版本更新说明")
            {
                int start = notice.Text.IndexOf("■ 全新寻访及申领", StringComparison.Ordinal);
                int end = notice.Text.IndexOf("■ 全新活动", StringComparison.Ordinal);
                if (start < 0 || end <= start) continue;
                string[] names = Regex.Matches(notice.Text[start..end], @"(?:^|\n)\d+\.「(?<name>[^」]+)」(?<type>特许寻访|重构寻访#\d+|重构申领#\d+)?")
                    .Select(match => match.Groups["name"].Value).ToArray();
                var matched = names.Select(name => events.Where(item => ActivityPolicy.Text(item["title"]).StartsWith("「" + name + "」", StringComparison.Ordinal)
                    || ActivityPolicy.Text(item["title"]) == name).ToArray()).ToArray();
                if (names.Length == 0 || matched.Any(items => items.Length != 1)) continue;
                string[] evidence = matched.SelectMany(items => items[0]["provenance"]!.AsArray())
                    .Select(item => ActivityPolicy.Text(item?["sourceRef"])).Where(id => id.StartsWith("official:", StringComparison.Ordinal)).Distinct().ToArray();
                return new("Current version comprehensive recruitment/arsenal section enumerates every special and reconstruction pool; each is cross-checked against its dedicated official notice. Carried count-based arsenal notices remain visible with their original unknown calendar end. Permanent basic recruitment is outside this directory.", [Ref(notice), .. evidence]);
            }
        }
        return null;
    }

    private static OfficialDirectoryProof? ChinaRecruitment(JsonObject feed, OfficialResult official, GameSource source, OfficialNotice update, JsonObject[] events)
    {
        int preload = update.Text.IndexOf("■ 资源预加载", StringComparison.Ordinal);
        if (preload < 0) return null;
        string resources = update.Text[preload..];
        bool currentBatch = feed["activities"]!.AsArray().OfType<JsonObject>().Where(item => !ActivityPolicy.Gacha(item))
            .Any(item =>
            {
                var title = Regex.Match(ActivityPolicy.Text(item["title"]), "【(?<title>[^】]+)】");
                if (!title.Success || !ActivityPolicy.Text(item["officialUrl"]).StartsWith("https://www.bluearchive-cn.com/news/", StringComparison.Ordinal)) return false;
                var lines = resources.Split('\n').Where(line => Clean(line).Contains("活动【" + Clean(title.Groups["title"].Value) + "】", StringComparison.Ordinal)).ToArray();
                if (lines.Length != 1) return false;
                var date = Regex.Match(lines[0], @"(?<date>\d{2}月\d{2}日\d{2}:\d{2})开启");
                return date.Success && Clean(ActivityPolicy.Text(item["times"]?["start"]?["rawValue"])) == date.Groups["date"].Value;
            });
        if (!currentBatch) return null;
        var parsed = official.Notices.SelectMany(notice => OfficialGachaParser.Parse(source, notice, Ref(notice))).ToArray();
        string[] names = Regex.Matches(update.Text[..preload], @"更新限时(?:限定)?招募【(?<name>[^】]+)】")
            .Select(match => match.Groups["name"].Value).ToArray();
        var matched = new List<JsonObject>();
        foreach (string name in names)
        {
            var batch = parsed.Where(item => ActivityPolicy.Text(item["title"]) == name).ToArray();
            if (batch.Length != 1) return null;
            matched.Add(batch[0]);
        }
        foreach (string line in resources.Split('\n').Where(line => line.Contains("招募活动", StringComparison.Ordinal)))
        {
            var start = Regex.Match(line, @"(?<date>\d{2}月\d{2}日\d{2}:\d{2})开启");
            var students = Regex.Matches(line, "【(?<name>[^】]+)】").Select(match => match.Groups["name"].Value).ToArray();
            if (!start.Success || students.Length == 0) return null;
            foreach (string student in students)
            {
                var notices = official.Notices.Where(notice => notice.Title.EndsWith("限时招募：" + student, StringComparison.Ordinal)).ToArray();
                if (notices.Length != 1) return null;
                var batch = OfficialGachaParser.Parse(source, notices[0], Ref(notices[0])).ToArray();
                if (batch.Length != 1 || Clean(ActivityPolicy.Text(batch[0]["times"]?["start"]?["rawValue"])) != start.Groups["date"].Value) return null;
                matched.Add(batch[0]);
            }
        }
        foreach (var special in new[] { (Summary: "3★必得招募", Title: "【预告】3★必得招募即将开启！"), (Summary: "3★限定成员必得招募", Title: "【预告】3★限定必得招募即将开启！") })
        {
            if (!update.Text[..preload].Contains("招募活动【" + special.Summary + "】", StringComparison.Ordinal)) continue;
            var notices = official.Notices.Where(notice => notice.Title == special.Title).ToArray();
            if (notices.Length != 1) return null;
            var batch = OfficialGachaParser.Parse(source, notices[0], Ref(notices[0])).ToArray();
            string opening = Regex.Match(update.Title, @"^\d{2}月\d{2}日").Value;
            if (batch.Length != 1 || opening.Length == 0 || !ActivityPolicy.Text(batch[0]["times"]?["start"]?["rawValue"]).StartsWith(opening, StringComparison.Ordinal)) return null;
            matched.Add(batch[0]);
        }
        if (names.Length == 0 || matched.Count == 0 || !AllPresent(matched.ToArray(), events)) return null;
        string[] evidence = matched.SelectMany(item => item["provenance"]!.AsArray()).Select(item => ActivityPolicy.Text(item?["sourceRef"])).Distinct().ToArray();
        return new("Domestic maintenance bulletin identifies the current preloaded event batch and enumerates new, festival, returning and guaranteed random recruitments. Each announced name/student, opening batch and ticket-use deadline is cross-checked with its dedicated notice. Free pulls share existing pools; direct student selection and permanent recruitment are outside this limited directory.", [Ref(update), .. evidence]);
    }

    private static OfficialDirectoryProof? HoyoPhase(JsonObject feed, OfficialResult official, GameSource source, string version, JsonObject[] events)
    {
        bool starRail = source.GameId == "honkai-star-rail";
        var updates = official.Notices.Where(notice => notice.Title.StartsWith(version + "版本", StringComparison.Ordinal)
            && notice.Title.EndsWith(starRail ? "版本更新说明" : "更新公告", StringComparison.Ordinal)).ToArray();
        var phases = official.Notices.Where(notice => notice.Title.StartsWith(version + (starRail ? "版本活动跃迁（" : "版本限时频段（"), StringComparison.Ordinal)).ToArray();
        if (updates.Length != 1 || phases.Length == 0) return null;
        foreach (var phase in phases)
        {
            int declared = starRail
                ? Regex.Matches(phase.Text, @"(?:^|\n)●\s*「[^」]+」(?:角色|光锥)活动跃迁期间").Count
                : Regex.Matches(phase.Text, @"活动期间，限定S级(?:代理人|音擎)(?<names>[^\n]+?)以及默认A级")
                    .Sum(section => Regex.Matches(section.Groups["names"].Value, @"\[[^\]]+\]").Count);
            var parsed = OfficialGachaParser.Parse(source, phase, Ref(phase)).ToArray();
            if (declared == 0 || parsed.Length != declared || !AllPresent(parsed, events)
                || !parsed.Any(item => ActivityPolicy.Text(item["category"]) == "gacha-character")
                || !parsed.Any(item => ActivityPolicy.Text(item["category"]) == "gacha-weapon")) return null;
        }
        var extras = new List<string>();
        if (starRail && updates[0].Text.Contains("星际潮玩", StringComparison.Ordinal))
        {
            var draws = official.Notices.Where(notice => notice.Title.StartsWith("「星际幻宠」乐园：", StringComparison.Ordinal)
                && notice.Text.Contains(version + "版本期间", StringComparison.Ordinal)
                && notice.Text.Contains("▌「星际潮玩」抽取活动说明", StringComparison.Ordinal)).ToArray();
            if (draws.Length != 1 || !feed["activities"]!.AsArray().OfType<JsonObject>().Any(item => ActivityPolicy.Text(item["category"]) == "gacha-other"
                && item["provenance"]!.AsArray().Any(evidence => ActivityPolicy.Text(evidence?["sourceRef"]) == Ref(draws[0])))) return null;
            extras.Add(Ref(draws[0]));
        }
        return new("Current version update and every published comprehensive phase announcement enumerate new and returning limited character and weapon pools. All named headings and their independent date ranges are parsed; any current pet draw is cross-checked separately. This proves the currently announced catalog, not unpublished future phases, permanent pools, server timezone or maintenance completion.",
            [Ref(updates[0]), .. phases.Select(Ref), .. extras]);
    }

    private static string Clean(string value) => Regex.Replace(value, @"\s", "");

    private static bool AllPresent(JsonObject[] expected, JsonObject[] actual) => expected.Length > 0
        && expected.All(item => actual.Any(candidate => ActivityPolicy.Text(candidate["eventId"]) == ActivityPolicy.Text(item["eventId"])))
        && expected.All(item => item["times"]?["start"] is not null && item["times"]?["playEnd"] is not null);
    private static string Ref(OfficialNotice notice) => "official:" + ActivityNormalizer.Hash(notice.Url)[..24];
}
