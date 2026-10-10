using System.Text.Json;
using NexusPipeline.Plugin.GameCheckIn.Credentials;

namespace NexusPipeline.Plugin.GameCheckIn.BrowserLogin;

internal static class CredentialValidation
{
    internal static string RawToken(string? value)
    {
        if (string.IsNullOrEmpty(value)) throw new CredentialException("credential_fields_missing");
        string unpadded = value.TrimEnd('=');
        if (!CredentialRecord.ValidValue(value) || value.Any(c => !char.IsAsciiLetterOrDigit(c) && c is not ('.' or '_' or '~' or '+' or '/' or '-' or '='))
            || unpadded.Length == 0 || value.Length - unpadded.Length > 2 || unpadded.Contains('=')) throw new CredentialException("secret_value_invalid");
        return value;
    }

    internal static string MaskIdentity(string platform, string? identity)
    {
        if (identity is not { Length: >= 4 and <= 32 } || !identity.All(char.IsAsciiDigit))
            throw new CredentialException("readonly_identity_unverified");
        int visible = identity.Length >= 6 ? 2 : 1;
        return platform + " · " + identity[..visible] + new string('*', Math.Min(12, identity.Length - visible * 2)) + identity[^visible..];
    }

    internal static JsonElement Property(JsonElement parent, string name, JsonValueKind kind)
    {
        if (parent.ValueKind != JsonValueKind.Object) throw new CredentialException("readonly_validation_failed");
        var matches = parent.EnumerateObject().Where(p => p.NameEquals(name)).ToArray();
        if (matches.Length != 1 || matches[0].Value.ValueKind != kind) throw new CredentialException("readonly_validation_failed");
        return matches[0].Value;
    }

    internal static void RequireCode(JsonDocument document, string field, int success, params int[] unauthenticated)
    {
        var value = Property(document.RootElement, field, JsonValueKind.Number);
        if (!value.TryGetInt32(out int code)) throw new CredentialException("readonly_validation_failed");
        if (code != success) throw new CredentialException(unauthenticated.Contains(code) ? "credential_not_authenticated" : "credential_rejected");
    }

    internal static async Task<JsonDocument> ReadResponseAsync(HttpResponseMessage response, CancellationToken token, bool requireSuccessStatus = true)
    {
        if (requireSuccessStatus && !response.IsSuccessStatusCode) throw new CredentialException(response.StatusCode is System.Net.HttpStatusCode.Unauthorized or System.Net.HttpStatusCode.Forbidden
            ? "credential_not_authenticated" : "readonly_validation_failed");
        const int limit = 262144;
        if (response.Content.Headers.ContentLength > limit) throw new CredentialException("readonly_validation_failed");
        await using var stream = await response.Content.ReadAsStreamAsync(token).ConfigureAwait(false);
        using var bytes = new MemoryStream();
        var buffer = new byte[8192];
        int count;
        while ((count = await stream.ReadAsync(buffer, token).ConfigureAwait(false)) != 0)
        {
            if (bytes.Length + count > limit) throw new CredentialException("readonly_validation_failed");
            bytes.Write(buffer, 0, count);
        }
        try { return JsonDocument.Parse(bytes.ToArray(), new JsonDocumentOptions { MaxDepth = 32 }); }
        catch (JsonException) { throw new CredentialException("readonly_validation_failed"); }
    }
}
