using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using NexusPipeline.Extensibility.Compilation;
using NexusPipeline.Extensions.MaaFramework;

internal static class EditorCases
{
    private static void Assert(bool value) => BundleCases.Assert(value);
    private static void Reject(Action action) => BundleCases.Reject(action);
    private static MaaCompilationBundle Fixture(bool longText = false, bool blocked = false)
    {
        var pi = CompilerFixture.Interface(); pi["languages"] = new JsonObject { ["zh_cn"] = "locale.json" };
        pi["private_extension"] = "PI_PRIVATE_SENTINEL"; pi["controller"]![0]!["private_extension"] = "CONTROLLER_PRIVATE_SENTINEL";
        pi["description"] = longText ? string.Concat(Enumerable.Repeat("选项😀", 10000)) : "$project.description";
        pi["task"]![0]!["label"] = "$task.label"; pi["task"]![0]!["option"]!.AsArray().Add("Plain");
        pi["task"]![0]!["pipeline_override"] = new JsonObject { ["Node"] = new JsonObject { ["custom"] = "PIPELINE_PRIVATE_SENTINEL" } };
        pi["option"]!["Plain"] = new JsonObject { ["type"] = "input", ["label"] = "$plain.label", ["inputs"] = new JsonArray(
            new JsonObject { ["name"] = "Message", ["default"] = "public-schema-default", ["private_extension"] = "FIELD_PRIVATE_SENTINEL" }) };
        pi["option"]!["Password"] = new JsonObject { ["type"] = "input", ["inputs"] = new JsonArray(
            new JsonObject { ["name"] = "Password", ["password"] = true, ["default"] = "" }) };
        pi["option"]!["Unused"] = new JsonObject { ["type"] = "select", ["default_case"] = "INVALID_CASE_PRIVATE_SENTINEL",
            ["cases"] = new JsonArray(new JsonObject { ["name"] = "Public" }) };
        var config = CompilerFixture.Mxu(); var task = config["instances"]![0]!["tasks"]![0]!;
        task["optionValues"]!["Plain"] = new JsonObject { ["type"] = "input", ["values"] = new JsonObject { ["Message"] = "saved-public-input" } };
        task["customName"] = "CUSTOM_NAME_PRIVATE_SENTINEL"; task["progress"] = "PROGRESS_PRIVATE_SENTINEL";
        config["instances"]![0]!["savedDevice"] = new JsonObject { ["token"] = "CONNECTION_PRIVATE_SENTINEL" };
        config["instances"]![0]!["tasks"]!.AsArray().Add(new JsonObject { ["id"] = "unknown-public-id", ["taskName"] = "UNKNOWN_NAME_PRIVATE_SENTINEL",
            ["enabled"] = blocked, ["optionValues"] = new JsonObject() });
        var inputs = new[] { CompilerFixture.Input("assets/interface.json", pi.ToJsonString()), CompilerFixture.Input("mxu.json", config.ToJsonString()),
            CompilerFixture.Input("assets/locale.json", new JsonObject { ["project.description"] = "public-description", ["task.label"] = "public-task", ["plain.label"] = "public-input",
                ["unreferenced"] = "TRANSLATION_PRIVATE_SENTINEL", ["private-object"] = new JsonObject { ["secret"] = "LOCALE_PRIVATE_SENTINEL" } }.ToJsonString()) };
        return MaaCompilationBundle.Build(new(inputs, configurationBindings: [new("mxu.json", "main", 7, inputs[1].Sha256, "", 1, new('a', 64), new('b', 64))]), BundleCases.Selection);
    }
    internal static void Run(Action<string, Action> run)
    {
        run("editor-and-runtime-share-first-case-and-mfa-default-selection-without-saving-an-override", () => {
            var pi = CompilerFixture.Interface(); pi["option"]!["Mode"]!.AsObject().Remove("default_case");
            var config = CompilerFixture.Mxu(); config["instances"]![0]!["tasks"]![0]!["optionValues"] = new JsonObject();
            var bundle = MaaCompilationBundle.Build(new MaaSourceSet([
                CompilerFixture.Input("assets/interface.json", pi.ToJsonString()), CompilerFixture.Input("mxu.json", config.ToJsonString())]), BundleCases.Selection);
            var view = MaaEditorProjection.Restore(MaaEditorProjection.Build(bundle));
            Assert(view["schema"]!["option"]!["Mode"]!["default_case"]!.GetValue<string>() == "A");
            Assert(view["profile"]!["Tasks"]![0]!["Options"]!["Mode"] is null);
            var option = pi["option"]!["Mode"]!.AsObject(); option["default_case"] = "unknown";
            Assert(MaaOptionDefaults.Selection(option, "mfa")!.GetValue<string>() == "A");
            Assert(new MaaEditorSchema().Build(pi, "mfa")["option"]!["Mode"]!["default_case"]!.GetValue<string>() == "A");
            Assert(new MaaEditorSchema().Build(pi, "mxu")["option"]!["Mode"]!["default_case"] is null);
        });
        run("editor-retains-explicit-runtime-selection-for-reopening", () => {
            var runtime = new MaaRuntimeSelection("runtime/native", new Dictionary<string, string> { ["python"] = "python/python.exe" }, ["python/Lib"]);
            var bundle = MaaCompilationBundle.Build(BundleCases.Sources(), BundleCases.Selection with { Runtime = runtime });
            var restored = MaaEditorProjection.Restore(MaaEditorProjection.Build(bundle));
            var expected = JsonSerializer.SerializeToNode(runtime);
            Assert(JsonNode.DeepEquals(restored["selection"]!["Runtime"], expected));
        });
        run("editor-declared-ordinary-inputs-remain-editable-without-serializing-protected-or-unknown-values", () => {
            var bundle = Fixture(); var editor = MaaEditorProjection.Build(bundle); var restored = MaaEditorProjection.Restore(editor);
            var text = Encoding.UTF8.GetString(editor.Index) + string.Concat(editor.Pages.Values.Select(Encoding.UTF8.GetString));
            Assert(!text.Contains("PRIVATE_SENTINEL", StringComparison.Ordinal) && !text.Contains("SourceSnapshot", StringComparison.Ordinal));
            Assert(restored["schema"]!["option"]!["Password"]!["inputs"]![0]!["password"]!.GetValue<bool>() &&
                restored["schema"]!["option"]!["Password"]!["inputs"]![0]!["default"] is null &&
                restored["schema"]!["option"]!["Plain"]!["inputs"]![0]!["default"]!.GetValue<string>() == "public-schema-default");
            Assert(restored["profile"]!["Tasks"]![0]!["Options"]!["Mode"]!.GetValue<string>() == "B" &&
                restored["profile"]!["Tasks"]![0]!["Options"]!["Plain"]!["Message"]!.GetValue<string>() == "saved-public-input" &&
                restored["schema"]!["option"]!["Unused"]!["default_case"] is null && restored["translations"]!.AsObject().Count == 3);
            var declaration = MaaJson.Object(MaaJson.Read(bundle.Pi.Artifact)["declaration"]);
            var protectedValue = MaaEditorSchema.Selections(new JsonObject { ["Password"] = new JsonObject { ["Password"] = "PASSWORD_PRIVATE_SENTINEL" } }, declaration);
            Assert(protectedValue["Password"]!.AsObject().Count == 0 && !protectedValue.ToJsonString().Contains("PRIVATE_SENTINEL", StringComparison.Ordinal));
            Assert(Encoding.UTF8.GetString(bundle.Artifact).Contains("PROGRESS_PRIVATE_SENTINEL", StringComparison.Ordinal));
        });
        run("editor-occurrences-retain-identities-order-and-origin-without-unknown-human-content", () => {
            var bundle = Fixture(); var view = MaaEditorProjection.Restore(MaaEditorProjection.Build(bundle));
            var rows = view["profile"]!["Tasks"]!.AsArray(); var privateRows = MaaJson.Read(bundle.Artifact)["profile"]!["Tasks"]!.AsArray();
            Assert(rows.Count == 2 && rows[1]!["Name"] is null && rows[1]!["Entry"] is null && !rows[1]!["DefinitionKnown"]!.GetValue<bool>());
            for (var index = 0; index < rows.Count; index++) foreach (var key in new[] { "Id", "SourceId", "Order", "Enabled", "RepeatCount", "Role" })
                Assert(JsonNode.DeepEquals(rows[index]![key], privateRows[index]![key]));
            Assert(rows[0]!["Origin"]!["Pointer"]!.GetValue<string>() == "/instances/0/tasks/0" && rows[0]!["Origin"]!["SnapshotPointer"] is null);
        });
        run("editor-readonly-blocker-preserves-code-and-authoritative-false-without-detail", () => {
            var bundle = Fixture(blocked: true); var view = MaaEditorProjection.Restore(MaaEditorProjection.Build(bundle));
            Assert(!view["compilation"]!["canExecute"]!.GetValue<bool>() && view["compilation"]!["semanticFingerprint"] is null &&
                view["diagnostics"]!.AsArray().Any(item => item!["code"]!.GetValue<string>() == "maa_enabled_task_unmapped") &&
                !view.ToJsonString().Contains("UNKNOWN_NAME_PRIVATE_SENTINEL", StringComparison.Ordinal));
        });
        run("editor-large-display-text-is-complete-and-every-page-is-bounded", () => {
            var bundle = Fixture(true); var editor = MaaEditorProjection.Build(bundle); var view = MaaEditorProjection.Restore(editor);
            Assert(editor.Pages.Count > 0 && editor.Index.Length <= 524288 && editor.Pages.Values.All(page => page.Length <= 65536) &&
                view["schema"]!["description"]!.GetValue<string>() == string.Concat(Enumerable.Repeat("选项😀", 10000)));
            Reject(() => MaaEditorProjection.Build(bundle, 1));
        });
        run("editor-missing-changed-extra-pages-and-index-identity-are-rejected", () => {
            var editor = MaaEditorProjection.Build(Fixture(true)); var pages = editor.Pages.ToDictionary(pair => pair.Key, pair => pair.Value.ToArray());
            var key = pages.Keys.First(); pages.Remove(key); Reject(() => MaaEditorProjection.Restore(editor with { Pages = pages }));
            pages = editor.Pages.ToDictionary(pair => pair.Key, pair => pair.Value.ToArray()); pages[key][0] ^= 1;
            Reject(() => MaaEditorProjection.Restore(editor with { Pages = pages }));
            pages = editor.Pages.ToDictionary(pair => pair.Key, pair => pair.Value); pages.Add(new('0', 64), "[]"u8.ToArray());
            Reject(() => MaaEditorProjection.Restore(editor with { Pages = pages }));
            var index = editor.Index.ToArray(); index[^2] ^= 1; Reject(() => MaaEditorProjection.Restore(editor with { Index = index }));
        });
        run("editor-binding-is-the-exact-frozen-bundle-and-original-file-sha", () => {
            var bundle = Fixture(); var view = MaaEditorProjection.Restore(MaaEditorProjection.Build(bundle));
            Assert(view["compilation"]!["bundleArtifactSha256"]!.GetValue<string>() == bundle.ArtifactSha256 &&
                view["compilation"]!["snapshotFingerprint"]!.GetValue<string>() == bundle.SnapshotFingerprint &&
                view["configurationBindings"]![0]!["SourceSha256"]!.GetValue<string>() != view["configurationBindings"]![0]!["SnapshotSha256"]!.GetValue<string>());
            var bytes = bundle.Artifact.ToArray(); bytes[^2] ^= 1; Reject(() => MaaEditorProjection.Build(bundle with { Artifact = bytes }));
            Reject(() => MaaEditorProjection.Build(bundle with { CanExecute = !bundle.CanExecute }));
            Reject(() => MaaEditorProjection.Build(bundle with { SourceFingerprint = new('0', 64) }));
        });
        run("editor-provider-public-subgraph-has-no-private-artifact-references", () => {
            var source = SelectedSourceFixture.Create(true); var result = new MaaProjectCompiler().CompileAsync(source,
                JsonSerializer.SerializeToElement(BundleCases.Selection), default).GetAwaiter().GetResult();
            var assets = result.Assets.ToDictionary(asset => asset.Name); var root = assets["editor-index"];
            Assert(result.PreviewIndex == "editor-index" && root.Kind == CompiledAssetKind.Index && root.References.All(name => name.StartsWith("editor-page-", StringComparison.Ordinal)) &&
                root.References.All(name => assets[name].Kind == CompiledAssetKind.Page && assets[name].References.Count == 0));
            Assert(assets.ContainsKey("bundle-artifact") && assets.ContainsKey("pi-artifact") && assets.ContainsKey("pi-index"));
        });
        foreach (var inherited in new[] { false, true })
            run("editor-mfa-inherited-and-new-default-original-origin/" + inherited, () => {
                var pi = CompilerFixture.Interface(); var global = inherited ? CompilerFixture.Mfa() : new JsonObject();
                var inputs = new[] { CompilerFixture.Input("assets/interface.json", pi.ToJsonString()), CompilerFixture.Input("appsettings.json", "{}"),
                    CompilerFixture.Input("config/config.json", global.ToJsonString()), CompilerFixture.Input("config/instances/one.json",
                        "{\"CurrentControllerName\":\"PC\",\"Resource\":\"Official\",\"privateValue\":\"MFA_PRIVATE_SENTINEL\"}") };
                var bundle = MaaCompilationBundle.Build(new(inputs), new("assets/interface.json", "mfa", "zh_cn", new("mfa", "config/instances/one.json", "one")));
                var editor = MaaEditorProjection.Restore(MaaEditorProjection.Build(bundle)); var origin = editor["profile"]!["Tasks"]![0]!["Origin"]!;
                Assert(origin["Kind"]!.GetValue<string>() == (inherited ? "inherited" : "default") &&
                    !editor.ToJsonString().Contains("MFA_PRIVATE_SENTINEL", StringComparison.Ordinal));
                Assert(inherited ? origin["Path"]!.GetValue<string>() == "config/config.json" : origin["Path"] is null && origin["Pointer"] is null && origin["Index"] is null);
            });
        run("editor-password-ordinary-material-is-rejected-before-any-asset-publication", () => {
            var source = SelectedSourceFixture.Create(); var pi = CompilerFixture.Interface();
            pi["option"]!["Mode"] = new JsonObject { ["type"] = "input", ["inputs"] = new JsonArray(new JsonObject { ["name"] = "Secret", ["password"] = true }) };
            var config = CompilerFixture.Mxu(); config["instances"]![0]!["tasks"]![0]!["optionValues"]!["Mode"] = new JsonObject {
                ["type"] = "input", ["values"] = new JsonObject { ["Secret"] = "SAVED_PASSWORD_PRIVATE_SENTINEL" } };
            source.Files["assets/interface.json"] = CompilerFixture.Input("assets/interface.json", pi.ToJsonString());
            source.Files["mxu.json"] = CompilerFixture.Input("mxu.json", config.ToJsonString());
            Reject(() => new MaaProjectCompiler().CompileAsync(source, JsonSerializer.SerializeToElement(BundleCases.Selection), default).GetAwaiter().GetResult());
            pi["option"]!["Mode"]!["inputs"]![0]!["default"] = "PASSWORD_DEFAULT_PRIVATE_SENTINEL";
            source.Files["assets/interface.json"] = CompilerFixture.Input("assets/interface.json", pi.ToJsonString());
            Reject(() => new MaaProjectCompiler().CompileAsync(source, JsonSerializer.SerializeToElement(BundleCases.Selection), default).GetAwaiter().GetResult());
        });
    }
}
