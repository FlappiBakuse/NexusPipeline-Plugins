using System.Text.Json.Nodes;
using NexusPipeline.Extensions.MaaFramework;

internal static class ProtectedCases
{
    internal static void Run(Action<string, Action> run)
    {
        static void Check(bool value) { if (!value) throw new InvalidOperationException("protected_assertion_failed"); }
        static void Reject(Action action)
        { try { action(); } catch (MaaInputFailure) { return; } throw new InvalidOperationException("protected_rejection_expected"); }
        var definition = new JsonObject { ["type"] = "input", ["inputs"] = new JsonArray(new JsonObject
            { ["name"] = "token", ["password"] = true, ["pipeline_type"] = "string" }) };
        var key = MaaProtectedInput.Key("GlobalOptions", "Credentials", "token");
        run("protected-input-key-binds-layer-option-and-exact-unicode-name", () =>
        {
            Check(key != MaaProtectedInput.Key("ResourceOptions", "Credentials", "token"));
            Check(MaaProtectedInput.Key("GlobalOptions", "a.b", "c") != MaaProtectedInput.Key("GlobalOptions", "a", "b.c"));
            Check(MaaProtectedInput.Key("GlobalOptions", "口令", "值").Length == 70);
            MaaProtectedInput.RequireBinding(MaaProtectedInput.Binding(key), "GlobalOptions", "Credentials", "token");
            Reject(() => MaaProtectedInput.RequireBinding(MaaProtectedInput.Binding(key), "another-task", "Credentials", "token"));
            Reject(() => MaaProtectedInput.ReadBinding(JsonValue.Create("secret:opaque-token")));
            Reject(() => MaaProtectedInput.ReadBinding(new JsonObject { ["$maaSecret"] = key, ["value"] = "plaintext" }));
        });
        run("protected-input-compiles-without-reading-material-and-expands-only-on-demand", () =>
        {
            var fields = MaaInputValues.Read(definition, new JsonObject { ["token"] = MaaProtectedInput.Binding(key) }, "Win32");
            var pipeline = MaaJson.Object(MaaPipeline.Expand(new JsonObject { ["Node"] = new JsonObject
                { ["exact"] = "{token}", ["embedded"] = "prefix-{token}-suffix" } }, fields));
            Check(MaaProtectedInput.Keys(pipeline).SequenceEqual(new[] { key }));
            Check(!pipeline.ToJsonString().Contains("PRIVATE_SENTINEL", StringComparison.Ordinal));
            var reads = 0;
            var expanded = MaaProtectedPipeline.Resolve(pipeline, requested =>
            { Check(requested == key); reads++; return "PRIVATE_SENTINEL"; });
            Check(reads == 2 && expanded["Node"]!["exact"]!.GetValue<string>() == "PRIVATE_SENTINEL" &&
                expanded["Node"]!["embedded"]!.GetValue<string>() == "prefix-PRIVATE_SENTINEL-suffix");
            Check(!pipeline.ToJsonString().Contains("PRIVATE_SENTINEL", StringComparison.Ordinal));
            var expression = MaaJson.Object(MaaPipeline.Expand(new JsonObject { ["Node"] = new JsonObject
                { ["value"] = "{token}-{runtime}" } }, fields));
            Check(MaaProtectedPipeline.Resolve(expression, _ => "{literal}")["Node"]!["value"]!.GetValue<string>() == "{literal}-{runtime}");
        });
        run("protected-input-retains-conversion-and-never-accepts-source-password-material", () =>
        {
            var input = definition.DeepClone().AsObject(); input["inputs"]![0]!["pipeline_type"] = "int";
            var fields = MaaInputValues.Read(input, new JsonObject { ["token"] = MaaProtectedInput.Binding(key) }, "Win32");
            var pipeline = new JsonObject { ["Node"] = new JsonObject { ["number"] = fields["token"]!.DeepClone() } };
            Check(MaaProtectedPipeline.Resolve(pipeline, _ => "42")["Node"]!["number"]!.GetValue<long>() == 42);
            Reject(() => MaaProtectedPipeline.Resolve(pipeline, _ => "not-a-number"));
            Reject(() => MaaInputValues.Read(input, new JsonObject { ["token"] = "raw-password" }, "Win32"));
            Reject(() => MaaSavedOptions.Inputs(input, new JsonObject { ["token"] = "raw-password" }));
            input["inputs"]![0]!["default"] = "raw-default";
            Reject(() => MaaInputValues.Read(input, new JsonObject { ["token"] = MaaProtectedInput.Binding(key) }, "Win32"));
        });
        run("protected-runtime-markers-cannot-be-injected-as-ordinary-pipeline", () =>
        {
            var source = new JsonObject { ["Node"] = new JsonObject { ["value"] = MaaProtectedInput.Deferred(key,
                definition["inputs"]![0]!.AsObject(), "Win32") } };
            Reject(() => MaaPipeline.Apply(new JsonObject(), source, true));
            Reject(() => MaaProtectedInput.RequireOrdinary(new JsonObject { ["nested"] = new JsonArray(MaaProtectedInput.Binding(key)) }));
        });
        run("protected-profile-is-editable-while-missing-and-retains-only-a-typed-public-binding-after-set", () =>
        {
            var pi = CompilerFixture.Interface();
            pi["global_option"] = new JsonArray("Credentials");
            pi["option"]!["Credentials"] = definition.DeepClone();
            pi["option"]!["Credentials"]!["pipeline_override"] = new JsonObject { ["Entry"] = new JsonObject { ["text"] = "{token}" } };
            var sources = new MaaSourceSet([CompilerFixture.Input("assets/interface.json", pi.ToJsonString()), CompilerFixture.Input("mxu.json", CompilerFixture.Mxu().ToJsonString())]);
            var selection = new MaaCompilationSelection("assets/interface.json", "mxu", "zh_cn", new("mxu", "mxu.json", "one"));
            var missing = MaaCompilationBundle.Build(sources, selection);
            Check(!missing.CanExecute && missing.BlockingDiagnostics.Any(issue => issue.Code == "maa_password_binding_required"));
            var binding = MaaProtectedInput.Key(missing.Pi.CompilationFingerprint + "/GlobalOptions", "Credentials", "token");
            var draft = new JsonObject { ["GlobalOptions"] = new JsonObject { ["Credentials"] = new JsonObject { ["token"] = MaaProtectedInput.Binding(binding) } } };
            var bound = MaaCompilationBundle.Build(sources, selection with { Profile = draft });
            Check(bound.CanExecute);
            var editor = MaaEditorProjection.Restore(MaaEditorProjection.Build(bound));
            Check(MaaProtectedInput.ReadBinding(editor["profile"]!["GlobalOptions"]!["Credentials"]!["token"]) == binding);
            Check(!editor["privacy"]!["protectedInputValuesAvailable"]!.GetValue<bool>());
            draft["GlobalOptions"]!["Credentials"]!["token"] = "secret:opaque-token";
            Reject(() => MaaCompilationBundle.Build(sources, selection with { Profile = draft }));
        });
        run("protected-binding-from-another-pi-or-layer-is-a-repairable-blocker-and-never-an-executable-grant", () =>
        {
            var pi = CompilerFixture.Interface(); pi["global_option"] = new JsonArray("Credentials");
            pi["option"]!["Credentials"] = definition.DeepClone();
            var sources = new MaaSourceSet([CompilerFixture.Input("assets/interface.json", pi.ToJsonString()), CompilerFixture.Input("mxu.json", CompilerFixture.Mxu().ToJsonString())]);
            var selection = new MaaCompilationSelection("assets/interface.json", "mxu", "zh_cn", new("mxu", "mxu.json", "one"));
            var project = new MaaPiCompiler(sources, "mxu").Compile("assets/interface.json");
            var draft = new JsonObject { ["GlobalOptions"] = new JsonObject { ["Credentials"] = new JsonObject
                { ["token"] = MaaProtectedInput.Binding(MaaProtectedInput.Key(project.CompilationFingerprint + "/another-occurrence", "Credentials", "token")) } } };
            var blocked = MaaCompilationBundle.Build(sources, selection with { Profile = draft });
            Check(!blocked.CanExecute && blocked.BlockingDiagnostics.Any(issue => issue.Code == "maa_password_binding_changed"));
            Check(MaaEditorProjection.Restore(MaaEditorProjection.Build(blocked))["schema"]!["option"]!["Credentials"] is JsonObject);
            pi["task"]![0]!["pipeline_override"] = new JsonObject { ["Entry"] = new JsonObject
                { ["text"] = MaaProtectedInput.Deferred(key, definition["inputs"]![0]!.AsObject(), "Win32") } };
            var injected = new MaaSourceSet([CompilerFixture.Input("assets/interface.json", pi.ToJsonString())]);
            Reject(() => new MaaPiCompiler(injected).Compile("assets/interface.json"));
        });
    }
}
