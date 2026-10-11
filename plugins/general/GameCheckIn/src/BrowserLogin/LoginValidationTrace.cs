using System.Net;
using System.Text.Json;
using NexusPipeline.Plugin.Abstractions;

namespace NexusPipeline.Plugin.GameCheckIn.BrowserLogin;

internal sealed class LoginValidationTrace(string platform, string operation, IPluginLogger logger)
{
    private string _stage = "capture";
    private int? _http;
    private int? _business;
    internal void Stage(string stage) { _stage = stage; _http = null; _business = null; }
    internal void Response(HttpStatusCode status) => _http = (int)status;
    internal void Body(JsonElement root)
    {
        if (root.ValueKind != JsonValueKind.Object) return;
        foreach (string field in new[] { "retcode", "status", "code" })
            if (root.TryGetProperty(field, out var value) && value.ValueKind == JsonValueKind.Number && value.TryGetInt32(out int code)) { _business = code; break; }
    }
    internal void Finish(string result)
    {
        string id = Guid.TryParseExact(operation, "N", out _) ? operation : "-";
        string message = $"browser_validation platform={platform} operation={id} stage={_stage} http={_http?.ToString() ?? "-"} business={_business?.ToString() ?? "-"} result={result}";
        if (result == "ok") logger.Info(message); else logger.Warn(message);
    }
}
