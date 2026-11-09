using System.Text;
using System.Text.Json;
using NexusPipeline.Extensions.GameCheckIn;

internal static class FrontendCases
{
    internal static void Run(Action<string, Action> run, string viewModel)
    {
        void Assert(bool condition) { if (!condition) throw new InvalidOperationException("assertion_failed"); }
        void Reject(Action action, string code)
        { try { action(); } catch (CheckInFailure error) when (error.Code == code) { return; } throw new InvalidOperationException("expected_" + code); }
        run("host-client-lifetime-and-scope-retirement-bind-private-memory", () =>
        {
            using var scope = new CancellationTokenSource(); using var host = new CancellationTokenSource(); using var other = new CancellationTokenSource();
            using var clients = new CheckInClients(scope.Token); var id = Guid.NewGuid(); var client = clients.Get(id, host.Token);
            Assert(client.ActivationScopeId != Guid.Empty && client.ClientId == id && clients.Get(id, host.Token).Lifetime == client.Lifetime);
            Reject(() => clients.Get(null, host.Token), "client_session_required"); Reject(() => clients.Get(id, default), "client_session_required");
            Reject(() => clients.Get(id, other.Token), "client_session_required"); scope.Cancel(); Assert(client.Lifetime.IsCancellationRequested);
        });
        run("frontend-read-state-projections-do-not-expose-protocol-or-secret-fields", () =>
        {
            using var fixture = new FrontendFixture();
            var initial = (CheckInState)fixture.Invoke("read-state", "{}");
            var task = FrontendFixture.Task("one"); fixture.Persistence.Store = new() { Tasks = [task] }; fixture.Runtime.Running = true;
            var state = (CheckInState)fixture.Invoke("read-state", "{}"); var bytes = CheckInJson.Bytes(state); var json = Encoding.UTF8.GetString(bytes);
            Assert(state.Tasks.Single().IsRunning && state.Platforms.Sum(platform => platform.Games.Length) == 14 && state.ConfigurationRevision == 0);
            Assert(!json.Contains("protocol", StringComparison.OrdinalIgnoreCase) && !json.Contains(task.Protocol.CnDeviceId.ToString("D"), StringComparison.Ordinal));
            Assert(state.NotificationTasks.Single().Id == "target-one" && !state.Platforms.Any(platform => platform.BrowserLogin.Ready));
            File.WriteAllBytes(viewModel, CheckInJson.Bytes(initial));
        });
        run("frontend-new-editor-save-reorder-delete-use-real-application-cas", () =>
        {
            using var fixture = new FrontendFixture(); var opened = (CheckInEditorState)fixture.Invoke("open-editor", "{\"taskId\":null,\"expectedRevision\":0}");
            var payload = CheckInJson.Bytes(new { draft = new { id = (string?)null, name = "new", remark = "", enabled = true,
                games = new { kuro = new[] { "ww" } }, schedules = Array.Empty<object>(), notification = new { enabled = false, notificationTaskIds = Array.Empty<string>() } },
                editorSessionId = opened.EditorSessionId, secrets = new { kuro = new { action = "set", fieldGeneration = 0, value = "synthetic-token" } } });
            var saved = (CheckInState)fixture.Frontend.InvokeAsync("save-task", Guid.NewGuid(), fixture.Client, payload, default).Result;
            Assert(saved.Tasks.Single().Name == "new" && saved.ConfigurationRevision == 1 && fixture.Persistence.Mutations.Count(change => change.Action == "set") == 1);
            var id = saved.Tasks.Single().Id;
            var reordered = (CheckInState)fixture.Invoke("reorder-tasks", JsonSerializer.Serialize(new { taskIds = new[] { id }, expectedRevision = 1 }));
            Assert(reordered.ConfigurationRevision == 2 && fixture.Persistence.Mutations.Length == 0);
            var deleted = (CheckInState)fixture.Invoke("delete-task", JsonSerializer.Serialize(new { taskId = id, expectedRevision = 2 }));
            Assert(deleted.Tasks.Length == 0 && fixture.Persistence.Mutations.All(change => change.Action == "clear"));
            _ = fixture.Invoke("close-editor", JsonSerializer.Serialize(new { editorSessionId = opened.EditorSessionId }));
        });
        run("frontend-private-editor-isolation-and-untrusted-task-membership", () =>
        {
            using var fixture = new FrontendFixture(); var opened = (CheckInEditorState)fixture.Invoke("open-editor", "{\"taskId\":null,\"expectedRevision\":0}");
            Reject(() => fixture.Frontend.InvokeAsync("read-editor", null, fixture.Client with { ClientId = Guid.NewGuid() },
                CheckInJson.Bytes(new { editorSessionId = opened.EditorSessionId }), default).AsTask().GetAwaiter().GetResult(), "credential_editor_owner_mismatch");
            Reject(() => fixture.Invoke("run-task", JsonSerializer.Serialize(new { taskId = Guid.NewGuid() })), "checkin_task_not_found");
            Assert(fixture.Runtime.Runs == 0 && fixture.Persistence.SecretReads == 0);
        });
        run("frontend-secret-action-parser-rejects-aliases-extra-fields-and-noninteger-generations", () =>
        {
            foreach (var body in new[] { "{\"kuro\":{\"Action\":\"set\",\"fieldGeneration\":0,\"value\":\"synthetic\"}}",
                "{\"kuro\":{\"action\":\"set\",\"fieldGeneration\":0.5,\"value\":\"synthetic\"}}",
                "{\"kuro\":{\"action\":\"keep\",\"fieldGeneration\":0,\"password\":\"synthetic\"}}" })
            {
                using var json = CheckInJson.Parse(Encoding.UTF8.GetBytes(body));
                try { CheckInFrontendInputs.Actions(json.RootElement); throw new InvalidOperationException("rejection_expected"); } catch (CheckInFailure) { }
            }
        });
        run("editor-save-blocks-pending-login-without-closing-draft", () =>
        {
            using var fixture = new FrontendFixture(); var editor = fixture.Editors.Add(fixture.Client, null, 0, new Dictionary<string, SavedCredentialField>());
            var binding = editor.Prepare(fixture.Client, "kuro", 0);
            Reject(() => editor.Reserve(fixture.Client, null, new Dictionary<string, CredentialAction>(), new Dictionary<string, SavedCredentialField>()), "credential_login_busy");
            editor.CancelBoundLogin(fixture.Client, binding);
            using var reservation = editor.Reserve(fixture.Client, null, new Dictionary<string, CredentialAction>(), new Dictionary<string, SavedCredentialField>());
            Assert(reservation.Changes.Length == 6 && fixture.Persistence.Writes == 0);
        });
        run("browser-capture-current-account-verification-before-candidate", () =>
        {
            using var fixture = new FrontendFixture(native: true); var editor = fixture.Editors.Add(fixture.Client, null, 0, new Dictionary<string, SavedCredentialField>());
            fixture.Capture.Reply = FrontendFixture.CaptureCn();
            var accepted = fixture.Browser.BeginAsync(fixture.Client, editor.Id, "cn", 0, default).Result;
            var field = editor.View(fixture.Client).Fields["cn"];
            Assert(field.MaskedAccount == "cn · 12**56" && field.CandidateId == accepted.CandidateId && fixture.Persistence.Writes == 0);
            fixture.Browser.CancelAsync(fixture.Client, editor.Id, "cn", default).GetAwaiter().GetResult();
            Assert(editor.View(fixture.Client).Fields["cn"].CandidateId is null && fixture.Capture.Cancels == 1);
        });
        run("browser-late-capture-after-cancel-cannot-replace-new-flow", () =>
        {
            using var fixture = new FrontendFixture(native: true); var editor = fixture.Editors.Add(fixture.Client, null, 0, new Dictionary<string, SavedCredentialField>());
            fixture.Capture.Pending = new(TaskCreationOptions.RunContinuationsAsynchronously);
            var late = fixture.Browser.BeginAsync(fixture.Client, editor.Id, "cn", 0, default).AsTask();
            fixture.Browser.CancelAsync(fixture.Client, editor.Id, "cn", default).GetAwaiter().GetResult();
            var pending = fixture.Capture.Pending; fixture.Capture.Pending = null; fixture.Capture.Reply = FrontendFixture.CaptureCn();
            var current = fixture.Browser.BeginAsync(fixture.Client, editor.Id, "cn", editor.View(fixture.Client).Fields["cn"].FieldGeneration, default).Result;
            pending.SetResult(FrontendFixture.CaptureCn());
            try { late.GetAwaiter().GetResult(); throw new InvalidOperationException("late_capture_accepted"); } catch (OperationCanceledException) { }
            var field = editor.View(fixture.Client).Fields["cn"];
            Assert(field.CandidateId == current.CandidateId && field.FieldGeneration == current.FieldGeneration && fixture.Persistence.Writes == 0);
        });
        run("reveal-candidate-requires-same-client-confirmation-and-no-document-write", () =>
        {
            using var fixture = new FrontendFixture(); var editor = fixture.Editors.Add(fixture.Client, null, 0, new Dictionary<string, SavedCredentialField>());
            var binding = editor.Prepare(fixture.Client, "kuro", 0); editor.Accept(fixture.Client, binding, new("synthetic-sensitive-canary", "browser", "kuro · 12**56"));
            var payload = JsonSerializer.Serialize(new { platformId = "kuro", editorSessionId = editor.Id });
            Reject(() => fixture.Invoke("reveal-credential", payload), "reveal_confirmation_required");
            fixture.Invoke("confirm-reveal", JsonSerializer.Serialize(new { editorSessionId = editor.Id }));
            var revealed = (CheckInRevealed)fixture.Invoke("reveal-credential", payload);
            Assert(revealed.Value == "synthetic-sensitive-canary" && revealed.RemainingSeconds == 86400 && fixture.Persistence.Writes == 0);
        });
    }
}
