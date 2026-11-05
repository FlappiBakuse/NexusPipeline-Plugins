using System.Security.Cryptography;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace NexusPipeline.Extensions.MaaFramework;

internal sealed record MaaCompilationSelection(string InterfacePath, string ClientKind, string Language, MaaImportSelection Source)
{
    [System.Text.Json.Serialization.JsonIgnore(Condition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull)]
    public JsonObject? Profile { get; init; }
    [System.Text.Json.Serialization.JsonIgnore(Condition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull)]
    public string? Preset { get; init; }
    [System.Text.Json.Serialization.JsonIgnore(Condition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull)]
    public MaaRuntimeSelection? Runtime { get; init; }
}
internal sealed record MaaCompilationBundle(byte[] Artifact, string ArtifactSha256, byte[] Index, string IndexSha256, byte[] Execution, string ExecutionSha256,
    MaaProjectionArtifact Pi, string SourceFingerprint, string? SemanticFingerprint, string SnapshotFingerprint,
    bool CanExecute, MaaCompilationDiagnostic[] BlockingDiagnostics)
{
    internal const int MaximumExecutionBytes = 262144;
    internal const int MaximumBundleBytes = 32 * 1024 * 1024;

    internal static MaaCompilationBundle Build(MaaSourceSet sources, MaaCompilationSelection selection,
        int maximumExecutionBytes = MaximumExecutionBytes, CancellationToken cancellationToken = default)
    {
        RequireSelection(selection, maximumExecutionBytes);
        cancellationToken.ThrowIfCancellationRequested();
        return Build(Prepare(sources, selection, cancellationToken), sources, selection, maximumExecutionBytes, cancellationToken);
    }

    internal static MaaCompilationBundle Build(MaaCompilationState state, MaaSourceSet sources, MaaCompilationSelection selection,
        int maximumExecutionBytes = MaximumExecutionBytes, CancellationToken cancellationToken = default)
    {
        RequireSelection(selection, maximumExecutionBytes);
        cancellationToken.ThrowIfCancellationRequested();
        var project = state.Project; var profile = state.Profile; var semantic = state.Semantic;
        var pi = MaaCompactProjection.Build(project);
        var profileJson = JsonSerializer.SerializeToNode(profile)!.AsObject();
        profileJson.Add("SourceSnapshot", profile.SourceSnapshot.DeepClone());
        var semanticJson = semantic is null ? null : JsonSerializer.SerializeToNode(semantic)!.AsObject();
        var artifact = Serialize(new {
            kind = "maa-internal-compilation", version = 1, selection,
            snapshotFingerprint = sources.SnapshotFingerprint, snapshotSources = sources.SnapshotProofs,
            sourceFingerprint = profile.SourceFingerprint, compilationFingerprint = project.CompilationFingerprint,
            semanticFingerprint = semantic?.Fingerprint, canExecute = semantic is not null, blockingDiagnostics = state.Diagnostics,
            configurationBindings = sources.ConfigurationBindings,
            pi = new { artifact = Reference(pi.Artifact), view = Reference(pi.View),
                pages = pi.Pages.OrderBy(pair => pair.Key, StringComparer.Ordinal).Select(pair => Reference(pair.Value)).ToArray() },
            profile = profileJson, semantic = semanticJson }, MaximumBundleBytes);
        var artifactSha = Hash(artifact);
        var execution = MaaExecutionProjection.Build(artifactSha, sources.SnapshotFingerprint, project, profile, semantic, state.Diagnostics, sources.ConfigurationBindings, maximumExecutionBytes);
        var index = Serialize(new { kind = "maa-internal-compilation-index", version = 1,
            artifact = Reference(artifact), execution = Reference(execution), piView = Reference(pi.View),
            sourceFingerprint = profile.SourceFingerprint, compilationFingerprint = project.CompilationFingerprint,
            semanticFingerprint = semantic?.Fingerprint, canExecute = semantic is not null, snapshotFingerprint = sources.SnapshotFingerprint }, 65536);
        var result = new MaaCompilationBundle(artifact, artifactSha, index, Hash(index), execution, Hash(execution), pi,
            profile.SourceFingerprint, semantic?.Fingerprint, sources.SnapshotFingerprint, semantic is not null, state.Diagnostics);
        result.RequireBudget(maximumExecutionBytes); cancellationToken.ThrowIfCancellationRequested();
        return result;
    }

    private static void RequireSelection(MaaCompilationSelection selection, int maximumExecutionBytes)
    {
        if (maximumExecutionBytes is < 1 or > MaximumExecutionBytes || selection is null || selection.Source is null ||
            string.IsNullOrEmpty(selection.Language) || selection.Language.Length > 128 || selection.Language.Any(char.IsControl))
            throw new MaaInputFailure("maa_compilation_selection_invalid");
    }

    internal JsonObject Verify(MaaSourceSet frozenSources, string expectedArtifactSha256,
        CancellationToken cancellationToken = default)
    {
        RequireBudget(MaximumExecutionBytes);
        if (ArtifactSha256 != expectedArtifactSha256 || Hash(Artifact) != ArtifactSha256 || Hash(Execution) != ExecutionSha256 || Hash(Index) != IndexSha256 ||
            SnapshotFingerprint != frozenSources.SnapshotFingerprint) throw new MaaInputFailure("maa_compilation_changed");
        var artifact = MaaJson.Read(Artifact);
        var selection = JsonSerializer.Deserialize<MaaCompilationSelection>(artifact["selection"]!.ToJsonString())
            ?? throw new MaaInputFailure("maa_compilation_selection_invalid");
        _ = MaaCompactProjection.Restore(Pi, MaaJson.Required(artifact, "compilationFingerprint"));
        var expected = Build(frozenSources, selection, cancellationToken: cancellationToken);
        if (!Artifact.AsSpan().SequenceEqual(expected.Artifact) || !Index.AsSpan().SequenceEqual(expected.Index) || !Execution.AsSpan().SequenceEqual(expected.Execution) ||
            SourceFingerprint != expected.SourceFingerprint || SemanticFingerprint != expected.SemanticFingerprint || CanExecute != expected.CanExecute ||
            !BlockingDiagnostics.SequenceEqual(expected.BlockingDiagnostics) ||
            !Pi.Artifact.AsSpan().SequenceEqual(expected.Pi.Artifact) || !Pi.View.AsSpan().SequenceEqual(expected.Pi.View) ||
            Pi.ArtifactSha256 != expected.Pi.ArtifactSha256 || Pi.ViewSha256 != expected.Pi.ViewSha256)
            throw new MaaInputFailure("maa_compilation_changed");
        return MaaJson.Read(Execution);
    }
    internal static MaaCompilationState Prepare(MaaSourceSet sources, MaaCompilationSelection selection, CancellationToken cancellation)
    {
        var project = new MaaPiCompiler(sources, selection.ClientKind).Compile(selection.InterfacePath, selection.Language, cancellation);
        var rules = new MaaCompilationPolicy(true); var profile = new MaaProjectImport(sources, project, rules).Import(selection.Source);
        if (selection.Profile is not null || selection.Preset is not null) rules.RevalidateProfile();
        if (selection.Preset is not null) profile = MaaPreset.Apply(project, profile, selection.Preset);
        if (selection.Profile is not null) profile = MaaProfileDraft.Apply(project, profile, selection.Profile, rules);
        MaaSemanticPlan? semantic = null;
        if (rules.Diagnostics.Length == 0)
        {
            try { semantic = MaaSemanticCompiler.Compile(project, profile, cancellation, selection.Runtime); }
            catch (MaaBusinessFailure failure) { rules.Block(failure.Code, "semantic"); }
            if (semantic is { Programs.Length: > 0 } && selection.Runtime?.NativeDirectory is null)
            {
                rules.Block("maa_project_runtime_selection_required", "runtime"); semantic = null;
            }
        }
        return new(project, profile, semantic, rules.Diagnostics);
    }

    private void RequireBudget(int maximumExecutionBytes)
    {
        var contents = new[] { Artifact, Index, Execution, Pi.Artifact, Pi.View }.Concat(Pi.Pages.Values).ToArray();
        if (Artifact.Length < 1 || Index.Length is < 1 or > 65536 || Execution.Length < 1 || Execution.Length > maximumExecutionBytes ||
            contents.GroupBy(content => Hash(content), StringComparer.Ordinal).Sum(group => (long)group.First().Length) > MaximumBundleBytes)
            throw new MaaInputFailure("maa_compilation_bundle_budget");
    }
    internal static JsonObject Reference(ReadOnlyMemory<byte> bytes) => new() { ["sha256"] = Hash(bytes.Span), ["bytes"] = bytes.Length };
    internal static string Hash(ReadOnlySpan<byte> bytes) => Convert.ToHexStringLower(SHA256.HashData(bytes));
    internal static byte[] Serialize<T>(T value, int maximumBytes)
    {
        using var output = new BudgetStream(maximumBytes);
        JsonSerializer.Serialize(output, value); return output.ToArray();
    }
    private sealed class BudgetStream(int maximumBytes) : MemoryStream
    {
        public override void Write(byte[] buffer, int offset, int count) { Require(count); base.Write(buffer, offset, count); }
        public override void Write(ReadOnlySpan<byte> buffer) { Require(buffer.Length); base.Write(buffer); }
        public override void WriteByte(byte value) { Require(1); base.WriteByte(value); }
        private void Require(int count)
        { if (Length + count > maximumBytes) throw new MaaInputFailure("maa_compilation_serialization_budget"); }
    }
}
