using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace NexusPipeline.Extensions.GameCheckIn;

[JsonConverter(typeof(SensitiveCaptureConverter<CredentialWebSession>))]
internal sealed record CredentialWebSession(string Platform, string? DeviceId = null, string? DistinctId = null)
{
    internal void Validate()
    {
        if (Platform == "skland" && Header(DeviceId, 16384) && DistinctId is null) return;
        if (Platform == "kuro" && DeviceId is null && (DistinctId is null || Header(DistinctId, 256))) return;
        throw new CheckInFailure("credential_web_context_invalid");
    }
    internal static bool Header(string? value, int maximum) => value is { Length: > 0 } && value.Length <= maximum && value.All(character => character is >= '!' and <= '~');
    public override string ToString() => "[credential web context]";
}
internal delegate void CredentialReader(ReadOnlySpan<char> value);

[JsonConverter(typeof(CredentialMaterialConverter))]
internal sealed class CredentialMaterial : IDisposable
{
    private char[]? characters;
    internal string Source { get; }
    internal string? MaskedAccount { get; }
    internal CredentialWebSession? Web { get; }
    internal CredentialMaterial(ReadOnlySpan<char> value, string source, string? maskedAccount = null, CredentialWebSession? web = null)
    {
        if (source is not ("manual" or "browser") || value.IsWhiteSpace() || Encoding.UTF8.GetByteCount(value) > 16384 ||
            value.Contains('\r') || value.Contains('\n') || maskedAccount?.Length > 128 || source == "manual" && web is not null)
            throw new CheckInFailure("credential_value_invalid");
        web?.Validate(); characters = value.ToArray(); Source = source; MaskedAccount = maskedAccount; Web = web;
    }
    internal void Use(CredentialReader reader)
    {
        lock (this) { ObjectDisposedException.ThrowIf(characters is null, this); reader(characters); }
    }
    internal CredentialMaterial Copy()
    {
        CredentialMaterial? copy = null; Use(value => copy = new(value, Source, MaskedAccount, Web)); return copy!;
    }
    internal byte[] Encode()
    {
        using var stream = new MemoryStream(); using var writer = new Utf8JsonWriter(stream);
        writer.WriteStartObject(); writer.WriteNumber("formatVersion", 1); writer.WriteString("source", Source);
        Use(value => writer.WriteString("value", value));
        if (MaskedAccount is not null) writer.WriteString("maskedAccount", MaskedAccount);
        if (Web is not null)
        {
            writer.WriteStartObject("web"); writer.WriteString("platform", Web.Platform);
            if (Web.DeviceId is not null) writer.WriteString("deviceId", Web.DeviceId);
            if (Web.DistinctId is not null) writer.WriteString("distinctId", Web.DistinctId);
            writer.WriteEndObject();
        }
        writer.WriteEndObject(); writer.Flush(); var encoded = stream.ToArray(); Array.Clear(stream.GetBuffer()); return encoded;
    }
    internal static CredentialMaterial Decode(ReadOnlyMemory<byte> bytes)
    {
        using var document = CheckInJson.Parse(bytes, 65536); var root = document.RootElement;
        if (CheckInJson.Property(root, "formatVersion", JsonValueKind.Number).GetInt32() != 1 ||
            root.EnumerateObject().Any(property => property.Name is not ("formatVersion" or "source" or "value" or "maskedAccount" or "web")))
            throw new CheckInFailure("credential_format_unsupported");
        CredentialWebSession? web = null;
        if (root.TryGetProperty("web", out var context))
        {
            if (context.ValueKind != JsonValueKind.Object || context.EnumerateObject().Any(property => property.Name is not ("platform" or "deviceId" or "distinctId")))
                throw new CheckInFailure("credential_web_context_invalid");
            web = new(CheckInJson.Property(context, "platform", JsonValueKind.String).GetString()!,
                context.TryGetProperty("deviceId", out var device) ? device.GetString() : null,
                context.TryGetProperty("distinctId", out var distinct) ? distinct.GetString() : null);
        }
        return new(CheckInJson.Property(root, "value", JsonValueKind.String).GetString(), CheckInJson.Property(root, "source", JsonValueKind.String).GetString()!,
            root.TryGetProperty("maskedAccount", out var masked) ? masked.GetString() : null, web);
    }
    public void Dispose() { lock (this) { if (characters is null) return; Array.Clear(characters); characters = null; } }
    public override string ToString() => "[credential material]";
}
internal sealed class CredentialMaterialConverter : JsonConverter<CredentialMaterial>
{
    public CredentialMaterialConverter() { }
    public override CredentialMaterial Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options) =>
        throw new NotSupportedException("credential_requires_encrypted_secret_owner");
    public override void Write(Utf8JsonWriter writer, CredentialMaterial value, JsonSerializerOptions options) =>
        throw new NotSupportedException("credential_requires_encrypted_secret_owner");
}
internal sealed class SensitiveCaptureConverter<T> : JsonConverter<T>
{
    public SensitiveCaptureConverter() { }
    public override T Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options) =>
        throw new NotSupportedException("credential_capture_requires_memory_owner");
    public override void Write(Utf8JsonWriter writer, T value, JsonSerializerOptions options) =>
        throw new NotSupportedException("credential_capture_requires_memory_owner");
}
