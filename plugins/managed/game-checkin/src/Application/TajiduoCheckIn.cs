using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace NexusPipeline.Extensions.GameCheckIn;

internal interface ICheckInCredentialRotation
{
    ValueTask<bool> PersistAsync(CredentialMaterial expected, CredentialMaterial replacement, CancellationToken cancellationToken);
}
internal sealed class TajiduoCheckIn(ICheckInNetwork network, ICheckInEffects effects, ICheckInCredentialRotation rotation, TimeProvider clock)
{
    internal async Task<CheckInGameResult> SignAsync(CredentialMaterial material, CancellationToken cancellationToken)
    {
        var submitted = false; var rotationUnknown = false;
        try
        {
            var credential = Read(material);
            if (credential.SdkToken is null || credential.SdkUid is null) return Result("tajiduo_sdk_credential_required");
            var gate = await CheckInEffectGate.BeginAsync(effects, "tajiduo", "nte", cancellationToken);
            if (gate.Result is not null) return gate.Result;
            if (gate.MaySubmit)
            {
                rotationUnknown = true;
                credential = await RefreshAsync(credential, material, cancellationToken);
                rotationUnknown = false;
            }
            using var roles = await RequestAsync(credential, "/usercenter/api/v2/getGameRoles?gameId=1289", false, true, null, cancellationToken);
            if (Code(roles.RootElement) != 0) return Result("api_error");
            var roleId = CheckInRoles.Tajiduo(roles.RootElement, credential.RoleId);
            var lease = await effects.AcquireAsync(new("tajiduo", "nte", roleId, "1289"), cancellationToken);
            if (lease.State == "confirmed") return await CheckInEffectGate.FinishAsync(effects, gate, Result("already", true, "confirmed"), cancellationToken);
            if (lease.State is not ("new" or "unknown")) return Result("effect_unavailable");
            using var before = await RequestAsync(credential, "/apihub/awapi/signin/state?gameId=1289", false, false, null, cancellationToken);
            var signed = Signed(before.RootElement);
            if (signed == true)
            {
                await effects.ConfirmedAsync(lease, "tajiduo_status_signed", cancellationToken);
                return await CheckInEffectGate.FinishAsync(effects, gate, Result("already", true, "confirmed"), cancellationToken);
            }
            if (lease.State == "unknown" || !gate.MaySubmit) return Result("effect_unknown", effect: "unknown");
            if (signed != false) return Result("verification_state_unknown");
            submitted = true; await effects.SubmittedAsync(lease, cancellationToken);
            using var sign = await RequestAsync(credential, "/apihub/awapi/sign", true, false,
                new() { ["gameId"] = "1289", ["roleId"] = roleId }, cancellationToken);
            using var after = await RequestAsync(credential, "/apihub/awapi/signin/state?gameId=1289", false, false, null, cancellationToken);
            if (Signed(after.RootElement) == true)
            {
                await effects.ConfirmedAsync(lease, "tajiduo_post_status_signed", cancellationToken);
                return await CheckInEffectGate.FinishAsync(effects, gate, Result("success", true, "confirmed"), cancellationToken);
            }
            return Result("success_unconfirmed", effect: "unknown");
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        { if (submitted || rotationUnknown) throw new CheckInInterrupted(true); throw; }
        catch (CheckInFailure error) { return Result(submitted ? "success_unconfirmed" : error.Code, effect: submitted || rotationUnknown ? "unknown" : "notSubmitted"); }
        catch (Exception error) when (error is not OutOfMemoryException)
        { return Result(submitted ? "success_unconfirmed" : "transport_error", effect: submitted || rotationUnknown ? "unknown" : "notSubmitted"); }
    }
    private async Task<TajiduoCredential> RefreshAsync(TajiduoCredential credential, CredentialMaterial material, CancellationToken cancellationToken)
    {
        if (credential.SdkToken is null || credential.SdkUid is null) throw new CheckInFailure("tajiduo_sdk_credential_required");
        using var refreshed = await RequestAsync(credential, "/usercenter/api/refreshTokenV2", true, true,
            new() { ["token"] = credential.SdkToken, ["userIdentity"] = credential.SdkUid, ["appId"] = "10551" }, cancellationToken);
        if (Code(refreshed.RootElement) != 0) throw new CheckInFailure("credential_expired");
        var data = CheckInJson.Property(refreshed.RootElement, "data", JsonValueKind.Object);
        var access = CheckInJson.Property(data, "accessToken", JsonValueKind.String).GetString();
        var refresh = CheckInJson.Property(data, "refreshToken", JsonValueKind.String).GetString();
        if (!CredentialWebSession.Header(access, 4096) || !CredentialWebSession.Header(refresh, 4096) ||
            data.TryGetProperty("uid", out _) && CheckInJson.Id(data, "uid", 40) != credential.Uid)
            throw new CheckInFailure("verification_state_unknown");
        credential = credential with { AccessToken = access!, RefreshToken = refresh! };
        using (var replacement = Encode(credential, material))
            if (!await rotation.PersistAsync(material, replacement, cancellationToken)) throw new CheckInFailure("credential_changed");
        return credential;
    }
    private static TajiduoCredential Read(CredentialMaterial material)
    {
        TajiduoCredential? result = null;
        material.Use(value => {
            var bytes = new byte[Encoding.UTF8.GetByteCount(value)]; Encoding.UTF8.GetBytes(value, bytes);
            try { result = TajiduoCredential.Parse(bytes); } finally { Array.Clear(bytes); }
        });
        return result!;
    }
    private static CredentialMaterial Encode(TajiduoCredential value, CredentialMaterial original)
    {
        var bytes = value.Encode(); var characters = Encoding.UTF8.GetChars(bytes);
        try { return new(characters, original.Source, original.MaskedAccount); }
        finally { Array.Clear(bytes); Array.Clear(characters); }
    }
    private Task<JsonDocument> RequestAsync(TajiduoCredential credential, string route, bool post, bool native,
        Dictionary<string, string>? fields, CancellationToken cancellationToken)
    {
        var headers = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase) { ["Accept"] = "application/json" };
        headers[native ? "AuthorizationV2" : "Authorization"] = route.EndsWith("/refreshTokenV2", StringComparison.Ordinal) ? "" : credential.AccessToken;
        if (native) AddNativeHeaders(headers, credential.Uid, credential.DeviceId, clock.GetUtcNow().ToUnixTimeSeconds(), Convert.ToHexStringLower(RandomNumberGenerator.GetBytes(4)));
        else
        {
            headers["Origin"] = "https://webstatic.tajiduo.com"; headers["Referer"] = "https://webstatic.tajiduo.com/";
        }
        var form = fields is null ? "" : string.Join("&", fields.Select(pair => Uri.EscapeDataString(pair.Key) + "=" + Uri.EscapeDataString(pair.Value)));
        return CheckInHttp.ReadAsync(network, new(new("https://bbs-api.tajiduo.com" + route), post ? "POST" : "GET", headers,
            post ? Encoding.UTF8.GetBytes(form) : [], post ? "application/x-www-form-urlencoded" : null), cancellationToken);
    }
    internal static void AddNativeHeaders(Dictionary<string, string> headers, string uid, string device, long timestamp, string nonce)
    {
        if (!TajiduoCredential.Numeric(uid) || !CredentialWebSession.Header(device, 4096)) throw new CheckInFailure("tajiduo_native_credential_required");
        headers["appVersion"] = "1.2.7"; headers["platform"] = "android"; headers["uid"] = uid;
        headers["deviceId"] = device; headers["Referer"] = "https://app.tajiduo.com/"; headers["ds"] = Signature(timestamp, nonce); headers["User-Agent"] = "okhttp/4.12.0";
    }
    internal static string Signature(long timestamp, string nonce) => timestamp.ToString(System.Globalization.CultureInfo.InvariantCulture) + "," + nonce + "," +
        Convert.ToHexStringLower(MD5.HashData(Encoding.UTF8.GetBytes(timestamp.ToString(System.Globalization.CultureInfo.InvariantCulture) + nonce + "1.2.7pUds3dfMkl")));
    private static int Code(JsonElement root) => CheckInJson.Property(root, "code", JsonValueKind.Number).TryGetInt32(out var code)
        ? code : throw new CheckInFailure("verification_state_unknown");
    private static bool? Signed(JsonElement root) => Code(root) == 0 && root.TryGetProperty("data", out var data) && data.ValueKind == JsonValueKind.Object &&
        data.TryGetProperty("todaySign", out var value) && value.ValueKind is JsonValueKind.True or JsonValueKind.False ? value.GetBoolean() : null;
    private static CheckInGameResult Result(string code, bool success = false, string effect = "notSubmitted") => CheckInResults.Result("tajiduo", "nte", code, success, effect);
}
