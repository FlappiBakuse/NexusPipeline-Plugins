using NexusPipeline.Extensions.GameCheckIn;

internal static class PolicyCases
{
    internal static void Run(Action<string, Action> run)
    {
        void Assert(bool value) { if (!value) throw new InvalidOperationException("assertion_failed"); }
        void Reject(Action action)
        { try { action(); } catch (CheckInFailure) { return; } throw new InvalidOperationException("expected_rejection"); }
        CheckInTask Task() => new() { Id = Guid.NewGuid(), Revision = 1, Name = "task", Games = new() { ["cn"] = ["gi"] },
            Schedules = [new() { Id = Guid.NewGuid().ToString("D"), Days = [0, 6], Enabled = true, Time = "09:00" }] };
        run("no-schedule-task-does-not-invent-enabled-plan", () =>
        { var task = Task() with { Schedules = [] }; Assert(CheckInPlans.Project(new() { Tasks = [task] }, "UTC").Length == 0); });
        run("multiple-plans-have-stable-uuid-and-reverse-business-identity", () =>
        {
            var first = Task(); var second = Task() with { Name = "second", Schedules = first.Schedules };
            var store = new CheckInTaskStore { Tasks = [first, second] }; var plans = CheckInPlans.Project(store, "UTC");
            Assert(plans.Length == 2 && plans[0].PlanId != plans[1].PlanId && plans[0].PlanId == CheckInPlans.Project(store, "UTC")[0].PlanId);
            Assert(CheckInPlans.Resolve(store, plans[0].PlanId, 1).Id == first.Id); Reject(() => CheckInPlans.Resolve(store, plans[0].PlanId, 2));
        });
        run("settings-revision-advances-private-task-not-results", () =>
        {
            var first = Task(); var other = Task() with { Name = "other" }; var store = new CheckInTaskStore { Tasks = [first, other] };
            var saved = CheckInEdits.Save(store, first with { Name = "changed" }); Assert(saved.Tasks[0].Revision == 2 && saved.Tasks[1].Revision == 1);
            var reordered = CheckInEdits.Reorder(saved, [other.Id, first.Id]); Assert(reordered.Tasks[0].Id == other.Id && reordered.Tasks[1].Revision == 2);
            var deleted = CheckInEdits.Delete(reordered, first.Id); Assert(deleted.Tasks.Single().Id == other.Id);
            Reject(() => CheckInEdits.Reorder(store, [first.Id, first.Id]));
        });
        foreach (var (effect, signed, error, action) in new (string, bool?, string?, string)[] {
            ("confirmed", null, null, "finish"), ("new", false, null, "requestHostSubmissionPermit"),
            ("new", null, null, "finish"), ("new", true, null, "recordReadonlyConfirmation"),
            ("unknown", false, null, "finish"), ("unknown", null, null, "finish"),
            ("unknown", true, null, "recordReadonlyConfirmation"), ("new", false, "captcha_required", "finish") })
            run($"submission-policy/{effect}/{signed}/{error}", () =>
            {
                var decision = SignInPolicy.BeforeSubmission(effect, signed, error); Assert(decision.Action == action);
                if (effect == "unknown" && signed != true) Assert(!decision.IsSuccess && decision.EffectState == "unknown");
            });
        run("post-without-positive-confirmation-remains-unknown", () =>
        {
            Assert(SignInPolicy.AfterSubmission(true, null).IsSuccess);
            Assert(!SignInPolicy.AfterSubmission(false, null).IsSuccess && SignInPolicy.AfterSubmission(null, null).EffectState == "unknown");
            Assert(!SignInPolicy.AfterSubmission(true, "captcha_required").IsSuccess);
        });
        run("tajiduo-refresh-must-persist-before-role-or-sign-state-read", () =>
        {
            Assert(SignInPolicy.TajiduoNext("refreshReceived", false, 0, false, null).Action == "requestAtomicRefreshPersistence");
            Assert(SignInPolicy.TajiduoNext("refreshPersisted", false, 1, true, false).Action == "finish");
            Assert(SignInPolicy.TajiduoNext("refreshPersisted", true, 0, false, null).Action == "readRoles");
            Assert(SignInPolicy.TajiduoNext("rolesResolved", true, 2, false, false).Code == "role_selection_required");
            Assert(SignInPolicy.TajiduoNext("rolesResolved", true, 1, false, null).Action == "readTodayState");
            Assert(SignInPolicy.TajiduoNext("stateRead", true, 1, false, null).Action == "finish");
        });
        run("authenticated-hoyolab-with-no-game-roles-can-save", () =>
        {
            using var capture = new CredentialMaterial("ltoken_v2=synthetic; ltuid_v2=123456", "browser");
            using var json = CheckInJson.Parse("{\"retcode\":0,\"data\":{\"user_info\":{\"uid\":\"123456\"}}}"u8.ToArray());
            using var verified = ReadOnlyIdentity.Verify("os", json.RootElement, capture);
            Assert(verified.MaskedAccount == "os · 12**56");
            using var mismatch = new CredentialMaterial("ltoken_v2=synthetic; ltuid_v2=654321", "browser");
            Reject(() => ReadOnlyIdentity.Verify("os", json.RootElement, mismatch));
            using var unauthenticated = CheckInJson.Parse("{\"retcode\":-100,\"data\":null}"u8.ToArray());
            Reject(() => ReadOnlyIdentity.Verify("os", unauthenticated.RootElement, capture));
        });
        foreach (var (platform, response) in new[] {
            ("skland", "{\"code\":0,\"data\":{\"user\":{\"id\":\"account-1234\"}}}"),
            ("skport", "{\"code\":0,\"data\":{\"user\":{\"basicUser\":{\"id\":\"account-1234\"}}}}"),
            ("kuro", "{\"code\":200,\"data\":{\"mine\":{\"userId\":\"123456\"}}}") })
            run("readonly-current-account-no-roles/" + platform, () =>
            {
                using var capture = new CredentialMaterial("synthetic", "browser"); using var json = CheckInJson.Parse(System.Text.Encoding.UTF8.GetBytes(response));
                using var material = ReadOnlyIdentity.Verify(platform, json.RootElement, capture); Assert(material.MaskedAccount is not null);
            });
    }
}
