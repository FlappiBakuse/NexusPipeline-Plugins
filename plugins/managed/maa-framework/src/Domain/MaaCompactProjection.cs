using System.Security.Cryptography;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace NexusPipeline.Extensions.MaaFramework;

internal sealed record MaaProjectionBinding(string Pointer, string Sha256, int Bytes);
internal sealed record MaaProjectionArtifact(byte[] Artifact, string ArtifactSha256, byte[] View, string ViewSha256,
    string CompilationFingerprint, MaaProjectionBinding[] Bindings, IReadOnlyDictionary<string, byte[]> Pages);

internal static class MaaCompactProjection
{
    internal const int MaximumViewBytes = 524288;
    internal static MaaProjectionArtifact Build(MaaPiProject project, int maximumViewBytes = MaximumViewBytes)
    {
        if (maximumViewBytes is < 1 or > MaximumViewBytes || project.SourceFingerprint != MaaSourceSet.Hash(project.Sources))
            throw new MaaInputFailure("maa_projection_binding_invalid");
        var declaration = MaaJson.Clone(project.Declaration); var bindings = new List<MaaProjectionBinding>();
        Extract(declaration, "", bindings, 0);
        var fingerprint = project.CompilationFingerprint;
        var artifact = JsonSerializer.SerializeToUtf8Bytes(new {
            kind = "maa-internal-full-project", project.InterfacePath, project.ClientKind, project.SourceFingerprint,
            compilationFingerprint = fingerprint, project.Sources, declaration = project.Declaration, translations = project.Translations });
        if (artifact.Length > 32 * 1024 * 1024) throw new MaaInputFailure("maa_projection_artifact_budget");
        var artifactHash = Hash(artifact);
        var pages = new MaaProjectionPages();
        var view = JsonSerializer.SerializeToUtf8Bytes(new {
            kind = "maa-internal-compact-project", project.InterfacePath, project.ClientKind, project.SourceFingerprint,
            compilationFingerprint = fingerprint, project.Sources, artifact = new { sha256 = artifactHash, bytes = artifact.Length },
            metadata = pages.Encode(declaration), translations = pages.Encode(project.Translations),
            externalized = pages.Encode(JsonSerializer.SerializeToNode(bindings)) });
        if (view.Length > maximumViewBytes) throw new MaaInputFailure("maa_projection_view_budget:" + view.Length);
        return new(artifact, artifactHash, view, Hash(view), fingerprint, bindings.ToArray(), pages.Contents);
    }
    private static void Extract(JsonNode? node, string pointer, List<MaaProjectionBinding> bindings, int depth)
    {
        if (depth > 64) throw new MaaInputFailure("maa_projection_depth");
        if (node is JsonObject obj)
        {
            foreach (var pair in obj.ToArray())
            {
                var path = pointer + "/" + Escape(pair.Key);
                if (pair.Key == "pipeline_override" && pair.Value is not null)
                {
                    var bytes = JsonSerializer.SerializeToUtf8Bytes(pair.Value);
                    if (bytes.Length >= 256)
                    { bindings.Add(new(path, Hash(bytes), bytes.Length)); obj.Remove(pair.Key); continue; }
                }
                Extract(pair.Value, path, bindings, depth + 1);
            }
        }
        else if (node is JsonArray array)
            for (var index = 0; index < array.Count; index++) Extract(array[index], pointer + "/" + index, bindings, depth + 1);
    }
    private static string Escape(string value) => value.Replace("~", "~0", StringComparison.Ordinal).Replace("/", "~1", StringComparison.Ordinal);
    private static string Hash(byte[] bytes) => Convert.ToHexStringLower(SHA256.HashData(bytes));
}
