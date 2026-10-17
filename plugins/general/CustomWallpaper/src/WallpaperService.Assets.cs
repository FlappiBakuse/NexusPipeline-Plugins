using System.Security.Cryptography;
using System.Text.Json;
using System.Text.Json.Nodes;
using NexusPipeline.Plugin.Abstractions;

namespace NexusPipeline.Plugin.CustomWallpaper;

internal sealed partial class WallpaperService
{
    public async Task<JsonObject> UploadAsync(
        Stream content,
        string? contentType,
        string? originalName,
        long declaredLength,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(content);
        string mime = (contentType ?? "").Split(';', 2)[0].Trim().ToLowerInvariant();
        if (!AllowedMimeTypes.Contains(mime))
        {
            throw new WallpaperException("invalid_type", "壁纸仅支持 JPEG、PNG 或 WebP");
        }
        if (declaredLength > MaxAssetBytes)
        {
            throw new WallpaperException("too_large", "壁纸文件不能超过 8192 KB");
        }

        byte[] bytes;
        using (var buffer = new MemoryStream())
        {
            byte[] chunk = new byte[64 * 1024];
            while (true)
            {
                int read = await content.ReadAsync(chunk, cancellationToken).ConfigureAwait(false);
                if (read == 0)
                {
                    break;
                }
                if (buffer.Length + read > MaxAssetBytes)
                {
                    throw new WallpaperException("too_large", "壁纸文件不能超过 8192 KB");
                }
                buffer.Write(chunk, 0, read);
            }
            bytes = buffer.ToArray();
        }
        ValidateImageHeader(mime, bytes);
        string assetId = Convert.ToHexString(SHA256.HashData(bytes)).ToLowerInvariant();

        await _sync.WaitAsync(cancellationToken).ConfigureAwait(false);
        try
        {
            WallpaperConfig config = await LoadConfigAsync(cancellationToken).ConfigureAwait(false);
            WallpaperAssetRecord? duplicate = config.Assets.FirstOrDefault(
                item => string.Equals(item.Id, assetId, StringComparison.OrdinalIgnoreCase));
            if (duplicate is not null)
            {
                EnsureInOrder(config, duplicate.Id);
                await SaveConfigAsync(config, cancellationToken).ConfigureAwait(false);
                WallpaperCurrentState current = await ResolveCurrentAsync(config, cancellationToken).ConfigureAwait(false);
                return new JsonObject
                {
                    ["ok"] = true,
                    ["duplicate"] = true,
                    ["asset"] = ToAssetDto(duplicate),
                    ["state"] = BuildState(config, current),
                };
            }
            if (config.Assets.Count >= MaxAssets)
            {
                throw new WallpaperException("quota_count", "壁纸数量不能超过 32 张");
            }
            if (config.Assets.Sum(item => item.SizeBytes) + bytes.LongLength > MaxTotalBytes)
            {
                throw new WallpaperException("quota_total", "壁纸总容量不能超过 256 MiB");
            }

            var record = new WallpaperAssetRecord
            {
                Id = assetId,
                OriginalName = SanitizeFileName(originalName, assetId + ExtensionFor(mime)),
                MimeType = mime,
                SizeBytes = bytes.LongLength,
                CreatedAt = _utcNow(),
                PaletteVersion = 0,
                Palette = new Dictionary<string, string>(StringComparer.Ordinal),
            };
            bool written = false;
            try
            {
                await using var source = new MemoryStream(bytes, writable: false);
                PluginAssetInfo info = await _assets.WriteAsync(AssetScope, ExtensionFor(mime).TrimStart('.'), source, cancellationToken)
                    .ConfigureAwait(false);
                written = true;
                if (!string.Equals(info.Id, assetId, StringComparison.OrdinalIgnoreCase))
                {
                    throw new WallpaperException("storage_mismatch", "资产存储返回的内容标识与内容不一致");
                }
                config.Assets.Add(record);
                EnsureInOrder(config, record.Id);
                if (string.IsNullOrWhiteSpace(config.SelectedId))
                {
                    config.SelectedId = record.Id;
                }
                config.Revision = Math.Max(1, config.Revision + 1);
                config.UpdatedAt = _utcNow();
                await SaveConfigAsync(config, cancellationToken).ConfigureAwait(false);
            }
            catch
            {
                if (written)
                {
                    await _assets.DeleteAsync(AssetScope, assetId, cancellationToken).ConfigureAwait(false);
                }
                throw;
            }
            WallpaperCurrentState currentId = await ResolveCurrentAsync(config, cancellationToken).ConfigureAwait(false);
            return new JsonObject
            {
                ["ok"] = true,
                ["duplicate"] = false,
                ["asset"] = ToAssetDto(record),
                ["state"] = BuildState(config, currentId),
            };
        }
        finally
        {
            _sync.Release();
        }
    }

    public async Task<JsonObject> DeleteAsync(string assetId, CancellationToken cancellationToken = default)
    {
        await _sync.WaitAsync(cancellationToken).ConfigureAwait(false);
        try
        {
            WallpaperConfig config = await LoadConfigAsync(cancellationToken).ConfigureAwait(false);
            WallpaperAssetRecord asset = FindAsset(config, assetId);
            config.Assets.Remove(asset);
            config.Order.RemoveAll(id => string.Equals(id, asset.Id, StringComparison.OrdinalIgnoreCase));
            if (string.Equals(config.SelectedId, asset.Id, StringComparison.OrdinalIgnoreCase))
            {
                config.SelectedId = config.Order.FirstOrDefault() ?? "";
            }
            config.Revision = Math.Max(1, config.Revision + 1);
            config.UpdatedAt = _utcNow();
            await SaveConfigAsync(config, cancellationToken).ConfigureAwait(false);
            await _assets.DeleteAsync(AssetScope, asset.Id, cancellationToken).ConfigureAwait(false);
            WallpaperCurrentState currentId = await ResolveCurrentAsync(config, cancellationToken).ConfigureAwait(false);
            return BuildState(config, currentId);
        }
        finally
        {
            _sync.Release();
        }
    }

    public async Task<JsonObject> SavePaletteAsync(string assetId, JsonObject palette, CancellationToken cancellationToken = default)
    {
        await _sync.WaitAsync(cancellationToken).ConfigureAwait(false);
        try
        {
            WallpaperConfig config = await LoadConfigAsync(cancellationToken).ConfigureAwait(false);
            WallpaperAssetRecord asset = FindAsset(config, assetId);
            asset.Palette = ParsePalette(palette);
            asset.PaletteVersion = PaletteVersion;
            config.Revision = Math.Max(1, config.Revision + 1);
            config.UpdatedAt = _utcNow();
            await SaveConfigAsync(config, cancellationToken).ConfigureAwait(false);
            WallpaperCurrentState currentId = await ResolveCurrentAsync(config, cancellationToken).ConfigureAwait(false);
            return BuildState(config, currentId);
        }
        finally
        {
            _sync.Release();
        }
    }

    public async Task<PluginAssetContent?> OpenAssetAsync(string assetId, CancellationToken cancellationToken = default)
    {
        await _sync.WaitAsync(cancellationToken).ConfigureAwait(false);
        try
        {
            WallpaperConfig config = await LoadConfigAsync(cancellationToken).ConfigureAwait(false);
            WallpaperAssetRecord asset = FindAsset(config, assetId);
            PluginAssetContent? content = await _assets.OpenAsync(AssetScope, asset.Id, cancellationToken).ConfigureAwait(false);
            if (content is null)
            {
                throw new WallpaperException("not_found", "壁纸资源不存在");
            }
            return content;
        }
        finally
        {
            _sync.Release();
        }
    }
}
