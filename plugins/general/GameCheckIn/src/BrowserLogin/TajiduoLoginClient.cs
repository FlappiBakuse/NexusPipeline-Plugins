using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using NexusPipeline.Plugin.Abstractions;
using NexusPipeline.Plugin.GameCheckIn.Credentials;

namespace NexusPipeline.Plugin.GameCheckIn.BrowserLogin;

internal sealed class TajiduoLoginClient(IPluginHttpClientFactory http)
{
    private const string SdkKey = "89155cc4e8634ec5b1b6364013b23e3e";
    private const string SdkOrigin = "https://user.laohu.com";
    internal async Task<CredentialRecord?> LoginAsync(string mode, string phone, string value, string device, CancellationToken token)
    {
        if (mode is not ("send" or "sms" or "password") || phone.Length != 11 || !phone.All(char.IsAsciiDigit)
            || mode == "sms" && (value.Length is < 4 or > 8 || !value.All(char.IsAsciiDigit))
            || mode == "password" && (value.Length is < 1 or > 512 || value.Any(char.IsControl)))
            throw new CredentialException("tajiduo_login_input_invalid");
        using var sdk = http.CreateClient(new Uri(SdkOrigin), TimeSpan.FromSeconds(20));
        if (mode is "send" or "sms")
        {
            var fields = Fields(device, true);
            fields["cellphone"] = phone;
            if (mode == "send") { fields["areaCodeId"] = "1"; fields["type"] = "16"; }
            else fields["captcha"] = value;
            using var check = await SdkRequest(sdk, mode == "send" ? "/m/newApi/sendPhoneCaptchaWithOutLogin" : "/m/newApi/checkPhoneCaptchaWithOutLogin", fields, false, token);
            if (mode == "send") return null;
        }
        var body = Fields(device, false);
        if (mode == "password") { body["username"] = Encrypt(phone); body["password"] = Encrypt(value); }
        else { body["areaCodeId"] = "1"; body["captcha"] = Encrypt(value); body["cellphone"] = Encrypt(phone); body["type"] = "16"; }
        using var login = await SdkRequest(sdk, mode == "password" ? "/openApi/secureLogin" : "/openApi/sms/new/login", body, true, token);
        var result = CredentialValidation.Property(login.RootElement, "result", JsonValueKind.Object);
        string sdkToken = CredentialValidation.Property(result, "token", JsonValueKind.String).GetString()!;
        string identity = Identifier(result.GetProperty("userId"));
        if (!TajiduoCredential.Header(sdkToken) || !TajiduoCredential.Id(identity)) throw new CredentialException("readonly_identity_unverified");
        using var client = http.CreateClient(new Uri("https://bbs-api.tajiduo.com"), TimeSpan.FromSeconds(20));
        using var request = new HttpRequestMessage(HttpMethod.Post, "https://bbs-api.tajiduo.com/usercenter/api/login");
        request.Headers.Add("Accept", "application/json");
        TajiduoClient.NativeHeaders(request, "0", device);
        request.Content = new FormUrlEncodedContent(new Dictionary<string, string> { ["token"] = sdkToken, ["userIdentity"] = identity, ["appId"] = "10551" });
        using var response = await client.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, token);
        using var native = await CheckInResponse.ReadAsync(response, token, codeProperty: "code");
        CredentialValidation.RequireCode(native, "code", 0);
        var data = CredentialValidation.Property(native.RootElement, "data", JsonValueKind.Object);
        var credential = new TajiduoCredential(data.GetProperty("accessToken").GetString()!, data.GetProperty("refreshToken").GetString()!, Identifier(data.GetProperty("uid")), device);
        if (TajiduoCredential.Parse(credential.Encode()) is null) throw new CredentialException("readonly_identity_unverified");
        // Native login identifies the account without requiring a bound game or claiming a reward.
        return new(1, credential.Encode(), "browser", CredentialValidation.MaskIdentity("tajiduo", credential.Uid), DateTimeOffset.UtcNow, "2");
    }
    private static string Identifier(JsonElement value) => value.ValueKind == JsonValueKind.String ? value.GetString()! : value.ValueKind == JsonValueKind.Number ? value.GetRawText() : "";
    private static Dictionary<string, string> Fields(string device, bool seconds) => new()
    {
        ["adm"] = "", ["appId"] = "10550", ["bid"] = "com.pwrd.htassistant", ["channelId"] = "1", ["deviceId"] = device,
        ["deviceModel"] = "Pixel 6", ["deviceName"] = "Pixel 6", ["deviceSys"] = "14", ["deviceType"] = "Pixel 6", ["idfa"] = "",
        ["sdkVersion"] = "4.327.0", ["t"] = (seconds ? DateTimeOffset.UtcNow.ToUnixTimeSeconds() : DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()).ToString(System.Globalization.CultureInfo.InvariantCulture),
        [seconds ? "imei" : "mac"] = "", [seconds ? "versionCode" : "version"] = "17",
    };
    private static async Task<JsonDocument> SdkRequest(HttpClient client, string route, Dictionary<string, string> fields, bool keepEmpty, CancellationToken token)
    {
        fields["sign"] = Convert.ToHexString(MD5.HashData(Encoding.UTF8.GetBytes(string.Concat(fields.OrderBy(p => p.Key, StringComparer.Ordinal).Select(p => p.Value)) + SdkKey))).ToLowerInvariant();
        using var request = new HttpRequestMessage(HttpMethod.Post, SdkOrigin + route);
        request.Headers.TryAddWithoutValidation("User-Agent", "LaohuSDK/4.327.0 (android os 14;mobile  manufacturer Google; model Pixel 6) ");
        if (route == "/openApi/secureLogin") request.Headers.Add("robot-auth-type", "2");
        request.Content = new FormUrlEncodedContent(fields.Where(p => keepEmpty || p.Value.Length != 0));
        using var response = await client.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, token);
        var document = await CheckInResponse.ReadAsync(response, token, codeProperty: "code");
        try { CredentialValidation.RequireCode(document, "code", 0); return document; }
        catch { document.Dispose(); throw; }
    }
    private static string Encrypt(string value)
    {
        using var aes = Aes.Create(); aes.Key = Encoding.ASCII.GetBytes(SdkKey[^16..]);
        // The official Laohu SDK protocol requires AES ECB with PKCS7 padding.
        return Convert.ToBase64String(aes.EncryptEcb(Encoding.UTF8.GetBytes(value), PaddingMode.PKCS7));
    }
}
