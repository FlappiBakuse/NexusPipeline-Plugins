namespace NexusPipeline.Extensions.GameCheckIn;

internal sealed record CheckInClient(Guid ActivationScopeId, Guid ClientId, CancellationToken Lifetime)
{
    internal void Require()
    { if (ActivationScopeId == Guid.Empty || ClientId == Guid.Empty || Lifetime.IsCancellationRequested) throw new CheckInFailure("client_session_required"); }
}
internal sealed record SavedCredentialField(long Revision, bool Configured, string? Source, string? MaskedAccount, string? Error = null);
internal sealed record CredentialFieldView(bool Configured, long FieldGeneration, string? Source, string? MaskedAccount,
    string Intent, string? CandidateId, string? Error);
internal sealed record CredentialEditorView(string EditorSessionId, long Revision, Dictionary<string, CredentialFieldView> Fields);
[System.Text.Json.Serialization.JsonConverter(typeof(SensitiveCaptureConverter<CredentialAction>))]
internal sealed record CredentialAction(string Action, long FieldGeneration, string? Value = null, string? CandidateId = null)
{ public override string ToString() => "[credential action]"; }
internal sealed record CredentialLoginBinding(string Platform, string EditorSessionId, long FieldGeneration, Guid Nonce);

internal sealed class CredentialEditor : IDisposable
{
    private sealed record PreviousCandidate(CredentialMaterial? Material, string? Id);
    private sealed class Field(SavedCredentialField saved)
    {
        internal SavedCredentialField Saved = saved;
        internal long Generation;
        internal Guid? Pending;
        internal CredentialMaterial? Candidate;
        internal string? CandidateId;
        internal PreviousCandidate? Previous;
        internal Guid? AcceptedLogin;
    }
    private readonly CheckInClient owner;
    private long revision;
    private bool disposed, reserved;
    private CancellationTokenRegistration cancellation;
    private readonly Dictionary<string, Field> fields;
    internal string Id { get; } = Guid.NewGuid().ToString("N");
    internal Guid? TaskId { get; }
    internal Guid TargetId { get; }
    internal CheckInProtocolIdentity NewProtocol { get; } = CheckInProtocolIdentity.Create();
    internal bool CanPrune
    {
        get { lock (fields) return !reserved && (disposed || owner.Lifetime.IsCancellationRequested); }
    }
    internal long DocumentRevision { get; }
    internal CredentialEditor(CheckInClient owner, Guid? taskId, long documentRevision,
        IReadOnlyDictionary<string, SavedCredentialField> saved)
    {
        owner.Require(); this.owner = owner; TaskId = taskId; TargetId = taskId ?? Guid.NewGuid(); DocumentRevision = documentRevision;
        fields = CheckInCatalog.Platforms.ToDictionary(platform => platform.Id,
            platform => new Field(saved.GetValueOrDefault(platform.Id) ?? new(0, false, null, null)), StringComparer.Ordinal);
        cancellation = owner.Lifetime.UnsafeRegister(static state => ((CredentialEditor)state!).Dispose(), this);
    }
    private void Require(CheckInClient client)
    {
        client.Require(); owner.Require();
        if (client.ActivationScopeId != owner.ActivationScopeId || client.ClientId != owner.ClientId) throw new CheckInFailure("credential_editor_owner_mismatch");
        if (disposed || reserved)
            throw new CheckInFailure("credential_editor_expired");
    }
    private Field RequireField(string platform, long generation)
    {
        if (!fields.TryGetValue(platform, out var field)) throw new CheckInFailure("credential_platform_invalid");
        if (generation != field.Generation) throw new CheckInFailure("credential_field_stale");
        return field;
    }
    internal CredentialEditorView View(CheckInClient client)
    {
        lock (fields)
        {
            Require(client);
            return new(Id, revision, fields.ToDictionary(pair => pair.Key, pair =>
            {
                var field = pair.Value;
                return new CredentialFieldView(field.Candidate is not null || field.Saved.Configured, field.Generation,
                    field.Candidate?.Source ?? field.Saved.Source, field.Candidate?.MaskedAccount ?? field.Saved.MaskedAccount,
                    field.Candidate is null ? "keep" : "set", field.CandidateId, field.Saved.Error);
            }, StringComparer.Ordinal));
        }
    }
    internal void Lease(CheckInClient client)
    {
        lock (fields)
        {
            Require(client);
        }
    }
    internal CredentialLoginBinding Prepare(CheckInClient client, string platform, long generation)
    {
        lock (fields)
        {
            Require(client); var field = RequireField(platform, generation);
            if (field.Saved.Error is { } error) throw new CheckInFailure(error);
            if (field.Previous?.Material is { } previous && !ReferenceEquals(previous, field.Candidate)) previous.Dispose();
            field.Previous = new(field.Candidate, field.CandidateId);
            field.AcceptedLogin = null;
            field.Pending = Guid.NewGuid(); field.Generation++; revision++;
            return new(platform, Id, field.Generation, field.Pending.Value);
        }
    }
    internal string Accept(CheckInClient client, CredentialLoginBinding binding, CredentialMaterial material)
    {
        try
        {
            lock (fields)
            {
                Require(client); var field = RequireField(binding.Platform, binding.FieldGeneration);
                if (binding.EditorSessionId != Id || field.Pending != binding.Nonce || material.Source != "browser" || string.IsNullOrWhiteSpace(material.MaskedAccount))
                    throw new CheckInFailure("credential_binding_stale");
                field.Candidate = material; field.CandidateId = Guid.NewGuid().ToString("N");
                field.Pending = null; field.Generation++;
                field.AcceptedLogin = binding.Nonce; revision++;
                return field.CandidateId;
            }
        }
        catch { material.Dispose(); throw; }
    }
    internal void CancelLogin(CheckInClient client, string platform)
    {
        lock (fields)
        {
            Require(client);
            if (!fields.TryGetValue(platform, out var field)) throw new CheckInFailure("credential_platform_invalid");
            if (field.Pending is not null || field.AcceptedLogin is not null)
            {
                if (field.AcceptedLogin is not null)
                {
                    field.Candidate?.Dispose(); field.Candidate = field.Previous?.Material; field.CandidateId = field.Previous?.Id;
                }
                field.Previous = null; field.Pending = null; field.AcceptedLogin = null; field.Generation++; revision++;
            }
        }
    }
    internal void CancelBoundLogin(CheckInClient client, CredentialLoginBinding binding)
    {
        lock (fields)
        {
            Require(client);
            if (binding.EditorSessionId != Id || !fields.TryGetValue(binding.Platform, out var field))
                throw new CheckInFailure("credential_binding_stale");
            if (field.Pending == binding.Nonce || field.AcceptedLogin == binding.Nonce) CancelLogin(client, binding.Platform);
        }
    }
    internal CredentialMaterial? Candidate(CheckInClient client, string platform, long generation)
    {
        lock (fields)
        {
            Require(client); var field = RequireField(platform, generation);
            return field.Candidate?.Copy();
        }
    }
    internal CredentialReservation Reserve(CheckInClient client, Guid? taskId, IReadOnlyDictionary<string, CredentialAction> actions,
        IReadOnlyDictionary<string, SavedCredentialField> current)
    {
        lock (fields)
        {
            Require(client);
            if (fields.Values.Any(field => field.Pending is not null)) throw new CheckInFailure("credential_login_busy");
            if (TaskId != taskId || actions.Values.Any(action => action is null) || actions.Keys.Except(fields.Keys, StringComparer.Ordinal).Any()) throw new CheckInFailure("credential_task_mismatch");
            var changes = new List<CredentialMutation>();
            try
            {
                foreach (var (platform, field) in fields)
                {
                    var action = actions.GetValueOrDefault(platform) ?? new("keep", field.Generation);
                    RequireField(platform, action.FieldGeneration);
                    if (action.Action is not ("keep" or "set" or "clear") || action.Action != "set" && (action.Value is not null || action.CandidateId is not null))
                        throw new CheckInFailure("credential_action_invalid");
                    if (action.Action != "keep" && (current.GetValueOrDefault(platform)?.Revision ?? 0) != field.Saved.Revision)
                        throw new CheckInFailure("credential_saved_conflict");
                    CredentialMaterial? value = null;
                    if (action.Action == "set")
                    {
                        if (field.Saved.Error is { } error) throw new CheckInFailure(error);
                        if ((action.Value is null) == (action.CandidateId is null)) throw new CheckInFailure("credential_action_invalid");
                        if (action.CandidateId is not null)
                        {
                            if (field.Candidate is null || field.CandidateId != action.CandidateId)
                                throw new CheckInFailure("credential_candidate_mismatch");
                            value = field.Candidate.Copy();
                        }
                        else
                        {
                            value = ManualCredentials.Prepare(platform, action.Value!);
                        }
                    }
                    changes.Add(new(platform, field.Saved.Revision, action.Action, value));
                }
                reserved = true;
                return new(changes.ToArray(), committed => { lock (fields) { reserved = false; if (committed) Dispose(); } });
            }
            catch { foreach (var change in changes) change.Dispose(); throw; }
        }
    }
    public void Dispose()
    {
        lock (fields)
        {
            if (disposed) return; disposed = true; cancellation.Unregister();
            foreach (var field in fields.Values)
            { field.Candidate?.Dispose(); field.Previous?.Material?.Dispose(); field.Candidate = null; field.Previous = null; field.Pending = null; }
        }
    }
}

internal sealed record CredentialMutation(string Platform, long ExpectedRevision, string Action, CredentialMaterial? Material) : IDisposable
{
    public void Dispose() => Material?.Dispose();
    public override string ToString() => "[credential mutation]";
}
internal sealed class CredentialReservation(CredentialMutation[] changes, Action<bool> finished) : IDisposable
{
    internal CredentialMutation[] Changes { get; } = changes;
    internal bool Committed { get; set; }
    private Action<bool>? completion = finished;
    public void Dispose()
    {
        var action = Interlocked.Exchange(ref completion, null); if (action is null) return;
        foreach (var change in Changes) change.Dispose(); action(Committed);
    }
}
