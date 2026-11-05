using System.Text.Json;
using System.Text.Json.Serialization;

namespace NexusPipeline.Extensions.GameActivities;

internal sealed record ActivityTimePoint(DateTimeOffset? InstantUtc, string RawValue, string TimeBasis, string? SourceZone);
internal sealed record ActivityOverview(string Title, string? Number, ActivityTimePoint? Start, ActivityTimePoint? End, string? CoverUrl);
internal sealed record ActivityEvent(string Id, string Title, string? Summary, string? Kind, ActivityTimePoint? Start,
    ActivityTimePoint? PlayEnd, string? CoverUrl);
internal sealed record ActivityContent(string FeedId, string SnapshotId, ActivityOverview Overview, ActivityEvent[] Events);
internal sealed record ActivityCache
{
    [JsonRequired] public int FormatVersion { get; init; } = 1;
    [JsonRequired] public string FeedId { get; init; } = "";
    public ActivityContent? Content { get; init; }
    public DateTimeOffset? LastGoodAt { get; init; }
    public DateTimeOffset? LastCheckedAt { get; init; }
    public DateTimeOffset NextCheckAt { get; init; }
    public int FailureCount { get; init; }
    public string[] Diagnostics { get; init; } = [];
    public Dictionary<string, DateTimeOffset> BoundaryChecks { get; init; } = new(StringComparer.Ordinal);
    internal ActivityCache Validate(ActivitySource source)
    {
        if (FormatVersion != 1 || FeedId != source.Id || FailureCount is < 0 or > 1000 || BoundaryChecks is null ||
            BoundaryChecks.Count > 1024 || BoundaryChecks.Keys.Any(key => key.Length != 64 || !key.All(Uri.IsHexDigit)) ||
            Diagnostics is null || Diagnostics.Length > 64 || Diagnostics.Any(value => value is null || value.Length > 128))
            throw new ActivityFailure("activity_cache_format_unsupported");
        if (Content is not { } content) return this;
        if (content.FeedId != source.Id || content.Overview is null || content.Events is null || content.Events.Length > 250 ||
            content.Events.Any(value => value is null) || content.SnapshotId != ActivityTimes.Hash(System.Text.Encoding.UTF8.GetString(
                ActivityJson.Bytes(content with { SnapshotId = "" }))) || ActivityJson.Bytes(content).Length > 850000)
            throw new ActivityFailure("activity_cache_content_invalid");
        return this;
    }
}

internal static class ActivityJson
{
    internal static readonly JsonSerializerOptions Options = new(JsonSerializerDefaults.Web)
        { UnmappedMemberHandling = JsonUnmappedMemberHandling.Disallow, PropertyNameCaseInsensitive = false, MaxDepth = 32 };
    internal static byte[] Bytes<T>(T value) => JsonSerializer.SerializeToUtf8Bytes(value, Options);
    internal static T Read<T>(ReadOnlyMemory<byte> bytes)
    {
        if (bytes.Length is < 1 or > 1048576) throw new ActivityFailure("activity_document_size_invalid");
        using var parsed = JsonDocument.Parse(bytes, new() { MaxDepth = 32 });
        RequireUnique(parsed.RootElement);
        return parsed.RootElement.Deserialize<T>(Options) ?? throw new ActivityFailure("activity_document_invalid");
    }
    internal static void RequireUnique(JsonElement value)
    {
        if (value.ValueKind == JsonValueKind.Object)
        {
            var names = new HashSet<string>(StringComparer.Ordinal);
            foreach (var property in value.EnumerateObject())
            { if (!names.Add(property.Name)) throw new ActivityFailure("activity_duplicate_json_property"); RequireUnique(property.Value); }
        }
        else if (value.ValueKind == JsonValueKind.Array) foreach (var item in value.EnumerateArray()) RequireUnique(item);
    }
}
