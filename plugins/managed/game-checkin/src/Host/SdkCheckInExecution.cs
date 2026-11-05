using NexusPipeline.Extensibility.Scheduling;

namespace NexusPipeline.Extensions.GameCheckIn;

internal sealed class SdkCheckInExecution(IWorkTasks tasks, IWorkEffects effects, ICheckInPersistence persistence) : ICheckInExecutionPorts
{
    public ICheckInEffects Effects(Guid taskId, string platform, long expectedSecretRevision)
    {
        if (taskId == Guid.Empty) throw new CheckInFailure("checkin_task_not_found");
        return new SdkCheckInEffects(effects, tasks, taskId, platform, expectedSecretRevision);
    }
    public ICheckInCredentialRotation Rotation(Guid taskId, long expectedTaskRevision, long expectedSecretRevision) =>
        new SdkCheckInRotation(tasks, persistence, taskId, expectedTaskRevision, expectedSecretRevision);
    public ValueTask<bool> IsStoppedAsync(Guid taskId, Guid runId, Guid attemptId, CancellationToken cancellationToken) =>
        tasks.HasStoppedAsync(SdkCheckInWork.ProviderId, taskId, runId, attemptId, cancellationToken);
}
