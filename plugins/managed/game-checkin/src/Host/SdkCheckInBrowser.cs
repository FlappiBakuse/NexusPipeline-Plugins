using NexusPipeline.Extensibility.Lifecycle;

namespace NexusPipeline.Extensions.GameCheckIn;

internal sealed class SdkCheckInBrowser(IExtensionDesktop? desktop) : ICheckInBrowserCapture
{
    private sealed class Active(CheckInClient client, CancellationToken cancellation) : IDisposable
    {
        internal readonly Guid ScopeId = client.ActivationScopeId;
        internal readonly CancellationTokenSource Cancellation = CancellationTokenSource.CreateLinkedTokenSource(client.Lifetime, cancellation);
        internal readonly TaskCompletionSource Completed = new(TaskCreationOptions.RunContinuationsAsynchronously);
        internal CancellationToken Token => Cancellation.Token;
        internal void Cancel()
        { try { Cancellation.Cancel(); } catch (AggregateException) { } catch (ObjectDisposedException) { } }
        public void Dispose() => Cancellation.Dispose();
    }
    private readonly Dictionary<(Guid Client, Guid Nonce), Active> active = [];
    private readonly TaskCompletionSource drained = new(TaskCreationOptions.RunContinuationsAsynchronously);
    private bool disposed;
    public async ValueTask<BrowserCredentialCapture> CaptureAsync(CheckInClient client, CheckInLoginPolicy policy, Guid nonce, Func<BrowserCredentialCapture, CancellationToken, ValueTask<bool>> validate, CancellationToken cancellationToken)
    {
        client.Require();
        if (desktop is null) throw new CheckInFailure("client_not_supported");
        if (nonce == Guid.Empty) throw new CheckInFailure("credential_capture_invalid");
        var mapping = SdkCheckInLoginPolicy.For(policy); var key = (client.ClientId, nonce); var current = new Active(client, cancellationToken);
        lock (active)
        {
            if (disposed) { current.Dispose(); throw new ObjectDisposedException(nameof(SdkCheckInBrowser)); }
            if (active.Count >= 256 || !active.TryAdd(key, current)) { current.Dispose(); throw new CheckInFailure("credential_login_busy"); }
        }
        try
        {
            try
            {
                using var captured = await desktop.CaptureValidatedAsync(mapping.Policy, (candidate, token) => validate(mapping.Read(candidate), token), current.Token);
                current.Token.ThrowIfCancellationRequested(); client.Require();
                return mapping.Read(captured);
            }
            catch (NotSupportedException) { throw new CheckInFailure("client_not_supported"); }
        }
        finally
        {
            lock (active) active.Remove(key);
            current.Dispose(); current.Completed.TrySetResult();
        }
    }
    public async ValueTask CancelAsync(CheckInClient client, Guid nonce, CancellationToken cancellationToken)
    {
        Active? current;
        lock (active)
        {
            current = active.GetValueOrDefault((client.ClientId, nonce));
            if (current is not null && current.ScopeId != client.ActivationScopeId) throw new CheckInFailure("credential_editor_owner_mismatch");
        }
        if (current is null) return;
        current.Cancel(); await current.Completed.Task.WaitAsync(cancellationToken);
    }
    public async ValueTask DisposeAsync()
    {
        Active[]? pending;
        lock (active) { pending = disposed ? null : active.Values.ToArray(); disposed = true; }
        if (pending is not null)
        {
            foreach (var current in pending) current.Cancel();
            try { await Task.WhenAll(pending.Select(current => current.Completed.Task)); }
            finally { drained.TrySetResult(); }
        }
        else await drained.Task;
    }
}
