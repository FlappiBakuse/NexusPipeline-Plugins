using System.Text.Json;
using System.Text.Json.Nodes;
using NexusPipeline.Extensibility.Execution;
using NexusPipeline.Extensibility.Protocol;

namespace NexusPipeline.Extensions.MaaFramework;

internal interface IMaaProjectSource
{
    Task<ExecutionProjectResponse> ManifestAsync(CancellationToken cancellation);
    Task<ExecutionProjectResponse> AssetsAsync(long index, CancellationToken cancellation);
    Task<ExecutionProjectResponse> ReadAsync(string name, long offset, int maximumBytes, CancellationToken cancellation);
}

internal sealed class MaaProjectSource(ExecutionProjectReader reader) : IMaaProjectSource
{
    public Task<ExecutionProjectResponse> ManifestAsync(CancellationToken cancellation) => reader.ManifestAsync(cancellation);
    public Task<ExecutionProjectResponse> AssetsAsync(long index, CancellationToken cancellation) => reader.AssetsAsync(index, cancellation);
    public Task<ExecutionProjectResponse> ReadAsync(string name, long offset, int maximumBytes, CancellationToken cancellation)
        => reader.ReadAssetAsync(name, offset, maximumBytes, cancellation);
}

internal static class MaaProjectInputs
{
    internal static async Task<MaaWorkerProject> ReadAsync(IMaaProjectSource source, CancellationToken cancellation, bool initialize = false)
    {
        var manifest = await source.ManifestAsync(cancellation).ConfigureAwait(false);
        if (manifest.Kind != "manifest" || manifest.RootIndex != "project" || manifest.AssetCount is null or < 8 or > 4112 ||
            manifest.View is null || manifest.Selection is null)
            throw new MaaInputFailure("maa_runtime_manifest_invalid");
        var assets = await InventoryAsync(source, manifest, cancellation).ConfigureAwait(false);
        async Task<byte[]> Read(string name, string kind)
        {
            if (!assets.TryGetValue(name, out var asset) || asset.Kind != kind) throw new MaaInputFailure("maa_runtime_asset_missing");
            return await ContentAsync(source, manifest.Fingerprint, asset, cancellation).ConfigureAwait(false);
        }
        var root = MaaJson.Read(await Read("project", "index").ConfigureAwait(false));
        var indexBytes = await Read("bundle-index", "index").ConfigureAwait(false); var index = MaaJson.Read(indexBytes);
        if (MaaJson.Required(root, "kind") != "maa-provider-index" || root["version"]?.GetValue<int>() != 1 ||
            MaaJson.Required(index, "kind") != "maa-internal-compilation-index" || index["version"]?.GetValue<int>() != 1)
            throw new MaaInputFailure("maa_runtime_index_invalid");
        Reference(root["compilation"], indexBytes);
        var artifact = await Read("bundle-artifact", "artifact").ConfigureAwait(false); Reference(index["artifact"], artifact);
        var execution = await Read("execution", "artifact").ConfigureAwait(false); Reference(index["execution"], execution);
        var view = JsonSerializer.SerializeToElement(manifest.View);
        if (!JsonNode.DeepEquals(MaaJson.Read(execution), MaaJson.Read(JsonSerializer.SerializeToUtf8Bytes(view))))
            throw new MaaInputFailure("maa_runtime_execution_unbound");
        var pi = await Read("pi-artifact", "artifact").ConfigureAwait(false);
        return new(MaaRuntimePlan.Read(artifact, pi, view, cancellation), manifest.Selection.ConsumerExtensionId,
            manifest.Selection.BindingId, manifest.Selection.SelectedTaskIds, manifest.Selection.ExecutionTaskIds, initialize,
            manifest.Selection.RepetitionOffsets?.ToDictionary(item => item.TaskId, item => checked((int)item.CompletedRepetitions), StringComparer.Ordinal));
    }

    private static async Task<Dictionary<string, ExecutionProjectResponseAssetsItem>> InventoryAsync(IMaaProjectSource source,
        ExecutionProjectResponse manifest, CancellationToken cancellation)
    {
        var result = new Dictionary<string, ExecutionProjectResponseAssetsItem>(StringComparer.Ordinal);
        long total = 0;
        for (long position = 0; position < manifest.AssetCount;)
        {
            var page = await source.AssetsAsync(position, cancellation).ConfigureAwait(false);
            if (page.Kind != "assets" || page.Fingerprint != manifest.Fingerprint || page.Index != position ||
                page.Assets is not { Count: > 0 and <= 16 } || page.Assets.Count != Math.Min(16, manifest.AssetCount.Value - position))
                throw new MaaInputFailure("maa_runtime_inventory_invalid");
            foreach (var asset in page.Assets)
            {
                if (asset.Name is not { Length: > 0 and <= 120 } || asset.Name.Any(char.IsControl) ||
                    asset.SizeBytes is < 1 or > MaaCompilationBundle.MaximumBundleBytes ||
                    asset.Sha256 is not { Length: 64 } || asset.Sha256.Any(character => !char.IsAsciiHexDigitLower(character)) ||
                    asset.Kind is not ("index" or "artifact" or "page") || !result.TryAdd(asset.Name, asset))
                    throw new MaaInputFailure("maa_runtime_inventory_invalid");
                total += asset.SizeBytes;
                if (total > MaaCompilationBundle.MaximumBundleBytes) throw new MaaInputFailure("maa_runtime_plan_budget");
            }
            position += page.Assets.Count;
        }
        return result;
    }

    private static async Task<byte[]> ContentAsync(IMaaProjectSource source, string fingerprint,
        ExecutionProjectResponseAssetsItem asset, CancellationToken cancellation)
    {
        var bytes = new byte[checked((int)asset.SizeBytes)];
        for (var position = 0; position < bytes.Length;)
        {
            var maximum = Math.Min(131072, bytes.Length - position);
            var response = await source.ReadAsync(asset.Name, position, maximum, cancellation).ConfigureAwait(false);
            if (response.Kind != "asset" || response.Fingerprint != fingerprint || response.Offset != position ||
                response.SizeBytes != asset.SizeBytes || response.Sha256 != asset.Sha256 || response.ContentBase64 is null)
                throw new MaaInputFailure("maa_runtime_content_unbound");
            if (!Convert.TryFromBase64String(response.ContentBase64, bytes.AsSpan(position, maximum), out var count) || count != maximum)
                throw new MaaInputFailure("maa_runtime_content_invalid");
            position += count;
        }
        if (MaaCompilationBundle.Hash(bytes) != asset.Sha256) throw new MaaInputFailure("maa_runtime_content_changed");
        return bytes;
    }

    private static void Reference(JsonNode? node, ReadOnlyMemory<byte> bytes)
    {
        var reference = MaaJson.Object(node);
        if (MaaJson.Required(reference, "sha256") != MaaCompilationBundle.Hash(bytes.Span) || reference["bytes"]?.GetValue<int>() != bytes.Length)
            throw new MaaInputFailure("maa_runtime_reference_changed");
    }
}
