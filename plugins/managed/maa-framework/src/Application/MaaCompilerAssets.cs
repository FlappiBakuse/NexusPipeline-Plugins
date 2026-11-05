using System.Text.Json;
using NexusPipeline.Extensibility.Compilation;

namespace NexusPipeline.Extensions.MaaFramework;

internal static class MaaCompilerAssets
{
    internal static CompilationResult Create(MaaCompilationBundle bundle, MaaSelectedFiles files)
    {
        var pages = bundle.Pi.Pages.Keys.Order(StringComparer.Ordinal).Select(PageName).ToArray();
        var editor = MaaEditorProjection.Build(bundle);
        var editorPages = editor.Pages.Keys.Order(StringComparer.Ordinal).Select(EditorPage).ToArray();
        var observations = files.Observations();
        var root = MaaCompilationBundle.Serialize(new { kind = "maa-provider-index", version = 1,
            compilation = MaaCompilationBundle.Reference(bundle.Index), sourceObservations = MaaCompilationBundle.Reference(observations),
            editor = MaaCompilationBundle.Reference(editor.Index), bundle.SnapshotFingerprint, resourceArchiveRequired = true }, 65536);
        var assets = new List<CompiledAsset> {
            new("project", CompiledAssetKind.Index, root, ["bundle-index", "source-observations", "editor-index"]),
            new("editor-index", CompiledAssetKind.Index, editor.Index, editorPages),
            new("source-observations", CompiledAssetKind.Artifact, observations, []),
            new("bundle-index", CompiledAssetKind.Index, bundle.Index, ["bundle-artifact", "execution", "pi-index"]),
            new("bundle-artifact", CompiledAssetKind.Artifact, bundle.Artifact, ["pi-artifact", "pi-index", .. pages]),
            new("execution", CompiledAssetKind.Artifact, bundle.Execution, ["bundle-artifact"]),
            new("pi-artifact", CompiledAssetKind.Artifact, bundle.Pi.Artifact, []),
            new("pi-index", CompiledAssetKind.Index, bundle.Pi.View, pages) };
        assets.AddRange(bundle.Pi.Pages.OrderBy(pair => pair.Key, StringComparer.Ordinal)
            .Select(pair => new CompiledAsset(PageName(pair.Key), CompiledAssetKind.Page, pair.Value, [])));
        assets.AddRange(editor.Pages.OrderBy(pair => pair.Key, StringComparer.Ordinal)
            .Select(pair => new CompiledAsset(EditorPage(pair.Key), CompiledAssetKind.Page, pair.Value, [])));
        if (assets.Sum(asset => (long)asset.Content.Length) > 32 * 1024 * 1024) throw new MaaInputFailure("maa_compiler_asset_budget");
        using var execution = JsonDocument.Parse(bundle.Execution);
        var semantic = MaaJson.Read(bundle.Artifact)["semantic"];
        IEnumerable<(string Key, string Occurrence)> Uses(string rows, string content) => MaaJson.Objects(semantic?[rows])
            .SelectMany(task => MaaProtectedInput.Keys(task[content]).Select(key => (key, MaaJson.Required(task, "OccurrenceId"))));
        var uses = Uses("Tasks", "Pipeline").Concat(Uses("Programs", "Options")).ToArray();
        var protectedInputs = uses.GroupBy(item => item.Key, StringComparer.Ordinal).Select(group =>
            new ProjectProtectedInput(group.Key, group.Select(item => item.Occurrence).Distinct(StringComparer.Ordinal).ToArray())).ToArray();
        return new("project", assets.ToArray(), execution.RootElement.Clone()) {
            InitializationOccurrences = MaaJson.Objects(semantic?["Programs"]).Where(program => MaaJson.Required(program, "Kind") == "pretask")
                .Select(task => MaaJson.Required(task, "OccurrenceId")).ToArray(),
            CanExecute = bundle.CanExecute, PreviewIndex = "editor-index", ProtectedInputs = protectedInputs, ResourceTrees = files.ResourceTrees.Select((path, index) =>
            new SourceResourceTree("resource-" + index.ToString(System.Globalization.CultureInfo.InvariantCulture), path))
            .Concat(files.ProgramPaths.Count == 0 ? [] : new[] { new SourceResourceTree("program-input", "") { IncludedPaths = files.ProgramPaths.ToArray() } }).ToArray() };
    }
    private static string PageName(string sha) => "pi-page-" + sha;
    private static string EditorPage(string sha) => "editor-page-" + sha;
}
