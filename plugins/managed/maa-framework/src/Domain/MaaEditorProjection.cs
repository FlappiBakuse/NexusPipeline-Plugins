using System.Text.Json;
using System.Text.Json.Nodes;

namespace NexusPipeline.Extensions.MaaFramework;

internal sealed record MaaEditorArtifact(byte[] Index, string IndexSha256, IReadOnlyDictionary<string, byte[]> Pages);
internal static class MaaEditorProjection
{
    internal static MaaEditorArtifact Build(MaaCompilationBundle bundle, int maximumIndexBytes = 524288)
    {
        if (maximumIndexBytes is < 1 or > 524288 || MaaCompilationBundle.Hash(bundle.Artifact) != bundle.ArtifactSha256 ||
            MaaCompilationBundle.Hash(bundle.Index) != bundle.IndexSha256) throw new MaaInputFailure("maa_editor_binding_invalid");
        var artifact = MaaJson.Read(bundle.Artifact); var full = MaaJson.Read(bundle.Pi.Artifact); var frozen = MaaJson.Read(bundle.Index);
        if (MaaCompilationBundle.Hash(bundle.Pi.Artifact) != bundle.Pi.ArtifactSha256 ||
            MaaJson.Text(artifact, "snapshotFingerprint") != bundle.SnapshotFingerprint || MaaJson.Text(artifact, "sourceFingerprint") != bundle.SourceFingerprint ||
            MaaJson.Boolean(artifact, "canExecute") != bundle.CanExecute || artifact["semanticFingerprint"]?.GetValue<string>() != bundle.SemanticFingerprint ||
            MaaJson.Text(full, "compilationFingerprint") != bundle.Pi.CompilationFingerprint ||
            MaaJson.Text(full, "compilationFingerprint") != MaaJson.Text(artifact, "compilationFingerprint") ||
            MaaJson.Text(MaaJson.Object(frozen["artifact"]), "sha256") != bundle.ArtifactSha256 ||
            MaaJson.Text(frozen, "snapshotFingerprint") != bundle.SnapshotFingerprint) throw new MaaInputFailure("maa_editor_binding_invalid");
        var declaration = MaaJson.Object(full["declaration"]); var profile = MaaJson.Object(artifact["profile"]);
        var schema = new MaaEditorSchema(); var publicSchema = schema.Build(declaration, MaaJson.Required(full, "ClientKind"));
        var translations = schema.Translate(MaaJson.Object(full["translations"]));
        var pages = new MaaProjectionPages();
        JsonObject Encode(JsonNode? value) => pages.Encode(value);
        JsonObject Rows(string name)
        {
            var rows = MaaJson.Objects(profile[name]);
            return Encode(new JsonArray(rows.Select(row => {
                var known = MaaJson.Boolean(row, "DefinitionKnown", true) || MaaWaitPolicy.Supports(MaaJson.Text(row, "Entry"));
                var origin = row["Origin"] as JsonObject;
                return (JsonNode)new JsonObject { ["Id"] = row["Id"]!.DeepClone(), ["SourceId"] = row["SourceId"]!.DeepClone(),
                    ["Name"] = known ? row["Name"]?.DeepClone() : null, ["Entry"] = known ? row["Entry"]?.DeepClone() : null,
                    ["Order"] = row["Order"]!.DeepClone(), ["Enabled"] = row["Enabled"]!.DeepClone(), ["RepeatCount"] = row["RepeatCount"]!.DeepClone(),
                    ["Role"] = row["Role"]!.DeepClone(), ["DefinitionKnown"] = known,
                    ["Origin"] = origin is null ? null : Select(origin, "Kind", "Path", "Pointer", "Index"),
                    ["Options"] = MaaEditorSchema.Selections(MaaImportRules.Data(row["Options"]), declaration) };
            }).ToArray()));
        }
        var publicProfile = Select(profile, "Kind", "InstanceId", "Controller", "Resource", "SourceSchema");
        publicProfile["Tasks"] = Rows("Tasks"); publicProfile["Pretasks"] = Rows("Pretasks");
        foreach (var key in new[] { "GlobalOptions", "ResourceOptions", "ControllerOptions" })
            publicProfile[key] = Encode(MaaEditorSchema.Selections(MaaImportRules.Data(profile[key]), declaration));
        if (profile["Inheritance"] is JsonObject inheritance) publicProfile["Inheritance"] = Select(inheritance, "GlobalPath", "RequestedConfig", "ResolvedConfig");
        var diagnostics = bundle.BlockingDiagnostics.Select(issue => (JsonNode)new JsonObject { ["code"] = issue.Code,
            ["stage"] = issue.Stage is "import" or "semantic" ? issue.Stage : "compilation", ["severity"] = "blocking" }).ToList();
        if (schema.Omitted > 0) diagnostics.Add(new JsonObject { ["code"] = "maa_editor_schema_filtered", ["stage"] = "projection", ["severity"] = "info" });
        var index = MaaCompilationBundle.Serialize(new { format = "maa.editor.index", version = 1,
            compilation = new { bundleArtifactSha256 = bundle.ArtifactSha256, bundleIndexSha256 = bundle.IndexSha256,
                snapshotFingerprint = bundle.SnapshotFingerprint, sourceFingerprint = bundle.SourceFingerprint,
                compilationFingerprint = bundle.Pi.CompilationFingerprint, semanticFingerprint = bundle.SemanticFingerprint, canExecute = bundle.CanExecute },
            selection = Select(MaaJson.Object(artifact["selection"]), "InterfacePath", "ClientKind", "Language", "Source", "Runtime"),
            schema = Encode(publicSchema), translations = Encode(translations), profile = publicProfile,
            configurationBindings = Encode(new JsonArray(MaaJson.Objects(artifact["configurationBindings"]).Select(binding => (JsonNode)Select(binding,
                "Path", "ResourceId", "Revision", "SourceSha256", "RelativePath", "ContractRevision", "ContractSha256", "SnapshotSha256")).ToArray())),
            diagnostics = Encode(new JsonArray(diagnostics.ToArray())),
            privacy = new { schemaOnly = false, savedInputValuesAvailable = "declared-nonsecret-fields", protectedInputValuesAvailable = false, rawConfigurationAvailable = false,
                pipelineAvailable = false, unknownMetadataAvailable = false, translations = "referenced-display-fields" } }, maximumIndexBytes);
        if (pages.Contents.Values.Sum(page => (long)page.Length) + index.Length > 32 * 1024 * 1024) throw new MaaInputFailure("maa_editor_budget");
        return new(index, MaaCompilationBundle.Hash(index), pages.Contents.ToDictionary(pair => pair.Key, pair => pair.Value.ToArray(), StringComparer.Ordinal));
    }
    internal static JsonObject Restore(MaaEditorArtifact editor)
    {
        if (MaaCompilationBundle.Hash(editor.Index) != editor.IndexSha256) throw new MaaInputFailure("maa_editor_changed");
        var index = MaaJson.Read(editor.Index); var pages = new MaaProjectionPages();
        foreach (var page in editor.Pages) pages.Contents.Add(page.Key, page.Value);
        foreach (var key in new[] { "schema", "translations", "configurationBindings", "diagnostics" }) index[key] = pages.Decode(MaaJson.Object(index[key]));
        var profile = MaaJson.Object(index["profile"]);
        foreach (var key in new[] { "Tasks", "Pretasks", "GlobalOptions", "ResourceOptions", "ControllerOptions" }) profile[key] = pages.Decode(MaaJson.Object(profile[key]));
        pages.RequireComplete(); return index;
    }
    private static JsonObject Select(JsonObject source, params string[] names)
    {
        var result = new JsonObject(); foreach (var name in names) if (source.TryGetPropertyValue(name, out var value)) result[name] = value?.DeepClone();
        return result;
    }
}
