using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace NexusPipeline.Extensions.GameCheckIn;

internal sealed class TajiduoAuthentication(ICheckInNetwork network, TimeProvider clock)
{
    private const string SdkKey = "89155cc4e8634ec5b1b6364013b23e3e";
    internal async Task SendCodeAsync(string phone, string device, CancellationToken cancellationToken)
    {
        Validate("send", phone, "");
        var fields = Fields(device, true); fields["cellphone"] = phone; fields["areaCodeId"] = "1"; fields["type"] = "16";
        using var response = await SdkAsync("/m/newApi/sendPhoneCaptchaWithOutLogin", fields, false, cancellationToken);
    }
    internal async Task<CredentialMaterial> LoginAsync(string mode, string phone, CredentialMaterial authenticationSecret,
        string device, CancellationToken cancellationToken)
    {
        if (mode is not ("sms" or "password")) throw new CheckInFailure("tajiduo_login_input_invalid");
        string value = ""; authenticationSecret.Use(characters => value = characters.ToString()); Validate(mode, phone, value);
        if (mode == "sms")
        {
            var check = Fields(device, true); check["cellphone"] = phone; check["captcha"] = value;
            using var response = await SdkAsync("/m/newApi/checkPhoneCaptchaWithOutLogin", check, false, cancellationToken);
        }
        var fields = Fields(device, false);
        if (mode == "password") { fields["username"] = Encrypt(phone); fields["password"] = Encrypt(value); }
        else { fields["areaCodeId"] = "1"; fields["captcha"] = Encrypt(value); fields["cellphone"] = Encrypt(phone); fields["type"] = "16"; }
        using var login = await SdkAsync(mode == "password" ? "/openApi/secureLogin" : "/openApi/sms/new/login", fields, true, cancellationToken);
        var result = CheckInJson.Property(login.RootElement, "result", JsonValueKind.Object);
        var sdkToken = CheckInJson.Property(result, "token", JsonValueKind.String).GetString(); var identity = CheckInJson.Id(result, "userId", 40);
        if (!CredentialWebSession.Header(sdkToken, 4096) || !TajiduoCredential.Numeric(identity)) throw new CheckInFailure("credential_identity_invalid");
        var headers = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase) { ["Accept"] = "application/json", ["AuthorizationV2"] = "" };
        TajiduoCheckIn.AddNativeHeaders(headers, "0", device, clock.GetUtcNow().ToUnixTimeSeconds(), Convert.ToHexStringLower(RandomNumberGenerator.GetBytes(4)));
        var form = EncodeForm(new() { ["token"] = sdkToken!, ["userIdentity"] = identity, ["appId"] = "10551" });
        using var native = await CheckInHttp.ReadAsync(network, new(new("https://bbs-api.tajiduo.com/usercenter/api/loginV2"), "POST", headers, form,
            "application/x-www-form-urlencoded"), cancellationToken);
        RequireCode(native.RootElement); var data = CheckInJson.Property(native.RootElement, "data", JsonValueKind.Object);
        var credential = new TajiduoCredential(CheckInJson.Property(data, "accessToken", JsonValueKind.String).GetString()!,
            CheckInJson.Property(data, "refreshToken", JsonValueKind.String).GetString()!, CheckInJson.Id(data, "uid", 40), device, SdkToken: sdkToken, SdkUid: identity);
        var bytes = credential.Encode(); var characters = Encoding.UTF8.GetChars(bytes);
        try
        {
            _ = TajiduoCredential.Parse(bytes); var uid = credential.Uid;
            if (uid.Length < 4) throw new CheckInFailure("credential_identity_invalid");
            var visible = uid.Length >= 6 ? 2 : 1;
            return new(characters, "browser", "tajiduo · " + uid[..visible] + new string('*', Math.Min(12, uid.Length - visible * 2)) + uid[^visible..]);
        }
        finally { Array.Clear(bytes); Array.Clear(characters); }
    }
    internal static void Validate(string mode, string phone, string value)
    {
        if (mode is not ("send" or "sms" or "password") || phone.Length != 11 || !phone.All(char.IsAsciiDigit) ||
            mode == "sms" && (value.Length is < 4 or > 8 || !value.All(char.IsAsciiDigit)) ||
            mode == "password" && (value.Length is < 1 or > 512 || value.Any(char.IsControl))) throw new CheckInFailure("tajiduo_login_input_invalid");
    }
    private Dictionary<string, string> Fields(string device, bool seconds)
    {
        if (!CredentialWebSession.Header(device, 4096)) throw new CheckInFailure("checkin_device_id_invalid");
        return new() { ["adm"] = "", ["appId"] = "10550", ["bid"] = "com.pwrd.htassistant", ["channelId"] = "1", ["deviceId"] = device,
            ["deviceModel"] = "Pixel 6", ["deviceName"] = "Pixel 6", ["deviceSys"] = "14", ["deviceType"] = "Pixel 6", ["idfa"] = "",
            ["sdkVersion"] = "4.327.0", ["t"] = (seconds ? clock.GetUtcNow().ToUnixTimeSeconds() : clock.GetUtcNow().ToUnixTimeMilliseconds()).ToString(System.Globalization.CultureInfo.InvariantCulture),
            [seconds ? "imei" : "mac"] = "", [seconds ? "versionCode" : "version"] = "19" };
    }
    private async Task<JsonDocument> SdkAsync(string route, Dictionary<string, string> fields, bool keepEmpty, CancellationToken cancellationToken)
    {
        var headers = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase) {
            ["User-Agent"] = "LaohuSDK/4.327.0 (android os 14;mobile manufacturer Google; model Pixel 6)" };
        if (route == "/openApi/secureLogin") headers["robot-auth-type"] = "2";
        fields["sign"] = Convert.ToHexStringLower(MD5.HashData(Encoding.UTF8.GetBytes(string.Concat(fields.OrderBy(pair => pair.Key, StringComparer.Ordinal).Select(pair => pair.Value)) + SdkKey)));
        var result = await CheckInHttp.ReadAsync(network, new(new("https://user.laohu.com" + route), "POST", headers,
            EncodeForm(fields.Where(pair => keepEmpty || pair.Value.Length > 0).ToDictionary()), "application/x-www-form-urlencoded"), cancellationToken);
        try { RequireCode(result.RootElement); return result; }
        catch { result.Dispose(); throw; }
        finally { fields.Clear(); }
    }
    private static byte[] EncodeForm(Dictionary<string, string> values) => Encoding.UTF8.GetBytes(string.Join("&",
        values.Select(pair => Uri.EscapeDataString(pair.Key) + "=" + Uri.EscapeDataString(pair.Value))));
    private static string Encrypt(string value)
    {
        using var aes = Aes.Create(); aes.Key = Encoding.ASCII.GetBytes(SdkKey[^16..]); var bytes = Encoding.UTF8.GetBytes(value);
        try { return Convert.ToBase64String(aes.EncryptEcb(bytes, PaddingMode.PKCS7)); }
        finally { Array.Clear(bytes); }
    }
    private static void RequireCode(JsonElement root)
    {
        var code = CheckInJson.Property(root, "code", JsonValueKind.Number);
        if (!code.TryGetInt32(out var number) || number != 0) throw new CheckInFailure("credential_not_authenticated");
    }
}
