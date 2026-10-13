using System.Text.Json;

namespace NexusPipeline.Plugin.GameCheckIn;

internal sealed record CheckInFieldShape(string Type, bool? Empty);
internal sealed record CheckInRiskShape(string Path, int? RiskCode, bool? IsRisk,
    CheckInFieldShape Gt, CheckInFieldShape Challenge);
internal sealed record CheckInDiagnostic(string Platform, string Game, string Phase, int? HttpStatus,
    int? Retcode, bool? IsSign, string Classification, long ElapsedMs, int Attempt,
    IReadOnlyList<CheckInRiskShape> Scopes);

internal sealed class CheckInDiagnostics
{
    private readonly List<CheckInDiagnostic> _entries = [];
    internal IReadOnlyList<CheckInDiagnostic> Entries => _entries;
    internal void Response(string platform, string game, string phase, int? status, JsonElement? root, long elapsedMs)
    {
        if (_entries.Count >= 32 || platform is not ("os" or "cn") || GameDefinitions.Find(game) is null
            || phase is not ("roles" or "info" or "sign" or "confirm")) return;
        int? retcode = null;
        bool? signed = null;
        string classification = "invalid_response";
        var scopes = new List<CheckInRiskShape>();
        if (root is { ValueKind: JsonValueKind.Object } value)
        {
            int code = HoyoLabClient.ReadRetcode(value);
            if (code != int.MinValue) retcode = code;
            using JsonDocument document = JsonDocument.Parse(value.GetRawText());
            signed = CheckInResponse.Signed(document);
            classification = HoyoLabClient.ReadCommonResponse(document, platform, game)?.Code ?? "no_challenge";
            AddScope("root", value);
            if (value.TryGetProperty("data", out JsonElement data) && data.ValueKind == JsonValueKind.Object)
            {
                AddScope("data", data);
                if (data.TryGetProperty("gt_result", out JsonElement nested) && nested.ValueKind == JsonValueKind.Object)
                    AddScope("data.gt_result", nested);
            }
        }
        _entries.Add(new(platform, game, phase, status, retcode, signed, classification,
            Math.Clamp(elapsedMs, 0, 120000), 1, scopes));

        void AddScope(string path, JsonElement scope)
        {
            int? risk = scope.TryGetProperty("risk_code", out JsonElement code) && code.ValueKind == JsonValueKind.Number
                && code.TryGetInt32(out int number) ? number : null;
            bool? flag = scope.TryGetProperty("is_risk", out JsonElement value) && value.ValueKind is JsonValueKind.True or JsonValueKind.False
                ? value.GetBoolean() : null;
            scopes.Add(new(path, risk, flag, Shape(scope, "gt"), Shape(scope, "challenge")));
        }
    }

    private static CheckInFieldShape Shape(JsonElement scope, string name)
    {
        if (!scope.TryGetProperty(name, out JsonElement value)) return new("missing", null);
        return new(value.ValueKind.ToString().ToLowerInvariant(), value.ValueKind == JsonValueKind.String
            ? string.IsNullOrWhiteSpace(value.GetString()) : null);
    }
}
