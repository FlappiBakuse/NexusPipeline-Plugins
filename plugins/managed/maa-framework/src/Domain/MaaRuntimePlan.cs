using System.Text.Json;
using System.Text.Json.Nodes;

namespace NexusPipeline.Extensions.MaaFramework;

internal sealed class MaaRuntimePlan
{
    private readonly MaaSemanticPlan semantic;
    private readonly MaaImportedProfile profile;
    private MaaRuntimePlan(MaaSemanticPlan semantic, MaaImportedProfile profile, MaaRuntimeSelection? runtime, string interfacePath)
    { this.semantic = semantic; this.profile = profile; Runtime = runtime; InterfacePath = interfacePath; }

    internal string Fingerprint => semantic.Fingerprint;
    internal JsonObject Controller => MaaJson.Clone(semantic.Controller);
    internal JsonObject Resource => MaaJson.Clone(semantic.Resource);
    internal JsonObject Connection => MaaJson.Clone(profile.Connection);
    internal JsonNode? Agent => semantic.Agent?.DeepClone();
    internal string[] ResourcePaths => semantic.ResourcePaths.ToArray();
    internal MaaProgramSpec[] Programs => semantic.Programs.Select(item => item with { Arguments = item.Arguments.ToArray(), Options = item.Options is null ? null : MaaJson.Clone(item.Options) }).ToArray();
    internal MaaRuntimeSelection? Runtime { get; }
    internal string InterfacePath { get; }
    internal MaaTaskOccurrence[] Pretasks => Read<MaaTaskOccurrence[]>(JsonSerializer.SerializeToNode(semantic.Pretasks));

    internal static MaaRuntimePlan Read(ReadOnlyMemory<byte> artifact, ReadOnlyMemory<byte> piArtifact,
        JsonElement frozenView, CancellationToken cancellation = default)
    {
        cancellation.ThrowIfCancellationRequested();
        if (artifact.Length < 1 || piArtifact.Length < 1 ||
            (long)artifact.Length + piArtifact.Length > MaaCompilationBundle.MaximumBundleBytes)
            throw new MaaInputFailure("maa_runtime_plan_budget");
        var viewBytes = JsonSerializer.SerializeToUtf8Bytes(frozenView);
        if (viewBytes.Length > MaaCompilationBundle.MaximumExecutionBytes) throw new MaaInputFailure("maa_runtime_view_budget");
        var view = MaaJson.Read(viewBytes);
        if (MaaJson.Required(view, "artifactSha256") != MaaCompilationBundle.Hash(artifact.Span))
            throw new MaaInputFailure("maa_runtime_plan_unbound");
        var full = MaaJson.Read(artifact);
        if (MaaJson.Required(view, "format") != "maa-internal-execution" || view["version"]?.GetValue<int>() != 1 ||
            MaaJson.Required(full, "kind") != "maa-internal-compilation" || full["version"]?.GetValue<int>() != 1 ||
            !MaaJson.Boolean(view, "canExecute") || !MaaJson.Boolean(full, "canExecute"))
            throw new MaaInputFailure("maa_runtime_plan_unbound");
        foreach (var field in new[] { "snapshotFingerprint", "compilationFingerprint", "sourceFingerprint", "semanticFingerprint" })
            if (MaaJson.Required(full, field) != MaaJson.Required(view, field)) throw new MaaInputFailure("maa_runtime_plan_unbound");
        var reference = MaaJson.Object(MaaJson.Object(full["pi"])["artifact"]);
        if (MaaJson.Required(reference, "sha256") != MaaCompilationBundle.Hash(piArtifact.Span) ||
            reference["bytes"]?.GetValue<int>() != piArtifact.Length) throw new MaaInputFailure("maa_runtime_pi_unbound");
        var project = Project(MaaJson.Read(piArtifact)); var profile = Profile(MaaJson.Object(full["profile"]));
        if (project.CompilationFingerprint != MaaJson.Required(full, "compilationFingerprint") ||
            profile.SourceFingerprint != MaaJson.Required(full, "sourceFingerprint") ||
            project.SourceFingerprint != MaaSourceSet.Hash(project.Sources) || profile.SourceFingerprint != MaaSourceSet.Hash(profile.Sources))
            throw new MaaInputFailure("maa_runtime_sources_changed");
        var runtime = MaaRuntimeSelection.Read(full["selection"]?["Runtime"]);
        var semantic = MaaSemanticCompiler.Compile(project, profile, cancellation, runtime);
        if (semantic.Fingerprint != MaaJson.Required(full, "semanticFingerprint") ||
            !JsonNode.DeepEquals(JsonSerializer.SerializeToNode(semantic), full["semantic"]))
            throw new MaaInputFailure("maa_runtime_semantic_changed");
        var diagnostics = Read<MaaCompilationDiagnostic[]>(full["blockingDiagnostics"]);
        if (diagnostics.Length != 0) throw new MaaInputFailure("maa_runtime_plan_blocked");
        var expected = MaaExecutionProjection.Build(MaaCompilationBundle.Hash(artifact.Span), MaaJson.Required(full, "snapshotFingerprint"),
            project, profile, semantic, diagnostics, Read<MaaConfigBinding[]>(full["configurationBindings"]), MaaCompilationBundle.MaximumExecutionBytes);
        if (!JsonNode.DeepEquals(MaaJson.Read(expected), view)) throw new MaaInputFailure("maa_runtime_view_changed");
        cancellation.ThrowIfCancellationRequested();
        return new(semantic, profile, runtime, project.InterfacePath);
    }

