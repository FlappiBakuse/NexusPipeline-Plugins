using NexusPipeline.Extensions.GameCheckIn;
using NexusPipeline.Extensibility.Lifecycle;
using NexusPipeline.Extensibility.Secrets;

internal static class CaptureCases
{
    internal static async Task RunAsync(Func<string, Func<Task>, Task> run)
    {
        static void Assert(bool value) { if (!value) throw new InvalidOperationException("assertion_failed"); }
        foreach (var platform in new[] { "cn", "os", "skland", "skport", "kuro" })
            await run("actual-capture-sdk-frozen-selectors-final-normalize-and-draft-disposal/" + platform, async () => {
                var desktop = new Desktop { Platform = platform }; await using var capture = new SdkCheckInBrowser(desktop);
                var result = await capture.CaptureAsync(Client(), LoginPolicies.For(platform), Guid.NewGuid(), default);
                using var material = LoginCapture.Normalize(platform, result);
                var policy = desktop.Policy ?? throw new InvalidOperationException("capture_policy_missing");
                Assert(material.Source == "browser" && desktop.Calls == 1 && policy.Id == "checkin-" + platform + "-v1");
                if (platform == "skland") Assert(material.Web?.DeviceId == "synthetic-device");
                if (platform == "kuro") Assert(material.Web?.DistinctId == "synthetic-distinct");
                if (platform is "cn" or "os")
                {
                    var token = platform == "cn" ? "cookie_token_v2" : "ltoken_v2"; var id = platform == "cn" ? "account_id_v2" : "ltuid_v2";
                    material.Use(value => Assert(value.SequenceEqual(token + "=synthetic-token; " + id + "=123456")));
                    Assert(policy.ReadySets.Count == (platform == "cn" ? 4 : 2) && policy.EqualSets.Count > 0);
                }
                foreach (var draft in desktop.Drafts) Cleared(draft);
                Assert(policy.JsonRequests.All(rule => rule.Method == (platform == "skland" ? "POST" : "GET")));
            });
        await run("actual-capture-sdk-unknown-selector-rejected-and-every-draft-cleared", async () => {
            var desktop = new Desktop { Platform = "kuro", Foreign = true }; await using var capture = new SdkCheckInBrowser(desktop);
            await RejectAsync(() => capture.CaptureAsync(Client(), LoginPolicies.For("kuro"), Guid.NewGuid(), default).AsTask(), "credential_capture_invalid");
            foreach (var draft in desktop.Drafts) Cleared(draft);
        });
        await run("actual-capture-sdk-policy-copy-cannot-change-official-origins", async () => {
            var desktop = new Desktop(); await using var capture = new SdkCheckInBrowser(desktop);
            await RejectAsync(() => capture.CaptureAsync(Client(), LoginPolicies.For("cn") with { Origins = ["https://evil.test"] }, Guid.NewGuid(), default).AsTask(), "credential_capture_policy_invalid");
            Assert(desktop.Calls == 0);
        });
        await run("actual-capture-sdk-null-desktop-preserves-manual-only", async () => {
            await using var capture = new SdkCheckInBrowser(null);
            await RejectAsync(() => capture.CaptureAsync(Client(), LoginPolicies.For("cn"), Guid.NewGuid(), default).AsTask(), "client_not_supported");
        });
        await run("actual-capture-sdk-cancel-waits-host-cleanup-before-completing", async () => {
            var desktop = new Desktop { Hold = true }; await using var capture = new SdkCheckInBrowser(desktop); var client = Client(); var nonce = Guid.NewGuid();
            var pending = capture.CaptureAsync(client, LoginPolicies.For("cn"), nonce, default).AsTask(); await desktop.Entered.Task;
            var cancel = capture.CancelAsync(client, nonce, default).AsTask(); await desktop.Cancelled.Task;
            Assert(!pending.IsCompleted && !cancel.IsCompleted); desktop.Cleanup.SetResult(); await cancel; await CancelledAsync(pending);
        });
        await run("actual-capture-sdk-scope-stop-and-repeat-dispose-wait-same-cleanup", async () => {
            var desktop = new Desktop { Hold = true }; var capture = new SdkCheckInBrowser(desktop);
            var pending = capture.CaptureAsync(Client(), LoginPolicies.For("cn"), Guid.NewGuid(), default).AsTask(); await desktop.Entered.Task;
            var first = capture.DisposeAsync().AsTask(); await desktop.Cancelled.Task; var second = capture.DisposeAsync().AsTask();
            Assert(!first.IsCompleted && !second.IsCompleted && !pending.IsCompleted); desktop.Cleanup.SetResult(); await Task.WhenAll(first, second); await CancelledAsync(pending);
            try { await capture.CaptureAsync(Client(), LoginPolicies.For("cn"), Guid.NewGuid(), default); }
            catch (ObjectDisposedException) { return; }
            throw new InvalidOperationException("disposed_capture_reused");
        });
        await run("actual-capture-sdk-cross-client-cancel-cannot-close-original-session", async () => {
            var desktop = new Desktop { Hold = true }; await using var capture = new SdkCheckInBrowser(desktop); var client = Client(); var nonce = Guid.NewGuid();
            var pending = capture.CaptureAsync(client, LoginPolicies.For("cn"), nonce, default).AsTask(); await desktop.Entered.Task;
            await capture.CancelAsync(Client(), nonce, default); Assert(!desktop.Cancelled.Task.IsCompleted);
            await RejectAsync(() => capture.CancelAsync(client with { ActivationScopeId = Guid.NewGuid() }, nonce, default).AsTask(), "credential_editor_owner_mismatch");
            var cancel = capture.CancelAsync(client, nonce, default).AsTask(); await desktop.Cancelled.Task; desktop.Cleanup.SetResult(); await cancel; await CancelledAsync(pending);
        });
        await run("actual-capture-sdk-client-retirement-cancels-before-candidate-can-escape", async () => {
            using var lifetime = new CancellationTokenSource(); var desktop = new Desktop { Hold = true }; await using var capture = new SdkCheckInBrowser(desktop);
            var pending = capture.CaptureAsync(Client() with { Lifetime = lifetime.Token }, LoginPolicies.For("cn"), Guid.NewGuid(), default).AsTask(); await desktop.Entered.Task;
            lifetime.Cancel(); await desktop.Cancelled.Task; Assert(!pending.IsCompleted); desktop.Cleanup.SetResult(); await CancelledAsync(pending);
        });
    }
    private static CheckInClient Client() => new(Guid.NewGuid(), Guid.NewGuid(), default);
    private static void Cleared(SecretDraft draft)
    { try { draft.Use(_ => { }); } catch (ObjectDisposedException) { return; } throw new InvalidOperationException("captured_draft_not_cleared"); }
    private static async Task RejectAsync(Func<Task> action, string code)
    { try { await action(); } catch (CheckInFailure error) when (error.Code == code) { return; } throw new InvalidOperationException("expected_" + code); }
    private static async Task CancelledAsync(Task task)
    { try { await task; } catch (OperationCanceledException) { return; } throw new InvalidOperationException("expected_capture_cancelled"); }
    private sealed class Desktop : IExtensionDesktop
    {
        internal string Platform = "cn";
        internal bool Hold, Foreign;
        internal int Calls;
        internal BrowserLoginPolicy? Policy;
        internal readonly List<SecretDraft> Drafts = [];
        internal readonly TaskCompletionSource Entered = new(TaskCreationOptions.RunContinuationsAsynchronously),
            Cancelled = new(TaskCreationOptions.RunContinuationsAsynchronously), Cleanup = new(TaskCreationOptions.RunContinuationsAsynchronously);
        public ValueTask<Guid?> ReadSessionAsync(CancellationToken cancellationToken) => throw new InvalidOperationException("session_is_not_capture_authority");
        public async ValueTask<BrowserLoginCapture> CaptureAsync(BrowserLoginPolicy policy, CancellationToken cancellationToken)
        {
            Calls++; Policy = policy; Entered.SetResult();
            if (Hold)
            {
                try { await Task.Delay(Timeout.InfiniteTimeSpan, cancellationToken); }
                finally { Cancelled.SetResult(); await Cleanup.Task; }
            }
            var values = new Dictionary<string, SecretDraft>(StringComparer.Ordinal);
            void Add(string id, string value) { var draft = new SecretDraft(value); Drafts.Add(draft); values.Add(id, draft); }
            if (Platform is "cn" or "os")
            {
                var token = Platform == "cn" ? "cookie_token_v2" : "ltoken_v2"; var account = Platform == "cn" ? "account_id_v2" : "ltuid_v2";
                Add(policy.Cookies.First(rule => rule.Name == token).Id, "synthetic-token"); Add(policy.Cookies.First(rule => rule.Name == account).Id, "123456");
            }
            else if (Platform is "skland" or "skport")
            { Add("passport-token", "synthetic-token"); if (Platform == "skland") Add("device", "{\"id\":\"synthetic-device\"}"); }
            else { Add("auth-token", "synthetic-token"); Add("distinct-id", "synthetic-distinct"); }
            if (Foreign) Add("unrequested-selector", "synthetic-foreign");
            return new(values);
        }
    }
}
