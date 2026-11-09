using NexusPipeline.Extensions.GameCheckIn;

internal static class IdentityCases
{
    internal static void Run(Action<string, Action> run)
    {
        static void Assert(bool value) { if (!value) throw new InvalidOperationException("assertion_failed"); }
        foreach (var platform in new[] { "cn", "os", "skland", "skport", "kuro" })
            run("production-current-account-verification-does-not-claim-or-submit/" + platform, () =>
            {
                var replies = platform switch {
                    "cn" or "os" => new[] { "{\"retcode\":0,\"data\":{\"user_info\":{\"uid\":\"123456\"}}}" },
                    "kuro" => ["{\"code\":200,\"data\":{\"mine\":{\"userId\":\"123456\"}}}", "{\"code\":200,\"data\":[]}", "{\"code\":200,\"data\":[]}"],
                    _ => ["{\"status\":0,\"data\":{\"code\":\"synthetic-code\"}}", "{\"code\":0,\"data\":{\"cred\":\"synthetic-cred\",\"token\":\"synthetic-signkey\"}}",
                        platform == "skland" ? "{\"code\":0,\"data\":{\"user\":{\"id\":\"123456\"}}}" : "{\"code\":0,\"data\":{\"user\":{\"basicUser\":{\"id\":\"123456\"}}}}",
                        "{\"code\":0,\"data\":{\"list\":[]}}"] };
                var effects = new TestEffects(); var network = new ClientNetwork(effects, replies) { RequireGameGate = false }; var device = new TestDevice();
                var value = platform == "cn" ? "cookie_token_v2=synthetic; account_id_v2=123456" : platform == "os" ? "ltoken_v2=synthetic; ltuid_v2=123456" : "synthetic-token";
                using var captured = new CredentialMaterial(value, "browser", web: platform == "skland" ? new("skland", "Bsynthetic-web-device") : null);
                using var verified = new CheckInIdentity(network, device, TimeProvider.System).VerifyAsync(platform, captured, default).GetAwaiter().GetResult();
                Assert(verified.MaskedAccount == platform + " · 12**56" && !effects.Began && network.Posts == 0 && device.Calls == 0);
                Assert(!network.Requests.Any(request => ClientNetwork.BusinessPost(new Uri(request.Address).AbsolutePath)));
            });
        run("current-account-role-mismatch-is-not-an-accepted-browser-candidate", () =>
        {
            var network = new ClientNetwork(new(), "{\"code\":200,\"data\":{\"mine\":{\"userId\":\"123456\"}}}",
                "{\"code\":200,\"data\":[{\"gameId\":\"3\",\"roleId\":\"789\",\"serverId\":\"1\",\"userId\":\"654321\"}]}") { RequireGameGate = false };
            using var capture = new CredentialMaterial("synthetic-token", "browser");
            try { using var accepted = new CheckInIdentity(network, new TestDevice(), TimeProvider.System).VerifyAsync("kuro", capture, default).GetAwaiter().GetResult(); }
            catch (CheckInFailure error) when (error.Code == "credential_capture_ambiguous") { Assert(network.Posts == 0); return; }
            throw new InvalidOperationException("mismatched_role_accepted");
        });
    }
}
