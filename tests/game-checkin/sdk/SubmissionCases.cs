using NexusPipeline.Extensions.GameCheckIn;
using NexusPipeline.Extensibility.Notifications;
using NexusPipeline.Extensibility.Protocol;

internal static class SubmissionCases
{
    internal static async Task RunAsync(Func<string, Func<Task>, Task> run)
    {
        static void Assert(bool value) { if (!value) throw new InvalidOperationException("assertion_failed"); }
        var ready = Guid.NewGuid(); var notFrozen = Guid.NewGuid(); var disabled = Guid.NewGuid(); var incomplete = Guid.NewGuid();
        var port = new Submission();
        var adapter = new SdkCheckInSubmission(port, new(new Targets(new(9, [new(ready, 1, "ready", true, true, "smtp"),
            new(notFrozen, 1, "outside", true, true, "webhook"), new(disabled, 1, "disabled", false, true, "smtp"), new(incomplete, 1, "incomplete", true, false, "smtp")]))));
        var task = new CheckInTask { Id = Guid.NewGuid(), Revision = 3, Name = "task", Games = new() { ["kuro"] = ["ww"] },
            Notification = new() { Enabled = true, NotificationTaskIds = [ready.ToString("D"), notFrozen.ToString("D"), disabled.ToString("D"), incomplete.ToString("D")] } };
        var started = DateTimeOffset.UtcNow; var result = new CheckInRun(Guid.NewGuid().ToString("D"), "manual", "unknown", started, started,
            [new("kuro", "ww", "success_unconfirmed", "synthetic-raw-server-message-not-for-notification", false, "unknown")], Guid.NewGuid().ToString("D"), 3);
        var invocation = new ScheduledInvocation { Format = "nexus.schedule.invocation", Version = 1, SubjectId = task.Id.ToString("D"), RunId = result.Id,
            AttemptId = result.AttemptId, InstanceId = Guid.NewGuid().ToString("D"), OccurrenceId = Guid.NewGuid().ToString("D"),
            NotificationOperationId = Guid.NewGuid().ToString("D"), DeadlineUtc = started.AddMinutes(30).ToString("O"),
            NotificationTaskIds = [ready.ToString("D"), disabled.ToString("D"), incomplete.ToString("D")] };
        await run("notification-submission-uses-original-operation-frozen-targets-and-current-configured-intersection", async () =>
        {
            var acceptance = await adapter.SubmitAsync(task, result, invocation, default);
            var sent = port.Sent ?? throw new InvalidOperationException("submission_missing");
            Assert(acceptance!.OperationId.ToString("D") == invocation.NotificationOperationId && sent.NotificationTaskIds.Single() == ready.ToString("D"));
            Assert(sent.Invocation == invocation && sent.Title.Contains("结果未知", StringComparison.Ordinal) && sent.Body.Contains("鸣潮", StringComparison.Ordinal));
            Assert(!sent.Body.Contains("synthetic-raw-server-message", StringComparison.Ordinal) && port.Calls == 1);
        });
        await run("disabled-or-unselected-notifications-do-not-submit", async () =>
        {
            Assert(await adapter.SubmitAsync(task with { Notification = task.Notification with { Enabled = false } }, result, invocation, default) is null);
            Assert(await adapter.SubmitAsync(task, result, invocation with { NotificationTaskIds = [] }, default) is null && port.Calls == 1);
        });
        await run("notification-result-identity-and-acceptance-identity-are-not-inferred", async () =>
        {
            try { await adapter.SubmitAsync(task, result with { AttemptId = Guid.NewGuid().ToString("D") }, invocation, default); throw new InvalidOperationException("mismatched_attempt_accepted"); }
            catch (CheckInFailure error) when (error.Code == "checkin_notification_identity_invalid") { }
            port.WrongOperation = true;
            try { await adapter.SubmitAsync(task, result, invocation, default); throw new InvalidOperationException("mismatched_receipt_accepted"); }
            catch (CheckInFailure error) when (error.Code == "checkin_notification_acceptance_unknown") { }
        });
    }
    private sealed class Targets(NotificationTargets targets) : INotificationTargets
    { public ValueTask<NotificationTargets> ReadAsync(CancellationToken cancellationToken) => ValueTask.FromResult(targets); }
    private sealed class Submission : INotificationSubmissionPort
    {
        internal NotificationSubmission? Sent;
        internal int Calls;
        internal bool WrongOperation;
        public ValueTask<NotificationAcceptance> SubmitAsync(NotificationSubmission submission, CancellationToken cancellationToken)
        { Calls++; Sent = submission; return ValueTask.FromResult(new NotificationAcceptance(WrongOperation ? Guid.NewGuid() : Guid.Parse(submission.OperationId), Guid.NewGuid(), true)); }
    }
}
