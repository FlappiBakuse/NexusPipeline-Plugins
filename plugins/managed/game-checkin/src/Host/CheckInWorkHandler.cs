using NexusPipeline.Extensibility.Protocol;
using NexusPipeline.Extensibility.Scheduling;

namespace NexusPipeline.Extensions.GameCheckIn;

internal sealed record CheckInWorkClock(DateTimeOffset UtcNow, string TimeZoneId);
internal interface ICheckInWorkContext
{
    ValueTask<CheckInWorkClock> ReadClockAsync(CancellationToken cancellationToken);
    ValueTask<CheckInExecutionIdentity> ReadAsync(ScheduledInvocation invocation, Guid businessTaskId, long taskRevision,
        string trigger, CancellationToken cancellationToken);
}

internal sealed class CheckInWorkHandler(ICheckInPersistence persistence, CheckInRunner runner,
    ICheckInWorkContext context, SdkCheckInNotifications notifications, SdkCheckInSubmission submissions) : IManualWorkHandler, IScheduledWorkPlanningHandler
{
    public string IdentityVersion => "v1";
    public NexusPipeline.Extensibility.Secrets.SecretDraft ProjectIdentity(string field, NexusPipeline.Extensibility.Secrets.SecretDraft actualStoredMaterial) =>
        SdkCheckInIdentity.Project(field, actualStoredMaterial);
    public bool CanRotateIdentity(string field, NexusPipeline.Extensibility.Secrets.SecretDraft before, NexusPipeline.Extensibility.Secrets.SecretDraft after) =>
        SdkCheckInIdentity.CanRotate(field, before, after);
    public async ValueTask<ScheduledWorkPlans> ReadPlansAsync(CancellationToken cancellationToken)
    {
        var snapshot = await persistence.ReadTasksAsync(cancellationToken);
        var timeZone = (await context.ReadClockAsync(cancellationToken)).TimeZoneId;
        var targets = await notifications.ReadAsync(cancellationToken);
        var plans = CheckInPlans.Project(snapshot.Store, timeZone);
        return new() { Format = "nexus.schedule.work-plans", Version = 1, Revision = snapshot.Revision,
            Tasks = plans.Select(plan => new ScheduledWorkPlansTask {
                TaskId = plan.PlanId.ToString("D"), OwnerTaskId = plan.BusinessTaskId.ToString("D"), Revision = plan.TaskRevision, IsEnabled = plan.IsEnabled,
                TimeZoneId = plan.TimeZoneId, Weekdays = plan.Weekdays.Select(day => (long)day).ToArray(),
                LocalMinute = plan.LocalMinute, TimeoutSeconds = plan.TimeoutSeconds,
                NotificationTaskIds = SdkCheckInNotifications.Selected(snapshot.Store.Tasks.Single(task => task.Id == plan.BusinessTaskId).Notification, targets)
            }).ToArray() };
    }

    public async ValueTask<ManualWorkTask?> ReadTaskAsync(Guid taskId, CancellationToken cancellationToken)
    {
        var snapshot = await persistence.ReadTasksAsync(cancellationToken);
        var task = snapshot.Store.Tasks.SingleOrDefault(task => task.Id == taskId);
        if (task is null) return null;
        var timeZone = (await context.ReadClockAsync(cancellationToken)).TimeZoneId;
        _ = TimeZoneInfo.FindSystemTimeZoneById(timeZone);
        var targets = await notifications.ReadAsync(cancellationToken);
        return new() { Format = "nexus.manual.work-task", Version = 1, TaskId = task.Id.ToString("D"), Revision = task.Revision,
            IsEnabled = true, TimeZoneId = timeZone, TimeoutSeconds = 1800,
            NotificationTaskIds = SdkCheckInNotifications.Selected(task.Notification, targets),
            ScheduledTaskIds = task.Schedules.Select(schedule => CheckInPlans.Identity(task.Id, schedule.Id).ToString("D")).ToArray() };
    }

    public async ValueTask<ScheduledWorkResult> ExecutePlannedAsync(ScheduledPlannedInvocation invocation, CancellationToken cancellationToken)
    {
        if (invocation.Format != "nexus.schedule.planned-invocation" || invocation.Version != 1)
            throw new CheckInFailure("checkin_invocation_invalid");
        var snapshot = await persistence.ReadTasksAsync(cancellationToken);
        if (snapshot.Revision != invocation.PlansRevision) throw new CheckInFailure("checkin_plan_stale");
        var planId = Subject(invocation.Invocation);
        var task = CheckInPlans.Resolve(snapshot.Store, planId, invocation.TaskRevision);
        if (invocation.OwnerTaskId != task.Id.ToString("D")) throw new CheckInFailure("checkin_execution_owner_invalid");
        var schedule = task.Schedules.Single(schedule => CheckInPlans.Identity(task.Id, schedule.Id) == planId);
        if (!task.Enabled || !schedule.Enabled) throw new CheckInFailure("checkin_plan_disabled");
        return await ExecuteAsync(task, invocation.Invocation, "scheduled", cancellationToken);
    }

    public async ValueTask<ScheduledWorkResult> ExecuteManualAsync(ManualWorkInvocation invocation, CancellationToken cancellationToken)
    {
        if (invocation.Format != "nexus.manual.work-invocation" || invocation.Version != 1)
            throw new CheckInFailure("checkin_invocation_invalid");
        var snapshot = await persistence.ReadTasksAsync(cancellationToken);
        var taskId = Subject(invocation.Invocation);
        var task = snapshot.Store.Tasks.SingleOrDefault(task => task.Id == taskId) ?? throw new CheckInFailure("checkin_task_not_found");
        if (task.Revision != invocation.TaskRevision) throw new CheckInFailure("checkin_task_revision_conflict");
        return await ExecuteAsync(task, invocation.Invocation, "manual", cancellationToken);
    }

    public ValueTask<ScheduledWorkResult> ExecuteAsync(ScheduledInvocation invocation, CancellationToken cancellationToken) =>
        ValueTask.FromException<ScheduledWorkResult>(new CheckInFailure("checkin_revision_required"));

    private async ValueTask<ScheduledWorkResult> ExecuteAsync(CheckInTask task, ScheduledInvocation invocation, string trigger, CancellationToken cancellationToken)
    {
        var identity = await context.ReadAsync(invocation, task.Id, task.Revision, trigger, cancellationToken);
        if (!Guid.TryParseExact(invocation.RunId, "D", out var runId) || !Guid.TryParseExact(invocation.AttemptId, "D", out var attemptId) ||
            identity.RunId != runId || identity.AttemptId != attemptId || identity.Trigger != trigger)
            throw new CheckInFailure("checkin_execution_identity_invalid");
        var result = await runner.ExecuteAsync(task.Id, task.Revision, identity, cancellationToken);
        var outcome = result.Results.Any(game => game.EffectState == "unknown") ? "unverified" : result.Status switch {
            "success" => "succeeded", "partial" => "partial", "failed" => "failed", "cancelled" => "cancelled", _ => "unverified" };
        var reason = "checkin_" + (outcome == "succeeded" ? "completed" : outcome);
        try { _ = await submissions.SubmitAsync(task, result, invocation, cancellationToken); }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested) { throw; }
        catch (Exception error) when (error is not OutOfMemoryException) { reason = "checkin_notification_unknown"; }
        return new() { Format = "nexus.schedule.work-result", Version = 1, Invocation = invocation,
            BusinessOutcome = outcome, ReasonCode = reason };
    }

    private static Guid Subject(ScheduledInvocation invocation)
    {
        if (invocation.Format != "nexus.schedule.invocation" || invocation.Version != 1 ||
            !Guid.TryParseExact(invocation.SubjectId, "D", out var id) || id == Guid.Empty)
            throw new CheckInFailure("checkin_invocation_invalid");
        return id;
    }
}
