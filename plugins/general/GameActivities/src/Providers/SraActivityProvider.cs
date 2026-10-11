using System.Text.Json.Nodes;
namespace NexusPipeline.Plugin.GameActivities;

internal sealed class SraActivityProvider(ActivityHttp http)
{
    public async Task<JsonObject> ReadAsync(GameSource source, CancellationToken ct)
    {
        var response = await http.ReadAsync(source.Endpoint, null, 4194304, ct).ConfigureAwait(false);
        return JsonNode.Parse(response.Bytes) as JsonObject ?? throw new ActivityException("sra_response_invalid", 502);
    }
}
