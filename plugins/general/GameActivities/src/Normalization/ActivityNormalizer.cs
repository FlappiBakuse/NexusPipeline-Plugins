using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;

namespace NexusPipeline.Plugin.GameActivities;

internal static class ActivityNormalizer
{
    public static readonly JsonSerializerOptions Json = new()
    {
        Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true
    };
    public static JsonObject Object(object value) => JsonSerializer.SerializeToNode(value, Json)!.AsObject();
    public static string Utc(DateTimeOffset now) => now.UtcDateTime.ToString("yyyy-MM-dd'T'HH:mm:ss'Z'", CultureInfo.InvariantCulture);
    public static string Hash(string text) => Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(text)));
    public static JsonObject Evidence(string field, string source, string locator, string transform = "normalized", string? rule = null) => Object(new { field, sourceRef = source, locator, transform, ruleId = rule, note = "" });
    public static JsonObject? Time(string? raw, string source, string? zone)
    {
        if (string.IsNullOrWhiteSpace(raw)) return null;
        bool offset = Regex.IsMatch(raw, @"(?:Z|[+-]\d{2}:\d{2})$");
        string? instant = null;
        string basis = "unknown";
        string certainty = "unknown";
        if (offset && DateTimeOffset.TryParse(raw, CultureInfo.InvariantCulture, DateTimeStyles.None, out var explicitTime))
        {
            instant = Utc(explicitTime);
            basis = raw.EndsWith('Z') ? "utc" : "explicit-offset";
            certainty = "reported";
        }
        else if (zone == "Asia/Shanghai" && DateTime.TryParseExact(raw, "yyyy-MM-dd'T'HH:mm:ss", CultureInfo.InvariantCulture, DateTimeStyles.None, out var date))
        {
            instant = Utc(new DateTimeOffset(date, TimeSpan.FromHours(8)));
            basis = "source-default";
            certainty = "reported";
        }
        string? sourceZone = basis == "unknown" ? null : offset ? (raw.EndsWith('Z') ? "UTC" : "UTC" + raw[^6..]) : zone;
        return Object(new
        {
            instantUtc = instant,
            rawValue = raw,
            timeBasis = basis,
            sourceZone,
            precision = instant is null ? "unknown" : "second",
            certainty,
            sourceRef = source
        });
    }
    public static JsonObject Normalize(GameSource source, JsonObject raw, DateTimeOffset now)
    {
        if (raw["dataClass"] is not null || raw["activities"] is not JsonArray activities || activities.Count > 250)
            throw new ActivityException("source_schema_invalid", 502);
        string sourceId = "sra:" + source.File.ToLowerInvariant();
        string stamp = Utc(now);
        string url = "https://starrailassistant.top/api/v1/activity/" + source.File + ".json";
        string number = ActivityPolicy.Text(raw["version"]);
        bool numbered = Regex.IsMatch(number, @"^\d+\.\d+(?:\.\d+)?$");
        string? period = numbered ? source.GameId + ":" + source.ProgressionId + ":" + number : null;
        JsonObject? contentPeriod = period is null ? null : Object(new
        {
            key = period,
            kind = "version",
            title = ActivityPolicy.Text(raw["versionName"]),
            provenance = new[]
            {
                Evidence("/title", sourceId, "/versionName"),
                Evidence("/key", sourceId, "/version", "derived", "sra-version-v1"),
                Evidence("/kind", sourceId, "/version", "derived", "sra-version-v1")
            }
        });
        JsonObject? version = period is null ? null : Object(new
        {
            key = period,
            number,
            title = ActivityPolicy.Text(raw["versionName"]),
            start = Time(ActivityPolicy.Text(raw["startTime"]), sourceId, source.SourceZone),
            end = Time(ActivityPolicy.Text(raw["endTime"]), sourceId, source.SourceZone),
            provenance = new[] { Evidence("/number", sourceId, "/version"), Evidence("/title", sourceId, "/versionName") }
        });
        var events = new JsonArray();
        for (int i = 0; i < activities.Count; i++)
        {
            if (activities[i] is not JsonObject item) throw new ActivityException("source_schema_invalid", 502);
            string title = ActivityPolicy.Text(item["name"]), kind = ActivityPolicy.Text(item["kind"]), description = ActivityPolicy.Text(item["description"]);
            if (title.Length is 0 or > 256) throw new ActivityException("source_schema_invalid", 502);
            string category = kind switch { "叙事活动" or "剧情活动" => "story", "挑战活动" => "combat", "签到活动" => "login", "双倍活动" => "resource-bonus", "通行证" => "battle-pass", "角色跃迁" or "角色祈愿" => "gacha-character", "武器祈愿" or "光锥跃迁" => "gacha-weapon", _ => "other" };
            var narrative = SraNarrative.Classify(item, i);
            if (narrative.Importance != "unknown") category = narrative.Category;
            string importance = narrative.Importance;
            string start = ActivityPolicy.Text(item["startTime"]), end = ActivityPolicy.Text(item["endTime"]);
            var provenance = new JsonArray(
                Evidence("/title", sourceId, $"/activities/{i}/name"),
                Evidence("/channel", sourceId, $"/activities/{i}", "derived", "sra-channel-v2"),
                Evidence("/category", sourceId, narrative.Locator, "derived", "sra-narrative-text-v1"),
                Evidence("/importance", sourceId, narrative.Locator, "derived", "sra-narrative-text-v1"),
                Evidence("/versionRelation", sourceId, $"/activities/{i}", "derived", "unverified-period-v1"));
            if (description.Length > 0) provenance.Add(Evidence("/description", sourceId, $"/activities/{i}/description"));
            events.Add(Object(new
            {
                eventId = "sra:" + Hash(source.GameId + "/" + source.ProgressionId + "/" + title.Normalize() + "/" + start),
                title,
                description = description.Length == 0 ? null : description[..Math.Min(8000, description.Length)],
                descriptionTruncated = description.Length > 8000,
                channel = kind.Contains("网页", StringComparison.Ordinal) || title.Contains("网页活动", StringComparison.Ordinal) ? "web" : "in-game",
                category,
                availability = "limited",
                importance,
                isOfficialFeatured = false,
                versionRelation = "unknown",
                periodKey = (string?)null,
                times = new
                {
                    start = Time(start, sourceId, source.SourceZone),
                    playEnd = Time(end, sourceId, source.SourceZone),
                    claimEnd = (object?)null
                },
                cover = (object?)null,
                officialUrl = (string?)null,
                officialLinkKind = "missing",
                provenance
            }));
        }
        var feed = Object(new
        {
            formatVersion = 1,
            pluginId = "game-activities",
            dataClass = "live",
            snapshotId = new string('0', 64),
            gameId = source.GameId,
            progressionId = source.ProgressionId,
            contentLocale = source.Locale,
            builtAt = stamp,
            contentPeriod,
            version,
            overview = new
            {
                title = ActivityPolicy.Text(raw["versionName"]),
                number = numbered ? number : null,
                start = Time(ActivityPolicy.Text(raw["startTime"]), sourceId, source.SourceZone),
                end = Time(ActivityPolicy.Text(raw["endTime"]), sourceId, source.SourceZone),
                cover = (object?)null,
                sourceRef = sourceId,
                provenance = new[]
                {
                    Evidence("/title", sourceId, "/versionName"),
                    Evidence("/number", sourceId, "/version"),
                    Evidence("/start", sourceId, "/startTime"),
                    Evidence("/end", sourceId, "/endTime")
                }
            },
            sources = new[] { Object(new
            {
                sourceId,
                providerId = "sra",
                providerVersion = "1",
                kind = "aggregate",
                url,
                locale = source.Locale,
                retrievedAt = stamp,
                sourceUpdatedAt = (string?)null,
                note = source.SourceZone is null ? "Per-field server time basis unverified"
                    : "Reported source-default Asia/Shanghai; SRA producer contract 18048aff9c2c518db112d1d69e23246164a66bc4. No end-second adjustment."
            }) },
            activities = events,
            coverage = new
            {
                events = new
                {
                    status = "partial", asOf = stamp, sourceRefs = new[] { sourceId },
                    note = "Aggregated curated list; categories and channel coverage are not complete."
                },
                gacha = new
                {
                    status = "not-checked", asOf = (string?)null, sourceRefs = Array.Empty<string>(),
                    note = "SRA list cannot establish banner coverage."
                }
            },
            primary = new { eventId = (string?)null, ruleId = "no-eligible-event", algorithmVersion = 1, computedAt = stamp },
            health = new
            {
                cacheState = "fresh",
                contentState = events.Count == 0 ? "empty" : "available",
                lastGoodAt = stamp,
                lastCheckedAt = stamp,
                nextCheckAt = Utc(now.AddHours(6)),
                diagnostics = new[] { new
                {
                    code = "coverage_partial", sourceRef = sourceId,
                    message = "Official coverage and current-period relation need independent evidence."
                } }
            }
        });
        SraNarrative.Associate(feed, raw, source, now);
        Finalize(feed, now);
        return feed;
    }
    public static void Finalize(JsonObject feed, DateTimeOffset now)
    {
        var referenced = ReferencedSources(feed);
        var sourceList = feed["sources"]!.AsArray();
        for (int i = sourceList.Count - 1; i >= 0; i--)
            if (!referenced.Contains(ActivityPolicy.Text(sourceList[i]?["sourceId"]))) sourceList.RemoveAt(i);
        var states = feed["activities"]!.AsArray().Select(item => ActivityPolicy.Status(item!, now)).ToArray();
        feed["health"]!["contentState"] = states.Length == 0 ? "empty" : states.All(value => value == "ended") ? "outdated" : "available";
        var primary = ActivityPolicy.Primary(feed, now);
        feed["primary"] = Object(new { eventId = primary.Id, ruleId = primary.Rule, algorithmVersion = 1, computedAt = Utc(now) });
        var content = feed.DeepClone().AsObject();
        foreach (var key in new[] { "snapshotId", "builtAt", "health", "primary" }) content.Remove(key);
        foreach (var item in content["sources"]!.AsArray()) item!.AsObject().Remove("retrievedAt");
        foreach (var item in content["coverage"]!.AsObject()) item.Value!.AsObject().Remove("asOf");
        content["sources"] = new JsonArray(content["sources"]!.AsArray().OrderBy(s => ActivityPolicy.Text(s?["sourceId"]), StringComparer.Ordinal).Select(s => s!.DeepClone()).ToArray());
        content["activities"] = new JsonArray(content["activities"]!.AsArray().OrderBy(s => ActivityPolicy.Text(s?["eventId"]), StringComparer.Ordinal).Select(s => s!.DeepClone()).ToArray());
        SortEvidence(content);
        feed["snapshotId"] = Hash(Canonical(content).ToJsonString(Json));
        Validate(feed);
        if (Encoding.UTF8.GetByteCount(feed.ToJsonString(Json)) > 524288) throw new ActivityException("feed_too_large", 502);
    }
    internal static HashSet<string> ReferencedSources(JsonNode node)
    {
        var result = new HashSet<string>(StringComparer.Ordinal);
        void Visit(JsonNode? value)
        {
            if (value is JsonObject obj) foreach (var pair in obj)
            {
                if (pair.Key == "sourceRef" && pair.Value is JsonValue) result.Add(ActivityPolicy.Text(pair.Value));
                else if (pair.Key == "sourceRefs" && pair.Value is JsonArray refs)
                    foreach (var source in refs) result.Add(ActivityPolicy.Text(source));
                else Visit(pair.Value);
            }
            else if (value is JsonArray array) foreach (var child in array) Visit(child);
        }
        Visit(node);
        return result;
    }
    private static void SortEvidence(JsonNode node)
    {
        if (node is JsonObject obj) foreach (var pair in obj.ToArray())
        {
            if (pair.Value is JsonArray array && pair.Key is "provenance" or "sourceRefs")
            {
                obj[pair.Key] = new JsonArray(array.OrderBy(item => pair.Key == "sourceRefs" ? ActivityPolicy.Text(item) : ActivityPolicy.Text(item?["field"]) + "\0" + ActivityPolicy.Text(item?["sourceRef"]) + "\0" + ActivityPolicy.Text(item?["locator"]), StringComparer.Ordinal).Select(item => item!.DeepClone()).ToArray());
            }
            if (obj[pair.Key] is { } value) SortEvidence(value);
        }
        else if (node is JsonArray list) foreach (var child in list) if (child is not null) SortEvidence(child);
    }
    private static JsonNode Canonical(JsonNode node) => node is JsonObject obj
        ? new JsonObject(obj.OrderBy(pair => pair.Key, StringComparer.Ordinal).Select(pair => new KeyValuePair<string, JsonNode?>(pair.Key, pair.Value is null ? null : Canonical(pair.Value))))
        : node is JsonArray array ? new JsonArray(array.Select(item => item is null ? null : Canonical(item)).ToArray()) : node.DeepClone();
    private static void Validate(JsonObject feed)
    {
        if (ActivityPolicy.Text(feed["dataClass"]) != "live") throw new ActivityException("synthetic_feed_rejected", 502);
        var sources = feed["sources"]!.AsArray();
        var sourceIds = sources.Select(item => ActivityPolicy.Text(item?["sourceId"])).ToHashSet(StringComparer.Ordinal);
        var events = feed["activities"]!.AsArray();
        if (sources.Count is < 1 or > 64 || sourceIds.Count != sources.Count || events.Count > 250 || events.Select(item => ActivityPolicy.Text(item?["eventId"])).Distinct().Count() != events.Count)
            throw new ActivityException("feed_identity_invalid", 502);
        foreach (var source in sources)
        {
            if (!Uri.TryCreate(ActivityPolicy.Text(source?["url"]), UriKind.Absolute, out var uri) || uri.Scheme != "https" || uri.UserInfo.Length > 0 || uri.Host.EndsWith(".invalid", StringComparison.Ordinal) || ActivityPolicy.Text(source?["kind"]) == "synthetic")
                throw new ActivityException("feed_source_invalid", 502);
        }
        foreach (var item in events)
        {
            foreach (var evidence in item!["provenance"]!.AsArray()) if (!sourceIds.Contains(ActivityPolicy.Text(evidence?["sourceRef"]))) throw new ActivityException("feed_source_missing", 502);
            var start = ActivityPolicy.Instant(item["times"]?["start"]);
            var end = ActivityPolicy.Instant(item["times"]?["playEnd"]);
            var claim = ActivityPolicy.Instant(item["times"]?["claimEnd"]);
            if (start >= end || claim < end) throw new ActivityException("feed_time_invalid", 502);
            foreach (var time in item["times"]!.AsObject()) if (time.Value is not null && !sourceIds.Contains(ActivityPolicy.Text(time.Value["sourceRef"]))) throw new ActivityException("feed_source_missing", 502);
        }
    }

}
