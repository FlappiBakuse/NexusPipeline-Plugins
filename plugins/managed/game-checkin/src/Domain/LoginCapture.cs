using System.Text;
using System.Text.Json.Serialization;

namespace NexusPipeline.Extensions.GameCheckIn;

[JsonConverter(typeof(SensitiveCaptureConverter<CapturedCookie>))]
internal sealed record CapturedCookie(string Domain, string Path, string Name, string Value)
{ public override string ToString() => "[captured cookie]"; }
[JsonConverter(typeof(SensitiveCaptureConverter<CapturedStorage>))]
internal sealed record CapturedStorage(string Origin, string Storage, string Key, string Value)
{ public override string ToString() => "[captured storage]"; }
[JsonConverter(typeof(SensitiveCaptureConverter<CapturedJsonValue>))]
internal sealed record CapturedJsonValue(string Id, string Value)
{ public override string ToString() => "[captured JSON value]"; }
[JsonConverter(typeof(SensitiveCaptureConverter<BrowserCredentialCapture>))]
internal sealed record BrowserCredentialCapture(CapturedCookie[] Cookies, CapturedStorage[] Storage, CapturedJsonValue[] JsonValues)
{ public override string ToString() => "[browser credential capture]"; }

internal static class LoginCapture
{
    internal static CredentialMaterial Normalize(string platform, BrowserCredentialCapture capture)
    {
        var policy = LoginPolicies.For(platform);
        if (capture.Cookies is null || capture.Storage is null || capture.JsonValues is null || capture.Cookies.Length > 10 || capture.Storage.Length > 2 || capture.JsonValues.Length > 1 ||
            capture.Cookies.Any(cookie => cookie is null || cookie.Value is null || cookie.Value.Length > 16384 || !policy.Cookies.Any(rule => rule.Domain == cookie.Domain && rule.Path == cookie.Path && rule.Name == cookie.Name)) ||
            capture.Storage.Any(storage => storage is null || storage.Value is null || storage.Value.Length > 32768 || !policy.Storage.Any(rule => rule.Origin == storage.Origin && rule.Storage == storage.Storage && rule.Key == storage.Key)) ||
            capture.JsonValues.Any(value => value is null || value.Value is null || value.Value.Length > 16384 || !policy.JsonRequests.Any(rule => rule.Id == value.Id)) ||
            capture.Cookies.Select(cookie => (cookie.Domain, cookie.Name)).Distinct().Count() != capture.Cookies.Length ||
            capture.Storage.Select(storage => (storage.Origin, storage.Key)).Distinct().Count() != capture.Storage.Length ||
            capture.JsonValues.Select(value => value.Id).Distinct().Count() != capture.JsonValues.Length)
            throw new CheckInFailure("credential_capture_invalid");
        return platform switch {
            "cn" or "os" => Cookie(platform, capture.Cookies),
            "kuro" => new(RawToken(capture.Storage.SingleOrDefault(storage => storage.Key == "auth_token")?.Value), "browser", web:
                new("kuro", DistinctId: capture.Storage.SingleOrDefault(storage => storage.Key == "distinct_id")?.Value)),
            "skland" or "skport" => Passport(platform, capture),
            _ => throw new CheckInFailure("credential_capture_invalid") };
    }
    private static CredentialMaterial Cookie(string platform, CapturedCookie[] cookies)
    {
        var grouped = cookies.Where(cookie => cookie.Value.Length > 0).GroupBy(cookie => cookie.Name, StringComparer.Ordinal).ToArray();
        if (grouped.Any(group => group.Select(cookie => cookie.Value).Distinct(StringComparer.Ordinal).Count() > 1))
            throw new CheckInFailure("credential_capture_ambiguous");
        var values = grouped.ToDictionary(group => group.Key, group => group.First().Value, StringComparer.Ordinal);
        if (values.Values.Any(value => !CredentialCharacters.Cookie(value)))
            throw new CheckInFailure("credential_value_invalid");
        var token = platform == "cn" ? "cookie_token" : "ltoken"; var id = platform == "cn" ? "account_id" : "ltuid";
        var ids = new[] { id, id + "_v2" }.Where(values.ContainsKey).Select(key => values[key]).Distinct(StringComparer.Ordinal).ToArray();
        if (ids.Length != 1 || ids[0].Length > 32 || !ids[0].All(char.IsAsciiDigit)) throw new CheckInFailure("credential_capture_ambiguous");
        bool Complete(string suffix) => cookies.Any(cookie => cookie.Name == token + suffix && cookie.Value.Length > 0 &&
            cookies.Any(other => other.Domain == cookie.Domain && other.Name == id + suffix && other.Value.Length > 0));
        var version = Complete("_v2") ? "_v2" : Complete("") ? "" : throw new CheckInFailure("credential_fields_missing");
        var names = new[] { token + version, id + version }.Concat(version == "_v2" ? [platform == "cn" ? "account_mid_v2" : "ltmid_v2"] : Array.Empty<string>());
        return new(string.Join("; ", names.Where(values.ContainsKey).Distinct().Select(name => name + "=" + values[name])), "browser");
    }
    private static CredentialMaterial Passport(string platform, BrowserCredentialCapture capture)
    {
        var value = RawToken(capture.JsonValues.SingleOrDefault()?.Value); CredentialWebSession? web = null;
        if (platform == "skland")
        {
            var device = capture.Storage.SingleOrDefault()?.Value ?? throw new CheckInFailure("credential_device_missing");
            using var document = CheckInJson.Parse(Encoding.UTF8.GetBytes(device), 32768);
            web = new("skland", CheckInJson.Property(document.RootElement, "id", System.Text.Json.JsonValueKind.String).GetString());
            web.Validate();
        }
        return new(value, "browser", web: web);
    }
    internal static string RawToken(string? value)
    {
        if (string.IsNullOrEmpty(value) || value.Length > 16384 || value.Any(character => !char.IsAsciiLetterOrDigit(character) && character is not ('.' or '_' or '~' or '+' or '/' or '-' or '=')))
            throw new CheckInFailure("credential_value_invalid");
        var unpadded = value.TrimEnd('=');
        if (unpadded.Length == 0 || value.Length - unpadded.Length > 2 || unpadded.Contains('=')) throw new CheckInFailure("credential_value_invalid");
        return value;
    }
}
