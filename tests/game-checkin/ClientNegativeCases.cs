using NexusPipeline.Extensions.GameCheckIn;

internal static class ClientNegativeCases
{
    internal static void Run(Action<string, Action> run)
    {
        void Assert(bool value) { if (!value) throw new InvalidOperationException("assertion_failed"); }
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
}
