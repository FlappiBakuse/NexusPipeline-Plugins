using System.Text.Json;
using NexusPipeline.Extensions.GameCheckIn;

internal static class ClientCases
{
    internal static void Run(Action<string, Action> run)
    {
        HoyoCases(run);
        PassportCases(run);
        KuroCases(run);
        TajiduoCases(run);
        EffectGateCases(run);
    }

    private static void HoyoCases(Action<string, Action> run)
    {
        foreach (var platform in new[] { "cn", "os" })
        foreach (var game in new[] { "gi", "hsr", "zzz", "bh3" })
            run("hoyo-role-submission-and-confirmation/" + platform + "/" + game, () =>
            {
                var effects = new TestEffects(); var replies = new[] { ClientFixtures.HoyoFalse, "{\"retcode\":0}", ClientFixtures.HoyoTrue };
                if (platform == "cn") replies = new[] { ClientFixtures.HoyoRoles }.Concat(replies).ToArray();
                var network = new ClientNetwork(effects, replies); using var material = ClientFixtures.Material(platform);
                var result = new HoyoCheckIn(network, effects, TimeProvider.System).SignAsync(platform, game, material, Guid.NewGuid().ToString("D"), default).GetAwaiter().GetResult();
                Assert(result.Success && effects.GameConfirmed && effects.Submitted.Count == 1 && network.Posts == 1);
                var sign = network.Requests.Single(request => request.Method == "POST"); using var body = JsonDocument.Parse(sign.Body);
                if (platform == "cn") Assert(body.RootElement.GetProperty("uid").GetString() == "123456" && sign.Headers.ContainsKey("DS"));
            });
        foreach (var info in new[] { ClientFixtures.HoyoTrue, "{\"retcode\":0,\"data\":{}}", "{\"retcode\":0,\"data\":{\"risk_code\":1,\"gt\":\"synthetic\",\"challenge\":\"synthetic\"}}" })
            run("hoyo-no-submit-on-already-unknown-or-risk/" + info.Length, () =>
            {
                var effects = new TestEffects(); var network = new ClientNetwork(effects, info); using var material = ClientFixtures.Material("os");
                var result = new HoyoCheckIn(network, effects, TimeProvider.System).SignAsync("os", "gi", material, "", default).GetAwaiter().GetResult();
                Assert(network.Posts == 0 && effects.Submitted.Count == 0 && result.Success == (info == ClientFixtures.HoyoTrue));
            });
        run("unknown-total-claim-never-repeats-hoyo-post", () =>
        {
            var effects = new TestEffects { GameState = "unknown" }; var network = new ClientNetwork(effects, ClientFixtures.HoyoFalse);
            using var material = ClientFixtures.Material("os");
            var result = new HoyoCheckIn(network, effects, TimeProvider.System).SignAsync("os", "gi", material, "", default).GetAwaiter().GetResult();
            Assert(!result.Success && result.EffectState == "unknown" && network.Posts == 0 && effects.Submitted.Count == 0);
        });
        run("network-unknown-after-submission-does-not-repeat-post", () =>
        {
            var effects = new TestEffects(); var network = new ClientNetwork(effects, ClientFixtures.HoyoFalse);
            network.Failure = request => ClientNetwork.BusinessPost(new Uri(request.Address).AbsolutePath) ? new IOException("synthetic_network_unknown") : null;
            using var material = ClientFixtures.Material("os");
            var result = new HoyoCheckIn(network, effects, TimeProvider.System).SignAsync("os", "gi", material, "", default).GetAwaiter().GetResult();
            Assert(!result.Success && result.EffectState == "unknown" && network.Posts == 1);
        });
        foreach (var confirmation in new[] { ClientFixtures.HoyoFalse, "invalid" })
            run("post-accepted-but-unverified-never-reposts/" + confirmation, () =>
            {
                var effects = new TestEffects(); var network = new ClientNetwork(effects, ClientFixtures.HoyoFalse, "{\"retcode\":0}", confirmation);
                using var material = ClientFixtures.Material("os");
                var result = new HoyoCheckIn(network, effects, TimeProvider.System).SignAsync("os", "gi", material, "", default).GetAwaiter().GetResult();
                Assert(!result.Success && result.EffectState == "unknown" && network.Posts == 1 && !effects.GameConfirmed);
            });
        run("submission-persistence-unknown-blocks-http-post", () =>
        {
            var effects = new TestEffects { FailSubmitted = true }; var network = new ClientNetwork(effects, ClientFixtures.HoyoFalse);
            using var material = ClientFixtures.Material("os");
            var result = new HoyoCheckIn(network, effects, TimeProvider.System).SignAsync("os", "gi", material, "", default).GetAwaiter().GetResult();
            Assert(!result.Success && result.EffectState == "unknown" && network.Posts == 0);
        });
        run("total-confirmation-persistence-unknown-keeps-outcome-unverified", () =>
        {
            var effects = new TestEffects { FailGameConfirmation = true }; var network = new ClientNetwork(effects, ClientFixtures.HoyoTrue);
            using var material = ClientFixtures.Material("os");
            var result = new HoyoCheckIn(network, effects, TimeProvider.System).SignAsync("os", "gi", material, "", default).GetAwaiter().GetResult();
            Assert(!result.Success && result.EffectState == "unknown" && network.Posts == 0);
        });
    }

