using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace NexusPipeline.Extensions.GameCheckIn;

internal sealed class HoyoCheckIn(ICheckInNetwork network, ICheckInEffects effects, TimeProvider clock)
{
    internal async Task<CredentialMaterial> ValidateAsync(string platform, CredentialMaterial captured, CancellationToken cancellationToken)
    {
        if (platform is not ("cn" or "os")) throw new CheckInFailure("checkin_platform_unknown");
        string cookie = ""; captured.Use(value => cookie = value.ToString());
        var address = platform == "cn" ? "https://bbs-api.miyoushe.com/user/wapi/getUserFullInfo?gids=2" :
            "https://bbs-api-os.hoyolab.com/community/painter/wapi/user/full";
        using var user = await ReadAsync(platform, HoyoEndpoints.For(platform, "gi"), address, cookie, Guid.NewGuid().ToString("D"), null, cancellationToken);
        return ReadOnlyIdentity.Verify(platform, user.RootElement, captured);
    }
    internal async Task<CheckInGameResult> SignAsync(string platform, string gameCode, CredentialMaterial material,
        string deviceId, CancellationToken cancellationToken)
    {
        var endpoint = HoyoEndpoints.For(platform, gameCode); string cookie = "";
        material.Use(value => cookie = value.ToString());
        try
        {
            var gate = await CheckInEffectGate.BeginAsync(effects, platform, gameCode, cancellationToken);
            if (gate.Result is not null) return gate.Result;
            CheckInRole[] roles;
            if (platform == "cn")
            {
                using var document = await ReadAsync(platform, endpoint,
                    "https://api-takumi.mihoyo.com/binding/api/getUserGameRolesByCookieToken?game_biz=" + Uri.EscapeDataString(endpoint.GameBiz),
                    cookie, deviceId, null, cancellationToken);
                var error = HoyoResponses.Error(document.RootElement);
                if (error is not null) return CheckInResults.Result(platform, gameCode, error);
                roles = CheckInRoles.Hoyo(document.RootElement);
            }
            else roles = [new("account", "global", "account")];
            var results = new List<CheckInGameResult>();
            foreach (var role in roles)
                results.Add(await SignRoleAsync(platform, gameCode, endpoint, role, cookie, deviceId, gate.MaySubmit, cancellationToken));
            var result = CheckInResults.Aggregate(platform, gameCode, results);
            return await CheckInEffectGate.FinishAsync(effects, gate, result, cancellationToken);
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested) { throw; }
        catch (CheckInFailure error) { return CheckInResults.Result(platform, gameCode, error.Code); }
        catch (Exception error) when (error is not OutOfMemoryException) { return CheckInResults.Result(platform, gameCode, "transport_error"); }
    }
    private async Task<CheckInGameResult> SignRoleAsync(string platform, string game, HoyoEndpoint endpoint,
        CheckInRole role, string cookie, string deviceId, bool maySubmit, CancellationToken cancellationToken)
    {
        var lease = await effects.AcquireAsync(new(platform, game, role.RoleId, role.ServerId), cancellationToken);
        if (lease.State == "confirmed") return CheckInResults.Result(platform, game, "already", true, "confirmed");
        if (lease.State is not ("new" or "unknown")) return CheckInResults.Result(platform, game, "effect_unavailable");
        var submitted = false;
        try
        {
            var infoUrl = endpoint.Info + "?lang=" + (platform == "cn" ? "zh-cn" : "en-us") + "&act_id=" + Uri.EscapeDataString(endpoint.ActId);
            if (platform == "cn") infoUrl += "&region=" + Uri.EscapeDataString(role.ServerId) + "&uid=" + Uri.EscapeDataString(role.RoleId);
            using var before = await ReadAsync(platform, endpoint, infoUrl, cookie, deviceId, null, cancellationToken);
            var error = HoyoResponses.Error(before.RootElement);
            if (error is not null) return CheckInResults.Result(platform, game, error, effectState: lease.State == "unknown" || !maySubmit ? "unknown" : "notSubmitted");
            if (HoyoResponses.Signed(before.RootElement) == true)
            {
                await effects.ConfirmedAsync(lease, "hoyo_status_signed", cancellationToken);
                return CheckInResults.Result(platform, game, "already", true, "confirmed");
            }
            if (lease.State == "unknown" || !maySubmit) return CheckInResults.Result(platform, game, "effect_unknown", effectState: "unknown");
            if (HoyoResponses.FirstBind(before.RootElement)) return CheckInResults.Result(platform, game, "first_bind");
            if (HoyoResponses.Signed(before.RootElement) != false) return CheckInResults.Result(platform, game, "verification_state_unknown");
            var body = platform == "cn" ? CheckInJson.Bytes(new { act_id = endpoint.ActId, region = role.ServerId, uid = role.RoleId }) :
                CheckInJson.Bytes(new { lang = "en-us", act_id = endpoint.ActId });
            submitted = true; await effects.SubmittedAsync(lease, cancellationToken);
            using var sign = await ReadAsync(platform, endpoint, endpoint.Sign, cookie, deviceId, body, cancellationToken);
            error = HoyoResponses.Error(sign.RootElement);
            if (error is not null && error != "success_unconfirmed") return CheckInResults.Result(platform, game, error, effectState: "unknown");
            using var after = await ReadAsync(platform, endpoint, infoUrl, cookie, deviceId, null, cancellationToken);
            if (HoyoResponses.Error(after.RootElement) is null && HoyoResponses.Signed(after.RootElement) == true)
            {
                await effects.ConfirmedAsync(lease, "hoyo_post_status_signed", cancellationToken);
                return CheckInResults.Result(platform, game, "success", true, "confirmed");
            }
            return CheckInResults.Result(platform, game, "success_unconfirmed", effectState: "unknown");
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested) { throw; }
        catch (Exception error) when (error is not OutOfMemoryException)
        { return CheckInResults.Result(platform, game, submitted || lease.State == "unknown" || !maySubmit ? "success_unconfirmed" : "transport_error",
            effectState: submitted || lease.State == "unknown" || !maySubmit ? "unknown" : "notSubmitted"); }
    }
    private Task<JsonDocument> ReadAsync(string platform, HoyoEndpoint endpoint, string url, string cookie, string deviceId,
        byte[]? content, CancellationToken cancellationToken)
    {
        var headers = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase) {
            ["Cookie"] = cookie, ["Accept"] = "application/json", ["Referer"] = endpoint.Referer,
            ["Origin"] = platform == "cn" ? "https://www.miyoushe.com" : "https://act.hoyolab.com",
            ["x-rpc-signgame"] = endpoint.SignGame,
            ["User-Agent"] = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36" };
        if (new Uri(url).Host == "bbs-api-os.hoyolab.com")
        { headers["Origin"] = "https://www.hoyolab.com"; headers["Referer"] = "https://www.hoyolab.com/"; headers["x-rpc-language"] = "en-us"; }
        if (platform == "cn")
        {
            if (!Guid.TryParse(deviceId, out var device)) throw new CheckInFailure("checkin_device_id_invalid");
            headers["DS"] = Signature(clock.GetUtcNow().ToUnixTimeSeconds(), RandomNumberGenerator.GetString("abcdefghijklmnopqrstuvwxyz0123456789", 6));
            headers["x-rpc-device_id"] = device.ToString("D"); headers["x-rpc-app_version"] = "2.109.0";
            headers["x-rpc-channel"] = "miyousheluodi"; headers["x-rpc-client_type"] = "5"; headers["X-Requested-With"] = "com.mihoyo.hyperion";
        }
        return CheckInHttp.ReadAsync(network, new(new(url), content is null ? "GET" : "POST", headers, content ?? [], content is null ? null : "application/json"), cancellationToken);
    }
    internal static string Signature(long unixSeconds, string nonce)
    {
        if (nonce.Length != 6 || nonce.Any(character => !char.IsAsciiLetterOrDigit(character))) throw new CheckInFailure("checkin_nonce_invalid");
        var time = unixSeconds.ToString(CultureInfo.InvariantCulture);
        var checksum = Convert.ToHexStringLower(MD5.HashData(Encoding.UTF8.GetBytes("salt=d9200c846b10886e8c874fc33c8f308b&t=" + time + "&r=" + nonce)));
        return time + "," + nonce + "," + checksum;
    }
}
