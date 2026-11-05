using System.Text.Json;

namespace NexusPipeline.Extensions.GameActivities;

internal sealed record ParsedActivityContent(ActivityContent Content, string[] Diagnostics);

internal static class SraFeed
{
    private static string? Text(JsonElement value, string key, int limit = 16384)
    {
        if (!value.TryGetProperty(key, out var item) || item.ValueKind == JsonValueKind.Null) return null;
        if (item.ValueKind != JsonValueKind.String || item.GetString()!.Length > limit) throw new ActivityFailure("activity_source_field_invalid");
        return item.GetString();
    }
    private static string? Cover(JsonElement value, HashSet<string> diagnostics)
    {
        var url = Text(value, "cover", 2048);
        if (url is null or "") return null;
        if (ActivityCovers.Allowed(url)) return url;
        diagnostics.Add("activity_cover_origin_rejected"); return null;
    }
    internal static ParsedActivityContent Parse(ActivitySource source, ReadOnlyMemory<byte> bytes)
    {
        if (bytes.Length is < 1 or > 4194304) throw new ActivityFailure("activity_source_size_invalid");
        using var document = JsonDocument.Parse(bytes, new() { MaxDepth = 32 });
        var root = document.RootElement;
        ActivityJson.RequireUnique(root);
        if (root.ValueKind != JsonValueKind.Object || !root.TryGetProperty("activities", out var list) ||
            list.ValueKind != JsonValueKind.Array || list.GetArrayLength() > 250) throw new ActivityFailure("activity_source_shape_invalid");
        var title = Text(root, "versionName", 512) ?? ""; var version = Text(root, "version", 128);
        if (string.IsNullOrWhiteSpace(title) && string.IsNullOrWhiteSpace(version)) throw new ActivityFailure("activity_source_version_missing");
        var diagnostics = new HashSet<string>(StringComparer.Ordinal); var occurrences = new Dictionary<string, int>(StringComparer.Ordinal);
        var events = new List<ActivityEvent>();
        foreach (var item in list.EnumerateArray())
        {
            if (item.ValueKind != JsonValueKind.Object) throw new ActivityFailure("activity_source_event_invalid");
            var name = Text(item, "name", 512);
            if (string.IsNullOrWhiteSpace(name)) throw new ActivityFailure("activity_source_event_name_missing");
            var start = ActivityTimes.Parse(Text(item, "startTime", 256), source);
            var identity = ActivityTimes.Hash(JsonSerializer.Serialize(new[] { source.Id, name, start?.InstantUtc?.ToString("O") ?? start?.RawValue ?? "" }));
            var occurrence = occurrences.GetValueOrDefault(identity); occurrences[identity] = occurrence + 1;
            events.Add(new(ActivityTimes.Hash(identity + "/" + occurrence), name, Text(item, "description"), Text(item, "kind", 128), start,
                ActivityTimes.Parse(Text(item, "endTime", 256), source), Cover(item, diagnostics)));
        }
        var overview = new ActivityOverview(title, version, ActivityTimes.Parse(Text(root, "startTime", 256), source),
            ActivityTimes.Parse(Text(root, "endTime", 256), source), Cover(root, diagnostics));
        var content = new ActivityContent(source.Id, "", overview, events.ToArray());
        var encoded = ActivityJson.Bytes(content);
        if (encoded.Length > 850000) throw new ActivityFailure("activity_normalized_feed_too_large");
        return new(content with { SnapshotId = ActivityTimes.Hash(System.Text.Encoding.UTF8.GetString(encoded)) }, diagnostics.ToArray());
    }
}
