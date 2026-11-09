using System.Text.Json;
using NexusPipeline.Extensions.GameCheckIn;

internal static class ClientCases
{
    internal static void Run(Action<string, Action> run)
    {
        void Assert(bool value) { if (!value) throw new InvalidOperationException("assertion_failed"); }
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
        ClientNegativeCases.Run(run);
    }
}
