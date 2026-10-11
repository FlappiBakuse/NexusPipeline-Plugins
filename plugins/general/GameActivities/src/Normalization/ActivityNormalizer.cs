using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;

namespace NexusPipeline.Plugin.GameActivities;

internal static class ActivityNormalizer
{
    public static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);
    public static JsonObject Object(object value) => JsonSerializer.SerializeToNode(value, Json)!.AsObject();
    public static string Hash(string value) => Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(value)));
    public static string Utc(DateTimeOffset value) => value.ToUniversalTime().ToString("O", CultureInfo.InvariantCulture);
    private static string? Field(JsonObject value, string key)
    {
        if (value[key] is null) return null;
        if (value[key] is JsonValue scalar && scalar.TryGetValue<string>(out var text)) return text;
        throw new ActivityException("sra_response_invalid", 502);
    }
    public static JsonObject? Time(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return null;
        string value = raw.Trim();
        bool explicitZone = Regex.IsMatch(value, @"(?:Z|[+-]\d{2}:?\d{2})$", RegexOptions.IgnoreCase);
        bool valid = Regex.IsMatch(value, @"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?$", RegexOptions.IgnoreCase)
            && DateTimeOffset.TryParse(explicitZone ? value : value + "+08:00", CultureInfo.InvariantCulture, DateTimeStyles.None, out _);
        return Object(new { instantUtc = valid ? Utc(DateTimeOffset.Parse(explicitZone ? value : value + "+08:00", CultureInfo.InvariantCulture)) : null,
            rawValue = raw, timeBasis = valid ? explicitZone ? "explicit" : "source-default" : "unknown", sourceZone = valid && !explicitZone ? "UTC+8" : null });
    }
    private static JsonObject? Cover(string? url, string title) => SraImages.Allowed(url) ? Object(new { assetId = (string?)null, sourceUrl = url, alt = title }) : null;
    public static JsonObject BuildSra(GameSource source, JsonObject raw, DateTimeOffset now)
    {
        if (raw["activities"] is not JsonArray list || list.Count > 250) throw new ActivityException("sra_response_invalid", 502);
        string title = Field(raw, "versionName") ?? "";
        string? number = Field(raw, "version");
        if (string.IsNullOrWhiteSpace(title) && string.IsNullOrWhiteSpace(number)) throw new ActivityException("sra_response_invalid", 502);
        var activities = new JsonArray(); var occurrences = new Dictionary<string, int>();
        foreach (var node in list)
        {
            if (node is not JsonObject item) throw new ActivityException("sra_response_invalid", 502);
            string name = Field(item, "name") ?? "";
            if (string.IsNullOrWhiteSpace(name)) throw new ActivityException("sra_response_invalid", 502);
            string? start = Field(item, "startTime"); var point = Time(start);
            string identity = Hash(JsonSerializer.Serialize(new[] { source.GameId, source.ProgressionId, name, ActivityPolicy.Text(point?["instantUtc"]) is { Length: > 0 } instant ? instant : start ?? "" }));
            int occurrence = occurrences.GetValueOrDefault(identity); occurrences[identity] = occurrence + 1;
            activities.Add(Object(new { eventId = Hash(identity + "/" + occurrence), title = name, summary = Field(item, "description"), kind = Field(item, "kind"),
                times = new { start = point, playEnd = Time(Field(item, "endTime")) }, cover = Cover(Field(item, "cover"), name) }));
        }
        var feed = Object(new { formatVersion = 3, snapshotId = "", gameId = source.GameId, progressionId = source.ProgressionId, contentLocale = source.Locale,
            overview = new { overviewId = Hash(GameSources.Key(source) + "/" + number + "/" + title), title, number, start = Time(Field(raw, "startTime")), end = Time(Field(raw, "endTime")), cover = Cover(Field(raw, "cover"), title) },
            activities, source = new { provider = "sra", url = source.Endpoint.AbsoluteUri },
            health = new { cacheState = "fresh", contentState = activities.Count == 0 ? "empty" : "available", lastGoodAt = Utc(now), lastCheckedAt = Utc(now), nextCheckAt = Utc(now.AddHours(6)), diagnostics = Array.Empty<object>() } });
        Finalize(feed, now); return feed;
    }
    public static void Finalize(JsonObject feed, DateTimeOffset now)
    {
        var content = feed.DeepClone().AsObject(); content.Remove("snapshotId"); content.Remove("health");
        feed["snapshotId"] = Hash(content.ToJsonString(Json));
        if (Encoding.UTF8.GetByteCount(feed.ToJsonString(Json)) > 1048576) throw new ActivityException("feed_too_large", 502);
    }
}

internal static class SraImages
{
    private static readonly string[] Hosts = ["resource.starrailassistant.top", "i0.hdslb.com", "i1.hdslb.com", "i2.hdslb.com", "web.hycdn.cn", "aka.doubaocdn.com", "prod-alicdn-community.kurobbs.com", "webusstatic.yo-star.com", "sdk.hoyoverse.com"];
    public static bool Allowed(string? value) => Uri.TryCreate(value, UriKind.Absolute, out var url) && url.Scheme == "https"
        && url.IsDefaultPort && url.UserInfo.Length == 0 && Hosts.Contains(url.IdnHost, StringComparer.OrdinalIgnoreCase);
}
