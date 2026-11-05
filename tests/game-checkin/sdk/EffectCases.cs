using NexusPipeline.Extensions.GameCheckIn;
using NexusPipeline.Extensibility.Scheduling;

internal static class EffectCases
{
    internal static async Task RunAsync(Func<string, Func<Task>, Task> run)
    {
        static void Assert(bool value) { if (!value) throw new InvalidOperationException("assertion_failed"); }
        async Task Reject(Func<Task> action)
        { try { await action(); } catch (CheckInFailure) { return; } throw new InvalidOperationException("rejection_expected"); }
        foreach (var state in Enum.GetValues<WorkEffectState>())
            await run("actual-sdk-effect-preserves-host-state/" + state, async () => {
                var host = new Effects { ActivityState = state }; var adapter = new SdkCheckInEffects(host, host, host.TaskId, "kuro", 7);
                var lease = await adapter.BeginGameAsync("kuro", "ww", default);
                Assert(lease.State == state.ToString().ToLowerInvariant() && lease.Id == host.Activity.ToString("D") && host.Field == "kuro" && host.Revision == 7 && host.Game == "ww");
                if (state is WorkEffectState.Busy or WorkEffectState.Confirmed)
                    await Reject(async () => { await adapter.AcquireAsync(new("kuro", "ww", "role", "server"), default); });
                Assert(host.Submissions == 0);
            });
        await run("actual-sdk-role-effects-forward-exact-opaque-identities-and-positive-evidence", async () => {
            var host = new Effects(); var adapter = new SdkCheckInEffects(host, host, host.TaskId, "kuro", 1);
            var activity = await adapter.BeginGameAsync("kuro", "ww", default); var role = await adapter.AcquireAsync(new("kuro", "ww", "123", "5000"), default);
            await adapter.SubmittedAsync(role, default); await adapter.ConfirmedAsync(role, "kuro_status_signed", default); await adapter.GameConfirmedAsync(activity, default);
            Assert(host.Acquired == (host.Activity, "123", "5000") && host.Submitted == host.Role && host.Confirmed == host.Role &&
                host.Evidence == "kuro_status_signed" && host.Completed == host.Activity);
        });
        await run("actual-sdk-unknown-role-can-only-reconcile-and-never-submit", async () => {
            var host = new Effects { ActivityState = WorkEffectState.Unknown, RoleState = WorkEffectState.Unknown }; var adapter = new SdkCheckInEffects(host, host, host.TaskId, "kuro", 1);
            var activity = await adapter.BeginGameAsync("kuro", "ww", default); var role = await adapter.AcquireAsync(new("kuro", "ww", "123", "5000"), default);
            await Reject(async () => { await adapter.SubmittedAsync(role, default); });
            await adapter.ConfirmedAsync(role, "kuro_status_signed", default); await adapter.GameConfirmedAsync(activity, default);
            Assert(host.Submissions == 0 && host.Confirmed == host.Role);
        });
        await run("actual-sdk-effect-rejects-foreign-state-forged-identity-and-role-activity-confusion", async () => {
            var host = new Effects(); var adapter = new SdkCheckInEffects(host, host, host.TaskId, "kuro", 1);
            var activity = await adapter.BeginGameAsync("kuro", "ww", default); var role = await adapter.AcquireAsync(new("kuro", "ww", "123", "5000"), default);
            await Reject(async () => { await adapter.SubmittedAsync(activity, default); });
            await Reject(async () => { await adapter.GameConfirmedAsync(role, default); });
            await Reject(async () => { await adapter.SubmittedAsync(role with { State = "unknown" }, default); });
            await Reject(async () => { await adapter.ConfirmedAsync(new(Guid.NewGuid().ToString("D"), "new"), "positive", default); });
            await Reject(async () => { await adapter.AcquireAsync(new("kuro", "pgr", "123", "5000"), default); });
            Assert(host.Submissions == 0 && host.Confirmed == Guid.Empty && host.Completed == Guid.Empty);
        });
        await run("actual-sdk-effect-invalid-field-revision-and-repeated-activity-do-not-call-host", async () => {
            var host = new Effects();
            await Reject(async () => { await new SdkCheckInEffects(host, host, host.TaskId, "kuro", 0).BeginGameAsync("kuro", "ww", default); });
            var adapter = new SdkCheckInEffects(host, host, host.TaskId, "kuro", 1);
            await Reject(async () => { await adapter.BeginGameAsync("cn", "gi", default); });
            await adapter.BeginGameAsync("kuro", "ww", default);
            await Reject(async () => { await adapter.BeginGameAsync("kuro", "ww", default); });
            Assert(host.Begins == 1);
        });
        await run("actual-sdk-effect-host-persistence-failure-propagates-before-business-http", async () => {
            var host = new Effects { FailSubmit = true }; var adapter = new SdkCheckInEffects(host, host, host.TaskId, "kuro", 1);
            await adapter.BeginGameAsync("kuro", "ww", default); var lease = await adapter.AcquireAsync(new("kuro", "ww", "r", "s"), default);
            try { await adapter.SubmittedAsync(lease, default); } catch (IOException) { Assert(host.Submissions == 1); return; }
            throw new InvalidOperationException("persistence_failure_hidden");
        });
        await run("actual-sdk-effect-refuses-foreign-business-owner-before-claim", async () => {
            var host = new Effects(); var adapter = new SdkCheckInEffects(host, host, Guid.NewGuid(), "kuro", 1);
            await Reject(async () => { await adapter.BeginGameAsync("kuro", "ww", default); }); Assert(host.Begins == 0);
        });
    }
    private sealed class Effects : IWorkEffects, IWorkTasks
    {
        internal readonly Guid Activity = Guid.NewGuid(), Role = Guid.NewGuid();
        internal readonly Guid TaskId = Guid.NewGuid();
        internal WorkEffectState ActivityState = WorkEffectState.New, RoleState = WorkEffectState.New;
        internal string Field = "", Game = "", Evidence = "";
        internal long Revision;
        internal int Begins, Submissions;
        internal Guid Submitted, Confirmed, Completed;
        internal (Guid, string, string) Acquired;
        internal bool FailSubmit;
        public ValueTask<WorkEffectLease> BeginAsync(string field, long expectedSecretRevision, string activityId, CancellationToken cancellationToken)
        { Begins++; Field = field; Revision = expectedSecretRevision; Game = activityId; return ValueTask.FromResult(new WorkEffectLease(Activity, ActivityState)); }
        public ValueTask<WorkEffectLease> AcquireAsync(Guid activityLeaseId, string roleId, string serverId, CancellationToken cancellationToken)
        { Acquired = (activityLeaseId, roleId, serverId); return ValueTask.FromResult(new WorkEffectLease(Role, RoleState)); }
        public ValueTask SubmittedAsync(Guid leaseId, CancellationToken cancellationToken)
        { Submitted = leaseId; Submissions++; if (FailSubmit) throw new IOException("synthetic_commit_unknown"); return ValueTask.CompletedTask; }
        public ValueTask ConfirmedAsync(Guid leaseId, string evidenceCode, CancellationToken cancellationToken)
        { Confirmed = leaseId; Evidence = evidenceCode; return ValueTask.CompletedTask; }
        public ValueTask CompleteAsync(Guid activityLeaseId, CancellationToken cancellationToken)
        { Completed = activityLeaseId; return ValueTask.CompletedTask; }
        public ValueTask<WorkInvocation> ReadCurrentAsync(CancellationToken cancellationToken) =>
            ValueTask.FromResult(new WorkInvocation(Guid.NewGuid(), Guid.NewGuid(), TaskId, TaskId, 1, new(2026, 10, 25), "UTC", DateTimeOffset.UtcNow.AddMinutes(30)));
        public ValueTask<bool> HasStoppedAsync(string providerId, Guid taskId, Guid runId, Guid attemptId, CancellationToken cancellationToken) => throw new NotSupportedException();
        public ValueTask<WorkClock> ReadClockAsync(CancellationToken cancellationToken) => throw new NotSupportedException();
        public ValueTask<WorkTaskSnapshot> ReadAsync(string providerId, IReadOnlyList<Guid> ids, CancellationToken cancellationToken) => throw new NotSupportedException();
        public ValueTask<ManualRunReceipt> RunAsync(string providerId, Guid taskId, long revision, CancellationToken cancellationToken) => throw new NotSupportedException();
        public ValueTask<IAsyncDisposable> QuiesceAsync(string providerId, Guid taskId, long revision, CancellationToken cancellationToken) => throw new NotSupportedException();
    }
}
