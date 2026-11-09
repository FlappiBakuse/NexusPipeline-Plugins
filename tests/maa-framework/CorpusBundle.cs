using System.Text.Json;
using System.Text.Json.Nodes;
using NexusPipeline.Extensions.MaaFramework;

internal static class CorpusBundle
{
    internal static MaaCompilationBundle Build(string name, MaaPiProject project, IEnumerable<MaaSourceInput> lockedInputs,
        JsonObject inventory, string? blockingDiagnostic)
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
        _ = bundle.Verify(sources, bundle.ArtifactSha256);
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
        var view = result.ExecutionView;
        var diagnostics = view.GetProperty("blockingDiagnostics").EnumerateArray().Select(issue => issue.GetProperty("Code").GetString()).ToArray();
        if (result.CanExecute != (blockingDiagnostic is null) || (blockingDiagnostic is not null && !diagnostics.Contains(blockingDiagnostic)))
            throw new InvalidDataException("corpus_execution_admission:" + string.Join(",", diagnostics));
        var previewTasks = view.GetProperty("Tasks").EnumerateArray().ToArray();
        var expectedTasks = project.Tasks.Select(task => MaaJson.Required(task, "name")).Select(taskName => ((string?)taskName, taskName == enabledName));
        BundleCases.Assert(previewTasks.Select(task => (task.GetProperty("Name").GetString(), task.GetProperty("Enabled").GetBoolean())).SequenceEqual(expectedTasks) &&
            previewTasks.Count(task => task.GetProperty("Compiled").ValueKind != JsonValueKind.Null) == (result.CanExecute ? 1 : 0) &&
            result.CanExecute == bundle.CanExecute && view.GetProperty("semanticFingerprint").GetString() == bundle.SemanticFingerprint);
        return bundle;
    }
}
