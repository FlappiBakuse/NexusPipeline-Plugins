using System.Text.Json.Nodes;
using System.Text.RegularExpressions;

namespace NexusPipeline.Plugin.GameActivities;

internal static class SraNarrative
{
    public static (string Category, string Importance, string Locator) Classify(JsonObject item, int index)
    {
        string kind = ActivityPolicy.Text(item["kind"]), title = ActivityPolicy.Text(item["name"]), description = ActivityPolicy.Text(item["description"]);
        string text = title + "\n" + description;
        string locator = kind.Length > 0 ? $"/activities/{index}/kind" : $"/activities/{index}/name+/description";
        if (Regex.IsMatch(kind + "\n" + text, @"魔神任务|开拓任务|主线(?:任务|剧情|章节|更新)|\b(?:archon quest|trailblaze mission|main story|main quest)\b", RegexOptions.IgnoreCase))
            return ("story", "major-story", locator);
        if (Regex.IsMatch(kind + "\n" + text, @"叙事活动|剧情活动|活动剧情|活动故事|主题剧情|剧情故事|\b(?:story event|event story|story chapter)\b", RegexOptions.IgnoreCase))
            return ("story", "story", locator);
        string category = kind switch
        {
            "挑战活动" => "combat",
            "签到活动" => "login",
            "双倍活动" => "resource-bonus",
            "通行证" => "battle-pass",
            "角色跃迁" or "角色祈愿" => "gacha-character",
            "武器祈愿" or "光锥跃迁" => "gacha-weapon",
            _ => "other"
        };
        return (category, "unknown", locator);
    }
    public static bool MatchesTopic(string title, string topic) => topic.Length >= 2 && Clean(title).Contains(Clean(topic), StringComparison.OrdinalIgnoreCase);
    private static string Clean(string value) => Regex.Replace(value.Normalize(), "[\\s「」『』《》【】“”\"·]", "");

    public static void Associate(JsonObject feed, JsonObject raw, GameSource source, DateTimeOffset now)
    {
        string sourceId = "sra:" + source.File.ToLowerInvariant(), topic = ActivityPolicy.Text(raw["versionName"]);
        var events = feed["activities"]!.AsArray().OfType<JsonObject>().ToArray();
        bool activeTopic = topic.Length > 0 && events.Any(item =>
            ActivityPolicy.Text(item["importance"]) is "major-story" or "story"
            && MatchesTopic(ActivityPolicy.Text(item["title"]), topic)
            && ActivityPolicy.Status(item, now) == "ongoing");
        if (feed["contentPeriod"] is null && activeTopic)
        {
            feed["contentPeriod"] = ActivityNormalizer.Object(new
            {
                key = source.GameId + ":" + source.ProgressionId + ":topic:" + ActivityNormalizer.Hash(topic)[..24],
                kind = "campaign",
                title = topic,
                provenance = new[]
                {
                    ActivityNormalizer.Evidence("/title", sourceId, "/versionName"),
                    ActivityNormalizer.Evidence("/key", sourceId, "/activities", "derived", "sra-active-narrative-topic-v1"),
                    ActivityNormalizer.Evidence("/kind", sourceId, "/version", "derived", "sra-active-narrative-topic-v1")
                }
            });
        }
        string period = ActivityPolicy.Text(feed["contentPeriod"]?["key"]);
        if (period.Length == 0) return;
        var versionStart = ActivityPolicy.Instant(feed["version"]?["start"]);
        var versionEnd = ActivityPolicy.Instant(feed["version"]?["end"]);
        foreach (var item in events)
        {
            var start = ActivityPolicy.Instant(item["times"]?["start"]);
            bool match = MatchesTopic(ActivityPolicy.Text(item["title"]), topic);
            bool window = versionStart is not null && versionEnd is not null && start >= versionStart && start < versionEnd;
            if (!match && !window) continue;
            if (feed["version"] is null && ActivityPolicy.Status(item, now) != "ongoing") continue;
            item["versionRelation"] = "current";
            item["periodKey"] = period;
            var evidence = item["provenance"]!.AsArray();
            string rule = match ? "sra-narrative-topic-match-v1" : "sra-version-start-window-v1";
            evidence.Add(ActivityNormalizer.Evidence("/versionRelation", sourceId, match ? "/versionName+/activities/name" : "/startTime+/endTime+/activities/startTime", "derived", rule));
            evidence.Add(ActivityNormalizer.Evidence("/periodKey", sourceId, "/versionName+/version", "derived", rule));
        }
    }
}
