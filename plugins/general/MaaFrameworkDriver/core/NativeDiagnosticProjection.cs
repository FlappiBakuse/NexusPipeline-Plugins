using System.Text.Json;
using System.Text.Json.Nodes;

namespace NexusPipeline.Plugin.MaaFrameworkDriver;

internal static class NativeDiagnosticProjection
{
    internal static JsonObject Project(string message, string details)
    {
        var fact = new JsonObject { ["message"] = message.Length <= 128 ? message : "diagnostic.message_truncated" };
        if (details.Length <= 64 * 1024)
        {
            try
            {
                using var detail = JsonDocument.Parse(details, new JsonDocumentOptions { MaxDepth = 16 });
                if (detail.RootElement.ValueKind != JsonValueKind.Object)
                    throw new JsonException("optional callback details must be an object");
                foreach (string key in new[] { "task_id", "node_id", "reco_id", "action_id" })
                    if (detail.RootElement.TryGetProperty(key, out var value))
                    {
                        if (value.ValueKind == JsonValueKind.Number && value.TryGetInt64(out long id)) fact[key] = id;
                        else fact["code"] = "diagnostic.details_invalid";
                    }
            }
            catch (JsonException) { fact["code"] = "diagnostic.details_invalid"; }
        }
        else fact["code"] = "diagnostic.details_truncated";
        return fact;
    }
}
