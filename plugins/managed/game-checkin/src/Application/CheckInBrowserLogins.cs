namespace NexusPipeline.Extensions.GameCheckIn;

internal interface ICheckInBrowserCapture : IAsyncDisposable
{
    ValueTask<BrowserCredentialCapture> CaptureAsync(CheckInClient client, CheckInLoginPolicy policy, Guid nonce, Func<BrowserCredentialCapture, CancellationToken, ValueTask<bool>> validate, CancellationToken cancellationToken);
    ValueTask CancelAsync(CheckInClient client, Guid nonce, CancellationToken cancellationToken);
}
internal sealed record CheckInLoginCandidate(string CandidateId, long FieldGeneration);
internal sealed class CheckInBrowserLogins(CheckInEditors editors, ICheckInNativeLogin native, ICheckInBrowserCapture capture,
    Func<string, CredentialMaterial, CancellationToken, Task<CredentialMaterial>> verify) : IDisposable
{
    private sealed class Session(CheckInClient client, CredentialLoginBinding binding) : IDisposable
    {
        internal readonly CheckInClient Client = client;
        internal readonly CredentialLoginBinding Binding = binding;
        internal readonly CancellationTokenSource Cancellation = CancellationTokenSource.CreateLinkedTokenSource(client.Lifetime);
        internal bool Accepted;
        private int disposed;
        public void Dispose() { if (Interlocked.Exchange(ref disposed, 1) == 0) CheckInCancellation.Stop(Cancellation); }
    }
    private readonly Dictionary<(Guid Client, string Editor, string Platform), Session> sessions = [];
    private bool disposed;
    internal async ValueTask<CheckInLoginCandidate> BeginAsync(CheckInClient client, string editorId, string platform,
        long generation, CancellationToken cancellationToken)
    {
        client.Require(); var policy = LoginPolicies.For(platform); await native.RequireAsync(client, cancellationToken);
        var key = (client.ClientId, editorId, platform); Session session;
        lock (sessions)
        {
            ObjectDisposedException.ThrowIf(disposed, this);
            foreach (var old in sessions.Where(pair => pair.Value.Client.Lifetime.IsCancellationRequested).Select(pair => pair.Key).ToArray())
            { sessions[old].Dispose(); sessions.Remove(old); }
            if (sessions.TryGetValue(key, out var previous))
            {
                if (!previous.Accepted) throw new CheckInFailure("credential_login_busy");
                previous.Dispose(); sessions.Remove(key);
            }
            if (sessions.Count >= 256) throw new CheckInFailure("credential_login_limit");
            session = new(client, editors.Get(client, editorId).Prepare(client, platform, generation)); sessions.Add(key, session);
        }
        CredentialMaterial? validated = null;
        try
        {
            using var linked = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken, session.Cancellation.Token);
            _ = await capture.CaptureAsync(client, policy, session.Binding.Nonce, async (result, token) =>
            {
                using var captured = LoginCapture.Normalize(platform, result);
                try { validated = await verify(platform, captured, token); return true; }
                catch (CheckInFailure) { return false; }
            }, linked.Token);
            linked.Token.ThrowIfCancellationRequested();
            var verified = validated ?? throw new CheckInFailure("credential_login_validation_required");
            validated = null;
            try
            {
                linked.Token.ThrowIfCancellationRequested();
                lock (sessions)
                {
                    if (disposed || sessions.GetValueOrDefault(key) != session) throw new CheckInFailure("credential_binding_stale");
                    var editor = editors.Get(client, editorId);
                    var candidate = editor.Accept(client, session.Binding, verified); session.Accepted = true;
                    return new(candidate, editor.View(client).Fields[platform].FieldGeneration);
                }
            }
            catch { verified.Dispose(); throw; }
        }
        catch
        {
            validated?.Dispose();
            lock (sessions)
            {
                if (sessions.GetValueOrDefault(key) == session)
                {
                    sessions.Remove(key);
                    try { editors.Get(client, editorId).CancelBoundLogin(client, session.Binding); }
                    catch (CheckInFailure) { }
                }
                session.Dispose();
            }
            throw;
        }
    }
    internal async ValueTask CancelAsync(CheckInClient client, string editorId, string platform, CancellationToken cancellationToken)
    {
        Session? session; var key = (client.ClientId, editorId, platform);
        lock (sessions)
        {
            client.Require(); _ = editors.Get(client, editorId);
            session = sessions.GetValueOrDefault(key);
            if (session is null) return;
            if (session.Client.ActivationScopeId != client.ActivationScopeId) throw new CheckInFailure("credential_editor_owner_mismatch");
            sessions.Remove(key); session.Dispose();
            editors.Get(client, editorId).CancelBoundLogin(client, session.Binding);
        }
        await capture.CancelAsync(client, session.Binding.Nonce, cancellationToken);
    }
    internal async ValueTask CloseEditorAsync(CheckInClient client, string editorId, CancellationToken cancellationToken)
    {
        _ = editors.Get(client, editorId);
        foreach (var platform in CheckInCatalog.Platforms.Where(platform => platform.Id != "tajiduo"))
            await CancelAsync(client, editorId, platform.Id, cancellationToken);
    }
    internal void ForgetEditor(CheckInClient client, string editorId)
    {
        lock (sessions)
            foreach (var key in sessions.Where(pair => pair.Key.Client == client.ClientId && pair.Key.Editor == editorId &&
                pair.Value.Client.ActivationScopeId == client.ActivationScopeId).Select(pair => pair.Key).ToArray())
            { sessions[key].Dispose(); sessions.Remove(key); }
    }
    public void Dispose()
    {
        lock (sessions)
        { if (disposed) return; disposed = true; foreach (var session in sessions.Values) session.Dispose(); sessions.Clear(); }
    }
}
