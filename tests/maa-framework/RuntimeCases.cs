using System.Text.Json;
using System.Text.Json.Nodes;
using NexusPipeline.Extensions.MaaFramework;

internal static class RuntimeCases
{
    private static void Assert(bool value) => BundleCases.Assert(value);
    private static void Reject(Action action) => BundleCases.Reject(action);
    private static JsonElement View(MaaCompilationBundle bundle) => JsonSerializer.Deserialize<JsonElement>(bundle.Execution);
    private static MaaRuntimePlan Plan(MaaCompilationBundle bundle) => MaaRuntimePlan.Read(bundle.Artifact, bundle.Pi.Artifact, View(bundle));
    internal static void Run(Action<string, Action> run)
    {
        run("mfa-timed-wait-keeps-local-civil-day-and-advances-equal-or-past-minute", () => {
            var parameters = new JsonObject { ["hour"] = 3, ["minute"] = 5 };
            Assert(MaaWaitPolicy.Target(parameters, new(2026, 10, 26, 3, 4, 59)) == new DateTime(2026, 10, 26, 3, 5, 0));
            Assert(MaaWaitPolicy.Target(parameters, new(2026, 10, 26, 3, 5, 0)) == new DateTime(2026, 10, 27, 3, 5, 0));
            Assert(MaaWaitPolicy.Target(parameters, new(2026, 10, 26, 23, 59, 0)) == new DateTime(2026, 10, 27, 3, 5, 0));
        });
        run("runtime-original-occurrence-subset-retains-compiled-pipeline-and-cannot-select-disabled-duplicate", () => {
            var bundle = MaaCompilationBundle.Build(BundleCases.Sources(), BundleCases.Selection); var plan = Plan(bundle);
            var rows = MaaJson.Objects(MaaJson.Read(bundle.Execution)["Tasks"]); var id = MaaJson.Required(rows[0], "Id");
            var tasks = plan.Select([id]);
            Assert(tasks.Length == 1 && tasks[0].OccurrenceId == id && tasks[0].SourceId == "task-1" && tasks[0].Entry == "DailyEntry" &&
                plan.Fingerprint == bundle.SemanticFingerprint && plan.ResourcePaths.SequenceEqual(new[] { "assets/resource" }));
            Reject(() => plan.Select([MaaJson.Required(rows[1], "Id")]));
            Reject(() => plan.Select(["Daily"])); Reject(() => plan.Select(["DailyEntry"]));
            Reject(() => plan.Select([id, id])); Reject(() => plan.Select([]));
        });
        run("runtime-selection-preserves-source-order-repeats-and-returned-data-is-detached", () => {
            var source = CompilerFixture.Mfa(); var duplicate = source["TaskItems"]![0]!.DeepClone();
            duplicate["repeat_count"] = 3; source["TaskItems"]!.AsArray().Add(duplicate);
            var bundle = MaaCompilationBundle.Build(CompilerFixture.Sources(("appsettings.json", new JsonObject()), ("config/config.json", source)),
                new("assets/interface.json", "mfa", "zh_cn", new("mfa", "config/config.json", "one")));
            var plan = Plan(bundle); var ids = MaaJson.Objects(MaaJson.Read(bundle.Execution)["Tasks"]).Select(row => MaaJson.Required(row, "Id")).ToArray();
            var tasks = plan.Select(ids.Reverse().ToArray());
            Assert(tasks.Length == 2 && tasks.Select(task => task.OccurrenceId).SequenceEqual(ids) && tasks[0].RepeatCount == 2 && tasks[1].RepeatCount == 3);
            tasks[0].Pipeline["changed"] = true; plan.Controller["name"] = "changed"; plan.Connection["changed"] = true;
            var paths = plan.ResourcePaths; paths[0] = "changed";
            Assert(plan.Select(ids)[0].Pipeline["changed"] is null && MaaJson.Required(plan.Controller, "name") == "PC" &&
                plan.Connection["changed"] is null && plan.ResourcePaths[0] == "assets/resource");
        });
        run("runtime-rejects-changed-original-artifact-and-unrelated-full-pi", () => {
            var bundle = MaaCompilationBundle.Build(BundleCases.Sources(), BundleCases.Selection);
            var changed = bundle.Artifact.ToArray(); changed[^2] ^= 1;
            Reject(() => MaaRuntimePlan.Read(changed, bundle.Pi.Artifact, View(bundle)));
            var pi = bundle.Pi.Artifact.ToArray(); pi[^2] ^= 1;
            Reject(() => MaaRuntimePlan.Read(bundle.Artifact, pi, View(bundle)));
        });
        foreach (var field in new[] { "entry", "pipeline", "repeat", "source", "pi", "disabled" })
            run("runtime-rejects-frozen-view-mismatch-" + field, () => {
                var bundle = MaaCompilationBundle.Build(BundleCases.Sources(), BundleCases.Selection); var view = MaaJson.Read(bundle.Execution);
                if (field == "entry") view["Tasks"]![0]!["Entry"] = "other";
                if (field == "pipeline") view["Tasks"]![0]!["Compiled"]!["Pipeline"]!["sha256"] = new string('0', 64);
                if (field == "repeat") view["Tasks"]![0]!["RepeatCount"] = 99;
                if (field == "source") view["sourceFingerprint"] = new string('0', 64);
                if (field == "pi") view["compilationFingerprint"] = new string('0', 64);
                if (field == "disabled") view["Tasks"]![1]!["Enabled"] = true;
                Reject(() => MaaRuntimePlan.Read(bundle.Artifact, bundle.Pi.Artifact, JsonSerializer.SerializeToElement(view)));
            });
        run("runtime-recompiles-private-semantic-instead-of-trusting-rehashed-pipeline", () => {
            var bundle = MaaCompilationBundle.Build(BundleCases.Sources(), BundleCases.Selection);
            var full = MaaJson.Read(bundle.Artifact); full["semantic"]!["Tasks"]![0]!["Pipeline"]!["uncompiled"] = new JsonObject();
            var bytes = JsonSerializer.SerializeToUtf8Bytes(full); var view = MaaJson.Read(bundle.Execution);
            view["artifactSha256"] = MaaCompilationBundle.Hash(bytes);
            Reject(() => MaaRuntimePlan.Read(bytes, bundle.Pi.Artifact, JsonSerializer.SerializeToElement(view)));
        });
        run("runtime-cancellation-never-yields-submissions", () => {
            var bundle = MaaCompilationBundle.Build(BundleCases.Sources(), BundleCases.Selection);
            using var cancellation = new CancellationTokenSource(); cancellation.Cancel();
            try { MaaRuntimePlan.Read(bundle.Artifact, bundle.Pi.Artifact, View(bundle), cancellation.Token); }
            catch (OperationCanceledException) { return; }
            throw new InvalidOperationException("expected_runtime_cancellation");
        });
        run("runtime-initialization-declarations-are-not-formal-native-submissions", () => {
            var pi = CompilerFixture.Interface(); pi["agent"] = new JsonObject { ["child_exec"] = "agent/worker.exe" };
            pi["pretask"] = new JsonObject { ["name"] = "prepare", ["exec"] = "agent/prepare.exe" };
            var source = CompilerFixture.Mxu(); var pretask = source["instances"]![0]!["tasks"]![0]!.DeepClone();
            pretask["id"] = "prepare-1"; pretask["taskName"] = "__MXU_PRETASK__prepare";
            pretask["optionValues"] = new JsonObject(); source["instances"]![0]!["tasks"]!.AsArray().Insert(0, pretask);
            var sources = new MaaSourceSet([CompilerFixture.Input("assets/interface.json", pi.ToJsonString()),
                CompilerFixture.Input("mxu.json", source.ToJsonString())]);
            var bundle = MaaCompilationBundle.Build(sources, BundleCases.Selection with
                { Runtime = new("assets/native", new Dictionary<string, string>(), []) }); var plan = Plan(bundle);
            Assert(plan.Pretasks.Length == 1 && plan.Agent!["child_exec"]!.GetValue<string>() == "agent/worker.exe");
            var pretasks = plan.Pretasks; pretasks[0].Pipeline["changed"] = true; plan.Agent!["child_exec"] = "changed";
            Assert(plan.Pretasks[0].Pipeline["changed"] is null && plan.Agent!["child_exec"]!.GetValue<string>() == "agent/worker.exe");
            Reject(() => plan.Select([pretasks[0].Id]));
        });
    }
}
