using System.Text.Json;
using System.Text.Json.Nodes;
using NexusPipeline.Extensibility.Compilation;
using NexusPipeline.Extensions.MaaFramework;

internal static class ReadonlyCases
{
    private static readonly MaaCompilationSelection Mfa = new("assets/interface.json", "mfa", "zh_cn", new("mfa", "config/instances/one.json", "one"));
    private static void Assert(bool value) => BundleCases.Assert(value);
    private static void Reject(Action action) => BundleCases.Reject(action);
    private static CompilationResult Compile(SelectedSourceFixture source, MaaCompilationSelection? choice = null)
        => new MaaProjectCompiler().CompileAsync(source, JsonSerializer.SerializeToElement(choice ?? BundleCases.Selection), default).GetAwaiter().GetResult();
    private static JsonObject Artifact(CompilationResult result) => MaaJson.Read(result.Assets.Single(asset => asset.Name == "bundle-artifact").Content);
    private static SelectedSourceFixture MfaSource(JsonObject local, JsonObject? global = null)
    {
        var source = new SelectedSourceFixture(); source.Add(CompilerFixture.Input("assets/interface.json", CompilerFixture.Interface().ToJsonString()));
        source.Add(CompilerFixture.Input("appsettings.json", "{}")); source.Add(CompilerFixture.Input("config/config.json", (global ?? CompilerFixture.Mfa()).ToJsonString()));
        source.Add(CompilerFixture.Input("config/instances/one.json", local.ToJsonString())); source.Directories.Add("assets/resource");
        source.Mount("appsettings.json", SourceEntryKind.File, null); source.Mount("config", SourceEntryKind.Directory, "one"); return source;
    }
    private static void Blocked(CompilationResult result, string code)
    {
        var full = Artifact(result); var view = result.ExecutionView;
        Assert(!result.CanExecute && !view.GetProperty("canExecute").GetBoolean() && full["canExecute"]!.GetValue<bool>() == false &&
            full["semantic"] is null && full["semanticFingerprint"] is null &&
            view.GetProperty("semanticFingerprint").ValueKind == JsonValueKind.Null &&
            view.GetProperty("blockingDiagnostics").EnumerateArray().Any(item => item.GetProperty("Code").GetString() == code));
        Assert(view.GetProperty("Tasks").EnumerateArray().All(row => row.GetProperty("Compiled").ValueKind == JsonValueKind.Null));
        Assert(result.Assets.Any(asset => asset.Name == "pi-artifact") && result.Assets.Any(asset => asset.Name == "pi-index") && result.ResourceTrees is { Count: > 0 });
    }
    internal static void Run(Action<string, Action> run)
    {
        run("readonly-mfa-startup-and-finish-actions-retain-complete-profile-without-a-fake-semantic", () => {
            var local = CompilerFixture.Mfa(); local["BeforeTask"] = "StartupSoftwareAndScript"; local["AfterTask"] = "CloseMFA";
            var source = MfaSource(local); var result = Compile(source, Mfa); Blocked(result, "maa_mfa_external_action_unsupported");
            var original = Artifact(result)["profile"]!["SourceSnapshot"]!["instance"]!;
            Assert(original["BeforeTask"]!.GetValue<string>() == "StartupSoftwareAndScript" && original["AfterTask"]!.GetValue<string>() == "CloseMFA" &&
                JsonNode.DeepEquals(original["TaskItems"], local["TaskItems"]));
            var binding = result.ExecutionView.GetProperty("configurationBindings").EnumerateArray().Single(item => item.GetProperty("Path").GetString() == Mfa.Source.Path);
            Assert(binding.GetProperty("SourceSha256").GetString() == source.Files[Mfa.Source.Path].Sha256 &&
                binding.GetProperty("SourceSha256").GetString() != binding.GetProperty("SnapshotSha256").GetString() &&
                binding.GetProperty("RelativePath").GetString() == "instances/one.json");
        });
        run("readonly-mxu-power-and-interleaved-pretask-preserve-original-row-pointers-and-native-ids", () => {
            var source = SelectedSourceFixture.Create(); var pi = CompilerFixture.Interface();
            pi["pretask"] = new JsonArray(new JsonObject { ["name"] = "Launch", ["exec"] = "agent/launch.exe" });
            source.Files["assets/interface.json"] = CompilerFixture.Input("assets/interface.json", pi.ToJsonString());
            var config = CompilerFixture.Mxu(); var rows = config["instances"]![0]!["tasks"]!.AsArray();
            rows.Add(new JsonObject { ["id"] = "pre", ["taskName"] = "__MXU_PRETASK__Launch", ["enabled"] = true, ["optionValues"] = new JsonObject() });
            rows.Add(new JsonObject { ["id"] = "power", ["taskName"] = "__MXU_POWER__", ["enabled"] = true,
                ["optionValues"] = new JsonObject { ["PowerMode"] = new JsonObject { ["type"] = "select", ["caseName"] = "Shutdown" } } });
            source.Files["mxu.json"] = CompilerFixture.Input("mxu.json", config.ToJsonString());
            var result = Compile(source); Blocked(result, "maa_enabled_task_unmapped");
            var full = Artifact(result); var raw = full["profile"]!["SourceSnapshot"]!["instances"]![0]!["tasks"]!;
            Assert(JsonNode.DeepEquals(raw, rows));
            var projected = result.ExecutionView.GetProperty("Tasks").EnumerateArray().Concat(result.ExecutionView.GetProperty("Pretasks").EnumerateArray())
                .OrderBy(row => row.GetProperty("Origin").GetProperty("Index").GetInt32()).ToArray();
            Assert(projected.Select(row => row.GetProperty("SourceId").GetString()).SequenceEqual(new[] { "task-1", "pre", "power" }));
            Assert(projected[1].GetProperty("Origin").GetProperty("Pointer").GetString() == "/instances/0/tasks/1" &&
                projected[2].GetProperty("Origin").GetProperty("SnapshotPointer").GetString() == "/instances/0/tasks/2" &&
                !projected[2].GetProperty("DefinitionKnown").GetBoolean());
        });
        run("readonly-semantic-invalid-option-is-an-explicit-blocker-and-preserves-the-invalid-saved-choice", () => {
            var source = SelectedSourceFixture.Create(); var config = CompilerFixture.Mxu();
            config["instances"]![0]!["tasks"]![0]!["optionValues"]!["Mode"]!["caseName"] = "MissingChoice";
            source.Files["mxu.json"] = CompilerFixture.Input("mxu.json", config.ToJsonString());
            var result = Compile(source); Blocked(result, "maa_option_selection_invalid");
            Assert(result.ExecutionView.GetProperty("blockingDiagnostics").EnumerateArray().Any(item => item.GetProperty("Stage").GetString() == "semantic") &&
                Artifact(result)["profile"]!["SourceSnapshot"]!["instances"]![0]!["tasks"]![0]!["optionValues"]!["Mode"]!["caseName"]!.GetValue<string>() == "MissingChoice");
        });
        run("readonly-corrected-frozen-configuration-can-compile-without-dropping-the-disabled-unknown-row", () => {
            var source = SelectedSourceFixture.Create(); var config = CompilerFixture.Mxu();
            config["instances"]![0]!["tasks"]!.AsArray().Add(new JsonObject { ["id"] = "power", ["taskName"] = "__MXU_POWER__", ["enabled"] = true,
                ["optionValues"] = new JsonObject { ["PowerMode"] = new JsonObject { ["type"] = "select", ["caseName"] = "Shutdown" } } });
            source.Files["mxu.json"] = CompilerFixture.Input("mxu.json", config.ToJsonString()); Blocked(Compile(source), "maa_enabled_task_unmapped");
            config["instances"]![0]!["tasks"]![1]!["enabled"] = false;
            source.Files["mxu.json"] = CompilerFixture.Input("mxu.json", config.ToJsonString()); source.Mounts[0] = source.Mounts[0] with { Revision = 2 };
            var result = Compile(source); var full = Artifact(result);
            Assert(result.CanExecute && result.ExecutionView.GetProperty("canExecute").GetBoolean() && result.ExecutionView.GetProperty("blockingDiagnostics").GetArrayLength() == 0 &&
                full["semantic"]!["Tasks"]!.AsArray().Count == 1 && full["profile"]!["SourceSnapshot"]!["instances"]![0]!["tasks"]!.AsArray().Count == 2 &&
                full["profile"]!["SourceSnapshot"]!["instances"]![0]!["tasks"]![1]!["optionValues"]!["PowerMode"]!["caseName"]!.GetValue<string>() == "Shutdown");
        });
        run("readonly-unsupported-controller-retains-selection-and-resource-declarations", () => {
            var source = SelectedSourceFixture.Create(); var pi = CompilerFixture.Interface(); pi["controller"]![0]!["type"] = "PlayCover";
            source.Files["assets/interface.json"] = CompilerFixture.Input("assets/interface.json", pi.ToJsonString());
            Blocked(Compile(source), "maa_controller_not_supported");
        });
        foreach (var inherited in new[] { false, true })
            run("origin-mfa-real-local-and-inherited-source-array-pointer/" + inherited, () => {
                var local = inherited ? new JsonObject { ["TaskItems"] = null } : CompilerFixture.Mfa();
                var global = CompilerFixture.Mfa(); global["Instance.default.TaskItems"] = global["TaskItems"]!.DeepClone();
                var source = MfaSource(local, global); var result = Compile(source, Mfa);
                Assert(result.ExecutionView.GetProperty("canExecute").GetBoolean());
                var origin = result.ExecutionView.GetProperty("Tasks")[0].GetProperty("Origin");
                Assert(origin.GetProperty("Kind").GetString() == (inherited ? "inherited" : "local") &&
                    origin.GetProperty("Path").GetString() == (inherited ? "config/config.json" : "config/instances/one.json") &&
                    origin.GetProperty("Pointer").GetString() == (inherited ? "/Instance.default.TaskItems/0" : "/TaskItems/0") &&
                    origin.GetProperty("SnapshotPointer").GetString() == (inherited ? "/global/Instance.default.TaskItems/0" : "/instance/TaskItems/0"));
                var inheritance = result.ExecutionView.GetProperty("Inheritance");
                Assert(inheritance.GetProperty("GlobalPath").GetString() == "config/config.json" && inheritance.GetProperty("ResolvedConfig").GetString() == "Default");
            });
        run("origin-mfa-new-default-has-no-original-config-position-or-patch-target", () => {
            var source = MfaSource(new JsonObject(), new JsonObject { ["CurrentControllerName"] = "PC", ["Resource"] = "Official" });
            var result = Compile(source, Mfa); var row = result.ExecutionView.GetProperty("Tasks")[0]; var origin = row.GetProperty("Origin");
            Assert(origin.GetProperty("Kind").GetString() == "default" && new[] { "Path", "Pointer", "SnapshotPointer", "Index" }
                .All(key => origin.GetProperty(key).ValueKind == JsonValueKind.Null));
        });
        run("origin-mxu-selected-instance-pointer-does-not-use-the-first-instance-or-display-name", () => {
            var source = SelectedSourceFixture.Create(); var config = CompilerFixture.Mxu(); var other = config["instances"]![0]!.DeepClone();
            other["id"] = "other"; config["instances"]!.AsArray().Insert(0, other);
            source.Files["mxu.json"] = CompilerFixture.Input("mxu.json", config.ToJsonString());
            var result = Compile(source);
            Assert(result.ExecutionView.GetProperty("Tasks")[0].GetProperty("Origin").GetProperty("Pointer").GetString() == "/instances/1/tasks/0");
        });
        run("readonly-output-never-turns-malformed-source-or-pipeline-identity-into-a-business-warning", () => {
            var source = MfaSource(new JsonObject { ["BeforeTask"] = "StartupSoftwareAndScript" });
            source.Files["config/config.json"] = CompilerFixture.Input("config/config.json", "{\"TaskItems\":[,]}");
            try { Compile(source, Mfa); throw new InvalidOperationException("source_error_expected"); }
            catch (JsonException) { }
            source = SelectedSourceFixture.Create(); var pi = CompilerFixture.Interface(); pi["import"] = new JsonArray("missing.json");
            source.Files["assets/interface.json"] = CompilerFixture.Input("assets/interface.json", pi.ToJsonString()); Reject(() => Compile(source));
        });
        run("readonly-upstream-unmapped-extension-field-cannot-hide-a-task-entry-identity-conflict", () => {
            var local = CompilerFixture.Mfa(); local["BeforeTask"] = "StartupSoftwareAndScript";
            local["TaskItems"]![0]!["entry"] = "ForeignEntry";
            var source = MfaSource(local); var pi = CompilerFixture.Interface(); pi["task"]![0]!["unmapped"] = true;
            source.Files["assets/interface.json"] = CompilerFixture.Input("assets/interface.json", pi.ToJsonString());
            Reject(() => Compile(source, Mfa));
        });
        run("readonly-output-cannot-hide-an-original-source-identity-failure", () => {
            var config = CompilerFixture.Mxu(); config["instances"]![0]!["tasks"]!.AsArray().Add(config["instances"]![0]!["tasks"]![0]!.DeepClone());
            var source = SelectedSourceFixture.Create(); source.Files["mxu.json"] = CompilerFixture.Input("mxu.json", config.ToJsonString());
            Reject(() => Compile(source));
            source = SelectedSourceFixture.Create(); source.ChangeFile = (_, value) => value with { Sha256 = new string('0', 64) };
            Reject(() => Compile(source));
        });
        run("readonly-business-blocker-cannot-hide-repeat-or-diagnostic-budgets", () => {
            var local = CompilerFixture.Mfa(); local["BeforeTask"] = "StartupSoftwareAndScript"; local["TaskItems"]![0]!["repeat_count"] = 101;
            Reject(() => Compile(MfaSource(local), Mfa));
            var source = SelectedSourceFixture.Create(); var config = CompilerFixture.Mxu();
            config["instances"]![0]!["tasks"] = new JsonArray(Enumerable.Range(0, 257).Select(index => (JsonNode)new JsonObject {
                ["id"] = "id-" + index, ["taskName"] = "Unknown-" + index, ["enabled"] = true }).ToArray());
            source.Files["mxu.json"] = CompilerFixture.Input("mxu.json", config.ToJsonString()); Reject(() => Compile(source));
        });
        run("readonly-business-blocker-cannot-hide-password-or-mount-failure", () => {
            var source = SelectedSourceFixture.Create(); var config = CompilerFixture.Mxu(); config["instances"]![0]!["tasks"]![0]!["taskName"] = "__MXU_POWER__";
            config["instances"]![0]!["tasks"]![0]!["optionValues"]!["Mode"]!["encryptedValues"] = new JsonObject { ["secret"] = "opaque" };
            source.Files["mxu.json"] = CompilerFixture.Input("mxu.json", config.ToJsonString()); Reject(() => Compile(source));
            source = MfaSource(new JsonObject { ["BeforeTask"] = "StartupSoftwareAndScript" }); source.Mounts.Clear(); Reject(() => Compile(source, Mfa));
        });
    }
}
