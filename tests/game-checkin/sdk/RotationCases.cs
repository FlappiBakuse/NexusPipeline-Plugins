using System.Text;
using NexusPipeline.Extensions.GameCheckIn;
using NexusPipeline.Extensibility.Scheduling;
using NexusPipeline.Extensibility.Secrets;

internal static class RotationCases
{
    private const string Native = "{\"accessToken\":\"synthetic-access\",\"refreshToken\":\"synthetic-refresh\",\"uid\":\"123456\",\"deviceId\":\"synthetic-device\",\"sdkToken\":\"synthetic-sdk\",\"sdkUid\":\"456789\"}";
    internal static async Task RunAsync(Func<string, Func<Task>, Task> run)
    {
        static void Assert(bool value) { if (!value) throw new InvalidOperationException("assertion_failed"); }
        await run("actual-manual-provider-rotation-preserves-borrowed-drafts-and-rejects-non-taji", () => {
            IManualWorkHandler handler = new CheckInWorkHandler(null!, null!, null!, null!, null!);
            using var before = Material(); using var after = Material(true); using var original = Draft(before); using var replacement = Draft(after);
            Assert(handler.CanRotateIdentity("tajiduo", original, replacement) && !handler.CanRotateIdentity("kuro", original, replacement));
            original.Use(value => Assert(value.Length > 0)); replacement.Use(value => Assert(value.Length > 0));
            using var changed = new CredentialMaterial(Native.Replace("synthetic-device", "other-device", StringComparison.Ordinal), "manual"); using var bad = Draft(changed);
            Assert(!handler.CanRotateIdentity("tajiduo", original, bad)); return Task.CompletedTask;
        });
        await run("actual-sdk-rotation-atomically-replaces-only-taji-without-changing-private-task", async () => {
            using var fixture = new Fixture(); using var before = Material(); using var after = Material(true);
            var original = fixture.Ports.Document!.Json.ToArray();
            var adapter = fixture.Adapter(); Assert(await adapter.PersistAsync(before, after, default));
            Assert(fixture.Ports.AtomicWrites == 1 && fixture.Ports.SingleWrites == 0 && fixture.Ports.Applies == 0 && fixture.Ports.Transferred.Count == 1);
            var snapshot = await fixture.Persistence.ReadTasksAsync(default); using var saved = await fixture.Persistence.ReadCredentialAsync(fixture.Task.Id, "tajiduo", default);
            Assert(snapshot.Revision == 12 && snapshot.Store.Tasks.Single().Revision == 3 && saved.Revision == 2);
            Assert(fixture.Ports.Document!.Json.Span.SequenceEqual(original));
            saved.Material!.Use(value => Assert(value.Contains("replacement-access", StringComparison.Ordinal)));
            Assert(!await adapter.PersistAsync(before, after, default) && fixture.Ports.AtomicWrites == 1);
        });
        foreach (var changed in new[] { "owner", "taskRevision", "secretRevision", "storedMaterial", "replacementIdentity", "selection" })
            await run("actual-sdk-rotation-rejects-changed-binding-before-publication/" + changed, async () => {
                using var fixture = new Fixture(); using var before = Material();
                using var after = changed == "replacementIdentity" ? new CredentialMaterial(Native.Replace("456789", "456788", StringComparison.Ordinal), "manual") : Material(true);
                if (changed == "owner") fixture.Work.Current = fixture.Work.Current with { TaskId = Guid.NewGuid() };
                if (changed == "taskRevision") fixture.Work.Current = fixture.Work.Current with { TaskRevision = 4 };
                if (changed == "storedMaterial") fixture.Ports.Put(fixture.Task.Id, "tajiduo", "synthetic-different");
                if (changed == "selection") fixture.Ports.Document = fixture.Ports.Document! with { Json = CheckInJson.Bytes(new CheckInTaskStore { Tasks = [fixture.Task with { Games = new() { ["kuro"] = ["ww"] } }] }) };
                var adapter = fixture.Adapter(changed == "secretRevision" ? 2 : 1);
                Assert(!await adapter.PersistAsync(before, after, default) && fixture.Ports.AtomicWrites == 0);
            });
        foreach (var afterCommit in new[] { false, true })
            await run("actual-sdk-rotation-publication-failure-never-restores-http-authority-from-readcommit/" + afterCommit, async () => {
                using var fixture = new Fixture(); fixture.Ports.RejectAtomic = !afterCommit; fixture.Ports.ThrowAfterCommit = afterCommit;
                using var before = Material(); using var after = Material(true);
                Assert(!await fixture.Adapter().PersistAsync(before, after, default) && fixture.Ports.AtomicWrites == 1 && fixture.Ports.CommitReads == 0);
                Assert((fixture.Ports.Document!.Revision == 12) == afterCommit);
            });
        await run("actual-sdk-historical-writer-query-forwards-exact-owner-run-attempt", async () => {
            using var fixture = new Fixture(); var runId = Guid.NewGuid(); var attemptId = Guid.NewGuid();
            var adapter = new SdkCheckInExecution(fixture.Work, null!, fixture.Persistence);
            Assert(!await adapter.IsStoppedAsync(fixture.Task.Id, runId, attemptId, default));
            Assert(fixture.Work.Stopped == ("checkin", fixture.Task.Id, runId, attemptId));
        });
    }
    private static CredentialMaterial Material(bool replacement = false) => new(replacement ? Native.Replace("synthetic-access", "replacement-access", StringComparison.Ordinal).Replace("synthetic-refresh", "replacement-refresh", StringComparison.Ordinal) : Native, "manual");
    private static SecretDraft Draft(CredentialMaterial value)
    {
        var bytes = value.Encode(); var characters = Encoding.UTF8.GetChars(bytes);
        try { return new(characters); } finally { Array.Clear(bytes); Array.Clear(characters); }
    }
    private sealed class Fixture : IDisposable
    {
        internal readonly PersistencePorts Ports = new();
        internal readonly CheckInTask Task = new() { Id = Guid.NewGuid(), Revision = 3, Name = "task", Games = new() { ["tajiduo"] = ["nte"] } };
        internal readonly Work Work;
        internal readonly SdkCheckInPersistence Persistence;
        internal Fixture()
        {
            Ports.Document = new(11, "fixture", CheckInJson.Bytes(new CheckInTaskStore { Tasks = [Task] }));
            using var material = Material(); var bytes = material.Encode();
            try { Ports.Put(Task.Id, "tajiduo", Encoding.UTF8.GetString(bytes)); } finally { Array.Clear(bytes); }
            Work = new(Task.Id); Persistence = new(Ports, Ports, Ports);
        }
        internal SdkCheckInRotation Adapter(long revision = 1) => new(Work, Persistence, Task.Id, 3, revision);
        public void Dispose() => Ports.Dispose();
    }
    private sealed class Work(Guid taskId) : IWorkTasks
    {
        internal WorkInvocation Current = new(Guid.NewGuid(), Guid.NewGuid(), taskId, taskId, 3, new(2026, 10, 25), "UTC", DateTimeOffset.UtcNow.AddMinutes(30));
        internal (string, Guid, Guid, Guid) Stopped;
        public ValueTask<WorkInvocation> ReadCurrentAsync(CancellationToken cancellationToken) => ValueTask.FromResult(Current);
        public ValueTask<bool> HasStoppedAsync(string providerId, Guid id, Guid runId, Guid attemptId, CancellationToken cancellationToken)
        { Stopped = (providerId, id, runId, attemptId); return ValueTask.FromResult(false); }
        public ValueTask<WorkClock> ReadClockAsync(CancellationToken cancellationToken) => throw new NotSupportedException();
        public ValueTask<WorkTaskSnapshot> ReadAsync(string providerId, IReadOnlyList<Guid> ids, CancellationToken cancellationToken) => throw new NotSupportedException();
        public ValueTask<ManualRunReceipt> RunAsync(string providerId, Guid id, long revision, CancellationToken cancellationToken) => throw new NotSupportedException();
        public ValueTask<IAsyncDisposable> QuiesceAsync(string providerId, Guid id, long revision, CancellationToken cancellationToken) => throw new NotSupportedException();
    }
}
