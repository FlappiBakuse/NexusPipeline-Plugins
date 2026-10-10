using System.Text.Json.Nodes;

namespace NexusPipeline.Plugin.GameActivities;

internal sealed class SraActivityProvider(ActivityHttp http)
{
    public async Task<(JsonObject Raw, string? ETag, DateTimeOffset? LastModified)> FetchAsync(GameSource source, JsonObject? checkpoint, CancellationToken ct)
    {
        DateTimeOffset? lastModified = DateTimeOffset.TryParse(ActivityPolicy.Text(checkpoint?["lastModified"]), out var modified) ? modified : null;
        var response = await http.ReadAsync(new Uri("https://starrailassistant.top/api/v1/activity/" + source.File + ".json"), ActivityPolicy.Text(checkpoint?["etag"]) is { Length: > 0 } value ? value : null, 4194304, ct, lastModified: lastModified).ConfigureAwait(false);
        ct.ThrowIfCancellationRequested();
        if (response.NotModified) return (checkpoint?["raw"]?.DeepClone().AsObject() ?? throw new ActivityException("invalid_304", 502), response.ETag, response.LastModified);
        using var content = new MemoryStream(response.Bytes, false);
        var raw = await JsonNode.ParseAsync(content, cancellationToken: ct).ConfigureAwait(false) as JsonObject ?? throw new ActivityException("source_schema_invalid", 502);
        ct.ThrowIfCancellationRequested();
        if (raw["activities"] is not JsonArray) throw new ActivityException("source_schema_invalid", 502);
        return (raw, response.ETag, response.LastModified);
    }
}
