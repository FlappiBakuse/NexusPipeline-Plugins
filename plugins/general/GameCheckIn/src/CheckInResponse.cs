using System.Text.Json;

namespace NexusPipeline.Plugin.GameCheckIn;

internal enum VerificationState { NoChallenge, ChallengeRequired, Incomplete, Unknown }

internal static class CheckInResponse
{
    internal static async Task<JsonDocument> ReadAsync(HttpResponseMessage response, CancellationToken token, Action<JsonElement>? inspect = null)
    {
        response.EnsureSuccessStatusCode();
        string? mediaType = response.Content.Headers.ContentType?.MediaType;
        if (mediaType is not "application/json" && !(mediaType?.EndsWith("+json", StringComparison.OrdinalIgnoreCase) ?? false))
            throw new JsonException("checkin.response_content_type");
        const int limit = 262144;
        if (response.Content.Headers.ContentLength > limit) throw new JsonException("checkin.response_size");
        await using Stream stream = await response.Content.ReadAsStreamAsync(token).ConfigureAwait(false);
        using var bytes = new MemoryStream();
        var buffer = new byte[8192];
        int count;
        while ((count = await stream.ReadAsync(buffer, token).ConfigureAwait(false)) != 0)
        {
            if (bytes.Length + count > limit) throw new JsonException("checkin.response_size");
            bytes.Write(buffer, 0, count);
        }
        JsonDocument document = JsonDocument.Parse(bytes.ToArray(), new JsonDocumentOptions { MaxDepth = 32 });
        try { inspect?.Invoke(document.RootElement); Validate(document.RootElement); return document; }
        catch { document.Dispose(); throw; }
    }

    internal static void Validate(JsonElement root)
    {
        if (root.ValueKind != JsonValueKind.Object || HoyoLabClient.ReadRetcode(root) == int.MinValue)
            throw new JsonException("checkin.response_schema");
        ValidateUnique(root);
    }

    private static void ValidateUnique(JsonElement element)
    {
        if (element.ValueKind == JsonValueKind.Object)
        {
            var names = new HashSet<string>(StringComparer.Ordinal);
            foreach (JsonProperty property in element.EnumerateObject())
            {
                if (!names.Add(property.Name)) throw new JsonException("checkin.response_duplicate");
                ValidateUnique(property.Value);
            }
        }
        else if (element.ValueKind == JsonValueKind.Array)
            foreach (JsonElement item in element.EnumerateArray()) ValidateUnique(item);
    }

    internal static VerificationState Verification(JsonElement root)
    {
        var scopes = new List<JsonElement> { root };
        if (root.TryGetProperty("data", out JsonElement data) && data.ValueKind != JsonValueKind.Null)
        {
            if (data.ValueKind != JsonValueKind.Object) return VerificationState.Unknown;
            scopes.Add(data);
            if (data.TryGetProperty("gt_result", out JsonElement nested))
            {
                if (nested.ValueKind != JsonValueKind.Object) return VerificationState.Unknown;
                scopes.Add(nested);
            }
        }
        bool risk = false, clear = false, complete = false, hasParameter = false, hasFields = false;
        foreach (JsonElement scope in scopes)
        {
            if (scope.TryGetProperty("risk_code", out JsonElement code))
            {
                if (code.ValueKind != JsonValueKind.Number || !code.TryGetInt32(out int value) || value < 0)
                    return VerificationState.Unknown;
                risk |= value != 0; clear |= value == 0;
            }
            if (scope.TryGetProperty("is_risk", out JsonElement flag))
            {
                if (flag.ValueKind is not (JsonValueKind.True or JsonValueKind.False)) return VerificationState.Unknown;
                risk |= flag.GetBoolean(); clear |= !flag.GetBoolean();
            }
            string? gt = null, challenge = null;
            foreach (string field in new[] { "gt", "challenge" })
            {
                if (!scope.TryGetProperty(field, out JsonElement parameter)) continue;
                hasFields = true;
                if (parameter.ValueKind != JsonValueKind.String) return VerificationState.Unknown;
                string? value = parameter.GetString();
                if (value is { Length: > 4096 }) return VerificationState.Unknown;
                if (field == "gt") gt = value; else challenge = value;
            }
            hasParameter |= !string.IsNullOrWhiteSpace(gt) || !string.IsNullOrWhiteSpace(challenge);
            complete |= !string.IsNullOrWhiteSpace(gt) && !string.IsNullOrWhiteSpace(challenge);
        }
        if (risk && clear || clear && hasParameter) return VerificationState.Unknown;
        if (risk) return complete ? VerificationState.ChallengeRequired : VerificationState.Incomplete;
        if (hasParameter || hasFields && !clear) return VerificationState.Unknown;
        return VerificationState.NoChallenge;
    }

    internal static bool? Signed(JsonDocument document)
    {
        if (!document.RootElement.TryGetProperty("data", out JsonElement data) || data.ValueKind != JsonValueKind.Object) return null;
        bool? result = null;
        foreach (string field in new[] { "is_sign", "isSign" })
        {
            if (!data.TryGetProperty(field, out JsonElement value)) continue;
            if (value.ValueKind is not (JsonValueKind.True or JsonValueKind.False)) return null;
            bool signed = value.GetBoolean();
            if (result.HasValue && result.Value != signed) return null;
            result = signed;
        }
        return result;
    }

    internal static CheckInResult Unconfirmed(string platform, string game) =>
        new(platform, game, "success_unconfirmed", "签到结果尚未确认，将先查询当天状态", false);
}
