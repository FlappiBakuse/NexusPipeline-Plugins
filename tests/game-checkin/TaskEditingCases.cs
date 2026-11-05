using NexusPipeline.Extensions.GameCheckIn;

internal static class TaskEditingCases
{
    internal static void Run(Action<string, Action> run)
    {
        void Assert(bool condition) { if (!condition) throw new InvalidOperationException("assertion_failed"); }
        void Reject(Action action, string code)
        {
            try { action(); }
            catch (CheckInFailure error) when (error.Code == code) { return; }
            throw new InvalidOperationException("expected_" + code);
        }
        CheckInClient Client() => new(Guid.NewGuid(), Guid.NewGuid(), default);
        CheckInTask Task(string name) => new() { Id = Guid.NewGuid(), Revision = 1, Name = name, Games = new() { ["kuro"] = ["ww"] } };
        CheckInTaskDraft Draft(CheckInTask task) => new(task.Id, task.Name, task.Remark, task.Enabled, task.Games, task.Schedules, task.Notification);
        run("task-names-are-trimmed-and-case-insensitively-unique", () =>
        {
            var first = Task("Alpha");
            Reject(() => CheckInEdits.Save(new() { Tasks = [first] }, Task(" alpha ")), "checkin_task_name_duplicate");
            var saved = CheckInEdits.Save(new() { Tasks = [first] }, first with { Name = " ALPHA " });
            Assert(saved.Tasks.Single().Name == "ALPHA");
        });
        run("protocol-identities-survive-task-edits", () =>
        {
            var first = Task("one"); var altered = first with { Protocol = CheckInProtocolIdentity.Create() };
            Assert(CheckInEdits.Save(new() { Tasks = [first] }, altered).Tasks.Single().Protocol == first.Protocol);
            Reject(() => (first with { Protocol = new() }).Validate(), "checkin_protocol_identity_invalid");
        });
        run("save-rejects-derived-plan-overflow-before-publication", () =>
        {
            CheckInSchedule[] Schedules(int count) => Enumerable.Range(0, count).Select(_ => new CheckInSchedule {
                Id = Guid.NewGuid().ToString("D"), Days = [1], Time = "09:00" }).ToArray();
            var tasks = Enumerable.Range(0, 136).Select(index => Task("task" + index) with { Schedules = Schedules(30) }).ToArray();
            var store = new CheckInTaskStore { Tasks = [.. tasks, Task("last") with { Schedules = Schedules(16) }] };
            Assert(store.Validate().Tasks.Sum(task => task.Schedules.Length) == 4096);
            Reject(() => CheckInEdits.Save(store, Task("overflow") with { Schedules = Schedules(1) }), "checkin_plan_limit");
        });
        run("open-editor-requires-current-document-before-reading-secrets", () =>
        {
            var client = Client(); var task = Task("one"); var store = new EditingPersistence(new() { Tasks = [task] });
            using var editors = new CheckInEditors(TimeProvider.System); var service = new CheckInTaskEditing(store, editors, new EditingQuiescence());
            Reject(() => service.OpenAsync(client, task.Id, 9, default).AsTask().GetAwaiter().GetResult(), "checkin_configuration_conflict");
            Assert(store.SecretReads == 0 && store.Writes == 0);
        });
        run("save-new-task-owns-one-target-and-one-six-field-atomic-publication", () =>
        {
            var client = Client(); var store = new EditingPersistence(new()); using var editors = new CheckInEditors(TimeProvider.System);
            var service = new CheckInTaskEditing(store, editors, new EditingQuiescence()); var opened = service.OpenAsync(client, null, 0, default).Result;
            var editor = editors.Get(client, opened.Editor.EditorSessionId); var target = editor.TargetId;
            var draft = new CheckInTaskDraft(null, "new", "", true, new() { ["kuro"] = ["ww"] }, [], new());
            var actions = new Dictionary<string, CredentialAction> { ["kuro"] = new("set", 0, "synthetic-new-token") };
            var result = service.SaveAsync(client, Guid.NewGuid(), editor.Id, draft, actions, default).Result;
            Assert(result.Revision == 1 && result.Store.Tasks.Single().Id == target && store.Subject == target && store.Writes == 1);
            Assert(store.Mutations.Length == 6 && store.Mutations.Single(change => change.Platform == "kuro").Action == "set");
            Assert(result.Store.Tasks.Single().Protocol == editor.NewProtocol);
            Reject(() => editors.Get(client, editor.Id), "credential_editor_expired");
        });
        run("task-save-concurrent-document-conflict-retains-candidate", () =>
        {
            var client = Client(); var task = Task("one"); var store = new EditingPersistence(new() { Tasks = [task] });
            using var editors = new CheckInEditors(TimeProvider.System); var service = new CheckInTaskEditing(store, editors, new EditingQuiescence());
            var opened = service.OpenAsync(client, task.Id, 0, default).Result; store.Revision++;
            Reject(() => service.SaveAsync(client, Guid.NewGuid(), opened.Editor.EditorSessionId, Draft(task), new Dictionary<string, CredentialAction>(), default).AsTask().GetAwaiter().GetResult(),
                "checkin_configuration_conflict");
            Assert(store.Writes == 0 && editors.Get(client, opened.Editor.EditorSessionId).TaskId == task.Id);
        });
        foreach (var committed in new[] { false, true })
            run("lost-atomic-reply-queries-original-operation-once/" + committed, () =>
            {
                var client = Client(); var task = Task("one"); var store = new EditingPersistence(new() { Tasks = [task] }) { LoseReply = true, CommitBeforeLostReply = committed };
                using var editors = new CheckInEditors(TimeProvider.System); var service = new CheckInTaskEditing(store, editors, new EditingQuiescence());
                var editor = service.OpenAsync(client, task.Id, 0, default).Result.Editor; var operation = Guid.NewGuid();
                void Save() => service.SaveAsync(client, operation, editor.EditorSessionId, Draft(task) with { Name = "changed" }, new Dictionary<string, CredentialAction>(), default).AsTask().GetAwaiter().GetResult();
                if (committed) Save(); else Reject(Save, "checkin_publication_unknown");
                Assert(store.Writes == 1 && store.CommitQueries == 1 && store.QueriedOperation == operation);
                Assert(store.Store.Tasks.Single().Name == (committed ? "changed" : "one"));
            });
        run("delete-clears-only-target-six-secrets-in-same-fact", () =>
        {
            var client = Client(); var task = Task("one"); var other = Task("two"); var store = new EditingPersistence(new() { Tasks = [task, other] });
            using var editors = new CheckInEditors(TimeProvider.System); var service = new CheckInTaskEditing(store, editors, new EditingQuiescence());
            var result = service.DeleteAsync(client, Guid.NewGuid(), task.Id, 0, default).Result;
            Assert(result.Store.Tasks.Single().Id == other.Id && store.Subject == task.Id && store.Mutations.Length == 6 && store.Mutations.All(change => change.Action == "clear"));
        });
        run("reorder-is-complete-cas-with-no-secret-mutations", () =>
        {
            var client = Client(); var task = Task("one"); var other = Task("two"); var store = new EditingPersistence(new() { Tasks = [task, other] });
            using var editors = new CheckInEditors(TimeProvider.System); var service = new CheckInTaskEditing(store, editors, new EditingQuiescence());
            var result = service.ReorderAsync(client, Guid.NewGuid(), [other.Id, task.Id], 0, default).Result;
            Assert(result.Store.Tasks[0].Id == other.Id && store.Mutations.Length == 0 && store.Subject is null && store.SecretReads == 0);
        });
        run("editor-capacity-rejects-without-evicting-other-clients", () =>
        {
            var client = Client(); using var editors = new CheckInEditors(TimeProvider.System);
            for (var index = 0; index < 256; index++) editors.Add(client, null, 0, new Dictionary<string, SavedCredentialField>());
            Reject(() => editors.Add(Client(), null, 0, new Dictionary<string, SavedCredentialField>()), "credential_editor_limit");
        });
        run("task-edit-holds-business-identity-and-private-revision-through-atomic-write", () =>
        {
            var client = Client(); var first = new CheckInSchedule { Id = Guid.NewGuid().ToString("D"), Days = [0], Time = "09:00" };
            var second = first with { Id = Guid.NewGuid().ToString("D") }; var task = Task("one") with { Schedules = [first] };
            var store = new EditingPersistence(new() { Tasks = [task] }); var quiescence = new EditingQuiescence();
            store.BeforeWrite = () => Assert(quiescence.Held && !quiescence.Released);
            using var editors = new CheckInEditors(TimeProvider.System); var service = new CheckInTaskEditing(store, editors, quiescence);
            var editor = service.OpenAsync(client, task.Id, 0, default).Result.Editor;
            _ = service.SaveAsync(client, Guid.NewGuid(), editor.EditorSessionId, Draft(task) with { Schedules = [second] }, new Dictionary<string, CredentialAction>(), default).Result;
            Assert(quiescence.Released && !quiescence.Held && quiescence.TaskId == task.Id && quiescence.ExpectedRevision == task.Revision);
        });
        run("task-revision-is-reread-after-real-quiescence-wait", () =>
        {
            var client = Client(); var task = Task("one"); var store = new EditingPersistence(new() { Tasks = [task] });
            var quiescence = new EditingQuiescence { OnHold = () => store.Revision++ };
            using var editors = new CheckInEditors(TimeProvider.System); var service = new CheckInTaskEditing(store, editors, quiescence);
            var editor = service.OpenAsync(client, task.Id, 0, default).Result.Editor;
            Reject(() => service.SaveAsync(client, Guid.NewGuid(), editor.EditorSessionId, Draft(task), new Dictionary<string, CredentialAction>(), default).AsTask().GetAwaiter().GetResult(), "checkin_configuration_conflict");
            Assert(store.Writes == 0 && store.SecretReads == 6 && quiescence.Released);
        });
    }
}
internal sealed class EditingPersistence(CheckInTaskStore initial) : ICheckInPersistence
{
    internal CheckInTaskStore Store = initial;
    internal long Revision;
    internal int SecretReads, Writes, CommitQueries;
    internal bool LoseReply, CommitBeforeLostReply;
    internal Guid? Subject, QueriedOperation;
    internal CredentialMutation[] Mutations = [];
    internal Action? BeforeWrite;
    private CheckInPublication? commit;
    public ValueTask<CheckInTaskSnapshot> ReadTasksAsync(CancellationToken cancellationToken) => ValueTask.FromResult(new CheckInTaskSnapshot(Revision, Store.Validate()));
    public ValueTask<CheckInCredentialRead> ReadCredentialAsync(Guid taskId, string platform, CancellationToken cancellationToken)
    { SecretReads++; return ValueTask.FromResult(new CheckInCredentialRead(0, false, null)); }
    public ValueTask<CheckInPublication> PublishAsync(Guid operationId, long expectedDocumentRevision, CheckInTaskStore proposed,
        Guid? secretSubjectId, IReadOnlyList<CredentialMutation> changes, CancellationToken cancellationToken)
    {
        BeforeWrite?.Invoke(); Writes++; if (Revision != expectedDocumentRevision) throw new CheckInFailure("checkin_configuration_conflict");
        Subject = secretSubjectId; Mutations = changes.ToArray();
        if (!LoseReply || CommitBeforeLostReply) { Store = proposed; Revision++; commit = new(operationId, Revision, true,
            Convert.ToHexStringLower(System.Security.Cryptography.SHA256.HashData(CheckInJson.Bytes(proposed)))); }
        if (LoseReply) throw new IOException("synthetic_reply_lost");
        return ValueTask.FromResult(commit!);
    }
    public ValueTask<CheckInPublication?> ReadPublicationAsync(Guid operationId, CancellationToken cancellationToken)
    { CommitQueries++; QueriedOperation = operationId; return ValueTask.FromResult(commit); }
    public ValueTask<CheckInRecentRunSnapshot> ReadRunAsync(Guid taskId, CancellationToken cancellationToken) => throw new NotSupportedException();
    public ValueTask<long> WriteRunAsync(Guid operationId, Guid taskId, long expectedRevision, CheckInRun run, CancellationToken cancellationToken) => throw new NotSupportedException();
}
