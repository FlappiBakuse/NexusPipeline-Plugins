using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;

namespace NexusPipeline.Extensions.CustomWallpaper;

internal sealed record WallpaperAsset(string Id, string Name, long SizeBytes, Dictionary<string, string> Palette);
internal sealed record WallpaperEffects(int BlurPx, int DimPercent, int SurfaceTransparencyPercent, bool SecondaryTransparency);
internal sealed record WallpaperRotation(string Mode, int IntervalMinutes, long EpochUnixMs);
internal sealed record WallpaperDocument(string Format, int Version, bool Enabled, WallpaperAsset[] Assets,
    string[] Order, string? SelectedId, WallpaperRotation Rotation, WallpaperEffects Effects)
{
    internal static WallpaperDocument Empty() => new("nexus.wallpaper.settings", 1, false, [], [], null,
        new("off", 30, 0), new(0, 20, 0, true));
}

internal static class WallpaperJson
{
    internal static JsonSerializerOptions Options { get; } = new(JsonSerializerDefaults.Web)
    {
        PropertyNameCaseInsensitive = false,
        UnmappedMemberHandling = JsonUnmappedMemberHandling.Disallow,
        RespectRequiredConstructorParameters = true
    };
    private static readonly HashSet<string> PaletteKeys = new(StringComparer.Ordinal)
    {
        "--accent", "--accent-strong", "--accent-alt", "--accent-soft", "--on-accent", "--focus", "--mask",
        "--wallpaper-card-dark", "--wallpaper-card-dark-soft", "--wallpaper-card-dark-hover", "--wallpaper-card-dark-border",
        "--wallpaper-card-light", "--wallpaper-card-light-soft", "--wallpaper-card-light-hover", "--wallpaper-card-light-border"
    };
    private static readonly Regex Color = new("^(#[0-9a-fA-F]{6}|(?:0 0 0 3px )?(?:hsl|hsla|rgb|rgba)\\([0-9.,% /-]+\\))$",
        RegexOptions.CultureInvariant, TimeSpan.FromMilliseconds(50));

    internal static WallpaperDocument Read(ReadOnlyMemory<byte> bytes)
    {
        var value = JsonSerializer.Deserialize<WallpaperDocument>(bytes.Span, Options)
            ?? throw new JsonException("wallpaper_document_invalid");
        Validate(value);
        return value;
    }

    internal static void Validate(WallpaperDocument value)
    {
        if (value.Format != "nexus.wallpaper.settings" || value.Version != 1 || value.Assets is null || value.Order is null ||
            value.Assets.Length > 32 || value.Assets.Select(asset => asset.Id).Distinct(StringComparer.Ordinal).Count() != value.Assets.Length ||
            value.Order.Length != value.Assets.Length || value.Order.Distinct(StringComparer.Ordinal).Count() != value.Order.Length ||
            value.Order.Any(id => !value.Assets.Any(asset => asset.Id == id)) ||
            value.SelectedId is not null && !value.Order.Contains(value.SelectedId, StringComparer.Ordinal))
            throw new JsonException("wallpaper_document_invalid");
        if (value.Rotation is null || value.Rotation.Mode is not ("off" or "startup" or "timer") ||
            value.Rotation.IntervalMinutes is < 1 or > 1440 || value.Rotation.EpochUnixMs < 0 ||
            value.Rotation.EpochUnixMs > DateTimeOffset.MaxValue.ToUnixTimeMilliseconds())
            throw new JsonException("wallpaper_rotation_invalid");
        if (value.Effects is null || value.Effects.BlurPx is < 0 or > 40 || value.Effects.DimPercent is < 0 or > 80 ||
            value.Effects.SurfaceTransparencyPercent is < 0 or > 50)
            throw new JsonException("wallpaper_effects_invalid");
        long total = 0;
        foreach (var asset in value.Assets)
        {
            if (asset.Id is not { Length: 64 } || asset.Id.Any(character => character is not (>= 'a' and <= 'f') and not (>= '0' and <= '9')) ||
                asset.Name is not { Length: >= 1 and <= 256 } || asset.Name.Any(char.IsControl) || asset.SizeBytes is < 1 or > 8388608)
                throw new JsonException("wallpaper_asset_invalid");
            ValidatePalette(asset.Palette);
            total += asset.SizeBytes;
        }
        if (total > 268435456) throw new JsonException("wallpaper_capacity_exceeded");
    }

    internal static void ValidatePalette(IReadOnlyDictionary<string, string> palette)
    {
        if (palette is null || palette.Count > PaletteKeys.Count || palette.Any(item => !PaletteKeys.Contains(item.Key) ||
            item.Value is not { Length: >= 1 and <= 128 } || !Color.IsMatch(item.Value)))
            throw new JsonException("wallpaper_palette_invalid");
    }
}
