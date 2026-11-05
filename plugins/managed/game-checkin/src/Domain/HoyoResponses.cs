using System.Text.Json;

namespace NexusPipeline.Extensions.GameCheckIn;

internal static class HoyoResponses
{
    internal static string? Error(JsonElement root)
    {
        var code = CheckInJson.Property(root, "retcode", JsonValueKind.Number);
        if (!code.TryGetInt32(out var number)) return "verification_state_unknown";
        if (number != 0) return number switch {
            -100 or -101 => "invalid_cookie", -500 => "rate_limited", -10002 => "game_not_available",
            -5003 => "success_unconfirmed", _ => "api_error" };
        return Challenge(root);
    }
    internal static bool? Signed(JsonElement root)
    {
        if (!root.TryGetProperty("data", out var data) || data.ValueKind != JsonValueKind.Object) return null;
        bool? signed = null;
        foreach (var name in new[] { "is_sign", "isSign" })
        {
            if (!data.TryGetProperty(name, out var value)) continue;
            if (value.ValueKind is not (JsonValueKind.True or JsonValueKind.False) || signed is { } previous && previous != value.GetBoolean()) return null;
            signed = value.GetBoolean();
        }
        return signed;
    }
    internal static bool FirstBind(JsonElement root)
    {
        if (!root.TryGetProperty("data", out var data) || data.ValueKind != JsonValueKind.Object) return false;
        return new[] { "first_bind", "firstBind" }.Any(name => data.TryGetProperty(name, out var value) && value.ValueKind == JsonValueKind.True);
    }
    private static string? Challenge(JsonElement root)
    {
        var nodes = new List<JsonElement> { root };
        if (root.TryGetProperty("data", out var data) && data.ValueKind != JsonValueKind.Null)
        {
            if (data.ValueKind != JsonValueKind.Object) return "verification_state_unknown";
            nodes.Add(data);
            if (data.TryGetProperty("gt_result", out var nested))
            { if (nested.ValueKind != JsonValueKind.Object) return "verification_state_unknown"; nodes.Add(nested); }
        }
        var flags = new List<bool>(); var anyField = false; var anyParameter = false; var complete = false;
        foreach (var node in nodes)
        {
            if (node.TryGetProperty("risk_code", out var code))
            {
                if (code.ValueKind != JsonValueKind.Number || !code.TryGetInt32(out var number) || number < 0) return "verification_state_unknown";
                flags.Add(number != 0);
            }
            if (node.TryGetProperty("is_risk", out var risk))
            { if (risk.ValueKind is not (JsonValueKind.True or JsonValueKind.False)) return "verification_state_unknown"; flags.Add(risk.GetBoolean()); }
            var parameters = new List<string>();
            foreach (var field in new[] { "gt", "challenge" })
            {
                if (!node.TryGetProperty(field, out var value)) { parameters.Add(""); continue; }
                anyField = true;
                if (value.ValueKind != JsonValueKind.String || value.GetString()!.Length > 4096) return "verification_state_unknown";
                parameters.Add(value.GetString()!);
            }
            anyParameter |= parameters.Any(value => !string.IsNullOrWhiteSpace(value));
            complete |= parameters.All(value => !string.IsNullOrWhiteSpace(value));
        }
        if (flags.Distinct().Count() > 1 || flags.Contains(false) && anyParameter) return "verification_state_unknown";
        if (flags.Contains(true)) return complete ? "captcha_required" : "challenge_incomplete";
        return anyParameter || anyField && !flags.Contains(false) ? "verification_state_unknown" : null;
    }
}
