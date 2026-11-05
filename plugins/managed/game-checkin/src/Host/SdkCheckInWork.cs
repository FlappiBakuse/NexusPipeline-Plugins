using System.Globalization;
using NexusPipeline.Extensibility.Protocol;
using NexusPipeline.Extensibility.Scheduling;

namespace NexusPipeline.Extensions.GameCheckIn;

internal sealed class SdkCheckInWork(IWorkTasks tasks, ICheckInPersistence persistence) : ICheckInWorkContext, ICheckInTaskQuiescence
{
    internal const string ProviderId = "checkin";
    public async ValueTask<CheckInWorkClock> ReadClockAsync(CancellationToken cancellationToken)
    {
        var clock = await tasks.ReadClockAsync(cancellationToken);
        ValidateZone(clock.TimeZoneId);
        return new(clock.UtcNow, clock.TimeZoneId);
    }
    public async ValueTask<CheckInExecutionIdentity> ReadAsync(ScheduledInvocation invocation, Guid businessTaskId, long taskRevision,
        string trigger, CancellationToken cancellationToken)
    {
        var actual = await tasks.ReadCurrentAsync(cancellationToken);
        if (actual.RunId == Guid.Empty || actual.AttemptId == Guid.Empty || actual.SubjectId == Guid.Empty || actual.LocalDate == default ||
            actual.RunId.ToString("D") != invocation.RunId || actual.AttemptId.ToString("D") != invocation.AttemptId ||
            actual.SubjectId.ToString("D") != invocation.SubjectId || actual.TaskId != businessTaskId || actual.TaskRevision != taskRevision ||
            !DateTimeOffset.TryParse(invocation.DeadlineUtc, CultureInfo.InvariantCulture, DateTimeStyles.RoundtripKind, out var deadline) || deadline != actual.DeadlineUtc)
            throw new CheckInFailure("checkin_execution_identity_invalid");
        ValidateZone(actual.TimeZoneId);
        var snapshot = await persistence.ReadTasksAsync(cancellationToken);
        var task = snapshot.Store.Tasks.SingleOrDefault(task => task.Id == businessTaskId);
        if (task is null || task.Revision != taskRevision || trigger is not ("manual" or "scheduled") ||
            trigger == "manual" && actual.SubjectId != businessTaskId ||
            trigger == "scheduled" && !task.Schedules.Any(schedule => CheckInPlans.Identity(task.Id, schedule.Id) == actual.SubjectId))
            throw new CheckInFailure("checkin_task_revision_conflict");
        return new(actual.RunId, actual.AttemptId, trigger, actual.LocalDate);
    }
    public ValueTask<IAsyncDisposable> HoldAsync(Guid taskId, long expectedTaskRevision, CancellationToken cancellationToken) =>
        tasks.QuiesceAsync(ProviderId, taskId, expectedTaskRevision, cancellationToken);
    internal ValueTask<bool> IsStoppedAsync(Guid taskId, Guid runId, Guid attemptId, CancellationToken cancellationToken) =>
        tasks.HasStoppedAsync(ProviderId, taskId, runId, attemptId, cancellationToken);
    internal async ValueTask RunNowAsync(Guid taskId, long expectedTaskRevision, CancellationToken cancellationToken)
    {
        var snapshot = await persistence.ReadTasksAsync(cancellationToken);
        if (!snapshot.Store.Tasks.Any(task => task.Id == taskId && task.Revision == expectedTaskRevision))
            throw new CheckInFailure("checkin_task_revision_conflict");
        _ = await tasks.RunAsync(ProviderId, taskId, expectedTaskRevision, cancellationToken);
    }
    private static void ValidateZone(string timeZoneId)
    {
        try { _ = TimeZoneInfo.FindSystemTimeZoneById(timeZoneId); }
        catch (Exception error) when (error is TimeZoneNotFoundException or InvalidTimeZoneException or ArgumentException)
        { throw new CheckInFailure("checkin_host_clock_invalid"); }
    }
}
