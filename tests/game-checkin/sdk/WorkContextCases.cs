using NexusPipeline.Extensions.GameCheckIn;
using NexusPipeline.Extensibility.Protocol;
using NexusPipeline.Extensibility.Scheduling;

internal static class WorkContextCases
{
    internal static async Task RunAsync(Func<string, Func<Task>, Task> run)
    {
        static void Assert(bool value) { if (!value) throw new InvalidOperationException("assertion_failed"); }
        var taskId = Guid.NewGuid(); var schedule = Guid.NewGuid();
        var task = new CheckInTask { Id = taskId, Revision = 3, Name = "task", Games = new() { ["kuro"] = ["ww"] },
            Schedules = [new() { Id = schedule.ToString("D"), Days = [0], Time = "09:00" }] };
        using var ports = new PersistencePorts { Document = new(11, "fixture", CheckInJson.Bytes(new CheckInTaskStore { Tasks = [task] })) };
        var persistence = new SdkCheckInPersistence(ports, ports, ports); var host = new WorkTasks(taskId); var adapter = new SdkCheckInWork(host, persistence);
        ScheduledInvocation Invocation() => new() { Format = "nexus.schedule.invocation", Version = 1, SubjectId = host.Current.SubjectId.ToString("D"),
            RunId = host.Current.RunId.ToString("D"), AttemptId = host.Current.AttemptId.ToString("D"), DeadlineUtc = host.Current.DeadlineUtc.ToString("O"),
            InstanceId = Guid.NewGuid().ToString("D"), OccurrenceId = Guid.NewGuid().ToString("D"), NotificationOperationId = Guid.NewGuid().ToString("D"), NotificationTaskIds = [] };
        async Task Reject(Func<Task> action, string code)
        { try { await action(); } catch (CheckInFailure error) when (error.Code == code) { return; } throw new InvalidOperationException("expected_" + code); }
        await run("actual-work-port-preserves-host-frozen-day-independent-of-current-clock", async () =>
        {
            var clock = await adapter.ReadClockAsync(default); var execution = await adapter.ReadAsync(Invocation(), taskId, 3, "manual", default);
            var identity = execution.Identity;
            Assert(clock.UtcNow.Month == 10 && clock.TimeZoneId == "UTC" && identity.LocalDate == new DateOnly(2026, 1, 31));
            Assert(identity.RunId == host.Current.RunId && identity.AttemptId == host.Current.AttemptId);
            Assert(execution.Task.Id == taskId && execution.Task.Revision == 3);
        });
        await run("actual-work-port-rejects-payload-run-attempt-subject-deadline-and-private-revision", async () =>
        {
            var actual = Invocation();
            foreach (var changed in new[] { actual with { RunId = Guid.NewGuid().ToString("D") }, actual with { AttemptId = Guid.NewGuid().ToString("D") },
                actual with { SubjectId = Guid.NewGuid().ToString("D") }, actual with { DeadlineUtc = host.Current.DeadlineUtc.AddSeconds(1).ToString("O") } })
                await Reject(async () => { await adapter.ReadAsync(changed, taskId, 3, "manual", default); }, "checkin_execution_identity_invalid");
            await Reject(async () => { await adapter.ReadAsync(actual, taskId, 4, "manual", default); }, "checkin_execution_identity_invalid");
        });
        await run("actual-work-port-resolves-planned-subject-to-private-owner-without-guessing", async () =>
        {
            host.Current = host.Current with { SubjectId = CheckInPlans.Identity(taskId, schedule.ToString("D")) };
            var execution = await adapter.ReadAsync(Invocation(), taskId, 3, "scheduled", default); Assert(execution.Identity.Trigger == "scheduled");
            await Reject(async () => { await adapter.ReadAsync(Invocation(), taskId, 3, "manual", default); }, "checkin_task_revision_conflict");
            host.Current = host.Current with { SubjectId = taskId };
        });
        await run("actual-work-run-and-quiescence-use-fixed-provider-and-current-private-revision", async () =>
        {
            await adapter.RunNowAsync(taskId, 3, default); Assert(host.RunCalls == 1 && host.Provider == "checkin" && host.TaskId == taskId && host.Revision == 3);
            await Reject(async () => { await adapter.RunNowAsync(taskId, 2, default); }, "checkin_task_revision_conflict"); Assert(host.RunCalls == 1);
            await using (await adapter.HoldAsync(taskId, 3, default)) { Assert(host.Held && host.Revision == 3); }
            Assert(!host.Held);
        });
        await run("run-now-uses-one-private-task-read-and-leaves-final-revision-admission-to-the-host", async () =>
        {
            var views = new CheckInViews(persistence, new SdkCheckInRuntime(host, persistence, adapter, null!), null!);
            var client = new CheckInClient(Guid.NewGuid(), Guid.NewGuid(), default);
            var reads = ports.DocumentReads;
            var accepted = host.RunCalls;
            await views.RunNowAsync(client, taskId, default);
            if (ports.DocumentReads - reads != 1)
                throw new InvalidOperationException($"run-now private reads: expected 1, observed {ports.DocumentReads - reads}");
            Assert(host.RunCalls == accepted + 1 && host.Revision == 3 && host.TaskId == taskId);

            host.AdmissionRevision = 4;
            try { await Reject(async () => { await views.RunNowAsync(client, taskId, default); }, "checkin_task_revision_conflict"); }
            finally { host.AdmissionRevision = 3; }
            Assert(host.RunCalls == accepted + 1);
            await Reject(async () => { await views.RunNowAsync(client, Guid.NewGuid(), default); }, "checkin_task_not_found");
            Assert(host.RunCalls == accepted + 1);
        });
        await run("actual-work-clock-invalid-zone-is-not-replaced-by-plugin-local-zone", async () =>
        {
            host.Zone = "synthetic/unknown-zone";
            await Reject(async () => { await adapter.ReadClockAsync(default); }, "checkin_host_clock_invalid");
        });
    }
    internal sealed class WorkTasks(Guid taskId) : IWorkTasks
    {
        internal WorkInvocation Current = new(Guid.NewGuid(), Guid.NewGuid(), taskId, taskId, 3, new(2026, 1, 31), "UTC", new(2026, 2, 1, 0, 10, 0, TimeSpan.Zero));
        internal string Zone = "UTC", Provider = "";
        internal int RunCalls;
        internal long AdmissionRevision = 3;
        internal Action? OnReadCurrent;
        internal Guid TaskId;
        internal long Revision;
        internal bool Held;
        public ValueTask<WorkClock> ReadClockAsync(CancellationToken cancellationToken) => ValueTask.FromResult(new WorkClock(new(2026, 10, 25, 0, 0, 0, TimeSpan.Zero), Zone));
        public ValueTask<WorkInvocation> ReadCurrentAsync(CancellationToken cancellationToken)
        { OnReadCurrent?.Invoke(); return ValueTask.FromResult(Current); }
        public ValueTask<WorkTaskSnapshot> ReadAsync(string providerId, IReadOnlyList<Guid> taskIds, CancellationToken cancellationToken) => throw new NotSupportedException();
        public ValueTask<bool> HasStoppedAsync(string providerId, Guid id, Guid runId, Guid attemptId, CancellationToken cancellationToken) => ValueTask.FromResult(false);
        public ValueTask<ManualRunReceipt> RunAsync(string providerId, Guid id, long expectedRevision, CancellationToken cancellationToken)
        {
            if (expectedRevision != AdmissionRevision) throw new IOException("manual_work_revision_conflict");
            RunCalls++; Provider = providerId; TaskId = id; Revision = expectedRevision;
            return ValueTask.FromResult(new ManualRunReceipt(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), true));
        }
        public ValueTask<IAsyncDisposable> QuiesceAsync(string providerId, Guid id, long expectedRevision, CancellationToken cancellationToken)
        { Provider = providerId; TaskId = id; Revision = expectedRevision; Held = true; return ValueTask.FromResult<IAsyncDisposable>(new Lease(this)); }
        private sealed class Lease(WorkTasks owner) : IAsyncDisposable
        { public ValueTask DisposeAsync() { owner.Held = false; return ValueTask.CompletedTask; } }
    }
}
