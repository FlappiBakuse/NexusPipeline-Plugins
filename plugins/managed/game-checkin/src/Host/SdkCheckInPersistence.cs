using System.Text;
using System.Text.Json;
using NexusPipeline.Extensibility.Secrets;
using NexusPipeline.Extensibility.State;

namespace NexusPipeline.Extensions.GameCheckIn;

internal sealed class SdkCheckInPersistence(IExtensionDocuments documents, IExtensionSecretPort secrets, ISecretDocuments atomic) : ICheckInPersistence
{
    public async ValueTask<CheckInTaskSnapshot> ReadTasksAsync(CancellationToken cancellationToken)
    {
        var document = await documents.ReadAsync("tasks", cancellationToken);
        return document is null ? new(0, new()) : new(document.Revision, CheckInJson.Read<CheckInTaskStore>(document.Json).Validate());
    }
    public async ValueTask<CheckInCredentialRead> ReadCredentialAsync(Guid taskId, string platform, CancellationToken cancellationToken)
    {
        _ = CheckInCatalog.Platform(platform);
        var before = await secrets.GetStateAsync(taskId, platform, cancellationToken);
        if (!before.IsConfigured) return new(before.Revision, false, null);
        if (!before.IsReadable) return new(before.Revision, true, null, "credential_unavailable");
        using var draft = await secrets.ReadAsync(taskId, platform, cancellationToken);
        var after = await secrets.GetStateAsync(taskId, platform, cancellationToken);
        if (before.Revision != after.Revision || before.SecretId != after.SecretId)
            throw new CheckInFailure("credential_saved_conflict");
        CredentialMaterial? material = null; string? error = null;
        draft.Use(value =>
        {
            var bytes = new byte[Encoding.UTF8.GetByteCount(value)]; Encoding.UTF8.GetBytes(value, bytes);
            try
            {
                material = CredentialMaterial.Decode(bytes);
                if (material.Web is not null && material.Web.Platform != platform)
                { material.Dispose(); material = null; error = "credential_format_unsupported"; }
            }
            catch (Exception failure) when (failure is CheckInFailure or JsonException or InvalidOperationException)
            { error = "credential_format_unsupported"; }
            finally { Array.Clear(bytes); }
        });
        return new(after.Revision, true, material, error);
    }
    public async ValueTask<CheckInPublication> PublishAsync(Guid operationId, long expectedDocumentRevision, CheckInTaskStore proposed,
        Guid? secretSubjectId, IReadOnlyList<CredentialMutation> changes, CancellationToken cancellationToken)
    {
        if (changes.Count > 6 || changes.Select(change => change.Platform).Distinct(StringComparer.Ordinal).Count() != changes.Count ||
            changes.Count > 0 && (secretSubjectId is null || secretSubjectId == Guid.Empty)) throw new CheckInFailure("credential_publication_invalid");
        // Only the internal edit owner and credential rotation publish an already validated snapshot.
        var json = JsonSerializer.SerializeToUtf8Bytes(proposed, CheckInJson.Options);
        var edits = new List<DocumentSecretEdit>();
        try
        {
            foreach (var mutation in changes)
            {
                _ = CheckInCatalog.Platform(mutation.Platform);
                var change = ConvertChange(mutation);
                edits.Add(new(secretSubjectId!.Value, mutation.Platform, mutation.ExpectedRevision, change));
            }
        }
        catch { foreach (var edit in edits) edit.Change.Dispose(); throw; }
        var committed = await atomic.WriteAsync(operationId, "tasks", expectedDocumentRevision, json, edits, cancellationToken);
        return new(committed.OperationId, committed.Revision, committed.IsNew, committed.Sha256);
    }
    public async ValueTask<CheckInPublication?> ReadPublicationAsync(Guid operationId, CancellationToken cancellationToken)
    {
        var commit = await atomic.ReadCommitAsync(operationId, cancellationToken);
        return commit is null ? null : new(commit.OperationId, commit.Revision, commit.IsNew, commit.Sha256);
    }
    public async ValueTask<CheckInRecentRunSnapshot> ReadRunAsync(Guid taskId, CancellationToken cancellationToken)
    {
        var document = await documents.ReadAsync(RunName(taskId), cancellationToken);
        return document is null ? new(0, null) : new(document.Revision, CheckInJson.Read<CheckInRunDocument>(document.Json).Validate().Run);
    }
    public async ValueTask<long> WriteRunAsync(Guid operationId, Guid taskId, long expectedRevision, CheckInRun run, CancellationToken cancellationToken)
    {
        var document = new CheckInRunDocument { Run = run }.Validate();
        var bytes = JsonSerializer.SerializeToUtf8Bytes(document, CheckInJson.Options);
        var sha256 = Convert.ToHexStringLower(System.Security.Cryptography.SHA256.HashData(bytes));
        DocumentCommit? committed;
        try { committed = await documents.WriteAsync(operationId, RunName(taskId), expectedRevision, bytes, cancellationToken); }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested) { throw; }
        catch (Exception error) when (error is not OutOfMemoryException)
        { committed = await documents.ReadCommitAsync(operationId, cancellationToken); }
        if (committed?.OperationId != operationId || committed.Revision != expectedRevision + 1 || committed.Sha256 != sha256)
            throw new CheckInFailure("checkin_run_publication_unknown");
        return committed.Revision;
    }
    private static SecretChange ConvertChange(CredentialMutation mutation)
    {
        if (mutation.ExpectedRevision < 0 || mutation.Action is not ("keep" or "set" or "clear") ||
            (mutation.Action == "set") != (mutation.Material is not null)) throw new CheckInFailure("credential_publication_invalid");
        if (mutation.Action == "keep") return SecretChange.Keep();
        if (mutation.Action == "clear") return SecretChange.Clear();
        var bytes = mutation.Material!.Encode(); char[]? characters = null;
        try { characters = Encoding.UTF8.GetChars(bytes); return SecretChange.Set(new SecretDraft(characters)); }
        finally { Array.Clear(bytes); if (characters is not null) Array.Clear(characters); }
    }
    private static string RunName(Guid taskId)
    { if (taskId == Guid.Empty) throw new CheckInFailure("checkin_task_not_found"); return "run-" + taskId.ToString("N"); }
}
