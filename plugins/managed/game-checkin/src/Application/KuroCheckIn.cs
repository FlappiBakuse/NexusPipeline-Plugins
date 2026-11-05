using System.Globalization;
using System.Text;
using System.Text.Json;

namespace NexusPipeline.Extensions.GameCheckIn;

internal sealed class KuroCheckIn(ICheckInNetwork network, ICheckInEffects effects)
{
    internal async Task<CredentialMaterial> ValidateAsync(CredentialMaterial captured, CancellationToken cancellationToken)
    {
        using var user = await RequestAsync("/user/mineV2", captured, Guid.NewGuid().ToString("N"), Guid.NewGuid().ToString("D"),
            new() { ["type"] = "1", ["searchType"] = "2" }, cancellationToken);
        var verified = ReadOnlyIdentity.Verify("kuro", user.RootElement, captured);
        try
        {
            var accountId = CheckInJson.Id(CheckInJson.Property(CheckInJson.Property(user.RootElement, "data", JsonValueKind.Object), "mine", JsonValueKind.Object), "userId");
            foreach (var game in CheckInCatalog.Platform("kuro").Games)
            {
                using var roles = await RequestAsync("/user/role/findRoleList", captured, Guid.NewGuid().ToString("N"), Guid.NewGuid().ToString("D"),
                    new() { ["gameId"] = game.ExternalGameId! }, cancellationToken);
                if (Code(roles.RootElement) != 200) throw new CheckInFailure("credential_not_authenticated");
                if (CheckInRoles.Kuro(roles.RootElement, game.ExternalGameId!).Any(role => role.UserId != accountId))
                    throw new CheckInFailure("credential_capture_ambiguous");
            }
            return verified;
        }
        catch { verified.Dispose(); throw; }
    }
    internal async Task<CheckInGameResult> SignAsync(string gameCode, CredentialMaterial material, string deviceId, string distinctId,
        DateOnly localDate, CancellationToken cancellationToken)
    {
        var game = CheckInCatalog.Game("kuro", gameCode);
        try
        {
            var gate = await CheckInEffectGate.BeginAsync(effects, "kuro", gameCode, cancellationToken);
            if (gate.Result is not null) return gate.Result;
            if (!gate.MaySubmit) return CheckInResults.Result("kuro", gameCode, "effect_unknown", effectState: "unknown");
            using var response = await RequestAsync("/user/role/findRoleList", material, deviceId, distinctId,
                new() { ["gameId"] = game.ExternalGameId! }, cancellationToken);
            if (Code(response.RootElement) != 200) return Failure(gameCode, Code(response.RootElement));
            var roles = CheckInRoles.Kuro(response.RootElement, game.ExternalGameId!); var results = new List<CheckInGameResult>();
            foreach (var role in roles) results.Add(await SignRoleAsync(game, material, role, deviceId, distinctId, localDate, cancellationToken));
            var result = CheckInResults.Aggregate("kuro", gameCode, results);
            return await CheckInEffectGate.FinishAsync(effects, gate, result, cancellationToken);
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested) { throw; }
        catch (CheckInFailure error) { return CheckInResults.Result("kuro", gameCode, error.Code); }
        catch (Exception error) when (error is not OutOfMemoryException) { return CheckInResults.Result("kuro", gameCode, "transport_error"); }
    }
    private async Task<CheckInGameResult> SignRoleAsync(CheckInGame game, CredentialMaterial material, CheckInRole role, string device,
        string distinct, DateOnly date, CancellationToken cancellationToken)
    {
        var lease = await effects.AcquireAsync(new("kuro", game.Code, role.RoleId, role.ServerId), cancellationToken);
        if (lease.State == "confirmed") return CheckInResults.Result("kuro", game.Code, "already", true, "confirmed");
        if (lease.State != "new") return CheckInResults.Result("kuro", game.Code, "effect_unknown", effectState: "unknown");
        var submitted = false;
        try
        {
            submitted = true; await effects.SubmittedAsync(lease, cancellationToken);
            using var response = await RequestAsync("/encourage/signIn/v2", material, device, distinct, new() {
                ["gameId"] = game.ExternalGameId!, ["serverId"] = role.ServerId, ["roleId"] = role.RoleId, ["userId"] = role.UserId,
                ["reqMonth"] = date.ToString("MM", CultureInfo.InvariantCulture) }, cancellationToken);
            var code = Code(response.RootElement);
            if (code is not (200 or 1511)) return Failure(game.Code, code) with { EffectState = "unknown" };
            await effects.ConfirmedAsync(lease, "kuro_attendance_" + code, cancellationToken);
            return CheckInResults.Result("kuro", game.Code, code == 200 ? "success" : "already", true, "confirmed");
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested) { throw; }
        catch (Exception error) when (error is not OutOfMemoryException)
        { return CheckInResults.Result("kuro", game.Code, submitted ? "success_unconfirmed" : "effect_unavailable", effectState: submitted ? "unknown" : "notSubmitted"); }
    }
    private Task<JsonDocument> RequestAsync(string path, CredentialMaterial material, string deviceId, string distinctId,
        Dictionary<string, string> fields, CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(deviceId, out _) || !Guid.TryParse(distinctId, out var distinct)) throw new CheckInFailure("checkin_device_id_invalid");
        var web = material.Web;
        if (web is not null) { web.Validate(); if (web.Platform != "kuro") throw new CheckInFailure("credential_web_context_invalid"); }
        string token = ""; material.Use(value => token = LoginCapture.RawToken(value.ToString()));
        var headers = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase) {
            ["Accept"] = "application/json", ["token"] = token, ["source"] = web is null ? "android" : "h5", ["lang"] = "zh-Hans",
            ["devcode"] = deviceId, ["distinct_id"] = web?.DistinctId ?? distinct.ToString("D"), ["countrycode"] = "CN", ["version"] = "2.2.0",
            ["User-Agent"] = web is null ? "Mozilla/5.0 (Linux; Android 14; NexusPipeline) AppleWebKit/537.36 Chrome/126.0 Mobile Safari/537.36 Kuro/2.2.0 KuroGameBox/2.2.0" :
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36" };
        if (web is null) { headers["model"] = "NexusPipeline"; headers["versioncode"] = "2200"; headers["x-requested-with"] = "com.kurogame.kjq"; }
        else { headers["Origin"] = "https://www.kurobbs.com"; headers["Referer"] = "https://www.kurobbs.com/"; }
        var encoded = string.Join("&", fields.Select(pair => Uri.EscapeDataString(pair.Key) + "=" + Uri.EscapeDataString(pair.Value)));
        return CheckInHttp.ReadAsync(network, new(new("https://api.kurobbs.com" + path), "POST", headers, Encoding.UTF8.GetBytes(encoded),
            "application/x-www-form-urlencoded"), cancellationToken);
    }
    private static int Code(JsonElement root) => CheckInJson.Property(root, "code", JsonValueKind.Number).TryGetInt32(out var code)
        ? code : throw new CheckInFailure("verification_state_unknown");
    private static CheckInGameResult Failure(string game, int code) => CheckInResults.Result("kuro", game,
        code is 220 or 230 ? "credential_expired" : code == 1513 ? "manual_action_required" : "api_error");
}
