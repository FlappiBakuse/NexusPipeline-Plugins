using System.Text.Json;
using System.Text.Json.Nodes;
using NexusPipeline.Extensions.MaaFramework;

internal static class WorkerPolicyCases
{
    internal static void Run(Action<string, Action> run)
    {
        run("worker-repetition-progress-is-bound-to-selected-business-identity-and-total", RepetitionProgress);
        run("worker-accepts-only-the-exact-implemented-frozen-controller-methods", () => MaaWorkerPolicy.Require(Project(), "pc"));
        foreach (var capture in new[] { "PrintWindow", "GDI", "ScreenDC", "FramePool" })
            foreach (var mouse in new[] { "SendMessage", "PostMessage", "SendMessageWithCursorPos", "Seize" })
                foreach (var keyboard in new[] { "SendMessage", "PostMessage", "SendMessageWithCursorPos", "Seize" })
                    run("worker-controller-methods-" + capture + "-" + mouse + "-" + keyboard,
                        () => MaaWorkerPolicy.Require(Project(capture: capture, mouse: mouse, keyboard: keyboard), "pc"));
        foreach (var fault in new[] { "target", "capture", "mouse", "keyboard" })
            run("worker-rejects-ungranted-runtime-effects-" + fault, () => BundleCases.Reject(() =>
                MaaWorkerPolicy.Require(Project(fault), fault == "target" ? "android" : "pc")));
        run("worker-adb-controller-requires-the-frozen-android-target", () => {
            var project = Project("adb");
            MaaWorkerPolicy.Require(project, "android");
            BundleCases.Reject(() => MaaWorkerPolicy.Require(project, "pc"));
        });
        run("worker-rejects-unimplemented-explicit-adb-methods", () =>
            BundleCases.Reject(() => MaaWorkerPolicy.Require(Project("adb-methods"), "android")));
        run("worker-accepts-agent-programs-bound-to-the-frozen-project", () => MaaWorkerPolicy.Require(Project("agent"), "pc"));
        run("worker-formal-run-does-not-submit-declared-initialization", () => {
            var project = Project("initialization");
            MaaWorkerPolicy.Require(project, "pc");
            BundleCases.Assert(project.InitializationOccurrences.Count == 0 &&
                project.Tasks.All(task => project.Plan.Pretasks.All(pre => pre.Id != task.OccurrenceId)));
        });
        run("worker-explicit-initialization-selects-only-pretasks-without-device", () => {
            var original = Project("initialization");
            var selected = original.Plan.Programs.Where(program => program.Kind == "pretask").Select(program => program.OccurrenceId).ToArray();
            var project = new MaaWorkerProject(original.Plan, "maas", original.BindingId.ToString("D"), selected, initialize: true);
            MaaWorkerPolicy.Require(project, "");
            BundleCases.Assert(project.Tasks.Length == 0 && project.InitializationOccurrences.SequenceEqual(selected));
            BundleCases.Reject(() => MaaWorkerPolicy.Require(project, "pc"));
            BundleCases.Reject(() => new MaaWorkerProject(original.Plan, "maas", original.BindingId.ToString("D"),
                original.Tasks.Select(task => task.OccurrenceId).ToArray(), initialize: true));
        });
        run("worker-selected-preparation-precedes-native-tasks-and-preserves-business-identity", () => {
            var original = Project("initialization");
            var preparation = original.Plan.Programs.Where(program => program.Kind == "pretask").Select(program => program.OccurrenceId).ToArray();
            var native = original.Tasks.Select(task => task.OccurrenceId).ToArray();
            var selected = preparation.Concat(native).ToArray();
            var project = new MaaWorkerProject(original.Plan, "maas", original.BindingId.ToString("D"),
                selected.Select(id => "business:" + id).ToArray(), selected);
            MaaWorkerPolicy.Require(project, "pc");
            BundleCases.Assert(project.PreparationOccurrences.SequenceEqual(preparation) && project.Tasks.Select(task => task.OccurrenceId).SequenceEqual(native));
            BundleCases.Assert(project.BusinessId(preparation[0]) == "business:" + preparation[0]);
            BundleCases.Reject(() => new MaaWorkerProject(original.Plan, "maas", original.BindingId.ToString("D"), native.Concat(preparation).ToArray()));
            BundleCases.Reject(() => new MaaWorkerProject(original.Plan, "maas", original.BindingId.ToString("D"), selected.Append(selected[0]).ToArray()));
            BundleCases.Assert(original.Plan.Programs.Single(program => program.Kind == "pretask").TimeoutMilliseconds == 900000);
        });
    }
    private static void RepetitionProgress()
    {
        var source = new MaaSourceSet([CompilerFixture.Input("assets/interface.json", CompilerFixture.Interface().ToJsonString()),
            CompilerFixture.Input("config/instances/one.json", CompilerFixture.Mfa().ToJsonString()),
            CompilerFixture.Input("appsettings.json", "{}"), CompilerFixture.Input("config/config.json", "{}")]);
        var bundle = MaaCompilationBundle.Build(source, new("assets/interface.json", "mfa", "zh_cn", new("mfa", "config/instances/one.json", "one")));
        var plan = MaaRuntimePlan.Read(bundle.Artifact, bundle.Pi.Artifact, JsonSerializer.Deserialize<JsonElement>(bundle.Execution));
        var execution = JsonSerializer.Deserialize<JsonElement>(bundle.Execution).GetProperty("Tasks")[0].GetProperty("Id").GetString()!;
        var project = new MaaWorkerProject(plan, "maas", "edc7f66f-6d2f-4990-833a-61b5c3f1a6eb", ["business"], [execution],
            repetitionOffsets: new Dictionary<string, int> { ["business"] = 1 });
        BundleCases.Assert(project.CompletedRepetitions(execution) == 1 && project.Tasks.Single().RepeatCount == 2);
        foreach (var offset in new[] { -1, 2, 3 })
            BundleCases.Reject(() => new MaaWorkerProject(plan, "maas", project.BindingId.ToString("D"), ["business"], [execution],
                repetitionOffsets: new Dictionary<string, int> { ["business"] = offset }));
        BundleCases.Reject(() => new MaaWorkerProject(plan, "maas", project.BindingId.ToString("D"), ["business"], [execution],
            repetitionOffsets: new Dictionary<string, int> { [execution] = 1 }));
    }
    private static MaaWorkerProject Project(string? fault = null, string capture = "PrintWindow", string mouse = "SendMessage", string keyboard = "SendMessage")
    {
        var pi = CompilerFixture.Interface();
        pi["controller"]![0]!["win32"] = new JsonObject { ["screencap"] = fault == "capture" ? "DXGI_DesktopDup" : capture,
            ["mouse"] = fault == "mouse" ? "Interception" : mouse, ["keyboard"] = fault == "keyboard" ? "Interception" : keyboard };
        if (fault is "adb" or "adb-methods")
        {
            var controller = pi["controller"]![0]!.AsObject();
            controller["type"] = "Adb"; controller.Remove("win32");
            if (fault == "adb-methods") controller["adb"] = new JsonObject { ["input"] = "Minitouch" };
        }
        if (fault == "agent") pi["agent"] = new JsonObject { ["child_exec"] = "agent/worker.exe", ["child_args"] = new JsonArray() };
        var profile = CompilerFixture.Mxu();
        if (fault == "initialization")
        {
            pi["pretask"] = new JsonObject { ["name"] = "prepare", ["exec"] = "agent/prepare.exe" };
            var pretask = profile["instances"]![0]!["tasks"]![0]!.DeepClone();
            pretask["id"] = "prepare-1"; pretask["taskName"] = "__MXU_PRETASK__prepare"; pretask["optionValues"] = new JsonObject();
            profile["instances"]![0]!["tasks"]!.AsArray().Insert(0, pretask);
        }
        var source = new MaaSourceSet([CompilerFixture.Input("assets/interface.json", pi.ToJsonString()), CompilerFixture.Input("mxu.json", profile.ToJsonString())]);
        var bundle = MaaCompilationBundle.Build(source, BundleCases.Selection with
            { Runtime = new("assets/native", new Dictionary<string, string>(), []) });
        var plan = MaaRuntimePlan.Read(bundle.Artifact, bundle.Pi.Artifact, JsonSerializer.Deserialize<JsonElement>(bundle.Execution));
        var selected = JsonSerializer.Deserialize<JsonElement>(bundle.Execution).GetProperty("Tasks")[0].GetProperty("Id").GetString()!;
        return new(plan, "maas", "edc7f66f-6d2f-4990-833a-61b5c3f1a6eb", [selected]);
    }
}
