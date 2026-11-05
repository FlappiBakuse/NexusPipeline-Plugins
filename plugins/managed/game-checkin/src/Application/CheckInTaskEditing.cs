using System.Text.Json.Serialization;

namespace NexusPipeline.Extensions.GameCheckIn;

internal sealed record CheckInTaskDraft([property: JsonRequired] Guid? Id, [property: JsonRequired] string Name,
    [property: JsonRequired] string Remark, [property: JsonRequired] bool Enabled, [property: JsonRequired] Dictionary<string, string[]> Games,
    [property: JsonRequired] CheckInSchedule[] Schedules, [property: JsonRequired] CheckInNotification Notification);
internal sealed record CheckInEditorOpened(CredentialEditorView Editor, CheckInTask? Task);

internal sealed class CheckInTaskEditing(ICheckInPersistence persistence, CheckInEditors editors, ICheckInTaskQuiescence quiescence)
{
    internal async ValueTask<bool> ReadPublicationAsync(CheckInClient client, Guid operationId, CancellationToken cancellationToken)
    {
        client.Require(); RequireOperation(operationId);
        return await persistence.ReadPublicationAsync(operationId, cancellationToken) is not null;
    }
    internal async ValueTask<CheckInEditorOpened> OpenAsync(CheckInClient client, Guid? taskId, long expectedRevision, CancellationToken cancellationToken)
    {
        client.Require(); var snapshot = await persistence.ReadTasksAsync(cancellationToken);
        RequireRevision(snapshot.Revision, expectedRevision);
        var task = taskId is null ? null : snapshot.Store.Tasks.SingleOrDefault(task => task.Id == taskId) ??
            throw new CheckInFailure("checkin_task_not_found");
        var saved = taskId is null ? new Dictionary<string, SavedCredentialField>() : await ReadFieldsAsync(taskId.Value, cancellationToken);
        var editor = editors.Add(client, taskId, snapshot.Revision, saved);
        return new(editor.View(client), task);
    }
    internal async ValueTask<CheckInTaskSnapshot> SaveAsync(CheckInClient client, Guid operationId, string editorId,
        CheckInTaskDraft draft, IReadOnlyDictionary<string, CredentialAction> actions, CancellationToken cancellationToken)
    {
        client.Require(); RequireOperation(operationId);
        var editor = editors.Get(client, editorId);
        if (draft.Id != editor.TaskId) throw new CheckInFailure("credential_task_mismatch");
        var snapshot = await persistence.ReadTasksAsync(cancellationToken); RequireRevision(snapshot.Revision, editor.DocumentRevision);
        var task = new CheckInTask { Id = editor.TargetId, Revision = 1, Name = draft.Name, Remark = draft.Remark,
            Enabled = draft.Enabled, Games = draft.Games, Schedules = draft.Schedules, Notification = draft.Notification, Protocol = editor.NewProtocol };
        var proposed = CheckInEdits.Save(snapshot.Store, task);
        var expectedTaskRevision = snapshot.Store.Tasks.SingleOrDefault(task => task.Id == editor.TargetId)?.Revision ?? 0;
        await using var hold = await quiescence.HoldAsync(editor.TargetId, expectedTaskRevision, cancellationToken);
        snapshot = await persistence.ReadTasksAsync(cancellationToken); RequireRevision(snapshot.Revision, editor.DocumentRevision);
        var current = editor.TaskId is null ? new Dictionary<string, SavedCredentialField>() : await ReadFieldsAsync(editor.TargetId, cancellationToken);
        using var reservation = editor.Reserve(client, draft.Id, actions, current);
        var publication = await PublishAsync(operationId, snapshot.Revision, proposed, editor.TargetId, reservation.Changes, cancellationToken);
        reservation.Committed = true; editors.RemoveCommitted(editor.Id);
        return new(publication.Revision, proposed);
    }
    internal async ValueTask<CheckInTaskSnapshot> DeleteAsync(CheckInClient client, Guid operationId, Guid taskId,
        long expectedRevision, CancellationToken cancellationToken)
    {
        client.Require(); RequireOperation(operationId);
        var snapshot = await persistence.ReadTasksAsync(cancellationToken); RequireRevision(snapshot.Revision, expectedRevision);
        var proposed = CheckInEdits.Delete(snapshot.Store, taskId);
        await using var hold = await quiescence.HoldAsync(taskId, snapshot.Store.Tasks.Single(task => task.Id == taskId).Revision, cancellationToken);
        snapshot = await persistence.ReadTasksAsync(cancellationToken); RequireRevision(snapshot.Revision, expectedRevision);
        var fields = await ReadFieldsAsync(taskId, cancellationToken);
        var changes = fields.Select(pair => new CredentialMutation(pair.Key, pair.Value.Revision, "clear", null)).ToArray();
        var publication = await PublishAsync(operationId, snapshot.Revision, proposed, taskId, changes, cancellationToken);
        return new(publication.Revision, proposed);
    }
    internal async ValueTask<CheckInTaskSnapshot> ReorderAsync(CheckInClient client, Guid operationId, Guid[] ids,
        long expectedRevision, CancellationToken cancellationToken)
    {
        client.Require(); RequireOperation(operationId);
        var snapshot = await persistence.ReadTasksAsync(cancellationToken); RequireRevision(snapshot.Revision, expectedRevision);
        var proposed = CheckInEdits.Reorder(snapshot.Store, ids);
        var publication = await PublishAsync(operationId, snapshot.Revision, proposed, null, [], cancellationToken);
        return new(publication.Revision, proposed);
    }
    private async ValueTask<CheckInPublication> PublishAsync(Guid operationId, long revision, CheckInTaskStore proposed,
        Guid? taskId, IReadOnlyList<CredentialMutation> changes, CancellationToken cancellationToken)
    {
        var sha256 = Convert.ToHexStringLower(System.Security.Cryptography.SHA256.HashData(CheckInJson.Bytes(proposed)));
        try
        {
            var publication = await persistence.PublishAsync(operationId, revision, proposed, taskId, changes, cancellationToken);
            return Match(publication);
        }
        catch (CheckInFailure) { throw; }
        catch (Exception error) when (error is not OutOfMemoryException)
        {
            // The original operation identity is the only safe lookup after losing a publication response.
            try
            {
                var committed = await persistence.ReadPublicationAsync(operationId, cancellationToken);
                if (committed is not null) return Match(committed);
            }
            catch (Exception lookupError) when (lookupError is not OutOfMemoryException) { }
            throw new CheckInFailure("checkin_publication_unknown");
        }
        CheckInPublication Match(CheckInPublication publication) => publication.OperationId == operationId && publication.Revision == revision + 1 && publication.Sha256 == sha256
            ? publication : throw new CheckInFailure("checkin_publication_unknown");
    }
    private async ValueTask<Dictionary<string, SavedCredentialField>> ReadFieldsAsync(Guid taskId, CancellationToken cancellationToken)
    {
        var result = new Dictionary<string, SavedCredentialField>(StringComparer.Ordinal);
        foreach (var platform in CheckInCatalog.Platforms)
        {
            using var field = await persistence.ReadCredentialAsync(taskId, platform.Id, cancellationToken);
            result.Add(platform.Id, new(field.Revision, field.Configured, field.Material?.Source, field.Material?.MaskedAccount, field.Error));
        }
        return result;
    }
    private static void RequireRevision(long actual, long expected)
    { if (actual != expected) throw new CheckInFailure("checkin_configuration_conflict"); }
    private static void RequireOperation(Guid id)
    { if (id == Guid.Empty) throw new CheckInFailure("checkin_operation_invalid"); }
}
