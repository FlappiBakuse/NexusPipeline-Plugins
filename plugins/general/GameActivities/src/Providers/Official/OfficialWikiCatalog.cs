using System.Globalization;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;

namespace NexusPipeline.Plugin.GameActivities;

internal static class OfficialWikiCatalog
{
    public const string Endpoint = "https://api.kurobbs.com/wiki/core/homepage/getPage";

    public static OfficialResult WutheringWaves(OfficialNotice[] notices, JsonNode json)
    {
        if (json["code"]?.GetValue<int>() != 200 || json["data"]?["contentJson"]?["sideModules"] is not JsonArray modules)
            throw new ActivityException("official_schema_changed", 502);
        var updates = notices.Where(notice => Regex.IsMatch(notice.Title, @"\d+\.\d+版本内容说明$"))
            .OrderByDescending(notice => Version.Parse(Regex.Match(notice.Title, @"\d+\.\d+(?=版本内容说明$)").Value)).ToArray();
        if (updates.Length == 0) throw new ActivityException("official_progression_mismatch", 502);
        var update = updates[0];
        string version = Regex.Match(update.Title, @"\d+\.\d+(?=版本内容说明$)").Value;
        var source = GameSources.Resolve("wuthering-waves", "default");
        var announced = OfficialGachaParser.Parse(source, update, "publisher").ToArray();
        var result = new List<OfficialNotice>();
        var ids = new HashSet<string>(StringComparer.Ordinal);
        foreach (var (title, category) in new[] { ("角色活动唤取", "gacha-character"), ("武器活动唤取", "gacha-weapon") })
        {
            var section = modules.OfType<JsonObject>().Where(module => ActivityPolicy.Text(module["title"]) == title
                && ActivityPolicy.Text(module["type"]) == "events-side").ToArray();
            if (section.Length != 1 || section[0]["content"]?["tabs"] is not JsonArray { Count: > 0 and <= 12 } tabs)
                throw new ActivityException("official_schema_changed", 502);
            foreach (var tab in tabs.OfType<JsonObject>())
            {
                string name = ActivityPolicy.Text(tab["name"]).Trim();
                if (name.Length is < 1 or > 200 || ActivityPolicy.Text(tab["countDown"]?["type"]) != "no-repeat"
                    || tab["countDown"]?["dateRange"] is not JsonArray { Count: 2 } range)
                    throw new ActivityException("official_schema_changed", 502);
                string start = ActivityPolicy.Text(range[0]), end = ActivityPolicy.Text(range[1]);
                if (!DateTime.TryParseExact(start, "yyyy-MM-dd HH:mm", CultureInfo.InvariantCulture, DateTimeStyles.None, out var opening)
                    || !DateTime.TryParseExact(end, "yyyy-MM-dd HH:mm", CultureInfo.InvariantCulture, DateTimeStyles.None, out var closing) || closing <= opening)
                    throw new ActivityException("official_time_invalid", 502);
                string id = ActivityNormalizer.Hash(category + "/" + name + "/" + start);
                if (!ids.Add(id)) throw new ActivityException("official_identity_invalid", 502);
                var publisher = announced.SingleOrDefault(item => ActivityPolicy.Text(item["category"]) == category && ActivityPolicy.Text(item["title"]) == name);
                result.Add(new(name, title + "：" + name + "\n目录时间：" + start + " ~ " + end,
                    "https://wiki.kurobbs.com/mc/home#pool-" + id, "zh-CN", Endpoint,
                    Banner: new(id, category, start, end, "limited", publisher is null ? "missing" : "version-notice",
                        publisher is null ? null : update.Url, publisher is null ? null : ActivityPolicy.Text(publisher["eventId"])),
                    SourceNote: "Official community wiki homepage directory, maintained by wiki editors. Anonymous structured read; dateRange has no declared timezone. Linked character/weapon entries are not exact pool announcements."));
            }
            if (result.Count(item => item.Banner!.Category == category) != tabs.Count
                || !result.Any(item => item.Banner!.Category == category && announced.Any(candidate => ActivityPolicy.Text(candidate["category"]) == category
                    && ActivityPolicy.Text(candidate["title"]) == item.Title)))
                throw new ActivityException("official_progression_mismatch", 502);
        }
        return new([.. notices, .. result], "partial", "Publisher news and official community directory read.",
            new(Endpoint, ids.ToArray(), "Official community wiki homepage explicitly lists every current character and weapon pickup tab, including returning pools. Both categories are cross-checked with new pool names in the publisher's current version bulletin. This qualifies the displayed current phase; future phases and permanent pools are outside this directory. Wiki editor dates do not establish a server timezone or an actual maintenance completion time.", version, [update.Url]));
    }
}
