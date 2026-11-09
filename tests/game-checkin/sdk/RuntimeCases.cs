using NexusPipeline.Extensions.GameCheckIn;
using NexusPipeline.Extensibility.Notifications;
using NexusPipeline.Extensibility.Scheduling;

internal static class RuntimeCases
{
    internal static async Task RunAsync(Func<string, Func<Task>, Task> run)
    {
        static void Assert(bool value) { if (!value) throw new InvalidOperationException("assertion_failed"); }
        static CheckInTask Task(int index = 0) => new() { Id = Guid.NewGuid(), Revision = 3, Name = "task" + index, Games = new() { ["kuro"] = ["ww"] } };
        var started = new DateTimeOffset(2026, 10, 25, 1, 0, 0, TimeSpan.Zero);
        WorkRunFact Fact(string completion = "returned", string? business = "succeeded") => new(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), 3, "manual", completion,
            started, completion == "returned" ? started.AddMinutes(1) : null, business, "synthetic");
        CheckInRun Cached(WorkRunFact fact, string status = "success") => new(fact.RunId.ToString("D"), "manual", status, started, fact.CompletedAtUtc,
            [CheckInResults.Result("kuro", "ww", "success", true, "confirmed")], fact.AttemptId.ToString("D"), fact.TaskRevision);
        SdkCheckInRuntime Adapter(RuntimeHost host, RuntimeStore store) => new(host, store, new(host, store), new(new Targets()));
        async Task Reject(Func<Task> action, string code)
        { try { await action(); } catch (CheckInFailure error) when (error.Code == code) { return; } throw new InvalidOperationException("expected_" + code); }
        await run("actual-runtime-queries-129-owned-tasks-in-bounded-batches-and-keeps-host-next-occurrence", async () =>
        {
            var tasks = Enumerable.Range(0, 129).Select(Task).ToArray(); var store = new RuntimeStore(new() { Tasks = tasks }); var host = new RuntimeHost(tasks);
            host.Infos[tasks[0].Id] = host.Infos[tasks[0].Id] with { IsRunning = true, NextRunAt = started.AddDays(7) };
            var snapshot = await Adapter(host, store).ReadAsync(store.Tasks, default);
            Assert(host.Batches.All(batch => batch.Length is >= 1 and <= 128) &&
                host.Batches.SelectMany(batch => batch).ToHashSet().SetEquals(tasks.Select(task => task.Id)) && host.Providers.All(provider => provider == "checkin"));
            Assert(snapshot.Tasks[0].IsRunning && snapshot.Tasks[0].NextRunAt == started.AddDays(7) && snapshot.TimeZoneId == "UTC" && host.StopQueries == 0);
        });
        await run("actual-runtime-task-running-is-host-fact-while-unterminated-history-stays-unknown", async () =>
        {
            var task = Task(); var store = new RuntimeStore(new() { Tasks = [task] }); var host = new RuntimeHost([task]); var fact = Fact("running", null);
            store.Cache[task.Id] = Cached(fact); host.Infos[task.Id] = new(task.Id, 3, true, null, [fact]);
            var snapshot = await Adapter(host, store).ReadAsync(store.Tasks, default);
            Assert(snapshot.Tasks[0].IsRunning && snapshot.Tasks[0].RecentRun!.Status == "unknown" && host.StopQueries == 0);
        });
        await run("actual-runtime-explicit-host-failure-or-partial-cannot-be-covered-by-positive-cache", async () =>
        {
            foreach (var business in new[] { "failed", "partial" })
            {
                var task = Task(); var store = new RuntimeStore(new() { Tasks = [task] }); var host = new RuntimeHost([task]); var fact = Fact(business: business);
                store.Cache[task.Id] = Cached(fact); host.Infos[task.Id] = new(task.Id, 3, false, null, [fact]);
                Assert((await Adapter(host, store).ReadAsync(store.Tasks, default)).Tasks[0].RecentRun!.Status == business);
            }
        });
        await run("actual-runtime-does-not-attach-other-run-game-results-or-invent-cache-only-history", async () =>
        {
            var task = Task(); var store = new RuntimeStore(new() { Tasks = [task] }); var host = new RuntimeHost([task]); store.Cache[task.Id] = Cached(Fact());
            host.Infos[task.Id] = new(task.Id, 3, false, null, [Fact(business: "partial")]);
            var snapshot = await Adapter(host, store).ReadAsync(store.Tasks, default);
            Assert(snapshot.Tasks[0].RecentRun!.Status == "partial" && snapshot.Tasks[0].RecentRun!.Results.Length == 0);
            host.Infos[task.Id] = host.Infos[task.Id] with { Runs = [] };
            Assert((await Adapter(host, store).ReadAsync(store.Tasks, default)).Tasks[0].RecentRun is null);
        });
        await run("actual-runtime-conflicting-private-revision-or-foreign-task-snapshot-is-rejected", async () =>
        {
            var task = Task(); var store = new RuntimeStore(new() { Tasks = [task] }); var host = new RuntimeHost([task]);
            host.Infos[task.Id] = host.Infos[task.Id] with { Revision = 4 };
            await Reject(async () => { await Adapter(host, store).ReadAsync(store.Tasks, default); }, "checkin_configuration_conflict");
            host.Infos[task.Id] = host.Infos[task.Id] with { TaskId = Guid.NewGuid() };
            await Reject(async () => { await Adapter(host, store).ReadAsync(store.Tasks, default); }, "checkin_runtime_snapshot_invalid");
        });
        await run("actual-runtime-rejects-unknown-completion-inconsistent-outcome-and-unbounded-history", async () =>
        {
            var task = Task(); var store = new RuntimeStore(new() { Tasks = [task] }); var host = new RuntimeHost([task]);
            foreach (var fact in new[] { Fact("arbitrary"), Fact("unknown", "succeeded"), Fact() with { CompletedAtUtc = null } })
            {
                host.Infos[task.Id] = new(task.Id, 3, false, null, [fact]);
                await Reject(async () => { await Adapter(host, store).ReadAsync(store.Tasks, default); }, "checkin_runtime_snapshot_invalid");
            }
            host.Infos[task.Id] = new(task.Id, 3, false, null, Enumerable.Range(0, 17).Select(_ => Fact()).ToArray());
            await Reject(async () => { await Adapter(host, store).ReadAsync(store.Tasks, default); }, "checkin_runtime_snapshot_invalid");
        });
        await run("actual-runtime-empty-store-uses-host-clock-without-invalid-empty-task-query", async () =>
        {
            var store = new RuntimeStore(new()); var host = new RuntimeHost([]); var snapshot = await Adapter(host, store).ReadAsync(store.Tasks, default);
            Assert(snapshot.Tasks.Length == 0 && host.Batches.Count == 0 && snapshot.TimeZoneId == "UTC");
        });
        await run("unterminated-runtime-history-retains-pending-game-instead-of-claiming-not-executed", async () =>
        {
            var task = Task(); var store = new RuntimeStore(new() { Tasks = [task] }); var host = new RuntimeHost([task]); var fact = Fact("running", null);
            store.Cache[task.Id] = Cached(fact, "running") with { Results = [CheckInResults.Result("kuro", "ww", "pending")] };
            host.Infos[task.Id] = new(task.Id, 3, true, null, [fact]);
            Assert((await Adapter(host, store).ReadAsync(store.Tasks, default)).Tasks[0].RecentRun!.Results[0].Code == "pending");
        });
        await run("runtime-scale-preserves-input-order-and-matches-each-task-history", async () =>
        {
            foreach (var count in new[] { 1, 129, 1024 })
            {
                var tasks = Enumerable.Range(0, count).Select(Task).ToArray();
                var store = new RuntimeStore(new() { Tasks = tasks }); var host = new RuntimeHost(tasks);
                foreach (var task in tasks)
                {
                    var fact = Fact(); store.Cache[task.Id] = Cached(fact);
                    host.Infos[task.Id] = host.Infos[task.Id] with { Runs = [fact] };
                }
                host.Transform = snapshot => snapshot with { Tasks = snapshot.Tasks.Reverse().ToArray() };
                var actual = await Adapter(host, store).ReadAsync(store.Tasks, default);
                Assert(actual.Tasks.Select(task => task.TaskId).SequenceEqual(tasks.Select(task => task.Id)));
                Assert(actual.Tasks.All(task => task.RecentRun?.AttemptId == store.Cache[task.TaskId].AttemptId &&
                    task.RecentRun.Results.Single().Code == "success"));
                Assert(host.Batches.All(batch => batch.Length is >= 1 and <= 128) &&
                    host.Batches.SelectMany(batch => batch).ToHashSet().SetEquals(tasks.Select(task => task.Id)));
            }
        });
        await run("external-runtime-duplicate-missing-identity-and-invalid-zone-still-reject", async () =>
        {
            foreach (var invalid in new[] { "duplicate", "missing", "zone" })
            {
                var tasks = Enumerable.Range(0, 2).Select(Task).ToArray(); var store = new RuntimeStore(new() { Tasks = tasks }); var host = new RuntimeHost(tasks);
                host.Transform = snapshot => invalid switch {
                    "duplicate" => snapshot with { Tasks = [snapshot.Tasks[0], snapshot.Tasks[0]] },
                    "missing" => snapshot with { Tasks = [snapshot.Tasks[0]] },
                    _ => snapshot with { Clock = snapshot.Clock with { TimeZoneId = "Invalid/Fixture-Zone" } }
                };
                await Reject(async () => { await Adapter(host, store).ReadAsync(store.Tasks, default); }, "checkin_runtime_snapshot_invalid");
            }
        });
    }
    private sealed class Targets : INotificationTargets
    { public ValueTask<NotificationTargets> ReadAsync(CancellationToken cancellationToken) => ValueTask.FromResult(new NotificationTargets(1, [])); }
    private sealed class RuntimeHost(CheckInTask[] tasks) : IWorkTasks
    {
        internal readonly Dictionary<Guid, WorkTaskInfo> Infos = tasks.ToDictionary(task => task.Id, task => new WorkTaskInfo(task.Id, task.Revision, false, null, []));
        internal readonly List<Guid[]> Batches = [];
        internal readonly List<string> Providers = [];
        internal int StopQueries;
        internal Func<WorkTaskSnapshot, WorkTaskSnapshot> Transform = snapshot => snapshot;
        private static WorkClock Clock => new(new(2026, 10, 25, 1, 0, 0, TimeSpan.Zero), "UTC");
        public ValueTask<WorkTaskSnapshot> ReadAsync(string providerId, IReadOnlyList<Guid> taskIds, CancellationToken cancellationToken)
        { Providers.Add(providerId); Batches.Add(taskIds.ToArray()); return ValueTask.FromResult(Transform(new WorkTaskSnapshot(Clock, taskIds.Select(id => Infos[id]).ToArray()))); }
        public ValueTask<WorkClock> ReadClockAsync(CancellationToken cancellationToken) => ValueTask.FromResult(Clock);
        public ValueTask<bool> HasStoppedAsync(string providerId, Guid taskId, Guid runId, Guid attemptId, CancellationToken cancellationToken)
        { StopQueries++; throw new InvalidOperationException("ui_must_not_use_callback_stop_query"); }
        public ValueTask<WorkInvocation> ReadCurrentAsync(CancellationToken cancellationToken) => throw new NotSupportedException();
        public ValueTask<ManualRunReceipt> RunAsync(string providerId, Guid taskId, long expectedRevision, CancellationToken cancellationToken) => throw new NotSupportedException();
        public ValueTask<IAsyncDisposable> QuiesceAsync(string providerId, Guid taskId, long expectedRevision, CancellationToken cancellationToken) => throw new NotSupportedException();
    }
    private sealed class RuntimeStore(CheckInTaskStore store) : ICheckInPersistence
    {
        internal readonly CheckInTaskStore Tasks = store;
        internal readonly Dictionary<Guid, CheckInRun> Cache = [];
        public ValueTask<CheckInTaskSnapshot> ReadTasksAsync(CancellationToken cancellationToken) => ValueTask.FromResult(new CheckInTaskSnapshot(1, Tasks));
        public ValueTask<CheckInRecentRunSnapshot> ReadRunAsync(Guid taskId, CancellationToken cancellationToken)
            => ValueTask.FromResult(new CheckInRecentRunSnapshot(1, Cache.GetValueOrDefault(taskId)));
        public ValueTask<CheckInCredentialRead> ReadCredentialAsync(Guid taskId, string platform, CancellationToken cancellationToken) => throw new NotSupportedException();
        public ValueTask<CheckInPublication> PublishAsync(Guid operationId, long expectedDocumentRevision, CheckInTaskStore proposed, Guid? secretSubjectId, IReadOnlyList<CredentialMutation> changes, CancellationToken cancellationToken) => throw new NotSupportedException();
        public ValueTask<CheckInPublication?> ReadPublicationAsync(Guid operationId, CancellationToken cancellationToken) => throw new NotSupportedException();
        public ValueTask<long> WriteRunAsync(Guid operationId, Guid taskId, long expectedRevision, CheckInRun run, CancellationToken cancellationToken) => throw new NotSupportedException();
    }
}
