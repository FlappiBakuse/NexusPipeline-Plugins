using NexusPipeline.Extensions.GameCheckIn;
using NexusPipeline.Extensibility.Notifications;
using NexusPipeline.Extensibility.Protocol;

internal static class WorkHandlerCases
{
    internal static async Task RunAsync(Func<string, Func<Task>, Task> run)
    {
        static void Assert(bool value) { if (!value) throw new InvalidOperationException("assertion_failed"); }
        var id = Guid.NewGuid(); var scheduleId = Guid.NewGuid(); var target = Guid.NewGuid();
        CheckInTask Task(bool enabled) => new() { Id = id, Revision = 7, Name = "task", Enabled = enabled,
            Games = new() { ["kuro"] = ["ww"] }, Notification = new() { Enabled = true, NotificationTaskIds = [target.ToString("D")] },
            Schedules = [new() { Id = scheduleId.ToString("D"), Enabled = true, Days = [0, 6], Time = "23:59" }] };
        using var ports = new PersistencePorts { Document = new(11, "fixture", CheckInJson.Bytes(new CheckInTaskStore { Tasks = [Task(false)] })) };
        var persistence = new SdkCheckInPersistence(ports, ports, ports); var source = new WorkContext();
        var handler = new CheckInWorkHandler(persistence, null!, source,
            new SdkCheckInNotifications(new Targets(new(2, [new(target, 3, "configured", true, true, "smtp")]))), null!);
        ScheduledInvocation Invocation(Guid subject) => new() { Format = "nexus.schedule.invocation", Version = 1,
            SubjectId = subject.ToString("D"), RunId = Guid.NewGuid().ToString("D"), AttemptId = Guid.NewGuid().ToString("D"),
            InstanceId = Guid.NewGuid().ToString("D"), OccurrenceId = Guid.NewGuid().ToString("D"),
            NotificationOperationId = Guid.NewGuid().ToString("D"), NotificationTaskIds = [target.ToString("D")], DeadlineUtc = "2026-10-25T00:00:00Z" };
        async Task Reject(Func<Task> action, string code)
        {
            try { await action(); } catch (CheckInFailure error) when (error.Code == code) { return; }
            throw new InvalidOperationException("expected_" + code);
        }
        await run("manual-metadata-preserves-disabled-automatic-task-and-associated-plan", async () =>
        {
            var manual = (await handler.ReadTaskAsync(id, default))!;
            Assert(manual.IsEnabled && manual.Revision == 7 && manual.ScheduledTaskIds.Single() == CheckInPlans.Identity(id, scheduleId.ToString("D")).ToString("D"));
            Assert(manual.NotificationTaskIds.Single() == target.ToString("D") && manual.TimeZoneId == "UTC");
            Assert(await handler.ReadTaskAsync(Guid.NewGuid(), default) is null);
        });
        await run("planned-metadata-uses-global-revision-private-revision-and-weekly-time", async () =>
        {
            var plans = await handler.ReadPlansAsync(default); var plan = plans.Tasks.Single();
            Assert(plans.Revision == 11 && plan.Revision == 7 && !plan.IsEnabled && plan.LocalMinute == 1439 && plan.Weekdays.SequenceEqual(new long[] { 0, 6 }));
        });
        await run("planned-stale-global-revision-rejected-before-work-context", async () =>
        {
            await Reject(async () => { await handler.ExecutePlannedAsync(new() { Format = "nexus.schedule.planned-invocation", Version = 1,
                Invocation = Invocation(CheckInPlans.Identity(id, scheduleId.ToString("D"))), OwnerTaskId = id.ToString("D"), PlansRevision = 10, TaskRevision = 7 }, default); }, "checkin_plan_stale");
            Assert(source.Reads == 0);
        });
        await run("planned-disabled-task-rejected-before-work-context", async () =>
        {
            await Reject(async () => { await handler.ExecutePlannedAsync(new() { Format = "nexus.schedule.planned-invocation", Version = 1,
                Invocation = Invocation(CheckInPlans.Identity(id, scheduleId.ToString("D"))), OwnerTaskId = id.ToString("D"), PlansRevision = 11, TaskRevision = 7 }, default); }, "checkin_plan_disabled");
            Assert(source.Reads == 0);
        });
        await run("planned-foreign-owner-rejected-before-work-context", async () =>
        {
            await Reject(async () => { await handler.ExecutePlannedAsync(new() { Format = "nexus.schedule.planned-invocation", Version = 1,
                Invocation = Invocation(CheckInPlans.Identity(id, scheduleId.ToString("D"))), OwnerTaskId = Guid.NewGuid().ToString("D"), PlansRevision = 11, TaskRevision = 7 }, default); }, "checkin_execution_owner_invalid");
            Assert(source.Reads == 0);
        });
        await run("manual-stale-private-revision-rejected-before-work-context", async () =>
        {
            await Reject(async () => { await handler.ExecuteManualAsync(new() { Format = "nexus.manual.work-invocation", Version = 1,
                Invocation = Invocation(id), TaskRevision = 6 }, default); }, "checkin_task_revision_conflict"); Assert(source.Reads == 0);
        });
        await run("disabled-automatic-task-manual-run-still-requires-real-host-context", async () =>
        {
            await Reject(async () => { await handler.ExecuteManualAsync(new() { Format = "nexus.manual.work-invocation", Version = 1,
                Invocation = Invocation(id), TaskRevision = 7 }, default); }, "synthetic_host_context_missing");
        });
        await run("unversioned-scheduled-entry-cannot-bypass-saved-revision-checks", async () =>
        {
            var readsBefore = source.Reads;
            await Reject(async () => { await handler.ExecuteAsync(Invocation(id), default); }, "checkin_revision_required"); Assert(source.Reads == readsBefore);
        });
    }
    private sealed class WorkContext : ICheckInWorkContext
    {
        internal int Reads;
        public ValueTask<CheckInWorkClock> ReadClockAsync(CancellationToken cancellationToken) => ValueTask.FromResult(new CheckInWorkClock(DateTimeOffset.UtcNow, "UTC"));
        public ValueTask<CheckInExecutionIdentity> ReadAsync(ScheduledInvocation invocation, Guid businessTaskId, long taskRevision,
            string trigger, CancellationToken cancellationToken)
        { Reads++; return ValueTask.FromException<CheckInExecutionIdentity>(new CheckInFailure("synthetic_host_context_missing")); }
    }
    private sealed class Targets(NotificationTargets targets) : INotificationTargets
    { public ValueTask<NotificationTargets> ReadAsync(CancellationToken cancellationToken) => ValueTask.FromResult(targets); }
}