    private static void PassportCases(Action<string, Action> run)
    {
        foreach (var (platform, game) in new[] { ("skland", "ak"), ("skland", "endfield"), ("skport", "endfield") })
            run("passport-production-protocol-fixture/" + platform + "/" + game, () =>
            {
                var effects = new TestEffects(); var device = new TestDevice();
                var binding = game == "ak" ? "{\"code\":0,\"data\":{\"list\":[{\"appCode\":\"arknights\",\"bindingList\":[{\"uid\":\"123456\",\"channelMasterId\":\"1\"}]}]}}" :
                    "{\"code\":0,\"data\":{\"list\":[{\"appCode\":\"endfield\",\"bindingList\":[{\"uid\":\"123456\",\"roles\":[{\"roleId\":\"789123\",\"serverId\":\"1\"}]}]}]}}";
                var network = new ClientNetwork(effects, "{\"status\":0,\"data\":{\"code\":\"synthetic-code\"}}",
                    "{\"code\":0,\"data\":{\"cred\":\"synthetic-cred\",\"token\":\"synthetic-signkey\"}}", binding, "{\"code\":0,\"data\":{\"awards\":[]}}");
                using var material = ClientFixtures.Material(platform);
                var result = new PassportCheckIn(network, effects, device, TimeProvider.System).SignAsync(platform, game, material, default).GetAwaiter().GetResult();
                Assert(result.Success && effects.GameConfirmed && network.Posts == 1);
                var post = network.Requests.Last(); Assert(post.Headers.ContainsKey("cred") && post.Headers["sign"].Length == 32);
                if (platform == "skland")
                {
                    var grants = network.Requests.Where(request => new Uri(request.Address).AbsolutePath == "/user/oauth2/v2/grant").ToArray();
                    Assert(grants.Length > 0 && grants.All(request => request.Headers["dId"] == "Bsynthetic-device"));
                }
                else Assert(device.Calls == 0);
                if (game == "endfield") Assert(post.Headers["sk-game-role"] == "3_789123_1" && post.Body == "");
                else using (var body = JsonDocument.Parse(post.Body)) Assert(body.RootElement.GetProperty("uid").GetString() == "123456");
            });
    }

    private static void KuroCases(Action<string, Action> run)
    {
        foreach (var (game, gameId) in new[] { ("ww", "3"), ("pgr", "2") })
            run("kuro-production-protocol-fixture/" + game, () =>
            {
                var effects = new TestEffects(); var network = new ClientNetwork(effects,
                    "{\"code\":200,\"data\":[{\"gameId\":\"" + gameId + "\",\"roleId\":\"789123\",\"serverId\":\"1\",\"userId\":\"123456\"}]}", "{\"code\":200}");
                using var material = ClientFixtures.Material("kuro");
                var result = new KuroCheckIn(network, effects).SignAsync(game, material, Guid.NewGuid().ToString("N"), Guid.NewGuid().ToString("D"), new(2026, 10, 25), default).GetAwaiter().GetResult();
                Assert(result.Success && effects.GameConfirmed && network.Posts == 1 && network.Requests.Last().Body.Contains("reqMonth=10", StringComparison.Ordinal));
                Assert(network.Requests.Last().Headers["source"] == "android");
            });
    }

