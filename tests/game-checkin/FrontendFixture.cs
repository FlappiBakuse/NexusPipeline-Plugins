using System.Text;
using NexusPipeline.Extensions.GameCheckIn;

internal sealed class FrontendFixture : IDisposable
{
    internal readonly CheckInClient Client = new(Guid.NewGuid(), Guid.NewGuid(), default);
    internal readonly EditingPersistence Persistence = new(new());
    internal readonly FrontendRuntime Runtime = new();
    internal readonly BrowserCapturePort Capture = new();
    internal readonly CheckInEditors Editors;
    internal readonly CheckInBrowserLogins Browser;
    private readonly CredentialRevealGrants grants;
    private readonly TajiduoLogins tajiduo;
    internal readonly CheckInFrontend Frontend;
    internal int Verifications;
    internal FrontendFixture(bool native = false)
    {
        var clock = new DraftClock(); Editors = new(clock); grants = new(clock); var proof = new FrontendNativeProof(native);
        Browser = new(Editors, proof, Capture, (platform, material, token) =>
        {
            Verifications++; string value = ""; material.Use(text => value = text.ToString());
            return System.Threading.Tasks.Task.FromResult(new CredentialMaterial(value, "browser", platform + " · 12**56", material.Web));
        });
        var network = new ClientNetwork(new TestEffects()) { RequireGameGate = false };
        tajiduo = new(Editors, new(network, clock), proof, clock);
        Frontend = new(new(Persistence, Editors, Runtime), new(Persistence, Runtime, proof), Editors, new(Persistence, Editors, grants), Browser, tajiduo);
    }
    internal object Invoke(string operation, string json) => Frontend.InvokeAsync(operation, Guid.NewGuid(), Client, Encoding.UTF8.GetBytes(json), default).Result;
    internal static CheckInTask Task(string name) => new() { Id = Guid.NewGuid(), Revision = 1, Name = name, Games = new() { ["kuro"] = ["ww"] } };
    internal static BrowserCredentialCapture CaptureCn() => new([new(".mihoyo.com", "/", "cookie_token_v2", "synthetic-token"), new(".mihoyo.com", "/", "account_id_v2", "123456")], [], []);
    public void Dispose() { tajiduo.Dispose(); Browser.Dispose(); Editors.Dispose(); grants.Dispose(); }
}
internal sealed class FrontendRuntime : ICheckInRuntime
{
    internal bool Running;
    internal int Runs;
    public ValueTask<CheckInRuntimeSnapshot> ReadAsync(CheckInTaskStore store, CancellationToken cancellationToken) => ValueTask.FromResult(new CheckInRuntimeSnapshot("UTC",
        store.Tasks.Select(task => new CheckInTaskFact(task.Id, Running, null, null, [])).ToArray(), [new("target-one", "one", "webhook", true, true)]));
    public ValueTask RunNowAsync(Guid taskId, long expectedTaskRevision, CancellationToken cancellationToken) { Runs++; return ValueTask.CompletedTask; }
    public ValueTask<IAsyncDisposable> HoldAsync(Guid taskId, long expectedTaskRevision, CancellationToken cancellationToken) => new EditingQuiescence().HoldAsync(taskId, expectedTaskRevision, cancellationToken);
}
internal sealed class EditingQuiescence : ICheckInTaskQuiescence
{
    internal bool Held, Released;
    internal Guid TaskId;
    internal long ExpectedRevision;
    internal Action? OnHold;
    public ValueTask<IAsyncDisposable> HoldAsync(Guid taskId, long expectedTaskRevision, CancellationToken cancellationToken)
    { OnHold?.Invoke(); Held = true; TaskId = taskId; ExpectedRevision = expectedTaskRevision; return ValueTask.FromResult<IAsyncDisposable>(new Lease(this)); }
    private sealed class Lease(EditingQuiescence owner) : IAsyncDisposable
    { public ValueTask DisposeAsync() { owner.Held = false; owner.Released = true; return ValueTask.CompletedTask; } }
}
internal sealed class FrontendNativeProof(bool ready) : ICheckInNativeLogin
{
    public ValueTask<CheckInNativeAvailability> ReadAsync(CheckInClient client, CancellationToken cancellationToken) => ValueTask.FromResult(new CheckInNativeAvailability(ready, ready));
    public ValueTask RequireAsync(CheckInClient client, CancellationToken cancellationToken)
    { if (!ready) throw new CheckInFailure("client_not_supported"); return ValueTask.CompletedTask; }
}
internal sealed class BrowserCapturePort : ICheckInBrowserCapture
{
    public ValueTask DisposeAsync() => ValueTask.CompletedTask;
    internal BrowserCredentialCapture Reply = new([], [], []);
    internal TaskCompletionSource<BrowserCredentialCapture>? Pending;
    internal int Cancels;
    public async ValueTask<BrowserCredentialCapture> CaptureAsync(CheckInClient client, CheckInLoginPolicy policy, Guid nonce, Func<BrowserCredentialCapture, CancellationToken, ValueTask<bool>> validate, CancellationToken cancellationToken)
    {
        var result = Pending is { } pending ? await pending.Task : Reply;
        if (!await validate(result, cancellationToken)) throw new CheckInFailure("credential_login_validation_rejected");
        return result;
    }
    public ValueTask CancelAsync(CheckInClient client, Guid nonce, CancellationToken cancellationToken) { Cancels++; return ValueTask.CompletedTask; }
}
