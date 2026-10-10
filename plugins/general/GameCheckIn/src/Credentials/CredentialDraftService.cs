using System.Text.Json.Nodes;
using NexusPipeline.Plugin.Abstractions;

namespace NexusPipeline.Plugin.GameCheckIn.Credentials;

internal sealed record CredentialFieldState(bool Configured, string? Source, long FieldGeneration, string Intent,
    string? CandidateId = null, string? MaskedAccount = null, DateTimeOffset? ExpiresAt = null, string? Error = null);
internal sealed record CredentialEditorView(string EditorSessionId, long EditorGeneration, Dictionary<string, CredentialFieldState> Fields);
internal sealed record LoginPreparation(string FlowId, string EditorSessionId, long FieldGeneration, JsonObject Context);

internal sealed class CredentialDraftService : IDisposable
{
    private static readonly string[] Platforms = ["cn", "os", "skland", "skport", "kuro"];
    private readonly TimeProvider _time;
    private readonly object _sync = new();
    private readonly Dictionary<string, Editor> _editors = new(StringComparer.Ordinal);
    private readonly Dictionary<(string Host, string Client), Grant> _grants = [];
    private readonly Timer _sweep;
    private bool _stopped;
    internal CredentialDraftService(TimeProvider? timeProvider = null)
    {
        _time = timeProvider ?? TimeProvider.System;
        _sweep = new(_ => Sweep(), null, TimeSpan.FromSeconds(5), TimeSpan.FromSeconds(5));
    }
    private sealed class Grant(long start, DateTimeOffset expiresAt)
    { internal readonly long Start = start;internal readonly DateTimeOffset ExpiresAt = expiresAt;internal CancellationTokenRegistration Cancellation; }
    private sealed record Candidate(string Id, CredentialRecord Record, long Created, long Touched);
    private sealed class Field(string? payload)
    {
        internal string? Baseline = payload;
        internal CredentialRecord? Record;
        internal string? Error;
        internal long Generation;
        internal string Intent = "keep";
        internal Candidate? Candidate;
        internal Pending? Pending;
    }
    private sealed class Pending(string nonce, long generation)
    {
        internal readonly string Nonce = nonce;
        internal readonly long Generation = generation;
        internal string? OperationId;
        internal Candidate? Provisional;
    }
    private sealed class Editor(string id, PluginClientSessionContext client, Guid? taskId, long now)
    {
        internal readonly string Id = id;
        internal readonly PluginClientSessionContext Client = client;
        internal readonly Guid? TaskId = taskId;
        internal readonly long Created = now;
        internal long Touched = now;
        internal readonly Dictionary<string, Field> Fields = new(StringComparer.Ordinal);
        internal readonly Dictionary<string, (string Platform, Candidate Candidate, CredentialRecord? Before, Candidate? BeforeCandidate, string Intent, string? Error)> Activations = new(StringComparer.Ordinal);
        internal bool Released, Reserved;
        internal CancellationTokenRegistration Cancellation;
    }
    internal CredentialEditorView Create(PluginClientSessionContext client, Guid? taskId, IReadOnlyDictionary<string, string?> payloads)
    {
        RequireClient(client);
        lock (_sync)
        {
            Sweep();
            if (_stopped) throw new CredentialException("service_stopping");
            if (_editors.Count >= 256) throw new CredentialException("credential_editor_limit");
            string id = Guid.NewGuid().ToString("N");
            var editor = new Editor(id, client, taskId, _time.GetTimestamp());
            foreach (string platform in Platforms)
            {
                var field = new Field(payloads.GetValueOrDefault(platform));
                try { field.Record = CredentialRecord.Decode(field.Baseline); } catch (CredentialException ex) { field.Error = ex.Code; }
                editor.Fields.Add(platform, field);
            }
            _editors.Add(id, editor);
            editor.Cancellation = client.Lifetime.Register(() => ReleaseOwned(id));
            return View(editor);
        }
    }
    internal CredentialEditorView State(PluginClientSessionContext client, string id) { lock (_sync) return View(Find(client, id)); }
    internal void Release(PluginClientSessionContext client, string id)
    {
        lock (_sync) { if (!_editors.TryGetValue(id, out var editor)) return; Own(editor, client); ReleaseOwned(id); }
    }
    internal void ReleaseTask(Guid taskId)
    {
        lock (_sync) foreach (string id in _editors.Values.Where(e => e.TaskId == taskId).Select(e => e.Id).ToArray()) ReleaseOwned(id);
    }
    private void ReleaseOwned(string id)
    {
        lock (_sync)
        {
            if (!_editors.TryGetValue(id, out var editor)) return;
            editor.Released = true;
            if (editor.Reserved) return;
            _editors.Remove(id);
            editor.Cancellation.Unregister();
            editor.Fields.Clear();
        }
    }
    internal void Lease(PluginClientSessionContext client, string id)
    {
        lock (_sync)
        {
            var editor = Find(client, id);
            foreach (var field in editor.Fields.Values)
                if (field.Candidate is { } candidate)
                {
                    EnsureCandidate(candidate);
                    field.Candidate = candidate with { Touched = _time.GetTimestamp() };
                }
            editor.Touched = _time.GetTimestamp();
        }
    }
    internal DateTimeOffset Confirm(PluginClientSessionContext client)
    {
        RequireClient(client);
        lock (_sync)
        {
            var key = (client.HostSessionId, client.ClientSessionId);
            if (_grants.TryGetValue(key, out var old) && _time.GetElapsedTime(old.Start) < TimeSpan.FromHours(24)) return old.ExpiresAt;
            var grant = new Grant(_time.GetTimestamp(), _time.GetUtcNow().AddHours(24));
            if (old is not null) old.Cancellation.Unregister();
            _grants[key] = grant;
            grant.Cancellation = client.Lifetime.Register(() => { lock (_sync) if (_grants.GetValueOrDefault(key) == grant) _grants.Remove(key); });
            return grant.ExpiresAt;
        }
    }
    internal double RevealRemainingSeconds(PluginClientSessionContext client)
    {
        lock (_sync) { RequireGrant(client);return Math.Max(0, (TimeSpan.FromHours(24) - _time.GetElapsedTime(_grants[(client.HostSessionId, client.ClientSessionId)].Start)).TotalSeconds); }
    }
    private void RequireGrant(PluginClientSessionContext client)
    {
        RequireClient(client);
        if (!_grants.TryGetValue((client.HostSessionId, client.ClientSessionId), out var grant) || _time.GetElapsedTime(grant.Start) >= TimeSpan.FromHours(24))
            throw new CredentialException("reveal_confirmation_required");
    }
    internal (CredentialFieldState State, string? Value) Read(PluginClientSessionContext client, string id, string platform, long generation)
    {
        lock (_sync)
        {
            var field = GetField(Find(client, id), platform, generation);
            if (field.Error is { } error) throw new CredentialException(error);
            if (field.Candidate is { } candidate) EnsureCandidate(candidate);
            if (field.Record?.Source == "browser") RequireGrant(client);
            return (Project(field), field.Record?.Value);
        }
    }
    internal CredentialFieldState Mutate(PluginClientSessionContext client, string id, string platform, long generation, string mutation, string? value)
    {
        lock (_sync)
        {
            var field = GetField(Find(client, id), platform, generation);
            if (mutation != "clear" && field.Error is { } error) throw new CredentialException(error);
            if (mutation == "clear")
            { field.Record = null; field.Candidate = null; field.Error = null; field.Intent = "clear"; }
            else
            {
                if (!CredentialRecord.ValidValue(value)) throw new CredentialException("secret_value_invalid");
                if (mutation is not ("set-manual" or "edit-current")) throw new CredentialException("credential_mutation_invalid");
                string source = field.Record?.Source ?? "manual";
                if (mutation == "set-manual" && source == "browser") throw new CredentialException("credential_clear_required");
                if (source == "browser") RequireGrant(client);
                field.Record = new(1, value!, source);
                field.Candidate = source == "browser" ? NewCandidate(field.Record) : null;
                field.Intent = "set";
            }
            field.Pending = null;
            field.Generation++;
            return Project(field);
        }
    }
    internal LoginPreparation Prepare(PluginClientSessionContext client, string id, string platform, long generation)
    {
        RequireClient(client);
        if (!client.NativeBrowserAvailable) throw new CredentialException("client_not_supported");
        lock (_sync)
        {
            var field = GetField(Find(client, id), platform, generation);
            if (field.Pending is null) { field.Generation++; field.Pending = new(Guid.NewGuid().ToString("N"), field.Generation); }
            return new(platform, id, field.Generation, new() { ["platform"] = platform, ["binding"] = field.Pending.Nonce });
        }
    }
    internal void ValidateInvocation(PluginBrowserInvocation invocation, string platform)
    {
        lock (_sync) _ = Bound(invocation, platform);
    }
    internal PluginBrowserLoginResult Provisional(PluginBrowserInvocation invocation, string platform, CredentialRecord record)
    {
        lock (_sync)
        {
            var field = Bound(invocation, platform);
            var pending = field.Pending!;
            if (pending.OperationId is not null && pending.OperationId != invocation.OperationId) throw new CredentialException("credential_binding_stale");
            pending.OperationId = invocation.OperationId;
            pending.Provisional = NewCandidate(record);
            return new(true, pending.Provisional.Id, true, "browser", record.MaskedAccount);
        }
    }
    internal void Terminal(PluginBrowserInvocation invocation, string platform, PluginBrowserLoginTerminal terminal)
    {
        lock (_sync)
        {
            if (!_editors.TryGetValue(invocation.EditorSessionId, out var editor)) return;
            Own(editor, invocation.ClientSession);
            var field = editor.Fields.GetValueOrDefault(platform);
            if (field is null) return;
            var pending = field.Pending;
            if (pending is null || pending.Nonce != invocation.Context["binding"]?.GetValue<string>() || pending.Generation != invocation.FieldGeneration)
            {
                if (editor.Activations.TryGetValue(invocation.OperationId, out var activation))
                {
                    if (terminal == PluginBrowserLoginTerminal.Completed) return;
                    editor.Activations.Remove(invocation.OperationId);
                    if (field.Candidate?.Id == activation.Candidate.Id)
                    { field.Record = activation.Before; field.Candidate = activation.BeforeCandidate; field.Intent = activation.Intent; field.Error = activation.Error; field.Generation++; }
                    return;
                }
                if (terminal == PluginBrowserLoginTerminal.Completed) throw new CredentialException("credential_binding_stale");
                return;
            }
            if (terminal == PluginBrowserLoginTerminal.Completed)
            {
                if (pending.Provisional is not { } candidate) throw new CredentialException("credential_candidate_missing");
                _ = Bound(invocation, platform);
                editor.Activations[invocation.OperationId] = (platform, candidate, field.Record, field.Candidate, field.Intent, field.Error);
                field.Candidate = candidate; field.Record = candidate.Record; field.Intent = "set"; field.Error = null;
                field.Generation++;
                field.Pending = null;
            }
            else if (pending.Provisional is { } provisional && field.Candidate?.Id == provisional.Id)
            { field.Candidate = null; field.Record = CredentialRecord.Decode(field.Baseline); field.Intent = "keep"; field.Generation++; }
            if (terminal != PluginBrowserLoginTerminal.Completed) field.Pending = null;
        }
    }
    private Field Bound(PluginBrowserInvocation invocation, string platform)
    {
        var field = GetField(Find(invocation.ClientSession, invocation.EditorSessionId), platform, invocation.FieldGeneration);
        if (invocation.Context["platform"]?.GetValue<string>() != platform || field.Pending?.Nonce != invocation.Context["binding"]?.GetValue<string>()) throw new CredentialException("credential_binding_stale");
        return field;
    }
    private Candidate NewCandidate(CredentialRecord record) => new(Guid.NewGuid().ToString("N"), record, _time.GetTimestamp(), _time.GetTimestamp());
    private void EnsureCandidate(Candidate candidate)
    {
        if (_time.GetElapsedTime(candidate.Created) >= TimeSpan.FromHours(2) || _time.GetElapsedTime(candidate.Touched) >= TimeSpan.FromMinutes(30)) throw new CredentialException("credential_candidate_expired");
    }
    internal Reservation Reserve(PluginClientSessionContext client, string id, Guid? taskId,
        IReadOnlyDictionary<string, CheckInSecretInput> inputs, IReadOnlyDictionary<string, string?> current)
    {
        lock (_sync)
        {
            var editor = Find(client, id);
            if (editor.TaskId != taskId) throw new CredentialException("credential_editor_task_mismatch");
            var changes = new Dictionary<string, CheckInSecretInput>(StringComparer.Ordinal);
            foreach (var (platform, input) in inputs)
            {
                var field = GetField(editor, platform, input.FieldGeneration ?? -1);
                if (field.Intent != input.Action) throw new CredentialException("credential_draft_mismatch");
                if (input.Action == "keep") { changes[platform] = new() { Action = "keep" }; continue; }
                if (current.GetValueOrDefault(platform) != field.Baseline) throw new CredentialException("credential_saved_conflict");
                if (input.Action == "clear") { changes[platform] = new() { Action = "clear" }; continue; }
                if (field.Error is { } error) throw new CredentialException(error);
                if (field.Candidate is { } candidate)
                {
                    EnsureCandidate(candidate);
                    if (input.CandidateId != candidate.Id || input.Value is not null) throw new CredentialException("credential_candidate_mismatch");
                }
                else if (field.Record is null || input.Value != field.Record.Value || input.CandidateId is not null) throw new CredentialException("credential_draft_mismatch");
                changes[platform] = new() { Action = "set", Value = field.Record!.Encode() };
            }
            editor.Reserved = true;
            return new(changes, committed =>
            {
                lock (_sync) { editor.Reserved = false; if (committed || editor.Released) ReleaseOwned(id); }
            });
        }
    }
    internal sealed class Reservation(Dictionary<string, CheckInSecretInput> changes, Action<bool> release) : IDisposable
    {
        internal Dictionary<string, CheckInSecretInput> Changes { get; } = changes;
        internal bool Committed;
        private Action<bool>? _release = release;
        public void Dispose() => Interlocked.Exchange(ref _release, null)?.Invoke(Committed);
    }
    private Editor Find(PluginClientSessionContext client, string id)
    {
        RequireClient(client);
        if (_stopped) throw new CredentialException("service_stopping");
        if (!_editors.TryGetValue(id, out var editor)) throw new CredentialException("credential_editor_expired");
        Own(editor, client);
        if (editor.Released || editor.Reserved || _time.GetElapsedTime(editor.Created) >= TimeSpan.FromHours(2)
            || _time.GetElapsedTime(editor.Touched) >= TimeSpan.FromMinutes(30)) throw new CredentialException("credential_editor_expired");
        return editor;
    }
    private static void RequireClient(PluginClientSessionContext? client)
    {
        if (client is null || client.Lifetime.IsCancellationRequested || client.HostSessionId.Length == 0 || client.ClientSessionId.Length == 0) throw new CredentialException("client_session_required");
    }
    private static void Own(Editor editor, PluginClientSessionContext client)
    {
        RequireClient(client);
        if (editor.Client.HostSessionId != client.HostSessionId || editor.Client.ClientSessionId != client.ClientSessionId) throw new CredentialException("credential_editor_owner_mismatch");
    }
    private static Field GetField(Editor editor, string platform, long generation)
    {
        if (!editor.Fields.TryGetValue(platform, out var field)) throw new CredentialException("credential_platform_invalid");
        if (field.Generation != generation) throw new CredentialException("credential_field_stale");
        return field;
    }
    private CredentialFieldState Project(Field field)
    {
        string? error = field.Error;
        if (field.Candidate is { } candidate) try { EnsureCandidate(candidate); } catch (CredentialException ex) { error = ex.Code; }
        DateTimeOffset? expires = field.Candidate is { } value ? _time.GetUtcNow().Add(
            TimeSpan.FromTicks(Math.Min((TimeSpan.FromMinutes(30) - _time.GetElapsedTime(value.Touched)).Ticks,
                (TimeSpan.FromHours(2) - _time.GetElapsedTime(value.Created)).Ticks))) : null;
        return new(field.Record is not null || field.Error is not null, field.Record?.Source, field.Generation, field.Intent,
            error is null ? field.Candidate?.Id : null, field.Record?.MaskedAccount, expires, error);
    }
    private CredentialEditorView View(Editor editor) => new(editor.Id, 0, editor.Fields.ToDictionary(p => p.Key, p => Project(p.Value), StringComparer.Ordinal));
    private void Sweep()
    {
        lock (_sync)
        {
            foreach (string id in _editors.Values.Where(e => !e.Reserved && (e.Released || e.Client.Lifetime.IsCancellationRequested
                || _time.GetElapsedTime(e.Created) >= TimeSpan.FromHours(2) || _time.GetElapsedTime(e.Touched) >= TimeSpan.FromMinutes(30))).Select(e => e.Id).ToArray()) ReleaseOwned(id);
            foreach (var editor in _editors.Values.Where(e => !e.Reserved))
                foreach (var field in editor.Fields.Values)
                    if (field.Candidate is { } candidate)
                    {
                        try { EnsureCandidate(candidate); }
                        catch (CredentialException) { field.Candidate = null; field.Record = null; field.Error = "credential_candidate_expired"; field.Pending = null; editor.Activations.Clear(); }
                    }
            foreach (var key in _grants.Where(p => _time.GetElapsedTime(p.Value.Start) >= TimeSpan.FromHours(24)).Select(p => p.Key).ToArray())
            { _grants[key].Cancellation.Unregister();_grants.Remove(key); }
        }
    }
    public void Dispose()
    {
        lock (_sync) { _stopped = true; foreach (string id in _editors.Keys.ToArray()) ReleaseOwned(id);foreach (var grant in _grants.Values) grant.Cancellation.Unregister();_grants.Clear(); }
        _sweep.Dispose();
    }
}
