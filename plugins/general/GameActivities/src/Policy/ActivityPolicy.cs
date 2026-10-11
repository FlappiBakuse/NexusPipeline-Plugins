using System.Text.Json.Nodes;

namespace NexusPipeline.Plugin.GameActivities;

internal static class ActivityPolicy
{
    public static string Text(JsonNode? node) => node?.GetValue<string>() ?? "";
    public static DateTimeOffset? Instant(JsonNode? time) => DateTimeOffset.TryParse(Text(time?["instantUtc"]), out var result) ? result : null;
    public static DateTimeOffset? DisplayInstant(JsonNode? time) => Instant(time);
    public static string Status(JsonNode item, DateTimeOffset now)
    {
        var start = Instant(item["times"]?["start"]); var end = Instant(item["times"]?["playEnd"]);
        if (start is not null && end is not null && start >= end) return "unknown";
        if (end <= now) return "ended";
        if (start > now) return "upcoming";
        return start is not null && end is not null ? "ongoing" : "unknown";
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
