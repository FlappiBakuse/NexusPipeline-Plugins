using NexusPipeline.Extensions.GameCheckIn;

internal static class CancellationCases
{
    internal static void Run(Action<string, Action> run)
    {
        static void Assert(bool value) { if (!value) throw new InvalidOperationException("assertion_failed"); }
        run("scope-stop-clears-all-client-drafts-despite-throwing-cancellation-callback", () =>
        {
            using var host = new CancellationTokenSource(); using var scope = new CancellationTokenSource(); using var clients = new CheckInClients(scope.Token);
            var first = clients.Get(Guid.NewGuid(), host.Token); var second = clients.Get(Guid.NewGuid(), host.Token);
            using var editors = new CheckInEditors(new DraftClock()); var materials = new List<CredentialMaterial>();
            foreach (var client in new[] { first, second })
            {
                var editor = editors.Add(client, null, 0, new Dictionary<string, SavedCredentialField>());
                var material = new CredentialMaterial("synthetic-sensitive-canary", "browser", "kuro · 12**56"); materials.Add(material);
                editor.Accept(client, editor.Prepare(client, "kuro", 0), material);
            }
            using var throwing = first.Lifetime.Register(() => throw new InvalidOperationException("synthetic_callback_failure"));
            clients.Dispose(); Assert(first.Lifetime.IsCancellationRequested && second.Lifetime.IsCancellationRequested);
            foreach (var material in materials)
            { try { material.Use(_ => { }); throw new InvalidOperationException("draft_retained"); } catch (ObjectDisposedException) { } }
        });
        run("login-cancel-clears-pending-binding-despite-throwing-capture-cancellation", () =>
        {
            using var fixture = new FrontendFixture(true); var editor = fixture.Editors.Add(fixture.Client, null, 0, new Dictionary<string, SavedCredentialField>());
            var capture = new ThrowingCapture(); using var browser = new CheckInBrowserLogins(fixture.Editors, new FrontendNativeProof(true), capture,
                (_, material, _) => Task.FromResult(material.Copy()));
            var login = browser.BeginAsync(fixture.Client, editor.Id, "cn", 0, default).AsTask();
            browser.CancelAsync(fixture.Client, editor.Id, "cn", default).AsTask().GetAwaiter().GetResult();
            try { login.GetAwaiter().GetResult(); throw new InvalidOperationException("cancelled_login_accepted"); } catch (OperationCanceledException) { }
            var view = editor.View(fixture.Client).Fields["cn"]; Assert(view.CandidateId is null && capture.Cancels == 1);
            _ = editor.Prepare(fixture.Client, "cn", view.FieldGeneration);
        });
    }
    private sealed class ThrowingCapture : ICheckInBrowserCapture
    {
        public ValueTask DisposeAsync() => ValueTask.CompletedTask;
        private readonly TaskCompletionSource<BrowserCredentialCapture> pending = new(TaskCreationOptions.RunContinuationsAsynchronously);
        internal int Cancels;
        public async ValueTask<BrowserCredentialCapture> CaptureAsync(CheckInClient client, CheckInLoginPolicy policy, Guid nonce, Func<BrowserCredentialCapture, CancellationToken, ValueTask<bool>> validate, CancellationToken cancellationToken)
        {
            using var registration = cancellationToken.Register(() => throw new InvalidOperationException("synthetic_capture_cancel_failure"));
            return await pending.Task;
        }
        public ValueTask CancelAsync(CheckInClient client, Guid nonce, CancellationToken cancellationToken)
        { Cancels++; pending.TrySetCanceled(); return ValueTask.CompletedTask; }
    }
}
