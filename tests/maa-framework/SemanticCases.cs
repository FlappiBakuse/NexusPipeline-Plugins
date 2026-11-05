using System.Text.Json.Nodes;
using NexusPipeline.Extensions.MaaFramework;

internal static class SemanticCases
{
    internal static void Run(Action<string, Action> run)
    {
        static void Assert(bool value) { if (!value) throw new InvalidOperationException("assertion_failed"); }
        static void Reject(Action action)
        { try { action(); } catch (MaaInputFailure) { return; } throw new InvalidOperationException("rejection_expected"); }
        JsonObject Option(string value) => new() { ["type"] = "select", ["default_case"] = "On", ["cases"] = new JsonArray(
            new JsonObject { ["name"] = "On", ["pipeline_override"] = new JsonObject { ["Node"] = new JsonObject { ["value"] = value } } }) };
        (MaaPiProject Project, MaaImportedProfile Profile) Make(JsonObject declaration)
        {
            var source = CompilerFixture.Mxu(); var files = new MaaSourceSet([CompilerFixture.Input("assets/interface.json", declaration.ToJsonString()), CompilerFixture.Input("mxu.json", source.ToJsonString())]);
            var project = new MaaPiCompiler(files).Compile("assets/interface.json"); var profile = new MaaProjectImport(files, project).Import(new("mxu", "mxu.json", "one"));
            return (project, profile);
        }
        run("effective-pipeline-global-resource-controller-task-order-and-final-occurrence-override", () => {
            var pi = CompilerFixture.Interface(); var options = pi["option"]!.AsObject();
            foreach (var key in new[] { "Global", "Resource", "Controller", "Task" }) options[key] = Option(key);
            pi["global_option"] = new JsonArray("Global"); pi["resource"]![0]!["option"] = new JsonArray("Resource");
            pi["controller"]![0]!["option"] = new JsonArray("Controller"); pi["task"]![0]!["option"] = new JsonArray("Task");
            var (project, profile) = Make(pi); var plan = MaaSemanticCompiler.Compile(project, profile);
            Assert(plan.Tasks.Single().Pipeline["Node"]!["value"]!.GetValue<string>() == "Task");
            var row = profile.Tasks.Single() with { Pipeline = new() { ["Node"] = new JsonObject { ["value"] = "Saved" } } };
            Assert(MaaSemanticCompiler.Compile(project, profile with { Tasks = [row] }).Tasks.Single().Pipeline["Node"]!["value"]!.GetValue<string>() == "Saved");
        });
        run("checkbox-overrides-follow-declaration-order-and-inactive-option-produces-nothing", () => {
            var pi = CompilerFixture.Interface(); pi["option"]!["Check"] = new JsonObject { ["type"] = "checkbox", ["default_case"] = new JsonArray("B", "A"),
                ["cases"] = new JsonArray(new JsonObject { ["name"] = "A", ["pipeline_override"] = new JsonObject { ["Node"] = new JsonObject { ["value"] = "A" } } },
                    new JsonObject { ["name"] = "B", ["pipeline_override"] = new JsonObject { ["Node"] = new JsonObject { ["value"] = "B" } } }) };
            pi["task"]![0]!["option"] = new JsonArray("Check"); var (project, profile) = Make(pi);
            Assert(MaaSemanticCompiler.Compile(project, profile).Tasks.Single().Pipeline["Node"]!["value"]!.GetValue<string>() == "B");
            project.Options["Check"]!["controller"] = new JsonArray("Other"); Reject(() => MaaSemanticCompiler.Compile(project, profile));
            Assert(MaaSemanticCompiler.Compile(project, profile with { PiFingerprint = project.CompilationFingerprint }).Tasks.Single().Pipeline.Count == 0);
        });
        run("typed-input-and-hotkey-placeholders-compile-without-running-source-expressions", () => {
            var input = new JsonObject { ["type"] = "input", ["inputs"] = new JsonArray(new JsonObject { ["name"] = "count", ["default"] = "12", ["pipeline_type"] = "int", ["verify"] = "^\\d+$" }) };
            var fields = MaaInputValues.Read(input, new(), "Win32"); var expanded = MaaPipeline.Expand(new JsonObject { ["number"] = "{count}", ["text"] = "value-{count}" }, fields)!;
            Assert(expanded["number"]!.GetValue<long>() == 12 && expanded["text"]!.GetValue<string>() == "value-12");
            var key = new JsonObject { ["type"] = "hotkey", ["hotkeys"] = new JsonArray(new JsonObject { ["name"] = "key", ["default"] = "CTRL+F2" }) };
            var codes = MaaInputValues.Read(key, new(), "Win32"); Assert(codes["key.modifier1"].GetValue<int>() == 17 && codes["key.primary"].GetValue<int>() == 113);
            Assert(MaaPipeline.Expand(JsonValue.Create("{key}.primary"), codes)!.GetValue<int>() == 113);
            input["inputs"]![0]!["verify"] = "(?=untrusted-expression)"; Reject(() => MaaInputValues.Read(input, new(), "Win32"));
        });
        run("cfa-deep-merges-saved-only-options-and-does-not-inject-default-selection", () => {
            var pi = CompilerFixture.Interface(); pi["task"]![0]!["option"] = new JsonArray("Extra"); pi["option"]!["Extra"] = Option("not-selected");
            var (project, profile) = Make(pi); profile = profile with { Kind = "cfa" };
            Assert(MaaSemanticCompiler.Compile(project, profile).Tasks.Single().Pipeline.Count == 0);
            var target = new JsonObject { ["N"] = new JsonObject { ["p"] = new JsonObject { ["a"] = 1, ["b"] = 2 } } };
            var source = new JsonObject { ["N"] = new JsonObject { ["p"] = new JsonObject { ["a"] = 3 } } };
            MaaPipeline.Apply(target, source, true); Assert(target["N"]!["p"]!["a"]!.GetValue<int>() == 3 && target["N"]!["p"]!["b"]!.GetValue<int>() == 2);
        });
        run("flat-mfa-does-not-inject-unsaved-defaults-and-disabled-occurrences-do-not-submit", () => {
            var pi = CompilerFixture.Interface(); pi["option"]!["Extra"] = Option("default"); pi["task"]![0]!["option"] = new JsonArray("Extra");
            var (project, profile) = Make(pi); profile = profile with { Kind = "mfa", SourceSchema = "mfa-flat", Tasks = [profile.Tasks[0] with { Options = new() }] };
            Assert(MaaSemanticCompiler.Compile(project, profile).Tasks.Single().Pipeline.Count == 0);
            Assert(MaaSemanticCompiler.Compile(project, profile with { Tasks = [profile.Tasks[0] with { Enabled = false }] }).Tasks.Length == 0);
        });
        run("mfa-selected-branches-share-first-saved-option-and-apply-each-name-once", () => {
            var pi = CompilerFixture.Interface(); var options = pi["option"]!.AsObject();
            options["Parent"] = Option("parent"); options["Child"] = Option("child"); options["Sibling"] = Option("sibling");
            options["Parent"]!["cases"]![0]!["option"] = new JsonArray("Child", "Sibling");
            options["Sibling"]!["cases"]![0]!["option"] = new JsonArray("Child");
            pi["task"]![0]!["option"] = new JsonArray("Parent");
            var (project, profile) = Make(pi); profile = profile with { Kind = "mfa" };
            JsonObject Saved(string name, params JsonObject[] children) => new() { ["name"] = name, ["index"] = 0,
                ["sub_options"] = new JsonArray(children.Select(child => (JsonNode)child).ToArray()) };
            var saved = new JsonArray(Saved("Parent", Saved("Child"), Saved("Sibling", Saved("Child")), Saved("Inactive")));
            var supplied = MaaSavedOptions.Mfa(saved, project, "PC", "Official");
            Assert(supplied.Count == 3 && supplied["Child"]!.GetValue<string>() == "On");
            var pipeline = new JsonObject(); new MaaOptionCompiler(project, profile).Apply(["Parent"], supplied, pipeline);
            Assert(pipeline["Node"]!["value"]!.GetValue<string>() == "sibling");
        });
        run("input-expansion-preserves-agent-references-regex-and-inserted-literal-braces", () => {
            var fields = new Dictionary<string, JsonNode> { ["ReserveValleyIV"] = JsonValue.Create(100)!,
                ["text"] = JsonValue.Create("{ReserveValleyIV}-{runtime}")! };
            Assert(MaaPipeline.Expand(JsonValue.Create("{ReserveValleyIV}>{AutoStockCurrentStockBill}"), fields)!.GetValue<string>() == "100>{AutoStockCurrentStockBill}");
            Assert(MaaPipeline.Expand(JsonValue.Create("[0-9]{2}-{text}"), fields)!.GetValue<string>() == "[0-9]{2}-{ReserveValleyIV}-{runtime}");
            Assert(MaaPipeline.Expand(JsonValue.Create("{runtime}"), new Dictionary<string, JsonNode>())!.GetValue<string>() == "{runtime}");
        });
        run("passwords-and-invalid-hotkeys-remain-explicit-blockers", () => {
            var definition = new JsonObject { ["type"] = "input", ["inputs"] = new JsonArray(new JsonObject { ["name"] = "secret", ["password"] = true }) };
            Reject(() => MaaInputValues.Read(definition, new(), "Win32"));
            var key = new JsonObject { ["type"] = "hotkey", ["hotkeys"] = new JsonArray(new JsonObject { ["name"] = "key", ["default"] = "CTRL+CTRL+A" }) };
            Reject(() => MaaInputValues.Read(key, new(), "Win32"));
        });
    }
}
