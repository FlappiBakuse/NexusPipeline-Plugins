using System.Text.Json;
using System.Text.Json.Serialization;

namespace NexusPipeline.Extensions.GameCheckIn;

[JsonConverter(typeof(SensitiveCaptureConverter<TajiduoCredential>))]
internal sealed record TajiduoCredential(string AccessToken, string RefreshToken, string Uid, string DeviceId, string? RoleId = null,
    string? SdkToken = null, string? SdkUid = null)
{
    internal static TajiduoCredential Parse(ReadOnlyMemory<byte> json)
    {
        using var document = CheckInJson.Parse(json, 16384); var root = document.RootElement;
        if (root.ValueKind != JsonValueKind.Object || root.EnumerateObject().Any(property => property.Name is not ("accessToken" or "refreshToken" or "uid" or "deviceId" or "roleId" or "sdkToken" or "sdkUid")))
            throw new CheckInFailure("tajiduo_native_credential_required");
        string Text(string name) => CheckInJson.Property(root, name, JsonValueKind.String).GetString()!;
        if (root.TryGetProperty("roleId", out var roleValue) && roleValue.ValueKind is not (JsonValueKind.Null or JsonValueKind.String))
            throw new CheckInFailure("tajiduo_native_credential_required");
        var credential = new TajiduoCredential(Text("accessToken"), Text("refreshToken"), Text("uid"), Text("deviceId"),
            Optional(root, "roleId"), Optional(root, "sdkToken"), Optional(root, "sdkUid"));
        if (!CredentialWebSession.Header(credential.AccessToken, 4096) || !CredentialWebSession.Header(credential.RefreshToken, 4096) ||
            !CredentialWebSession.Header(credential.DeviceId, 4096) || !Numeric(credential.Uid) || credential.RoleId is not null && !Numeric(credential.RoleId) ||
            (credential.SdkToken is null) != (credential.SdkUid is null) || credential.SdkToken is not null &&
            (!CredentialWebSession.Header(credential.SdkToken, 4096) || !Numeric(credential.SdkUid)))
            throw new CheckInFailure("tajiduo_native_credential_required");
        return credential;
    }
    internal static bool Numeric(string? value) => value is { Length: > 0 and <= 40 } && value.All(char.IsAsciiDigit);
    internal byte[] Encode() => CheckInJson.Bytes(new { AccessToken, RefreshToken, Uid, DeviceId, RoleId, SdkToken, SdkUid });
    private static string? Optional(JsonElement root, string name) => !root.TryGetProperty(name, out var value) || value.ValueKind == JsonValueKind.Null ? null :
        value.ValueKind == JsonValueKind.String ? value.GetString() : throw new CheckInFailure("tajiduo_native_credential_required");
    public override string ToString() => "[Tajiduo native credential]";
}
internal static class ManualCredentials
{
    internal static CredentialMaterial Prepare(string platform, string value)
    {
        CheckInCatalog.Platform(platform);
        if (platform is "skland" or "skport" or "kuro") LoginCapture.RawToken(value);
        else if (platform is "cn" or "os")
        {
            if (string.IsNullOrWhiteSpace(value) || value.Any(character => character is < ' ' or > '~')) throw new CheckInFailure("credential_value_invalid");
        }
        else
        {
            var bytes = System.Text.Encoding.UTF8.GetBytes(value);
            try { _ = TajiduoCredential.Parse(bytes); }
            finally { Array.Clear(bytes); }
        }
        return new(value, "manual");
    }
}