    private static void TajiduoCases(Action<string, Action> run)
    {
        run("tajiduo-production-protocol-fixture/nte", () =>
        {
            var effects = new TestEffects(); var rotation = new TestRotation();
            var network = new ClientNetwork(effects, ClientFixtures.Refresh, ClientFixtures.NativeRoles, ClientFixtures.NativeFalse, "{\"code\":0}", ClientFixtures.NativeTrue);
            network.Inspect = request => {
                if (request.Address.Contains("getGameRoles", StringComparison.Ordinal)) Assert(rotation.Persisted && rotation.Access == "synthetic-new-access");
                if (new Uri(request.Address).AbsolutePath == "/apihub/awapi/sign") Assert(request.Body.Contains("roleId=789123", StringComparison.Ordinal));
            };
            using var material = ClientFixtures.Material("tajiduo");
            var result = new TajiduoCheckIn(network, effects, rotation, TimeProvider.System).SignAsync(material, default).GetAwaiter().GetResult();
            Assert(result.Success && rotation.Persisted && effects.GameConfirmed && network.Posts == 1);
        });
        run("tajiduo-rotation-rejected-stops-before-role-query", () =>
        {
            var effects = new TestEffects(); var rotation = new TestRotation { Accept = false }; var network = new ClientNetwork(effects, ClientFixtures.Refresh);
            using var material = ClientFixtures.Material("tajiduo");
            var result = new TajiduoCheckIn(network, effects, rotation, TimeProvider.System).SignAsync(material, default).GetAwaiter().GetResult();
            Assert(result.Code == "credential_changed" && result.EffectState == "unknown" && network.Requests.All(request => new Uri(request.Address).AbsolutePath == "/usercenter/api/refreshTokenV2") && network.Posts == 0);
        });
        run("tajiduo-multiple-roles-stops-before-today-state-or-submission", () =>
        {
            var effects = new TestEffects(); var network = new ClientNetwork(effects, ClientFixtures.Refresh,
                "{\"code\":0,\"data\":{\"roles\":[{\"roleId\":\"123\"},{\"roleId\":\"456\"}]}}");
            using var material = ClientFixtures.Material("tajiduo");
            var result = new TajiduoCheckIn(network, effects, new TestRotation(), TimeProvider.System).SignAsync(material, default).GetAwaiter().GetResult();
            Assert(result.Code == "role_selection_required" && network.Posts == 0 &&
                network.Requests.All(request => new Uri(request.Address).AbsolutePath is "/usercenter/api/refreshTokenV2" or "/usercenter/api/v2/getGameRoles"));
        });
        run("tajiduo-unknown-total-claim-readonly-reconciles-without-repost", () =>
        {
            var effects = new TestEffects { GameState = "unknown" }; var network = new ClientNetwork(effects,
                ClientFixtures.NativeRoles, ClientFixtures.NativeFalse);
            using var material = ClientFixtures.Material("tajiduo");
            var rotation = new TestRotation { Accept = false };
            var result = new TajiduoCheckIn(network, effects, rotation, TimeProvider.System).SignAsync(material, default).GetAwaiter().GetResult();
            Assert(result.EffectState == "unknown" && network.Requests.All(request => request.Method == "GET") && network.Posts == 0 && rotation.Access is null);
            foreach (var (path, header) in new[] { ("/usercenter/api/v2/getGameRoles", "AuthorizationV2"), ("/apihub/awapi/signin/state", "Authorization") })
            {
                var requests = network.Requests.Where(request => new Uri(request.Address).AbsolutePath == path).ToArray();
                Assert(requests.Length > 0 && requests.All(request => request.Headers[header] == "synthetic-access"));
            }
        });
        run("tajiduo-unknown-claim-positive-readonly-status-resolves-without-refresh", () =>
        {
            var effects = new TestEffects { GameState = "unknown", RoleState = "unknown" }; var network = new ClientNetwork(effects, ClientFixtures.NativeRoles, ClientFixtures.NativeTrue);
            var rotation = new TestRotation { Accept = false }; using var material = ClientFixtures.Material("tajiduo");
            var result = new TajiduoCheckIn(network, effects, rotation, TimeProvider.System).SignAsync(material, default).GetAwaiter().GetResult();
            Assert(result.Success && result.Code == "already" && effects.GameConfirmed && network.Requests.All(request => request.Method == "GET") && rotation.Access is null);
        });
        run("tajiduo-cancellation-during-refresh-preserves-unknown-external-effect", () =>
        {
            using var cancelled = new CancellationTokenSource(); var effects = new TestEffects(); var network = new ClientNetwork(effects);
            network.Failure = _ => { cancelled.Cancel(); return new OperationCanceledException(cancelled.Token); };
            using var material = ClientFixtures.Material("tajiduo");
            try { new TajiduoCheckIn(network, effects, new TestRotation(), TimeProvider.System).SignAsync(material, cancelled.Token).GetAwaiter().GetResult(); }
            catch (CheckInInterrupted error) { Assert(error.Unknown && network.Requests.Count == 1 && effects.Submitted.Count == 0); return; }
            throw new InvalidOperationException("refresh_cancellation_lost");
        });
    }

