using System.Text.Json.Nodes;
using NexusPipeline.Extensions.MaaFramework;

internal static class EffectiveCases
{
    internal static void Run(Action<string, Action> run)
    {
        static void Check(bool value) { if (!value) throw new InvalidOperationException("effective_assertion_failed"); }
        (MaaPiProject Project, MaaImportedProfile Profile) Make(JsonObject pi)
        {
            var sources = new MaaSourceSet([CompilerFixture.Input("assets/interface.json", pi.ToJsonString()), CompilerFixture.Input("mxu.json", CompilerFixture.Mxu().ToJsonString())]);
            var project = new MaaPiCompiler(sources, "mxu").Compile("assets/interface.json");
            return (project, new MaaProjectImport(sources, project).Import(new("mxu", "mxu.json", "one")));
        }
        run("pretask-effective-values-share-activation-and-selection-but-preserve-raw-input-and-hotkey-strings", () =>
        {
            var pi = CompilerFixture.Interface();
            pi["option"]!["Raw"] = new JsonObject { ["type"] = "input", ["inputs"] = new JsonArray(new JsonObject
                { ["name"] = "count", ["default"] = "0012", ["pipeline_type"] = "int" }) };
            pi["option"]!["Key"] = new JsonObject { ["type"] = "hotkey", ["hotkeys"] = new JsonArray(new JsonObject { ["name"] = "key", ["default"] = "CTRL+F2" }) };
            pi["option"]!["Mode"]!["cases"]![0]!["option"] = new JsonArray("Raw", "Key");
            var (project, profile) = Make(pi);
            var result = new MaaOptionCompiler(project, profile).Effective(["Mode"], new JsonObject { ["Mode"] = "A" });
            Check(result["Mode"]!.GetValue<string>() == "A" && result["Raw"]!["count"]!.GetValue<string>() == "0012");
            Check(result["Key"]!["key"]!.GetValue<string>() == "CTRL+F2" && result["Key"]!.AsObject().Count == 1);
            pi["controller"]!.AsArray().Add(new JsonObject { ["name"] = "another-controller", ["type"] = "Win32" });
            pi["option"]!["Raw"]!["controller"] = new JsonArray("another-controller");
            (project, profile) = Make(pi);
            Check(!new MaaOptionCompiler(project, profile).Effective(["Raw"], new()).ContainsKey("Raw"));
        });
        run("pretask-checkbox-retains-selected-case-names-without-recursing-children", () =>
        {
            var pi = CompilerFixture.Interface();
            pi["option"]!["Check"] = new JsonObject { ["type"] = "checkbox", ["default_case"] = new JsonArray("A"),
                ["cases"] = new JsonArray(new JsonObject { ["name"] = "A", ["option"] = new JsonArray("Mode") }) };
            var (project, profile) = Make(pi);
            var result = new MaaOptionCompiler(project, profile).Effective(["Check"], new());
            Check(result.Count == 1 && result["Check"]![0]!.GetValue<string>() == "A");
        });
        run("pretask-protected-fields-remain-deferred-raw-strings-and-never-get-a-global-agent-grant", () =>
        {
            var pi = CompilerFixture.Interface();
            pi["option"]!["Credentials"] = new JsonObject { ["type"] = "input", ["inputs"] = new JsonArray(new JsonObject
                { ["name"] = "secret", ["password"] = true, ["pipeline_type"] = "int", ["verify"] = "^(Normal|Hard)$" }) };
            var (project, profile) = Make(pi); var key = MaaProtectedInput.Key(project.CompilationFingerprint + "/pretask-occurrence", "Credentials", "secret");
            var values = new JsonObject { ["Credentials"] = new JsonObject { ["secret"] = MaaProtectedInput.Binding(key) } };
            var effective = new MaaOptionCompiler(project, profile).Effective(["Credentials"], values);
            Check(MaaProtectedInput.Keys(effective).SequenceEqual(new[] { key }));
            Check(MaaProtectedPipeline.Resolve(effective, requested => requested == key ? "Hard" : throw new InvalidOperationException())
                ["Credentials"]!["secret"]!.GetValue<string>() == "Hard");
            Check(new MaaOptionCompiler(project, profile).Effective([], values).Count == 0);
        });
    }
}
