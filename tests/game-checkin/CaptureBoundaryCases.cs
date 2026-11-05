using NexusPipeline.Extensions.GameCheckIn;

internal static class CaptureBoundaryCases
{
    internal static void Run(Action<string, Action> run)
    {
        void Assert(bool condition) { if (!condition) throw new InvalidOperationException("assertion_failed"); }
        void Reject(Func<CredentialMaterial> action)
        {
            try { using var material = action(); }
            catch (CheckInFailure) { return; }
            throw new InvalidOperationException("expected_capture_rejection");
        }
        run("capture-final-normalization-rejects-cross-domain-half-pairs", () =>
            Reject(() => LoginCapture.Normalize("cn", new([
                new(".mihoyo.com", "/", "cookie_token_v2", "synthetic-token"),
                new(".miyoushe.com", "/", "account_id_v2", "123456")], [], []))));
        foreach (var platform in new[] { "cn", "os" })
            run("capture-final-normalization-rejects-legacy-v2-account-conflict/" + platform, () => {
                var domain = platform == "cn" ? ".mihoyo.com" : ".hoyolab.com";
                var token = platform == "cn" ? "cookie_token" : "ltoken";
                var account = platform == "cn" ? "account_id" : "ltuid";
                Reject(() => LoginCapture.Normalize(platform, new([
                    new(domain, "/", token + "_v2", "synthetic-token"), new(domain, "/", account + "_v2", "123456"),
                    new(domain, "/", account, "654321")], [], [])));
            });
        run("capture-incomplete-v2-does-not-replace-complete-legacy-pair", () => {
            using var material = LoginCapture.Normalize("cn", new([
                new(".mihoyo.com", "/", "cookie_token_v2", "incomplete-v2"),
                new(".miyoushe.com", "/", "cookie_token", "complete-legacy"),
                new(".miyoushe.com", "/", "account_id", "123456")], [], []));
            material.Use(value => Assert(value.SequenceEqual("cookie_token=complete-legacy; account_id=123456")));
        });
        run("capture-complete-v2-replaces-legacy-pair-with-same-account", () => {
            using var material = LoginCapture.Normalize("cn", new([
                new(".mihoyo.com", "/", "cookie_token_v2", "complete-v2"), new(".mihoyo.com", "/", "account_id_v2", "123456"),
                new(".miyoushe.com", "/", "cookie_token", "complete-legacy"), new(".miyoushe.com", "/", "account_id", "123456")], [], []));
            material.Use(value => Assert(value.SequenceEqual("cookie_token_v2=complete-v2; account_id_v2=123456")));
        });
        run("capture-optional-mid-conflict-is-not-hidden-by-complete-pair", () =>
            Reject(() => LoginCapture.Normalize("cn", new([
                new(".mihoyo.com", "/", "cookie_token_v2", "synthetic-token"), new(".mihoyo.com", "/", "account_id_v2", "123456"),
                new(".mihoyo.com", "/", "account_mid_v2", "mid-a"), new(".miyoushe.com", "/", "account_mid_v2", "mid-b")], [], []))));
        foreach (var device in new[] { "{}", "{\"id\":123}", "{\"id\":\"first\",\"id\":\"second\"}", "{\"id\":\"device id\"}" })
            run("capture-skland-rejects-unusable-device-with-valid-passport/" + device, () =>
                Reject(() => LoginCapture.Normalize("skland", new([], [new("https://www.skland.com", "localStorage", "SK_SHUMEI_DEVICE_ID_KEY", device)],
                    [new("passport-token", "synthetic-token")]))));
        run("capture-kuro-token-without-optional-distinct-keeps-no-device-identity", () => {
            using var material = LoginCapture.Normalize("kuro", new([], [new("https://www.kurobbs.com", "localStorage", "auth_token", "synthetic-token")], []));
            Assert(material.Web is { Platform: "kuro", DeviceId: null, DistinctId: null });
        });
        run("capture-kuro-present-invalid-distinct-is-not-silently-dropped", () =>
            Reject(() => LoginCapture.Normalize("kuro", new([], [new("https://www.kurobbs.com", "localStorage", "auth_token", "synthetic-token"),
                new("https://www.kurobbs.com", "localStorage", "distinct_id", "bad device")], []))));
    }
}
