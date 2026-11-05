using System.Text;
using System.Text.Json;
using NexusPipeline.Extensions.GameCheckIn;
using NexusPipeline.Extensibility.Frontend;

internal static class FrontendCases
{
    internal static async Task RunAsync(Func<string, Func<Task>, Task> run)
    {
        static void Assert(bool value) { if (!value) throw new InvalidOperationException("assertion_failed"); }
        await run("actual-sdk-frontend-waits-for-single-initialization-before-document-read", async () => {
            using var fixture = new Fixture(false); var pending = fixture.Host.InvokeAsync(fixture.Call("read-state"), default).AsTask();
            Assert(!pending.IsCompleted && fixture.Ports.DocumentReads == 0); fixture.Ready.SetResult();
            using var json = JsonDocument.Parse((await pending).Content); var state = json.RootElement.GetProperty("value");
            Assert(json.RootElement.GetProperty("ok").GetBoolean() && state.GetProperty("platforms").EnumerateArray().Sum(platform => platform.GetProperty("games").GetArrayLength()) == 14 && fixture.Ports.DocumentReads == 1);
        });
        await run("actual-sdk-frontend-declares-privacy-desktop-and-write-access-distinctly", () => {
            using var fixture = new Fixture(); var operations = fixture.Host.Operations;
            Assert(operations.Count == 18 && operations.Select(operation => operation.Name).Distinct().Count() == 18);
            foreach (var name in new[] { "confirm-reveal", "reveal-credential" }) Assert(operations.Single(operation => operation.Name == name).Access == FrontendAccess.RevealSecret);
            foreach (var name in new[] { "begin-browser-login", "prepare-tajiduo", "send-tajiduo-code", "login-tajiduo" }) Assert(operations.Single(operation => operation.Name == name).Access == FrontendAccess.Desktop);
            Assert(operations.Single(operation => operation.Name == "cancel-browser-login").Access == FrontendAccess.Write); return Task.CompletedTask;
        });
        await run("actual-sdk-frontend-rejects-missing-client-and-operation-id-without-private-read", async () => {
            using var fixture = new Fixture();
            foreach (var (call, code) in new[] { (fixture.Call("read-state") with { ClientId = null }, "client_session_required"),
                (fixture.Call("reveal-credential") with { OperationId = null }, "checkin_operation_invalid"),
                (fixture.Call("read-state") with { OperationId = Guid.NewGuid() }, "checkin_operation_invalid") })
            {
                using var json = JsonDocument.Parse((await fixture.Host.InvokeAsync(call, default)).Content);
                Assert(!json.RootElement.GetProperty("ok").GetBoolean() && json.RootElement.GetProperty("error").GetProperty("code").GetString() == code);
            }
            Assert(fixture.Ports.DocumentReads == 0);
        });
        await run("actual-sdk-frontend-same-subject-different-host-client-cannot-read-editor", async () => {
            using var fixture = new Fixture();
            using var opened = JsonDocument.Parse((await fixture.Host.InvokeAsync(fixture.Call("open-editor", "{\"taskId\":null,\"expectedRevision\":0}"), default)).Content);
            var id = opened.RootElement.GetProperty("value").GetProperty("editorSessionId").GetString();
            var call = fixture.Call("read-editor", JsonSerializer.Serialize(new { editorSessionId = id })) with { ClientId = Guid.NewGuid() };
            using var denied = JsonDocument.Parse((await fixture.Host.InvokeAsync(call, default)).Content);
            Assert(denied.RootElement.GetProperty("error").GetProperty("code").GetString() == "credential_editor_owner_mismatch");
        });
        await run("actual-sdk-frontend-retired-client-cannot-produce-private-state", async () => {
            using var fixture = new Fixture(); var call = fixture.Call("read-state"); fixture.Client.Cancel();
            try { await fixture.Host.InvokeAsync(call, default); } catch (OperationCanceledException) { Assert(fixture.Ports.DocumentReads == 0); return; }
            throw new InvalidOperationException("retired_client_accepted");
        });
        await run("actual-sdk-frontend-initialization-failure-does-not-become-empty-state", async () => {
            using var fixture = new Fixture(false); fixture.Ready.SetException(new IOException("synthetic_unknown_document"));
            try { await fixture.Host.InvokeAsync(fixture.Call("read-state"), default); } catch (IOException) { Assert(fixture.Ports.DocumentReads == 0); return; }
            throw new InvalidOperationException("initialization_failure_hidden");
        });
        await run("actual-sdk-read-state-distinguishes-native-taji-from-browser-capture-without-require", async () => {
            using var fixture = new Fixture();
            using var json = JsonDocument.Parse((await fixture.Host.InvokeAsync(fixture.Call("read-state"), default)).Content);
            var platforms = json.RootElement.GetProperty("value").GetProperty("platforms").EnumerateArray().ToArray();
            Assert(platforms.Single(platform => platform.GetProperty("id").GetString() == "tajiduo").GetProperty("browserLogin").GetProperty("ready").GetBoolean());
            Assert(platforms.Where(platform => platform.GetProperty("id").GetString() != "tajiduo").All(platform => !platform.GetProperty("browserLogin").GetProperty("ready").GetBoolean()));
        });
    }
    private sealed class Fixture : IDisposable
    {
        internal readonly PersistencePorts Ports = new();
        internal readonly CancellationTokenSource Scope = new(), Client = new();
        internal readonly TaskCompletionSource Ready = new(TaskCreationOptions.RunContinuationsAsynchronously);
        internal readonly SdkCheckInFrontend Host;
        private readonly CheckInClients clients;
        private readonly CheckInEditors editors = new(TimeProvider.System);
        private readonly CredentialRevealGrants grants = new(TimeProvider.System);
        private readonly CheckInBrowserLogins browser;
        private readonly TajiduoLogins tajiduo;
        private readonly Guid clientId = Guid.NewGuid();
        internal Fixture(bool ready = true)
        {
            if (ready) Ready.SetResult(); clients = new(Scope.Token); var persistence = new SdkCheckInPersistence(Ports, Ports, Ports); var native = new Native(); var runtime = new Runtime();
            browser = new(editors, native, new Capture(), (_, _, _) => throw new InvalidOperationException("unexpected_verification"));
            tajiduo = new(editors, new(null!, TimeProvider.System), native, TimeProvider.System);
            var application = new CheckInFrontend(new(persistence, editors, runtime), new(persistence, runtime, native), editors, new(persistence, editors, grants), browser, tajiduo);
            Host = new(application, clients, Ready.Task);
        }
        internal FrontendCall Call(string operation, string input = "{}") => new(operation, operation is "read-state" or "read-editor" or "read-publication" ? null : Guid.NewGuid(),
            "same-subject", true, Encoding.UTF8.GetBytes(input)) { ClientId = clientId, ClientLifetime = Client.Token };
        public void Dispose() { Scope.Cancel(); clients.Dispose(); browser.Dispose(); tajiduo.Dispose(); editors.Dispose(); grants.Dispose(); Ports.Dispose(); Client.Dispose(); Scope.Dispose(); }
    }
    private sealed class Native : ICheckInNativeLogin
    {
        public ValueTask<CheckInNativeAvailability> ReadAsync(CheckInClient client, CancellationToken cancellationToken) => ValueTask.FromResult(new CheckInNativeAvailability(true, false));
        public ValueTask RequireAsync(CheckInClient client, CancellationToken cancellationToken) => throw new InvalidOperationException("read_state_requested_desktop_effect_authority");
    }
    private sealed class Capture : ICheckInBrowserCapture
    {
        public ValueTask DisposeAsync() => ValueTask.CompletedTask;
        public ValueTask<BrowserCredentialCapture> CaptureAsync(CheckInClient client, CheckInLoginPolicy policy, Guid nonce, CancellationToken cancellationToken) => throw new InvalidOperationException("unexpected_capture");
        public ValueTask CancelAsync(CheckInClient client, Guid nonce, CancellationToken cancellationToken) => throw new InvalidOperationException("unexpected_cancel");
    }
    private sealed class Runtime : ICheckInRuntime
    {
        public ValueTask<CheckInRuntimeSnapshot> ReadAsync(CheckInTaskStore store, CancellationToken cancellationToken) => ValueTask.FromResult(new CheckInRuntimeSnapshot("UTC", [], []));
        public ValueTask RunNowAsync(Guid taskId, long expectedTaskRevision, CancellationToken cancellationToken) => throw new InvalidOperationException("unexpected_run");
        public ValueTask<IAsyncDisposable> HoldAsync(Guid taskId, long expectedTaskRevision, CancellationToken cancellationToken) => throw new InvalidOperationException("unexpected_hold");
    }
}
