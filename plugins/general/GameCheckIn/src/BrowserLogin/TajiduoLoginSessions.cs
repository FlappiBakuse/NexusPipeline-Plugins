using System.Text.Json.Nodes;
using NexusPipeline.Plugin.Abstractions;
using NexusPipeline.Plugin.GameCheckIn.Credentials;

namespace NexusPipeline.Plugin.GameCheckIn.BrowserLogin;

internal sealed class TajiduoLoginSessions(CredentialDraftService drafts, IPluginHttpClientFactory http) : IDisposable
{
    private readonly object _sync = new();
    private readonly Dictionary<string, Session> _sessions = new(StringComparer.Ordinal);
    private readonly Dictionary<(string Host, string Client), long> _smsTimes = [];
    private bool _stopped;
    private sealed class Session(PluginBrowserInvocation invocation)
    {
        internal readonly PluginBrowserInvocation Invocation = invocation;
        internal readonly string Device = Guid.NewGuid().ToString();
        internal readonly long Created = Environment.TickCount64;
        internal readonly CancellationTokenSource Cancellation = CancellationTokenSource.CreateLinkedTokenSource(invocation.ClientSession.Lifetime);
        internal bool Busy;
        internal bool Completed;
    }
    internal LoginPreparation Prepare(PluginClientSessionContext client, string editor, long generation)
    {
        lock (_sync)
        {
            Sweep();
            if (_stopped) throw new CredentialException("service_stopping");
            if (_sessions.Count >= 256) throw new CredentialException("credential_editor_limit");
            if (drafts.State(client, editor).Fields["tajiduo"].FieldGeneration != generation) throw new CredentialException("credential_field_stale");
            CancelEditor(client, editor);
            var preparation = drafts.Prepare(client, editor, "tajiduo", generation);
            var invocation = new PluginBrowserInvocation(Guid.NewGuid().ToString("N"), editor, preparation.FieldGeneration, preparation.Context, client);
            _sessions.Add(invocation.OperationId, new(invocation));
            var context = (JsonObject)preparation.Context.DeepClone();
            context["operation"] = invocation.OperationId;
            return preparation with { Context = context };
        }
    }
    internal async Task<CredentialEditorView?> Submit(PluginClientSessionContext client, string editor, string operation, string mode, string phone, string value, CancellationToken token)
    {
        Session session;
        lock (_sync)
        {
            Sweep();
            if (_stopped || !_sessions.TryGetValue(operation, out session!) || session.Invocation.EditorSessionId != editor)
                throw new CredentialException("credential_binding_stale");
            drafts.State(client, editor);
            if (mode == "accept" && session.Completed)
            {
                _sessions.Remove(operation); session.Cancellation.Dispose();
                return drafts.State(client, editor);
            }
            drafts.ValidateInvocation(session.Invocation with { ClientSession = client }, "tajiduo");
            if (session.Busy) throw new CredentialException("tajiduo_login_busy");
            if (mode == "send")
            {
                var key = (client.HostSessionId, client.ClientSessionId);
                if (_smsTimes.TryGetValue(key, out long sent) && Environment.TickCount64 - sent < 60000) throw new CredentialException("tajiduo_sms_cooldown");
                _smsTimes[key] = Environment.TickCount64;
            }
            session.Busy = true;
        }
        using var deadline = CancellationTokenSource.CreateLinkedTokenSource(token, session.Cancellation.Token);
        deadline.CancelAfter(TimeSpan.FromSeconds(60));
        bool activated = false;
        try
        {
            var record = await new TajiduoLoginClient(http).LoginAsync(mode, phone, value, session.Device, deadline.Token);
            if (record is null) return null;
            lock (_sync)
            {
                deadline.Token.ThrowIfCancellationRequested();
                drafts.Provisional(session.Invocation, "tajiduo", record);
                drafts.Terminal(session.Invocation, "tajiduo", PluginBrowserLoginTerminal.Completed);
                activated = true;
                session.Completed = true;
                deadline.Token.ThrowIfCancellationRequested();
                return drafts.State(client, editor);
            }
        }
        catch
        {
            if (activated) drafts.Terminal(session.Invocation, "tajiduo", PluginBrowserLoginTerminal.Cancelled);
            throw;
        }
        finally
        {
            lock (_sync)
            {
                session.Busy = false;
                if (session.Cancellation.IsCancellationRequested)
                { _sessions.Remove(operation); session.Cancellation.Dispose(); }
            }
        }
    }
    internal void CancelOperation(PluginClientSessionContext client, string editor, string operation)
    {
        lock (_sync)
        {
            if (!_sessions.TryGetValue(operation, out var session) || session.Invocation.EditorSessionId != editor) return;
            drafts.State(client, editor);
            Cancel(operation, session);
        }
    }
    internal void CancelEditor(PluginClientSessionContext client, string editor)
    {
        lock (_sync)
        {
            // Verify ownership before cancellation, including editors with an in-flight request.
            var entries = _sessions.Where(p => p.Value.Invocation.EditorSessionId == editor).ToArray();
            if (entries.Length != 0) drafts.State(client, editor);
            foreach (var entry in entries) Cancel(entry.Key, entry.Value);
        }
    }
    private void Cancel(string id, Session session)
    {
        _sessions.Remove(id);
        session.Cancellation.Cancel();
        try { drafts.Terminal(session.Invocation, "tajiduo", PluginBrowserLoginTerminal.Cancelled); }
        catch (CredentialException) when (session.Invocation.ClientSession.Lifetime.IsCancellationRequested) { }
        if (!session.Busy) session.Cancellation.Dispose();
    }
    private void Sweep()
    {
        foreach (var entry in _sessions.Where(p => p.Value.Cancellation.IsCancellationRequested || Environment.TickCount64 - p.Value.Created >= 900000).ToArray()) Cancel(entry.Key, entry.Value);
        foreach (var key in _smsTimes.Where(p => Environment.TickCount64 - p.Value >= 60000).Select(p => p.Key).ToArray()) _smsTimes.Remove(key);
    }
    public void Dispose()
    {
        lock (_sync) { _stopped = true; foreach (var entry in _sessions.ToArray()) Cancel(entry.Key, entry.Value); _smsTimes.Clear(); }
    }
}
