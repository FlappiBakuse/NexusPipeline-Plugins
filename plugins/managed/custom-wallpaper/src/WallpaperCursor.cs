using System.Security.Cryptography;

namespace NexusPipeline.Extensions.CustomWallpaper;

internal sealed class WallpaperCursor
{
    private Guid? _desktop;
    private string? _current;
    private long _slot = -1;
    private WallpaperRotation? _rotation;

    internal (string? Current, string? Next) Resolve(WallpaperDocument document, Guid? desktop, DateTimeOffset now)
    {
        if (!document.Enabled || document.Order.Length == 0) return (null, null);
        if (_rotation != document.Rotation)
        {
            _rotation = document.Rotation;
            _slot = -1;
            _current = document.SelectedId ?? document.Order[0];
        }
        if (_current is null || !document.Order.Contains(_current, StringComparer.Ordinal))
            _current = document.SelectedId ?? document.Order[0];
        if (document.Rotation.Mode == "off") return (document.SelectedId ?? document.Order[0], null);
        if (document.Rotation.Mode == "startup")
        {
            if (desktop is not null && desktop != _desktop)
            {
                _current = Pick(document.Order, _current);
                _desktop = desktop;
            }
            return (_current, null);
        }
        var epoch = document.Rotation.EpochUnixMs;
        if (epoch == 0) return (document.SelectedId ?? document.Order[0], null);
        var interval = document.Rotation.IntervalMinutes * 60000L;
        var elapsed = Math.Max(0, now.ToUnixTimeMilliseconds() - epoch);
        var slot = elapsed / interval;
        if (slot != _slot)
        {
            _current = Pick(document.Order, _current);
            _slot = slot;
        }
        var next = epoch + Math.Min(DateTimeOffset.MaxValue.ToUnixTimeMilliseconds() - epoch, (slot + 1) * interval);
        return (_current, DateTimeOffset.FromUnixTimeMilliseconds(next).ToString("O"));
    }

    private static string Pick(string[] ids, string? previous)
    {
        if (ids.Length == 1) return ids[0];
        var candidates = ids.Where(id => id != previous).ToArray();
        return candidates[RandomNumberGenerator.GetInt32(candidates.Length)];
    }
}
