namespace NexusPipeline.Extensions.GameCheckIn;

internal sealed record CheckInTaskSnapshot(long Revision, CheckInTaskStore Store);
internal sealed record CheckInPublication(Guid OperationId, long Revision, bool IsNew, string Sha256);
internal sealed record CheckInRecentRunSnapshot(long Revision, CheckInRun? Run);
internal sealed record CheckInCredentialRead(long Revision, bool Configured, CredentialMaterial? Material, string? Error = null) : IDisposable
{
    public void Dispose() => Material?.Dispose();
    public override string ToString() => "[saved check-in credential]";
}
internal interface ICheckInPersistence
{
    ValueTask<CheckInTaskSnapshot> ReadTasksAsync(CancellationToken cancellationToken);
    ValueTask<CheckInCredentialRead> ReadCredentialAsync(Guid taskId, string platform, CancellationToken cancellationToken);
    ValueTask<CheckInPublication> PublishAsync(Guid operationId, long expectedDocumentRevision, CheckInTaskStore proposed,
        Guid? secretSubjectId, IReadOnlyList<CredentialMutation> changes, CancellationToken cancellationToken);
    ValueTask<CheckInPublication?> ReadPublicationAsync(Guid operationId, CancellationToken cancellationToken);
    ValueTask<CheckInRecentRunSnapshot> ReadRunAsync(Guid taskId, CancellationToken cancellationToken);
    ValueTask<long> WriteRunAsync(Guid operationId, Guid taskId, long expectedRevision, CheckInRun run, CancellationToken cancellationToken);
}
