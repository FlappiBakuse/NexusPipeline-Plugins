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
    internal static JsonObject Restore(MaaProjectionArtifact projection, string expectedCompilationFingerprint)
    {
        if (projection.CompilationFingerprint != expectedCompilationFingerprint || Hash(projection.Artifact) != projection.ArtifactSha256 ||
            Hash(projection.View) != projection.ViewSha256 || projection.Pages.Count > 4096 ||
            projection.Pages.Values.Sum(page => (long)page.Length) > 32 * 1024 * 1024) throw new MaaInputFailure("maa_projection_changed");
        var full = MaaJson.Read(projection.Artifact); var view = MaaJson.Read(projection.View);
        if (MaaJson.Required(full, "compilationFingerprint") != expectedCompilationFingerprint ||
            MaaJson.Required(view, "compilationFingerprint") != expectedCompilationFingerprint ||
            MaaJson.Required(MaaJson.Object(view["artifact"]), "sha256") != projection.ArtifactSha256)
            throw new MaaInputFailure("maa_projection_binding_invalid");
        var pages = new MaaProjectionPages();
        foreach (var pair in projection.Pages) pages.Contents.Add(pair.Key, pair.Value);
        var source = MaaJson.Object(full["declaration"]); var restored = MaaJson.Object(pages.Decode(MaaJson.Object(view["metadata"])));
        var translations = pages.Decode(MaaJson.Object(view["translations"]));
        var encoded = JsonSerializer.Deserialize<MaaProjectionBinding[]>(pages.Decode(MaaJson.Object(view["externalized"]))!.ToJsonString())
            ?? throw new MaaInputFailure("maa_projection_binding_invalid");
        if (encoded.Length != projection.Bindings.Length || !encoded.SequenceEqual(projection.Bindings))
            throw new MaaInputFailure("maa_projection_binding_invalid");
        foreach (var binding in encoded)
        {
            var parts = Parts(binding.Pointer); var original = Find(source, parts);
            var bytes = JsonSerializer.SerializeToUtf8Bytes(original);
            if (parts[^1] != "pipeline_override" || bytes.Length != binding.Bytes || Hash(bytes) != binding.Sha256)
                throw new MaaInputFailure("maa_projection_part_changed");
            var parent = Find(restored, parts[..^1]) as JsonObject ?? throw new MaaInputFailure("maa_projection_pointer_invalid");
            if (parent.ContainsKey(parts[^1])) throw new MaaInputFailure("maa_projection_pointer_invalid");
            parent[parts[^1]] = original?.DeepClone();
        }
        pages.RequireComplete();
        if (!JsonNode.DeepEquals(source, restored) || !JsonNode.DeepEquals(full["translations"], translations))
            throw new MaaInputFailure("maa_projection_not_lossless");
        return restored;
    }
    private static JsonNode? Find(JsonNode? node, string[] path)
    {
        foreach (var part in path)
        {
            if (node is JsonObject obj && obj.TryGetPropertyValue(part, out var child)) node = child;
            else if (node is JsonArray array && int.TryParse(part, System.Globalization.NumberStyles.None,
                System.Globalization.CultureInfo.InvariantCulture, out var index) && index < array.Count) node = array[index];
            else throw new MaaInputFailure("maa_projection_pointer_invalid");
        }
        return node;
    }
    private static string[] Parts(string pointer)
    {
        if (!pointer.StartsWith('/') || pointer.Split('/').Length > 66) throw new MaaInputFailure("maa_projection_pointer_invalid");
        return pointer[1..].Split('/').Select(part => part.Replace("~1", "/", StringComparison.Ordinal).Replace("~0", "~", StringComparison.Ordinal)).ToArray();
    }
    private static string Escape(string value) => value.Replace("~", "~0", StringComparison.Ordinal).Replace("/", "~1", StringComparison.Ordinal);
    private static string Hash(byte[] bytes) => Convert.ToHexStringLower(SHA256.HashData(bytes));
}
