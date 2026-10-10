using System.Text.Json.Nodes;

namespace NexusPipeline.Plugin.GameActivities;

internal static class ActivityPolicy
{
    public static string Text(JsonNode? node) => node?.GetValue<string>() ?? "";
    public static bool Reliable(JsonNode? time) => time is not null && time["instantUtc"] is not null
        && Text(time["certainty"]) is "confirmed" or "reported" && Text(time["timeBasis"]) != "unknown"
        && Text(time["precision"]) is "second" or "minute";
    public static DateTimeOffset? Instant(JsonNode? time) => Reliable(time) && DateTimeOffset.TryParse(Text(time?["instantUtc"]), out var result) ? result : null;
    public static string Status(JsonNode item, DateTimeOffset now)
    {
        var start = Instant(item["times"]?["start"]); var end = Instant(item["times"]?["playEnd"]);
        if (end <= now) return "ended";
        if (start > now) return "upcoming";
        return "ongoing";
    }
    public static bool Gacha(JsonNode item) => Text(item["category"]).StartsWith("gacha-", StringComparison.Ordinal);
    private static int Importance(JsonNode item) => Text(item["importance"]) switch { "major-story" => 0, "story" => 1, "featured-gameplay" => 2, "routine" => 3, _ => 4 };
    public static JsonNode[] Order(IEnumerable<JsonNode> items, DateTimeOffset now) => items
        .OrderBy(item => Gacha(item) ? 0 : 1)
        .ThenBy(item => Status(item, now) switch { "ongoing" => 0, "upcoming" => 1, "ended" => 2, _ => 3 })
        .ThenBy(item => Status(item, now) switch
        {
            "ongoing" => Instant(item["times"]?["playEnd"])?.UtcTicks ?? long.MaxValue,
            "upcoming" => Instant(item["times"]?["start"])?.UtcTicks ?? long.MaxValue,
            "ended" => -(Instant(item["times"]?["playEnd"])?.UtcTicks ?? 0),
            _ => 0
        })
        .ThenBy(item => Status(item, now) == "ongoing" ? Importance(item) : 0)
        .ThenBy(item => Status(item, now) == "ongoing" ? Instant(item["times"]?["start"])?.UtcTicks ?? long.MaxValue : 0)
        .ThenBy(item => Status(item, now) == "unknown" ? Text(item["title"]).Normalize() : "", StringComparer.Ordinal)
        .ThenBy(item => Text(item["eventId"]), StringComparer.Ordinal).ToArray();
    public static (string? Id, string Rule) Primary(JsonObject feed, DateTimeOffset now)
    {
        string period = Text(feed["contentPeriod"]?["key"]);
        var ranked = (feed["activities"]?.AsArray() ?? []).OfType<JsonObject>().Select(item =>
        {
            string status = Status(item, now), importance = Text(item["importance"]), category = Text(item["category"]);
            bool current = period.Length > 0 && Text(item["periodKey"]) == period && Text(item["versionRelation"]) == "current";
            bool evidence = (item["provenance"]?.AsArray() ?? []).Any(p => Text(p?["field"]) == "/importance");
            bool featured = item["isOfficialFeatured"]?.GetValue<bool>() == true && (item["provenance"]?.AsArray() ?? []).Any(p => Text(p?["field"]) == "/isOfficialFeatured");
            int tier = 99;
            if (!Gacha(item) && category is not ("shop" or "battle-pass") && evidence)
            {
                if (status == "ongoing" && current) tier = importance switch { "major-story" => 1, "story" => 2, "featured-gameplay" => 3, _ => 99 };
                if (tier == 99 && status == "ongoing" && featured && importance is "major-story" or "story") tier = 4;
                if (tier == 99 && status == "ongoing" && (featured || importance == "featured-gameplay") && category is "combat" or "exploration" or "minigame") tier = 5;
                if (tier == 99 && status == "upcoming" && current && importance is "major-story" or "story") tier = 6;
            }
            return new { item, tier, featured };
        }).Where(value => value.tier < 99).OrderBy(value => value.tier).ThenByDescending(value => value.featured)
          .ThenBy(value => Text(value.item["availability"]) == "permanent" ? 1 : 0)
          .ThenBy(value => Instant(value.item["times"]?["playEnd"]) ?? DateTimeOffset.MaxValue)
          .ThenByDescending(value => Instant(value.item["times"]?["start"]))
          .ThenBy(value => Text(value.item["eventId"]), StringComparer.Ordinal).FirstOrDefault();
        return ranked is null ? (null, "no-eligible-event") : (Text(ranked.item["eventId"]), ranked.tier switch { 1 => "current-major-story", 2 => "current-story", 3 => "current-featured-gameplay", 4 => "carried-story", 5 => "ongoing-gameplay", _ => "upcoming-current-story" });
    }
    public static object Countdown(long deltaMs)
    {
        if (deltaMs <= 0) return new { unit = "ended", first = 0L, second = 0L };
        long seconds = Math.Max(1, deltaMs / 1000);
        return deltaMs >= 259200000 ? new { unit = "days", first = seconds / 86400, second = seconds % 86400 / 3600 }
            : deltaMs >= 3600000 ? new { unit = "hours", first = seconds / 3600, second = seconds % 3600 / 60 }
            : deltaMs >= 60000 ? new { unit = "minutes", first = seconds / 60, second = seconds % 60 }
            : new { unit = "seconds", first = seconds, second = 0L };
    }
}
