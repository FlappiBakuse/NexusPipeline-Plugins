using System.Text.Json;
using System.Text.Json.Nodes;
using NexusPipeline.Extensions.MaaFramework;

internal static class CorpusBundle
{
    internal static MaaCompilationBundle Build(string name, MaaPiProject project, IEnumerable<MaaSourceInput> lockedInputs, JsonObject inventory)
    {
        var controller = project.Declaration["controller"]!.AsArray().Select(MaaJson.Object)
            .First(item => MaaJson.Required(item, "type") == "Win32")["name"]!.GetValue<string>();
        var resource = MaaJson.Required(MaaJson.Objects(project.Declaration["resource"]).First(), "name");
        var enabledName = name == "MaaEnd" ? "WeaponUpgrade" : "登录游戏";
        if (!project.Tasks.Any(task => MaaJson.Required(task, "name") == enabledName)) throw new InvalidDataException("corpus_enabled_task_missing");
        var inputs = lockedInputs.ToList(); MaaImportSelection selection;
        if (project.ClientKind == "mxu")
        {
            var tasks = new JsonArray(project.Tasks.Select((task, index) => (JsonNode)new JsonObject {
                ["id"] = "fixture-" + index, ["taskName"] = MaaJson.Required(task, "name"),
                ["enabled"] = MaaJson.Required(task, "name") == enabledName, ["optionValues"] = new JsonObject() }).ToArray());
            var source = new JsonObject { ["version"] = "1.0", ["instances"] = new JsonArray(new JsonObject {
                ["id"] = "corpus", ["controllerName"] = controller, ["resourceName"] = resource, ["tasks"] = tasks,
                ["privateProgress"] = new JsonObject { ["counter"] = 19 } }) };
            inputs.Add(CompilerFixture.Input("mxu.json", source.ToJsonString())); selection = new("mxu", "mxu.json", "corpus");
        }
        else
        {
            var tasks = new JsonArray(project.Tasks.Select(task => (JsonNode)new JsonObject { ["name"] = MaaJson.Required(task, "name"),
                ["entry"] = MaaJson.Required(task, "entry"), ["default_check"] = MaaJson.Required(task, "name") == enabledName,
                ["repeat_count"] = 1 }).ToArray());
            var source = new JsonObject { ["CurrentControllerName"] = controller, ["Resource"] = resource, ["TaskItems"] = tasks,
                ["CurrentTasks"] = new JsonArray(project.Tasks.Select(task => (JsonNode)JsonValue.Create(MaaJson.Required(task, "name") + "<|||>" + MaaJson.Required(task, "entry"))!).ToArray()),
                ["BeforeTask"] = "None", ["AfterTask"] = "None", ["privateProgress"] = new JsonObject { ["counter"] = 19 } };
            inputs.Add(CompilerFixture.Input("appsettings.json", "{}")); inputs.Add(CompilerFixture.Input("config/config.json", "{}"));
            inputs.Add(CompilerFixture.Input("config/instances/corpus.json", source.ToJsonString()));
            selection = new("mfa", "config/instances/corpus.json", "corpus");
        }
        var sources = new MaaSourceSet(inputs);
        var bundle = MaaCompilationBundle.Build(sources, new(project.InterfacePath, project.ClientKind, "zh_cn", selection));
        var view = bundle.Verify(sources, bundle.ArtifactSha256); var artifact = MaaJson.Read(bundle.Artifact);
        BundleCases.Assert(view["Tasks"]!.AsArray().Count == project.Tasks.Length && artifact["semantic"]!["Tasks"]!.AsArray().Count == 1 &&
            artifact["profile"]!["SourceSnapshot"] is JsonObject && bundle.Execution.Length <= MaaCompilationBundle.MaximumExecutionBytes);
        var semantic = artifact["semantic"]!["Tasks"]![0]!;
        BundleCases.Assert(semantic["Name"]!.GetValue<string>() == enabledName && semantic["Pipeline"]!.AsObject().Count > 0 == (name == "MaaEnd"));
        var changed = BundleCases.Rewrite(bundle, root => root["profile"]!["Tasks"]![0]!["Order"] = 999);
        BundleCases.Reject(() => changed.Verify(sources, changed.ArtifactSha256));
        var selected = new SelectedSourceFixture();
        foreach (var input in inputs) selected.Add(input);
        if (selection.Kind == "mxu") selected.Mount(selection.Path, NexusPipeline.Extensibility.Compilation.SourceEntryKind.File, "corpus");
        else
        {
            selected.Mount("appsettings.json", NexusPipeline.Extensibility.Compilation.SourceEntryKind.File, null);
            selected.Mount("config", NexusPipeline.Extensibility.Compilation.SourceEntryKind.Directory, "corpus");
        }
        foreach (var pair in inventory)
            if (!selected.Files.ContainsKey(pair.Key)) selected.Add(new(pair.Key, ReadOnlyMemory<byte>.Empty,
                pair.Value!.GetValue<string>(), "inventory:" + pair.Value!.GetValue<string>()));
        var result = new MaaProjectCompiler().CompileAsync(selected,
            JsonSerializer.SerializeToElement(new MaaCompilationSelection(project.InterfacePath, project.ClientKind, "zh_cn", selection)), default).GetAwaiter().GetResult();
        BundleCases.Assert(result.ExecutionView.GetProperty("semanticFingerprint").GetString() == bundle.SemanticFingerprint &&
            result.ExecutionView.GetProperty("Tasks").GetArrayLength() == project.Tasks.Length && selected.Reads.Count <= 128 &&
            !selected.Reads.Any(path => path.Contains("/pipeline/", StringComparison.Ordinal)));
        return bundle;
    }
}