    internal MaaCompiledTask[] Select(IReadOnlyList<string> occurrenceIds)
    {
        if (occurrenceIds.Count == 0 || occurrenceIds.Count > semantic.Tasks.Length ||
            occurrenceIds.Any(string.IsNullOrWhiteSpace) || occurrenceIds.Distinct(StringComparer.Ordinal).Count() != occurrenceIds.Count)
            throw new MaaInputFailure("maa_runtime_selection_invalid");
        var selected = occurrenceIds.ToHashSet(StringComparer.Ordinal);
        var tasks = semantic.Tasks.Where(task => selected.Contains(task.OccurrenceId)).ToArray();
        if (tasks.Length != selected.Count) throw new MaaInputFailure("maa_runtime_selection_unmapped");
        return tasks.Select(task => task with { Pipeline = MaaJson.Clone(task.Pipeline) }).ToArray();
    }

    private static MaaPiProject Project(JsonObject full)
    {
        if (MaaJson.Required(full, "kind") != "maa-internal-full-project") throw new MaaInputFailure("maa_runtime_pi_unbound");
        var result = new MaaPiProject(MaaJson.Required(full, "InterfacePath"), MaaJson.Object(full["declaration"]),
            MaaJson.Object(full["translations"]), Read<MaaSourceProof[]>(full["Sources"]),
            MaaJson.Required(full, "SourceFingerprint"), MaaJson.Required(full, "ClientKind"));
        if (MaaJson.Required(full, "compilationFingerprint") != result.CompilationFingerprint) throw new MaaInputFailure("maa_runtime_pi_changed");
        return result;
    }

    private static MaaImportedProfile Profile(JsonObject full) => new(MaaJson.Required(full, "Kind"), MaaJson.Required(full, "InstanceId"),
        MaaJson.Required(full, "Controller"), MaaJson.Required(full, "Resource"),
        Read<MaaTaskOccurrence[]>(full["Tasks"]), Read<MaaTaskOccurrence[]>(full["Pretasks"]), MaaJson.Object(full["GlobalOptions"]),
        MaaJson.Object(full["ResourceOptions"]), MaaJson.Object(full["ControllerOptions"]), MaaJson.Object(full["Connection"]),
        MaaJson.Object(full["SourceSnapshot"]), Read<MaaSourceProof[]>(full["Sources"]), MaaJson.Required(full, "SourceFingerprint"),
        MaaJson.Text(full, "SourceSchema"), MaaJson.Required(full, "PiFingerprint")) {
        Inheritance = full["Inheritance"] is null ? null : Read<MaaProfileInheritance>(full["Inheritance"])
    };

    private static T Read<T>(JsonNode? node) => node is null ? throw new MaaInputFailure("maa_runtime_field_missing") :
        node.Deserialize<T>() ?? throw new MaaInputFailure("maa_runtime_field_invalid");
}
