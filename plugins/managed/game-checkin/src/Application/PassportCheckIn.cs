using System.Security.Cryptography;
using System.Text;
using System.Text.Encodings.Web;
using System.Text.Json;

namespace NexusPipeline.Extensions.GameCheckIn;

internal interface ICheckInPassportDevice
{
    ValueTask<string> GetAsync(CancellationToken cancellationToken);
}
internal sealed class PassportCheckIn(ICheckInNetwork network, ICheckInEffects effects, ICheckInPassportDevice devices, TimeProvider clock)
{
    private sealed record Profile(string Platform, string AuthOrigin, string ApiOrigin, string AppCode, string ClientPlatform, string Version, bool Browser)
    {
        internal string Origin => Platform == "skland" ? "https://www.skland.com" : "https://www.skport.com";
    }
    private sealed record Session(string Credential, string SigningKey, Profile Profile, string Device)
    { public override string ToString() => "[passport session]"; }
    private static Profile Configuration(string platform, bool endfield, bool browser) => platform switch {
        "skland" => new(platform, "https://as.hypergryph.com", "https://zonai.skland.com", "4ca99fa6b56cc2ba",
            endfield || browser ? "3" : "1", endfield || browser ? "1.0.0" : "1.5.1", browser),
        "skport" => new(platform, "https://as.gryphline.com", "https://zonai.skport.com", "6eb76d4e13aa36e6", "3", "1.0.0", true),
        _ => throw new CheckInFailure("checkin_platform_unknown") };
    internal async Task<CredentialMaterial> ValidateAsync(string platform, CredentialMaterial captured, CancellationToken cancellationToken)
    {
        var session = await AuthenticateAsync(platform, true, captured, cancellationToken);
        var url = session.Profile.ApiOrigin + (platform == "skport" ? "/web/v2/user" : "/web/v1/user");
        using var user = await SignedAsync(session, url, null, null, cancellationToken);
        using var bindings = await SignedAsync(session, session.Profile.ApiOrigin + "/api/v1/game/player/binding", null, null, cancellationToken);
        RequireCode(bindings.RootElement, "code", 0);
        CheckInJson.Property(CheckInJson.Property(bindings.RootElement, "data", JsonValueKind.Object), "list", JsonValueKind.Array);
        return ReadOnlyIdentity.Verify(platform, user.RootElement, captured);
    }
    internal async Task<CheckInGameResult> SignAsync(string platform, string gameCode, CredentialMaterial material, CancellationToken cancellationToken)
    {
        CheckInCatalog.Game(platform, gameCode); var endfield = gameCode == "endfield";
        try
        {
            var gate = await CheckInEffectGate.BeginAsync(effects, platform, gameCode, cancellationToken);
            if (gate.Result is not null) return gate.Result;
            if (!gate.MaySubmit) return CheckInResults.Result(platform, gameCode, "effect_unknown", effectState: "unknown");
            var session = await AuthenticateAsync(platform, endfield, material, cancellationToken);
            if (endfield && material.Web is null && platform == "skland") session = session with { Device = "" };
            using var bindings = await SignedAsync(session, session.Profile.ApiOrigin + "/api/v1/game/player/binding", null, null, cancellationToken);
            RequireCode(bindings.RootElement, "code", 0);
            var roles = CheckInRoles.Passport(bindings.RootElement, endfield); var results = new List<CheckInGameResult>();
            foreach (var role in roles) results.Add(await AttendanceAsync(platform, gameCode, session, role, endfield, cancellationToken));
            var result = CheckInResults.Aggregate(platform, gameCode, results);
            return await CheckInEffectGate.FinishAsync(effects, gate, result, cancellationToken);
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested) { throw; }
        catch (CheckInFailure error) { return CheckInResults.Result(platform, gameCode, error.Code); }
        catch (Exception error) when (error is not OutOfMemoryException) { return CheckInResults.Result(platform, gameCode, CheckInDiagnostics.Failure(error, "PassportCheckIn.prepare")); }
    }
    private async Task<CheckInGameResult> AttendanceAsync(string platform, string game, Session session, CheckInRole role,
        bool endfield, CancellationToken cancellationToken)
    {
        var lease = await effects.AcquireAsync(new(platform, game, role.RoleId, role.ServerId), cancellationToken);
        if (lease.State == "confirmed") return CheckInResults.Result(platform, game, "already", true, "confirmed");
        if (lease.State != "new") return CheckInResults.Result(platform, game, "effect_unknown", effectState: "unknown");
        var submitted = false;
        try
        {
            var body = endfield ? Array.Empty<byte>() : CheckInJson.Bytes(new { uid = role.UserId, gameId = "1" });
            Dictionary<string, string>? extra = endfield ? new() { ["sk-game-role"] = "3_" + role.RoleId + "_" + role.ServerId } : null;
            submitted = true; await effects.SubmittedAsync(lease, cancellationToken);
            using var response = await SignedAsync(session, session.Profile.ApiOrigin + "/api/v1/game/" + (endfield ? "endfield/attendance" : "attendance"), body, extra, cancellationToken);
            var code = Code(response.RootElement, "code");
            if (code is 0 or 10001)
            {
                await effects.ConfirmedAsync(lease, "passport_attendance_" + code, cancellationToken);
                return CheckInResults.Result(platform, game, code == 0 ? "success" : "already", true, "confirmed");
            }
            return CheckInResults.Result(platform, game, code is 401 or 10002 ? "credential_expired" : "api_error", effectState: "unknown");
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested) { throw; }
        catch (Exception error) when (error is not OutOfMemoryException)
        { return CheckInResults.Result(platform, game, submitted ? "success_unconfirmed" : "effect_unavailable", effectState: submitted ? "unknown" : "notSubmitted"); }
    }
    private async Task<Session> AuthenticateAsync(string platform, bool endfield, CredentialMaterial material, CancellationToken cancellationToken)
    {
        var profile = Configuration(platform, endfield, material.Web is not null); var device = "";
        if (material.Web is { } web)
        { web.Validate(); if (web.Platform != platform) throw new CheckInFailure("credential_web_context_invalid"); device = web.DeviceId ?? ""; }
        else if (platform == "skland") device = await devices.GetAsync(cancellationToken);
        if (platform == "skland" && !CredentialWebSession.Header(device, 16384)) throw new CheckInFailure("credential_device_missing");
        string token = ""; material.Use(value => token = LoginCapture.RawToken(value.ToString()));
        using var grant = await UnsignedAsync(profile, device, profile.AuthOrigin + "/user/oauth2/v2/grant",
            CheckInJson.Bytes(new { token, appCode = profile.AppCode, type = 0 }), cancellationToken);
        RequireCode(grant.RootElement, "status", 0);
        var code = CheckInJson.Property(CheckInJson.Property(grant.RootElement, "data", JsonValueKind.Object), "code", JsonValueKind.String).GetString();
        LoginCapture.RawToken(code);
        using var exchange = await UnsignedAsync(profile, device, profile.ApiOrigin + "/web/v1/user/auth/generate_cred_by_code",
            CheckInJson.Bytes(new { kind = 1, code }), cancellationToken);
        RequireCode(exchange.RootElement, "code", 0);
        var data = CheckInJson.Property(exchange.RootElement, "data", JsonValueKind.Object);
        return new(LoginCapture.RawToken(CheckInJson.Property(data, "cred", JsonValueKind.String).GetString()),
            LoginCapture.RawToken(CheckInJson.Property(data, "token", JsonValueKind.String).GetString()), profile, device);
    }
    private Dictionary<string, string> Headers(Profile profile, string device)
    {
        var headers = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase) { ["Accept"] = "application/json",
            ["platform"] = profile.ClientPlatform, ["vName"] = profile.Version, ["dId"] = device,
            ["timestamp"] = clock.GetUtcNow().ToUnixTimeSeconds().ToString(System.Globalization.CultureInfo.InvariantCulture),
            ["User-Agent"] = profile.Browser ? "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36" :
                "Skland/1.5.1 (com.hypergryph.skland; build:100501001; Android 34; ) Okhttp/4.11.0" };
        if (profile.Browser) { headers["Origin"] = profile.Origin; headers["Referer"] = profile.Origin + "/"; }
        else headers["X-Requested-With"] = "com.hypergryph.skland";
        return headers;
    }
    private Task<JsonDocument> UnsignedAsync(Profile profile, string device, string url, byte[] body, CancellationToken cancellationToken) =>
        CheckInHttp.ReadAsync(network, new(new(url), "POST", Headers(profile, device), body, "application/json"), cancellationToken);
    private Task<JsonDocument> SignedAsync(Session session, string url, byte[]? body, Dictionary<string, string>? extra, CancellationToken cancellationToken)
    {
        var uri = new Uri(url); var headers = Headers(session.Profile, session.Device); headers["cred"] = session.Credential;
        headers["sign"] = Signature(session.SigningKey, uri.AbsolutePath, body ?? [], headers["timestamp"], session.Device, session.Profile.ClientPlatform, session.Profile.Version);
        if (extra is not null) foreach (var pair in extra) headers[pair.Key] = pair.Value;
        return CheckInHttp.ReadAsync(network, new(uri, body is null ? "GET" : "POST", headers, body ?? [], body is null ? null : "application/json"), cancellationToken);
    }
    internal static string Signature(string token, string path, ReadOnlySpan<byte> body, string timestamp, string device, string platform, string version)
    {
        var header = JsonSerializer.Serialize(new { platform, timestamp, dId = device, vName = version },
            new JsonSerializerOptions { Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping });
        var message = Encoding.UTF8.GetBytes(path + Encoding.UTF8.GetString(body) + timestamp + header);
        var key = Encoding.UTF8.GetBytes(token);
        try
        {
            var signature = Convert.ToHexStringLower(HMACSHA256.HashData(key, message));
            return Convert.ToHexStringLower(MD5.HashData(Encoding.ASCII.GetBytes(signature)));
        }
        finally { Array.Clear(key); Array.Clear(message); }
    }
    private static int Code(JsonElement root, string name) => CheckInJson.Property(root, name, JsonValueKind.Number).TryGetInt32(out var code)
        ? code : throw new CheckInFailure("verification_state_unknown");
    private static void RequireCode(JsonElement root, string field, int success)
    {
        var code = Code(root, field);
        if (code != success) throw new CheckInFailure(code is 1 or 401 or 10000 or 10002 ? "credential_expired" : "api_error");
    }
}
