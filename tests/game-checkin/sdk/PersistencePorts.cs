using NexusPipeline.Extensibility.Secrets;
using NexusPipeline.Extensibility.State;

internal sealed class PersistencePorts : IExtensionDocuments, IExtensionSecretPort, ISecretDocuments, IDisposable
{
    private sealed record Field(long Revision, Guid Id, char[] Text);
    private readonly Dictionary<(Guid, string), Field> fields = [];
    private readonly Dictionary<Guid, DocumentCommit> commits = [];
    internal ExtensionDocument? Document;
    internal bool RejectAtomic, RaceState, ThrowAfterCommit;
    internal int CommitReads;
    internal int DocumentReads;
    internal int AtomicWrites, SingleWrites, Applies, StateReads;
    internal List<SecretChange> Transferred = [];
    internal void Put(Guid id, string name, string text) => fields[(id, name)] = new(1, Guid.NewGuid(), text.ToCharArray());
    public ValueTask<ExtensionDocument?> ReadAsync(string name, CancellationToken cancellationToken)
    { DocumentReads++; return ValueTask.FromResult(name == "tasks" ? Document : null); }
    public ValueTask<DocumentCommit> WriteAsync(Guid operationId, string name, long expectedRevision, ReadOnlyMemory<byte> json, CancellationToken cancellationToken)
    { SingleWrites++; throw new InvalidOperationException("ordinary_document_write_unexpected"); }
    public ValueTask<DocumentCommit?> ReadCommitAsync(Guid operationId, CancellationToken cancellationToken)
    { CommitReads++; return ValueTask.FromResult(commits.GetValueOrDefault(operationId)); }
    public ValueTask<DocumentCommit> WriteAsync(Guid operationId, string name, long expectedRevision, ReadOnlyMemory<byte> json,
        IReadOnlyList<DocumentSecretEdit> changes, CancellationToken cancellationToken)
    {
        AtomicWrites++; Transferred = changes.Select(change => change.Change).ToList();
        try
        {
            if (RejectAtomic) throw new IOException("synthetic_rejected_before_publication");
            if ((Document?.Revision ?? 0) != expectedRevision) throw new InvalidOperationException("synthetic_document_conflict");
            foreach (var change in changes)
                if ((fields.GetValueOrDefault((change.SubjectId, change.Field))?.Revision ?? 0) != change.ExpectedRevision) throw new InvalidOperationException("synthetic_secret_conflict");
            foreach (var edit in changes)
            {
                if (edit.Change.Kind == SecretChangeKind.Keep) continue;
                char[] text = []; if (edit.Change.Kind == SecretChangeKind.Set) edit.Change.UseValue(value => text = value.ToArray());
                if (fields.Remove((edit.SubjectId, edit.Field), out var old)) Array.Clear(old.Text);
                fields[(edit.SubjectId, edit.Field)] = new(edit.ExpectedRevision + 1, Guid.NewGuid(), text);
            }
            Document = new(expectedRevision + 1, Convert.ToHexStringLower(System.Security.Cryptography.SHA256.HashData(json.Span)), json.ToArray());
            var commit = new DocumentCommit(operationId, Document.Revision, Document.Sha256, true);
            commits.Add(operationId, commit);
            if (ThrowAfterCommit) throw new IOException("synthetic_response_lost_after_commit");
            return ValueTask.FromResult(commit);
        }
        finally { foreach (var edit in changes) edit.Change.Dispose(); }
    }
    public ValueTask<SecretFieldState> GetStateAsync(Guid subjectId, string field, CancellationToken cancellationToken)
    {
        StateReads++; var value = fields.GetValueOrDefault((subjectId, field)); var revision = value?.Revision ?? 0;
        return ValueTask.FromResult(new SecretFieldState(subjectId, field, revision + (RaceState && StateReads > 1 ? 1 : 0), value?.Id, value?.Text.Length > 0, true));
    }
    public ValueTask<SecretDraft> ReadAsync(Guid subjectId, string field, CancellationToken cancellationToken) => ValueTask.FromResult(new SecretDraft(fields[(subjectId, field)].Text));
    public ValueTask<SecretFieldState> ApplyAsync(Guid operationId, Guid subjectId, string field, long expectedRevision, SecretChange change, CancellationToken cancellationToken)
    { Applies++; change.Dispose(); throw new InvalidOperationException("serial_secret_apply_forbidden"); }
    public void Dispose() { foreach (var field in fields.Values) Array.Clear(field.Text); fields.Clear(); }
}
