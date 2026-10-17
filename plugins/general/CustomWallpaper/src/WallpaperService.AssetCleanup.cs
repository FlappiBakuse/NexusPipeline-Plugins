using System.Text.Json.Nodes;
using System.Text.Json.Serialization;

namespace NexusPipeline.Plugin.CustomWallpaper;

internal sealed partial class WallpaperService
{
    private const string CleanupScope = "asset-cleanup";
    private sealed class AssetCleanupJournal
    {
        [JsonPropertyName("schemaVersion")]
        public int SchemaVersion { get; set; } = 1;
        [JsonPropertyName("assetIds")]
        public List<string> AssetIds { get; set; } = [];
    }

    private async Task<AssetCleanupJournal> ReadCleanupAsync(CancellationToken token)
    {
        var raw = await _scopedData.ReadJsonAsync(CleanupScope, token).ConfigureAwait(false);
        if (raw is null) return new();
        if (raw.Count != 2 || raw["schemaVersion"] is not JsonValue schema
            || !schema.TryGetValue<int>(out int version) || version != 1 || raw["assetIds"] is not JsonArray ids
            || ids.Any(id => id is not JsonValue value || !value.TryGetValue<string>(out _)))
            throw new WallpaperException("unsupported_cleanup_state", "壁纸资产清理状态未知，已保留现场");
        var journal = new AssetCleanupJournal { AssetIds = ids.Select(id => id!.GetValue<string>()).ToList() };
        if (journal.AssetIds is null
            || journal.AssetIds.Any(id => id is null || id.Length != 64 || id.Any(c => !char.IsAsciiHexDigitLower(c)))
            || journal.AssetIds.Distinct(StringComparer.Ordinal).Count() != journal.AssetIds.Count)
            throw new WallpaperException("unsupported_cleanup_state", "壁纸资产清理状态未知，已保留现场");
        return journal;
    }

    private async Task RecordCleanupAsync(string assetId, CancellationToken token)
    {
        var journal = await ReadCleanupAsync(token).ConfigureAwait(false);
        if (journal.AssetIds.Contains(assetId, StringComparer.Ordinal)) return;
        journal.AssetIds.Add(assetId);
        await _scopedData.WriteAsync(CleanupScope, journal, token).ConfigureAwait(false);
    }

    private async Task RecoverAssetCleanupAsync(string assetId, CancellationToken token)
    {
        var journal = await ReadCleanupAsync(token).ConfigureAwait(false);
        if (!journal.AssetIds.Contains(assetId, StringComparer.Ordinal)) return;
        // A write may have committed before reporting failure. Durable references always protect the asset.
        var committed = await LoadConfigAsync(token).ConfigureAwait(false);
        if (!committed.Assets.Any(asset => string.Equals(asset.Id, assetId, StringComparison.OrdinalIgnoreCase)))
            await _assets.DeleteAsync(AssetScope, assetId, token).ConfigureAwait(false);
        journal.AssetIds.Remove(assetId);
        await _scopedData.WriteAsync(CleanupScope, journal, token).ConfigureAwait(false);
    }

    private async Task TryRecoverAssetCleanupAsync(string assetId)
    {
        using var deadline = new CancellationTokenSource(TimeSpan.FromSeconds(10));
        try { await RecoverAssetCleanupAsync(assetId, deadline.Token).ConfigureAwait(false); }
        catch { _logger.Warn("壁纸资产清理尚未完成，已保留精确清理记录供下次启动重试。"); }
    }
}
