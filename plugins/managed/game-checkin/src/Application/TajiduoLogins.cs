namespace NexusPipeline.Extensions.GameCheckIn;

internal sealed record CheckInNativeAvailability(bool NativeReady, bool BrowserReady);
internal interface ICheckInNativeLogin
{
    ValueTask<CheckInNativeAvailability> ReadAsync(CheckInClient client, CancellationToken cancellationToken);
    ValueTask RequireAsync(CheckInClient client, CancellationToken cancellationToken);
}
internal sealed class TajiduoLogins(CheckInEditors editors, TajiduoAuthentication authentication, ICheckInNativeLogin native, TimeProvider clock) : IDisposable
{
    private sealed class Session(CheckInClient owner, CredentialLoginBinding binding, long start) : IDisposable
    {
        internal CheckInClient Owner = owner;
        internal CredentialLoginBinding Binding = binding;
        internal long Start = start;
        internal readonly string Device = Guid.NewGuid().ToString("D");
        internal readonly CancellationTokenSource Cancellation = CancellationTokenSource.CreateLinkedTokenSource(owner.Lifetime);
        internal bool Busy, Accepted;
        private int disposed;
        public void Dispose() { if (Interlocked.Exchange(ref disposed, 1) == 0) CheckInCancellation.Stop(Cancellation); }
    }
    private readonly Dictionary<Guid, Session> sessions = [];
    private readonly Dictionary<(Guid Scope, Guid Client), (long Sent, CancellationToken Lifetime)> smsSent = [];
    private bool disposed;
    internal async ValueTask<Guid> PrepareAsync(CheckInClient client, string editorId, long fieldGeneration, CancellationToken cancellationToken)
    {
        client.Require(); await native.RequireAsync(client, cancellationToken);
        lock (sessions)
        {
            ObjectDisposedException.ThrowIf(disposed, this); Prune();
            foreach (var previous in sessions.Where(pair => pair.Value.Accepted && Same(pair.Value.Owner, client) && pair.Value.Binding.EditorSessionId == editorId).Select(pair => pair.Key).ToArray())
            { sessions[previous].Dispose(); sessions.Remove(previous); }
            if (sessions.Count >= 256) throw new CheckInFailure("tajiduo_login_limit");
            if (sessions.Values.Any(session => Same(session.Owner, client) && session.Binding.EditorSessionId == editorId))
                throw new CheckInFailure("tajiduo_login_busy");
            var binding = editors.Get(client, editorId).Prepare(client, "tajiduo", fieldGeneration);
            var id = Guid.NewGuid(); sessions.Add(id, new(client, binding, clock.GetTimestamp())); return id;
        }
    }
    internal async ValueTask SendCodeAsync(CheckInClient client, Guid id, string phone, CancellationToken cancellationToken)
    {
        TajiduoAuthentication.Validate("send", phone, "");
        var session = Enter(client, id, null);
        try
        {
            await native.RequireAsync(client, cancellationToken);
            lock (sessions)
            {
                var key = (client.ActivationScopeId, client.ClientId);
                if (smsSent.TryGetValue(key, out var previous) && clock.GetElapsedTime(previous.Sent) < TimeSpan.FromSeconds(60))
                    throw new CheckInFailure("tajiduo_sms_cooldown");
                if (!smsSent.ContainsKey(key) && smsSent.Count >= 256) throw new CheckInFailure("tajiduo_login_limit");
                smsSent[key] = (clock.GetTimestamp(), client.Lifetime);
            }
            using var linked = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken, session.Cancellation.Token);
            await authentication.SendCodeAsync(phone, session.Device, linked.Token);
        }
        finally { Exit(session); }
    }
    internal async ValueTask<string> LoginAsync(CheckInClient client, Guid id, string editorId, string mode, string phone,
        CredentialMaterial secret, CancellationToken cancellationToken)
    {
        var session = Enter(client, id, editorId);
        try
        {
            await native.RequireAsync(client, cancellationToken);
            using var linked = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken, session.Cancellation.Token);
            var candidate = await authentication.LoginAsync(mode, phone, secret, session.Device, linked.Token);
            try
            {
                linked.Token.ThrowIfCancellationRequested();
                lock (sessions)
                {
                    _ = Require(client, id, editorId);
                    var accepted = editors.Get(client, editorId).Accept(client, session.Binding, candidate);
                    session.Accepted = true; session.Dispose(); return accepted;
                }
            }
            catch { candidate.Dispose(); throw; }
        }
        finally { Exit(session); }
    }
    internal void Cancel(CheckInClient client, Guid id, string editorId)
    {
        lock (sessions)
        {
            if (!sessions.ContainsKey(id)) { _ = editors.Get(client, editorId); return; }
            var session = Require(client, id, editorId); sessions.Remove(id); session.Dispose();
            editors.Get(client, editorId).CancelBoundLogin(client, session.Binding);
        }
    }
    internal void CloseEditor(CheckInClient client, string editorId)
    {
        lock (sessions)
        {
            _ = editors.Get(client, editorId);
            foreach (var id in sessions.Where(pair => Same(pair.Value.Owner, client) && pair.Value.Binding.EditorSessionId == editorId).Select(pair => pair.Key).ToArray())
            { var session = sessions[id]; sessions.Remove(id); session.Dispose(); }
        }
    }
    internal void ForgetEditor(CheckInClient client, string editorId)
    {
        lock (sessions)
            foreach (var id in sessions.Where(pair => Same(pair.Value.Owner, client) && pair.Value.Binding.EditorSessionId == editorId).Select(pair => pair.Key).ToArray())
            { sessions[id].Dispose(); sessions.Remove(id); }
    }
    private Session Enter(CheckInClient client, Guid id, string? editorId)
    {
        lock (sessions)
        {
            var session = Require(client, id, editorId);
            if (session.Busy || session.Accepted) throw new CheckInFailure("tajiduo_login_busy");
            session.Busy = true; return session;
        }
    }
    private void Exit(Session session) { lock (sessions) session.Busy = false; }
    private Session Require(CheckInClient client, Guid id, string? editorId)
    {
        ObjectDisposedException.ThrowIf(disposed, this); client.Require(); Prune();
        if (!sessions.TryGetValue(id, out var session)) throw new CheckInFailure("tajiduo_login_expired");
        if (!Same(session.Owner, client) || editorId is not null && editorId != session.Binding.EditorSessionId)
            throw new CheckInFailure("credential_editor_owner_mismatch");
        _ = editors.Get(client, session.Binding.EditorSessionId); return session;
    }
    private void Prune()
    {
        foreach (var id in sessions.Where(pair => pair.Value.Owner.Lifetime.IsCancellationRequested || clock.GetElapsedTime(pair.Value.Start) >= TimeSpan.FromMinutes(15)).Select(pair => pair.Key).ToArray())
        { var session = sessions[id]; sessions.Remove(id); session.Dispose(); }
        foreach (var key in smsSent.Where(pair => pair.Value.Lifetime.IsCancellationRequested || clock.GetElapsedTime(pair.Value.Sent) >= TimeSpan.FromSeconds(60)).Select(pair => pair.Key).ToArray())
            smsSent.Remove(key);
    }
    private static bool Same(CheckInClient left, CheckInClient right) => left.ActivationScopeId == right.ActivationScopeId && left.ClientId == right.ClientId;
    public void Dispose()
    {
        lock (sessions)
        { if (disposed) return; disposed = true; foreach (var session in sessions.Values) session.Dispose(); sessions.Clear(); smsSent.Clear(); }
    }
}
