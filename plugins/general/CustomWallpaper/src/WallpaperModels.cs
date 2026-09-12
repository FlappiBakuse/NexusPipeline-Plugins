namespace NexusPipeline.Plugin.CustomWallpaper;

/// <summary>插件自有壁纸配置；顺序、当前选择、轮换与显示效果均由插件持有。</summary>
internal sealed class WallpaperConfig
{
    public int SchemaVersion { get; set; } = 1;

    public long Revision { get; set; } = 1;

    public bool Enabled { get; set; }

    public string SelectedId { get; set; } = "";

    public List<string> Order { get; set; } = new();

    public List<WallpaperAssetRecord> Assets { get; set; } = new();

    public WallpaperRotationSettings Rotation { get; set; } = new();

    public WallpaperEffectSettings Effects { get; set; } = new();

    public DateTimeOffset UpdatedAt { get; set; }
}

/// <summary>资产的展示与配色元数据；文件本体由宿主通用资产存储按 Id 持有。</summary>
internal sealed class WallpaperAssetRecord
{
    public string Id { get; set; } = "";

    public string OriginalName { get; set; } = "";

    public string MimeType { get; set; } = "";

    public long SizeBytes { get; set; }

    public DateTimeOffset CreatedAt { get; set; }

    public int PaletteVersion { get; set; }

    public Dictionary<string, string> Palette { get; set; } = new(StringComparer.Ordinal);
}

internal sealed class WallpaperRotationSettings
{
    public string Mode { get; set; } = "off";

    public int IntervalMinutes { get; set; } = 30;

    public long EpochUnixMs { get; set; }
}

internal sealed class WallpaperEffectSettings
{
    public int BlurPx { get; set; }

    public int DimPercent { get; set; } = 20;

    public int SurfaceTransparencyPercent { get; set; }

    public bool ApplyTransparencyToSecondarySurfaces { get; set; } = true;
}

/// <summary>轮换游标：记录当前随机结果与计时槽位，属于可重建的运行状态。</summary>
internal sealed class WallpaperRotationRuntime
{
    public string LastRandomId { get; set; } = "";

    public long TimerSlot { get; set; } = -1;

    public long TimerEpochUnixMs { get; set; }

    public int TimerIntervalMinutes { get; set; }
}

/// <summary>插件可预期的调用方错误；code 由前端映射到插件词典文案。</summary>
internal sealed class WallpaperException : Exception
{
    public WallpaperException(string code, string message)
        : base(message)
    {
        Code = code;
    }

    public string Code { get; }
}
