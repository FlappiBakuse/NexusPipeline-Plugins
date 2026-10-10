using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace NexusPipeline.Plugin.GameCheckIn.Credentials;

internal sealed record CredentialRecord(int RecordVersion, string Value, string Source,
    string? MaskedAccount = null, DateTimeOffset? VerifiedAt = null, string? FlowVersion = null)
{
    internal const string Magic = "NXP-CREDENTIAL-RECORD/1\n";
    private static readonly JsonSerializerOptions Options = new(JsonSerializerDefaults.Web) { UnmappedMemberHandling = JsonUnmappedMemberHandling.Disallow };
    internal static bool ValidValue(string? value) => !string.IsNullOrWhiteSpace(value)
        && Encoding.UTF8.GetByteCount(value) <= 16384 && value.IndexOfAny(['\r', '\n']) < 0;
    internal static CredentialRecord? Decode(string? payload)
    {
        if (string.IsNullOrEmpty(payload)) return null;
        if (!payload.StartsWith(Magic, StringComparison.Ordinal))
            return ValidValue(payload) ? new(1, payload, "manual") : throw new CredentialException("credential_record_invalid");
        if (Encoding.UTF8.GetByteCount(payload) > 65536) throw new CredentialException("credential_record_invalid");
        try
        {
            using var document = JsonDocument.Parse(payload[Magic.Length..]);
            if (document.RootElement.ValueKind != JsonValueKind.Object) throw new JsonException();
            var properties = document.RootElement.EnumerateObject().Select(p => p.Name).ToArray();
            if (properties.Distinct(StringComparer.Ordinal).Count() != properties.Length) throw new JsonException();
            var record = JsonSerializer.Deserialize<CredentialRecord>(payload[Magic.Length..], Options);
            if (record is null || record.RecordVersion != 1 || !ValidValue(record.Value) || record.Source is not ("manual" or "browser")
                || record.MaskedAccount?.Length > 120 || record.FlowVersion?.Length > 64) throw new JsonException();
            return record;
        }
        catch (JsonException) { throw new CredentialException("credential_record_invalid"); }
    }
    internal string Encode()
    {
        string payload = Magic + JsonSerializer.Serialize(this, Options);
        _ = Decode(payload);
        return payload;
    }
}

internal sealed class CredentialException(string code) : Exception(code) { internal string Code { get; } = code; }
