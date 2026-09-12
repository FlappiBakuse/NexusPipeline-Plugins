using System.Security.Cryptography;
using System.Text.Json;
using System.Text.Json.Nodes;
using NexusPipeline.Plugin.Abstractions;

namespace NexusPipeline.Plugin.CustomWallpaper;

/// <summary>
/// 自定义壁纸插件业务核心：配置、配额、文件校验、去重、配色、轮换与旧数据导入全部由插件持有，
/// 宿主只提供通用资产存储与插件 Web API 传输。
/// </summary>
internal sealed class WallpaperService
{
    internal const long MaxAssetBytes = 8L * 1024 * 1024;

    internal const int MaxAssets = 32;

    internal const long MaxTotalBytes = 256L * 1024 * 1024;

    internal const int PaletteVersion = 3;

    internal const string AssetScope = "wallpapers";

    internal const string RotationScope = "rotation";

    internal const string LegacyImportScope = "legacy-appearance-import";

    private static readonly HashSet<string> AllowedMimeTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "image/jpeg",
        "image/png",
        "image/webp",
    };

    private static readonly HashSet<string> AllowedPaletteTokens = new(StringComparer.Ordinal)
    {
        "--accent", "--accent-strong", "--accent-alt", "--accent-soft", "--on-accent", "--focus", "--mask",
        "--wallpaper-card-dark", "--wallpaper-card-dark-soft", "--wallpaper-card-dark-hover", "--wallpaper-card-dark-border",
        "--wallpaper-card-light", "--wallpaper-card-light-soft", "--wallpaper-card-light-hover", "--wallpaper-card-light-border",
    };

    private readonly IPluginConfigStore _configStore;
    private readonly IPluginScopedDataStore _scopedData;
    private readonly IPluginAssetStore _assets;
    private readonly IPluginLogger _logger;
    private readonly Func<DateTimeOffset> _utcNow;
    private readonly SemaphoreSlim _sync = new(1, 1);

    public WallpaperService(
        IPluginConfigStore configStore,
        IPluginScopedDataStore scopedData,
        IPluginAssetStore assets,
        IPluginLogger logger,
        Func<DateTimeOffset>? utcNow = null)
    {
        _configStore = configStore;
        _scopedData = scopedData;
        _assets = assets;
        _logger = logger;
        _utcNow = utcNow ?? (() => DateTimeOffset.UtcNow);
    }

    /// <summary>启动时归一化配置并消费宿主搬迁的旧外观数据。</summary>
    public async Task InitializeAsync(CancellationToken cancellationToken = default)
    {
        await _sync.WaitAsync(cancellationToken).ConfigureAwait(false);
        try
        {
            WallpaperConfig config = await LoadConfigAsync(cancellationToken).ConfigureAwait(false);
            await SaveConfigAsync(config, cancellationToken).ConfigureAwait(false);
            await ImportLegacyAsync(cancellationToken).ConfigureAwait(false);
        }
        finally
        {
            _sync.Release();
        }
    }

    public async Task<JsonObject> GetStateAsync(CancellationToken cancellationToken = default)
    {
        await _sync.WaitAsync(cancellationToken).ConfigureAwait(false);
        try
        {
            WallpaperConfig config = await LoadConfigAsync(cancellationToken).ConfigureAwait(false);
            string currentId = await ResolveCurrentAsync(config, cancellationToken).ConfigureAwait(false);
            return BuildState(config, currentId);
        }
        finally
        {
            _sync.Release();
        }
    }

    public async Task<JsonObject> ApplySettingsAsync(JsonObject patch, CancellationToken cancellationToken = default)
    {
        await _sync.WaitAsync(cancellationToken).ConfigureAwait(false);
        try
        {
            WallpaperConfig config = await LoadConfigAsync(cancellationToken).ConfigureAwait(false);
            ApplyPatch(config, patch ?? new JsonObject());
            config.Revision = Math.Max(1, config.Revision + 1);
            config.UpdatedAt = _utcNow();
            await SaveConfigAsync(config, cancellationToken).ConfigureAwait(false);
            string currentId = await ResolveCurrentAsync(config, cancellationToken).ConfigureAwait(false);
            return BuildState(config, currentId);
        }
        finally
        {
            _sync.Release();
        }
    }

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
                string current = await ResolveCurrentAsync(config, cancellationToken).ConfigureAwait(false);
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
            string currentId = await ResolveCurrentAsync(config, cancellationToken).ConfigureAwait(false);
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
            string currentId = await ResolveCurrentAsync(config, cancellationToken).ConfigureAwait(false);
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
            string currentId = await ResolveCurrentAsync(config, cancellationToken).ConfigureAwait(false);
            return BuildState(config, currentId);
        }
        finally
        {
            _sync.Release();
        }
    }

    public async Task<JsonObject> AdvanceRotationAsync(string reason, CancellationToken cancellationToken = default)
    {
        await _sync.WaitAsync(cancellationToken).ConfigureAwait(false);
        try
        {
            WallpaperConfig config = await LoadConfigAsync(cancellationToken).ConfigureAwait(false);
            if (config.Order.Count > 0
                && (string.Equals(reason, "startup", StringComparison.OrdinalIgnoreCase)
                    || config.Rotation.Mode.Equals("startup", StringComparison.OrdinalIgnoreCase)))
            {
                WallpaperRotationRuntime runtime = await LoadRuntimeAsync(cancellationToken).ConfigureAwait(false);
                runtime.LastRandomId = PickRandomId(config.Order, runtime.LastRandomId);
                await SaveRuntimeAsync(runtime, cancellationToken).ConfigureAwait(false);
            }
            string currentId = await ResolveCurrentAsync(config, cancellationToken).ConfigureAwait(false);
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

    internal static string ExtensionFor(string mime) => mime switch
    {
        "image/jpeg" => ".jpg",
        "image/png" => ".png",
        _ => ".webp",
    };

    internal static string PickRandomId(IReadOnlyList<string> order, string? previousId)
    {
        if (order.Count == 0)
        {
            return "";
        }
        string[] candidates = order
            .Where(id => !string.Equals(id, previousId, StringComparison.OrdinalIgnoreCase))
            .ToArray();
        return candidates.Length == 0
            ? order[0]
            : candidates[RandomNumberGenerator.GetInt32(candidates.Length)];
    }

    private async Task<string> ResolveCurrentAsync(WallpaperConfig config, CancellationToken cancellationToken)
    {
        if (config.Order.Count == 0)
        {
            return "";
        }
        if (config.Rotation.Mode.Equals("timer", StringComparison.OrdinalIgnoreCase))
        {
            long intervalMs = Math.Max(1, config.Rotation.IntervalMinutes) * 60_000L;
            long epoch = config.Rotation.EpochUnixMs <= 0 ? _utcNow().ToUnixTimeMilliseconds() : config.Rotation.EpochUnixMs;
            long nowMs = _utcNow().ToUnixTimeMilliseconds();
            long slot = Math.Max(0, nowMs - epoch) / intervalMs;
            WallpaperRotationRuntime runtime = await LoadRuntimeAsync(cancellationToken).ConfigureAwait(false);
            bool sameSlot = runtime.TimerSlot == slot
                && runtime.TimerEpochUnixMs == epoch
                && runtime.TimerIntervalMinutes == config.Rotation.IntervalMinutes;
            if (!sameSlot || !ContainsId(config.Order, runtime.LastRandomId))
            {
                runtime.LastRandomId = PickRandomId(config.Order, runtime.LastRandomId);
                runtime.TimerSlot = slot;
                runtime.TimerEpochUnixMs = epoch;
                runtime.TimerIntervalMinutes = config.Rotation.IntervalMinutes;
                await SaveRuntimeAsync(runtime, cancellationToken).ConfigureAwait(false);
            }
            return runtime.LastRandomId;
        }
        if (config.Rotation.Mode.Equals("startup", StringComparison.OrdinalIgnoreCase))
        {
            WallpaperRotationRuntime runtime = await LoadRuntimeAsync(cancellationToken).ConfigureAwait(false);
            if (!ContainsId(config.Order, runtime.LastRandomId))
            {
                runtime.LastRandomId = ResolveSelectedId(config);
                await SaveRuntimeAsync(runtime, cancellationToken).ConfigureAwait(false);
            }
            return runtime.LastRandomId;
        }
        return ResolveSelectedId(config);
    }

    private async Task ImportLegacyAsync(CancellationToken cancellationToken)
    {
        JsonObject? payload = await _scopedData.ReadJsonAsync(LegacyImportScope, cancellationToken).ConfigureAwait(false);
        if (payload is null)
        {
            return;
        }
        try
        {
            WallpaperConfig config = await LoadConfigAsync(cancellationToken).ConfigureAwait(false);
            var imported = new List<WallpaperAssetRecord>();
            var remappedOrder = new List<string>();
            if (payload["assets"] is JsonArray assets)
            {
                foreach (JsonNode? node in assets)
                {
                    if (node is not JsonObject asset)
                    {
                        continue;
                    }
                    string id = asset["id"]?.ToString()?.Trim().ToLowerInvariant() ?? "";
                    if (!IsSafeAssetId(id) || config.Assets.Any(item => string.Equals(item.Id, id, StringComparison.OrdinalIgnoreCase)))
                    {
                        continue;
                    }
                    string extension = asset["extension"]?.ToString()?.Trim().ToLowerInvariant() ?? "";
                    PluginAssetContent? content = await _assets.OpenAsync(AssetScope, id, cancellationToken).ConfigureAwait(false);
                    if (content is null)
                    {
                        _logger.Warn($"旧外观数据缺少资产文件，已跳过：{id}");
                        continue;
                    }
                    PluginAssetInfo info = content.Info;
                    content.Dispose();
                    var record = new WallpaperAssetRecord
                    {
                        Id = id,
                        OriginalName = SanitizeFileName(asset["originalName"]?.ToString(), id + (extension.Length > 0 ? "." + extension : "")),
                        MimeType = asset["mimeType"]?.ToString()?.Trim().ToLowerInvariant() ?? "image/jpeg",
                        SizeBytes = info.SizeBytes,
                        CreatedAt = info.CreatedAt,
                        PaletteVersion = 0,
                        Palette = new Dictionary<string, string>(StringComparer.Ordinal),
                    };
                    if (asset["paletteVersion"] is not null && ReadInt(asset["paletteVersion"], "paletteVersion") >= PaletteVersion
                        && asset["palette"] is JsonObject palette)
                    {
                        try
                        {
                            record.Palette = ParsePalette(palette);
                            record.PaletteVersion = PaletteVersion;
                        }
                        catch (WallpaperException)
                        {
                            record.Palette = new Dictionary<string, string>(StringComparer.Ordinal);
                            record.PaletteVersion = 0;
                        }
                    }
                    if (!AllowedMimeTypes.Contains(record.MimeType))
                    {
                        record.MimeType = "image/jpeg";
                    }
                    imported.Add(record);
                    remappedOrder.Add(id);
                }
            }
            if (payload["settings"] is JsonObject settings)
            {
                string selected = settings["selectedId"]?.ToString()?.Trim().ToLowerInvariant() ?? "";
                if (remappedOrder.Contains(selected, StringComparer.OrdinalIgnoreCase))
                {
                    config.SelectedId = selected;
                }
                if (settings["rotation"] is JsonObject rotation)
                {
                    ApplyRotation(config, rotation);
                }
                if (settings["effects"] is JsonObject effects)
                {
                    ApplyEffects(config, effects);
                }
                if (settings["providerEnabled"] is not null)
                {
                    config.Enabled = ReadBool(settings["providerEnabled"], "providerEnabled");
                }
            }
            if (imported.Count > 0)
            {
                config.Assets.AddRange(imported);
                config.Order = remappedOrder
                    .Concat(config.Order)
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .ToList();
                if (string.IsNullOrWhiteSpace(config.SelectedId))
                {
                    config.SelectedId = remappedOrder[0];
                }
                config.Revision = Math.Max(1, config.Revision + 1);
                config.UpdatedAt = _utcNow();
                await SaveConfigAsync(config, cancellationToken).ConfigureAwait(false);
            }
            await _scopedData.DeleteAsync(LegacyImportScope, cancellationToken).ConfigureAwait(false);
            _logger.Info($"已导入宿主搬迁的自定义壁纸数据：{imported.Count} 张。");
        }
        catch (Exception ex)
        {
            _logger.Error($"导入旧自定义壁纸数据失败，保留迁移载荷供下次启动重试：{ex.Message}");
        }
    }

    private async Task<WallpaperConfig> LoadConfigAsync(CancellationToken cancellationToken)
    {
        WallpaperConfig? config = await _configStore.ReadAsync<WallpaperConfig>(cancellationToken).ConfigureAwait(false);
        return Normalize(config ?? new WallpaperConfig());
    }

    private Task SaveConfigAsync(WallpaperConfig config, CancellationToken cancellationToken) =>
        _configStore.WriteAsync(config, cancellationToken).AsTask();

    private async Task<WallpaperRotationRuntime> LoadRuntimeAsync(CancellationToken cancellationToken)
    {
        WallpaperRotationRuntime? runtime = await _scopedData.ReadAsync<WallpaperRotationRuntime>(RotationScope, cancellationToken)
            .ConfigureAwait(false);
        return runtime ?? new WallpaperRotationRuntime();
    }

    private Task SaveRuntimeAsync(WallpaperRotationRuntime runtime, CancellationToken cancellationToken) =>
        _scopedData.WriteAsync(RotationScope, runtime, cancellationToken).AsTask();

    private static WallpaperConfig Normalize(WallpaperConfig config)
    {
        config.SchemaVersion = 1;
        config.Revision = Math.Max(1, config.Revision);
        config.Assets ??= new List<WallpaperAssetRecord>();
        config.Assets = config.Assets
            .Where(asset => asset is not null && IsSafeAssetId(asset.Id) && AllowedMimeTypes.Contains(asset.MimeType ?? ""))
            .Take(MaxAssets)
            .Select(CloneAsset)
            .ToList();
        HashSet<string> ids = config.Assets.Select(asset => asset.Id).ToHashSet(StringComparer.OrdinalIgnoreCase);
        config.Order ??= new List<string>();
        config.Order = config.Order
            .Where(ids.Contains)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();
        config.Order.AddRange(config.Assets.Select(asset => asset.Id).Where(id => !config.Order.Contains(id, StringComparer.OrdinalIgnoreCase)));
        string selected = config.SelectedId ?? "";
        config.SelectedId = config.Order.Contains(selected, StringComparer.OrdinalIgnoreCase)
            ? selected
            : config.Order.FirstOrDefault() ?? "";
        config.Rotation ??= new WallpaperRotationSettings();
        string mode = config.Rotation.Mode?.Trim().ToLowerInvariant() ?? "off";
        config.Rotation.Mode = mode is "timer" or "startup" ? mode : "off";
        config.Rotation.IntervalMinutes = Math.Clamp(config.Rotation.IntervalMinutes, 1, 1440);
        config.Rotation.EpochUnixMs = config.Rotation.EpochUnixMs <= 0
            ? DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()
            : Math.Min(config.Rotation.EpochUnixMs, DateTimeOffset.MaxValue.ToUnixTimeMilliseconds());
        config.Effects ??= new WallpaperEffectSettings();
        config.Effects.BlurPx = Math.Clamp(config.Effects.BlurPx, 0, 40);
        config.Effects.DimPercent = Math.Clamp(config.Effects.DimPercent, 0, 80);
        config.Effects.SurfaceTransparencyPercent = Math.Clamp(config.Effects.SurfaceTransparencyPercent, 0, 50);
        return config;
    }

    private static WallpaperAssetRecord CloneAsset(WallpaperAssetRecord source) => new()
    {
        Id = source.Id.ToLowerInvariant(),
        OriginalName = string.IsNullOrWhiteSpace(source.OriginalName) ? source.Id : source.OriginalName,
        MimeType = source.MimeType,
        SizeBytes = Math.Max(0, source.SizeBytes),
        CreatedAt = source.CreatedAt,
        PaletteVersion = source.PaletteVersion >= PaletteVersion ? PaletteVersion : 0,
        Palette = source.Palette is null
            ? new Dictionary<string, string>(StringComparer.Ordinal)
            : ParsePalette(source.Palette),
    };

    private void ApplyPatch(WallpaperConfig config, JsonObject patch)
    {
        if (patch["enabled"] is not null)
        {
            config.Enabled = ReadBool(patch["enabled"], "enabled");
        }
        if (patch["order"] is JsonArray order)
        {
            var values = new List<string>();
            foreach (JsonNode? node in order)
            {
                string id = node?.ToString()?.Trim().ToLowerInvariant() ?? "";
                if (!IsSafeAssetId(id) || values.Contains(id, StringComparer.OrdinalIgnoreCase))
                {
                    throw new WallpaperException("invalid_config", "壁纸顺序包含无效或重复的资源");
                }
                values.Add(id);
            }
            if (values.Any(id => !config.Assets.Any(asset => string.Equals(asset.Id, id, StringComparison.OrdinalIgnoreCase))))
            {
                throw new WallpaperException("invalid_config", "壁纸顺序包含不存在的资源");
            }
            config.Order = values;
        }
        if (patch["selectedId"] is not null)
        {
            string selected = patch["selectedId"]?.ToString()?.Trim().ToLowerInvariant() ?? "";
            if (selected.Length > 0 && !config.Order.Contains(selected, StringComparer.OrdinalIgnoreCase))
            {
                throw new WallpaperException("invalid_config", "当前壁纸资源不存在");
            }
            config.SelectedId = selected;
        }
        if (patch["rotation"] is JsonObject rotation)
        {
            ApplyRotation(config, rotation);
        }
        if (patch["effects"] is JsonObject effects)
        {
            ApplyEffects(config, effects);
        }
        config.Order = config.Order
            .Where(id => config.Assets.Any(asset => string.Equals(asset.Id, id, StringComparison.OrdinalIgnoreCase)))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();
        if (string.IsNullOrWhiteSpace(config.SelectedId) || !config.Order.Contains(config.SelectedId, StringComparer.OrdinalIgnoreCase))
        {
            config.SelectedId = config.Order.FirstOrDefault() ?? "";
        }
    }

    private static void ApplyRotation(WallpaperConfig config, JsonObject rotation)
    {
        string mode = rotation["mode"]?.ToString()?.Trim().ToLowerInvariant() ?? config.Rotation.Mode;
        if (mode is not ("off" or "timer" or "startup"))
        {
            throw new WallpaperException("invalid_config", "壁纸轮换模式无效");
        }
        config.Rotation.Mode = mode;
        if (rotation["intervalMinutes"] is not null)
        {
            config.Rotation.IntervalMinutes = Math.Clamp(ReadInt(rotation["intervalMinutes"], "rotation.intervalMinutes"), 1, 1440);
        }
        if (rotation["epochUnixMs"] is not null)
        {
            config.Rotation.EpochUnixMs = Math.Max(0, ReadLong(rotation["epochUnixMs"], "rotation.epochUnixMs"));
        }
        if (config.Rotation.EpochUnixMs <= 0)
        {
            config.Rotation.EpochUnixMs = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        }
    }

    private static void ApplyEffects(WallpaperConfig config, JsonObject effects)
    {
        if (effects["blurPx"] is not null)
        {
            config.Effects.BlurPx = Math.Clamp(ReadInt(effects["blurPx"], "effects.blurPx"), 0, 40);
        }
        if (effects["dimPercent"] is not null)
        {
            config.Effects.DimPercent = Math.Clamp(ReadInt(effects["dimPercent"], "effects.dimPercent"), 0, 80);
        }
        if (effects["surfaceTransparencyPercent"] is not null)
        {
            config.Effects.SurfaceTransparencyPercent = Math.Clamp(
                ReadInt(effects["surfaceTransparencyPercent"], "effects.surfaceTransparencyPercent"),
                0,
                50);
        }
        if (effects["applyTransparencyToSecondarySurfaces"] is not null)
        {
            config.Effects.ApplyTransparencyToSecondarySurfaces = ReadBool(
                effects["applyTransparencyToSecondarySurfaces"],
                "effects.applyTransparencyToSecondarySurfaces");
        }
    }

    private JsonObject BuildState(WallpaperConfig config, string currentId)
    {
        DateTimeOffset now = _utcNow();
        DateTimeOffset? nextSwitchAt = null;
        if (config.Order.Count > 0 && config.Rotation.Mode.Equals("timer", StringComparison.OrdinalIgnoreCase))
        {
            long intervalMs = Math.Max(1, config.Rotation.IntervalMinutes) * 60_000L;
            long epoch = config.Rotation.EpochUnixMs <= 0 ? now.ToUnixTimeMilliseconds() : config.Rotation.EpochUnixMs;
            long slot = Math.Max(0, now.ToUnixTimeMilliseconds() - epoch) / intervalMs;
            nextSwitchAt = DateTimeOffset.FromUnixTimeMilliseconds(epoch + (slot + 1) * intervalMs);
        }
        var assets = new JsonArray();
        foreach (WallpaperAssetRecord asset in config.Assets)
        {
            assets.Add(ToAssetDto(asset));
        }
        var order = new JsonArray();
        foreach (string id in config.Order)
        {
            order.Add(id);
        }
        return new JsonObject
        {
            ["schemaVersion"] = config.SchemaVersion,
            ["revision"] = config.Revision,
            ["enabled"] = config.Enabled,
            ["effectiveEnabled"] = config.Enabled && config.Order.Count > 0,
            ["assets"] = assets,
            ["order"] = order,
            ["selectedId"] = config.SelectedId,
            ["currentId"] = currentId,
            ["rotation"] = new JsonObject
            {
                ["mode"] = config.Rotation.Mode,
                ["intervalMinutes"] = config.Rotation.IntervalMinutes,
                ["epochUnixMs"] = config.Rotation.EpochUnixMs,
                ["nextSwitchAt"] = nextSwitchAt?.ToString("O"),
            },
            ["effects"] = new JsonObject
            {
                ["blurPx"] = config.Effects.BlurPx,
                ["dimPercent"] = config.Effects.DimPercent,
                ["surfaceTransparencyPercent"] = config.Effects.SurfaceTransparencyPercent,
                ["applyTransparencyToSecondarySurfaces"] = config.Effects.ApplyTransparencyToSecondarySurfaces,
            },
            ["limits"] = new JsonObject
            {
                ["maxAssetBytes"] = MaxAssetBytes,
                ["maxAssets"] = MaxAssets,
                ["maxTotalBytes"] = MaxTotalBytes,
            },
        };
    }

    private static JsonObject ToAssetDto(WallpaperAssetRecord asset)
    {
        var palette = new JsonObject();
        foreach ((string key, string value) in asset.Palette)
        {
            palette[key] = value;
        }
        return new JsonObject
        {
            ["id"] = asset.Id,
            ["originalName"] = asset.OriginalName,
            ["mimeType"] = asset.MimeType,
            ["sizeBytes"] = asset.SizeBytes,
            ["createdAt"] = asset.CreatedAt.ToString("O"),
            ["paletteVersion"] = asset.PaletteVersion,
            ["palette"] = palette,
        };
    }

    private static WallpaperAssetRecord FindAsset(WallpaperConfig config, string? id)
    {
        string normalized = (id ?? "").Trim().ToLowerInvariant();
        if (!IsSafeAssetId(normalized))
        {
            throw new WallpaperException("invalid_asset", "壁纸资源 ID 无效");
        }
        return config.Assets.FirstOrDefault(asset => string.Equals(asset.Id, normalized, StringComparison.OrdinalIgnoreCase))
            ?? throw new WallpaperException("not_found", "壁纸资源不存在");
    }

    private static void EnsureInOrder(WallpaperConfig config, string assetId)
    {
        if (!config.Order.Contains(assetId, StringComparer.OrdinalIgnoreCase))
        {
            config.Order.Add(assetId);
        }
    }

    private static string ResolveSelectedId(WallpaperConfig config) =>
        config.Order.FirstOrDefault(id => string.Equals(id, config.SelectedId, StringComparison.OrdinalIgnoreCase))
            ?? config.Order[0];

    private static bool ContainsId(IReadOnlyList<string> order, string? id) =>
        !string.IsNullOrWhiteSpace(id) && order.Any(value => string.Equals(value, id, StringComparison.OrdinalIgnoreCase));

    private static Dictionary<string, string> ParsePalette(JsonObject palette)
    {
        var result = new Dictionary<string, string>(StringComparer.Ordinal);
        foreach ((string key, JsonNode? value) in palette)
        {
            string text = value?.ToString() ?? "";
            if (!AllowedPaletteTokens.Contains(key) || text.Length > 4096 || text.Any(ch => ch is '\0' or '\r' or '\n'))
            {
                throw new WallpaperException("invalid_palette", $"壁纸配色 token 无效：{key}");
            }
            result[key] = text;
        }
        return result;
    }

    private static Dictionary<string, string> ParsePalette(Dictionary<string, string> palette)
    {
        var node = new JsonObject();
        foreach ((string key, string value) in palette)
        {
            node[key] = value;
        }
        return ParsePalette(node);
    }

    private static void ValidateImageHeader(string mime, byte[] bytes)
    {
        bool valid = mime switch
        {
            "image/jpeg" => bytes.Length >= 3 && bytes[0] == 0xFF && bytes[1] == 0xD8 && bytes[2] == 0xFF,
            "image/png" => bytes.Length >= 8 && bytes.AsSpan(0, 8).SequenceEqual(new byte[] { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A }),
            "image/webp" => bytes.Length >= 12
                && bytes.AsSpan(0, 4).SequenceEqual("RIFF"u8)
                && bytes.AsSpan(8, 4).SequenceEqual("WEBP"u8),
            _ => false,
        };
        if (!valid || bytes.LongLength <= 0)
        {
            throw new WallpaperException("invalid_image", "壁纸文件内容与声明类型不匹配");
        }
    }

    private static string SanitizeFileName(string? value, string fallback)
    {
        string text = Path.GetFileName(value ?? "").Trim();
        if (string.IsNullOrWhiteSpace(text))
        {
            text = fallback;
        }
        text = new string(text.Select(ch => char.IsControl(ch) || ch is '/' or '\\' ? '_' : ch).ToArray());
        return text.Length <= 128 ? text : text[..128];
    }

    private static bool IsSafeAssetId(string? value) =>
        !string.IsNullOrWhiteSpace(value)
        && value.Length == 64
        && value.All(ch => ch is >= '0' and <= '9' or >= 'a' and <= 'f');

    private static bool ReadBool(JsonNode? node, string field)
    {
        try
        {
            return node?.GetValue<bool>() ?? throw new WallpaperException("invalid_config", $"{field} 无效");
        }
        catch (Exception ex) when (ex is InvalidOperationException or FormatException or JsonException)
        {
            throw new WallpaperException("invalid_config", $"{field} 无效");
        }
    }

    private static int ReadInt(JsonNode? node, string field)
    {
        try
        {
            return node?.GetValue<int>() ?? throw new WallpaperException("invalid_config", $"{field} 无效");
        }
        catch (Exception ex) when (ex is InvalidOperationException or FormatException or JsonException or OverflowException)
        {
            throw new WallpaperException("invalid_config", $"{field} 无效");
        }
    }

    private static long ReadLong(JsonNode? node, string field)
    {
        try
        {
            return node?.GetValue<long>() ?? throw new WallpaperException("invalid_config", $"{field} 无效");
        }
        catch (Exception ex) when (ex is InvalidOperationException or FormatException or JsonException or OverflowException)
        {
            throw new WallpaperException("invalid_config", $"{field} 无效");
        }
    }
}
