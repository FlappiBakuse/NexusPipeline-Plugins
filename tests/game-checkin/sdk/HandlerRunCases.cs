using NexusPipeline.Extensions.GameCheckIn;
using NexusPipeline.Extensibility.Notifications;
using NexusPipeline.Extensibility.Protocol;

internal static class HandlerRunCases
{
    internal static async Task RunAsync(Func<string, Func<Task>, Task> run)
    {
        static void Assert(bool value) { if (!value) throw new InvalidOperationException("assertion_failed"); }
        foreach (var planned in new[] { false, true })
            await run("actual-handler-final-result-submits-once-with-real-invocation/" + (planned ? "planned" : "manual"), async () => {
                var fixture = new Fixture(planned); var result = await fixture.ExecuteAsync();
                Assert(result.BusinessOutcome == "failed" && result.ReasonCode == "checkin_failed" && result.Invocation == fixture.Invocation);
                Assert(fixture.Submission.Calls == 1 && fixture.Submission.Sent!.Invocation == fixture.Invocation &&
                    fixture.Submission.Sent.OperationId == fixture.Invocation.NotificationOperationId && fixture.Submission.Sent.Body.Contains("未确认", StringComparison.Ordinal));
                Assert(fixture.Store.Run!.Status == "failed" && fixture.Store.Run.Trigger == (planned ? "scheduled" : "manual") && fixture.Store.CredentialReads == 1);
                if (!planned) Assert(!fixture.Task.Enabled && fixture.Task.Schedules.Length == 0);
            });
        await run("actual-handler-notification-acceptance-failure-preserves-business-result-and-does-not-repeat", async () => {
            var fixture = new Fixture(false); fixture.Submission.Fail = true; var result = await fixture.ExecuteAsync();
            Assert(result.BusinessOutcome == "failed" && result.ReasonCode == "checkin_notification_unknown" && fixture.Submission.Calls == 1 &&
                fixture.Store.Run!.Status == "failed" && fixture.Store.CredentialReads == 1);
        });
    }
    private sealed class Fixture
    {
        internal readonly CheckInTask Task;
        internal readonly Store Store;
        internal readonly Submission Submission = new();
        internal readonly ScheduledInvocation Invocation;
        private readonly CheckInWorkHandler handler;
        private readonly bool planned;
        internal Fixture(bool planned)
        {
            this.planned = planned; var target = Guid.NewGuid(); var schedule = Guid.NewGuid().ToString("D");
            Task = new() { Id = Guid.NewGuid(), Revision = 3, Name = "synthetic-task", Enabled = planned, Games = new() { ["kuro"] = ["ww"] },
                Schedules = planned ? [new() { Id = schedule, Enabled = true, Days = [0], Time = "09:00" }] : [],
                Notification = new() { Enabled = true, NotificationTaskIds = [target.ToString("D")] } };
            Store = new(Task); var execution = new Execution(); var targets = new SdkCheckInNotifications(new Targets(target));
            var protocols = new CheckInProtocols(null!, execution, null!, TimeProvider.System);
            handler = new(Store, new(Store, protocols, execution, TimeProvider.System), new Context(), targets, new(Submission, targets));
            var subject = planned ? CheckInPlans.Identity(Task.Id, schedule) : Task.Id;
            Invocation = new() { Format = "nexus.schedule.invocation", Version = 1, SubjectId = subject.ToString("D"), RunId = Guid.NewGuid().ToString("D"),
                AttemptId = Guid.NewGuid().ToString("D"), InstanceId = Guid.NewGuid().ToString("D"), OccurrenceId = Guid.NewGuid().ToString("D"),
                DeadlineUtc = DateTimeOffset.UtcNow.AddMinutes(30).ToString("O"), NotificationOperationId = Guid.NewGuid().ToString("D"), NotificationTaskIds = [target.ToString("D")] };
        }
        internal ValueTask<ScheduledWorkResult> ExecuteAsync() => planned ? handler.ExecutePlannedAsync(new() {
            Format = "nexus.schedule.planned-invocation", Version = 1, Invocation = Invocation, OwnerTaskId = Task.Id.ToString("D"), PlansRevision = 11, TaskRevision = 3 }, default) :
            handler.ExecuteManualAsync(new() { Format = "nexus.manual.work-invocation", Version = 1, Invocation = Invocation, TaskRevision = 3 }, default);
    }
    private sealed class Store(CheckInTask task) : ICheckInPersistence
    {
        internal CheckInRun? Run;
        internal int CredentialReads;
        public ValueTask<CheckInTaskSnapshot> ReadTasksAsync(CancellationToken cancellationToken) => ValueTask.FromResult(new CheckInTaskSnapshot(11, new() { Tasks = [task] }));
        public ValueTask<CheckInCredentialRead> ReadCredentialAsync(Guid taskId, string platform, CancellationToken cancellationToken)
        { CredentialReads++; return ValueTask.FromResult(new CheckInCredentialRead(0, false, null)); }
        public ValueTask<CheckInRecentRunSnapshot> ReadRunAsync(Guid taskId, CancellationToken cancellationToken) => ValueTask.FromResult(new CheckInRecentRunSnapshot(0, Run));
        public ValueTask<long> WriteRunAsync(Guid operationId, Guid taskId, long expectedRevision, CheckInRun run, CancellationToken cancellationToken)
        { Run = run; return ValueTask.FromResult(expectedRevision + 1); }
        public ValueTask<CheckInPublication> PublishAsync(Guid operationId, long expectedDocumentRevision, CheckInTaskStore proposed, Guid? secretSubjectId, IReadOnlyList<CredentialMutation> changes, CancellationToken cancellationToken) => throw new NotSupportedException();
        public ValueTask<CheckInPublication?> ReadPublicationAsync(Guid operationId, CancellationToken cancellationToken) => throw new NotSupportedException();
    }
    private sealed class Context : ICheckInWorkContext
    {
        public ValueTask<CheckInWorkClock> ReadClockAsync(CancellationToken cancellationToken) => ValueTask.FromResult(new CheckInWorkClock(DateTimeOffset.UtcNow, "UTC"));
        public ValueTask<CheckInExecutionIdentity> ReadAsync(ScheduledInvocation invocation, Guid businessTaskId, long taskRevision, string trigger, CancellationToken cancellationToken) =>
            ValueTask.FromResult(new CheckInExecutionIdentity(Guid.Parse(invocation.RunId), Guid.Parse(invocation.AttemptId), trigger, new(2026, 10, 25)));
    }
    private sealed class Execution : ICheckInExecutionPorts
    {
        public ICheckInEffects Effects(Guid taskId, string platform, long expectedSecretRevision) => throw new InvalidOperationException("unexpected_effect");
        public ICheckInCredentialRotation Rotation(Guid taskId, long expectedTaskRevision, long expectedSecretRevision) => throw new InvalidOperationException("unexpected_rotation");
        public ValueTask<bool> IsStoppedAsync(Guid taskId, Guid runId, Guid attemptId, CancellationToken cancellationToken) => throw new InvalidOperationException("unexpected_recovery");
    }
    private sealed class Targets(Guid id) : INotificationTargets
    { public ValueTask<NotificationTargets> ReadAsync(CancellationToken cancellationToken) => ValueTask.FromResult(new NotificationTargets(1, [new(id, 1, "fixture", true, true, "smtp")])); }
    private sealed class Submission : INotificationSubmissionPort
    {
        internal int Calls;
        internal bool Fail;
        internal NotificationSubmission? Sent;
        public ValueTask<NotificationAcceptance> SubmitAsync(NotificationSubmission submission, CancellationToken cancellationToken)
        {
            Calls++; Sent = submission; if (Fail) throw new IOException("synthetic_acceptance_unknown");
            return ValueTask.FromResult(new NotificationAcceptance(Guid.Parse(submission.OperationId), Guid.NewGuid(), true));
        }
    }
}