    private static void EffectGateCases(Action<string, Action> run)
    {
        foreach (var platform in CheckInCatalog.Platforms)
        foreach (var game in platform.Games)
            run("busy-actual-effect-blocks-all-platform-http/" + platform.Id + "/" + game.Code, () =>
            {
                var effects = new TestEffects { GameState = "busy" }; var network = new ClientNetwork(effects); var rotation = new TestRotation();
                using var material = ClientFixtures.Material(platform.Id);
                var result = platform.Id switch {
                    "cn" or "os" => new HoyoCheckIn(network, effects, TimeProvider.System).SignAsync(platform.Id, game.Code, material, Guid.NewGuid().ToString("D"), default).GetAwaiter().GetResult(),
                    "skland" or "skport" => new PassportCheckIn(network, effects, new TestDevice(), TimeProvider.System).SignAsync(platform.Id, game.Code, material, default).GetAwaiter().GetResult(),
                    "kuro" => new KuroCheckIn(network, effects).SignAsync(game.Code, material, Guid.NewGuid().ToString("D"), Guid.NewGuid().ToString("D"), new(2026, 10, 25), default).GetAwaiter().GetResult(),
                    _ => new TajiduoCheckIn(network, effects, rotation, TimeProvider.System).SignAsync(material, default).GetAwaiter().GetResult() };
                Assert(result.Code == "effect_busy" && result.EffectState == "unknown" && !result.Success && network.Requests.Count == 0 && !rotation.Persisted);
            });
        foreach (var state in new[] { "confirmed", "busy" })
        foreach (var platform in new[] { "os", "skland", "kuro", "tajiduo" })
            run("total-host-gate-before-protocol/" + platform + "/" + state, () =>
            {
                var effects = new TestEffects { GameState = state }; var network = new ClientNetwork(effects);
                using var material = ClientFixtures.Material(platform); var result = platform switch {
                    "os" => new HoyoCheckIn(network, effects, TimeProvider.System).SignAsync(platform, "gi", material, "", default).GetAwaiter().GetResult(),
                    "skland" => new PassportCheckIn(network, effects, new TestDevice(), TimeProvider.System).SignAsync(platform, "ak", material, default).GetAwaiter().GetResult(),
                    "kuro" => new KuroCheckIn(network, effects).SignAsync("ww", material, "", "", new(2026, 10, 25), default).GetAwaiter().GetResult(),
                    _ => new TajiduoCheckIn(network, effects, new TestRotation(), TimeProvider.System).SignAsync(material, default).GetAwaiter().GetResult() };
                Assert(network.Requests.Count == 0 && effects.Submitted.Count == 0 && result.Success == (state == "confirmed"));
            });
    }

    private static void Assert(bool value)
    {
        if (!value) throw new InvalidOperationException("assertion_failed");
    }
}
