using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;

namespace NexusPipeline.Extensions.GameActivities;

internal static class ActivityTimes
{
    private static readonly Regex IsoTime = new(@"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?$",
        RegexOptions.CultureInvariant | RegexOptions.IgnoreCase, TimeSpan.FromMilliseconds(100));
    private static readonly Regex Offset = new(@"(?:Z|[+-]\d{2}:?\d{2})$",
        RegexOptions.CultureInvariant | RegexOptions.IgnoreCase, TimeSpan.FromMilliseconds(100));
    internal static ActivityTimePoint? Parse(string? raw, ActivitySource? source = null)
    {
        if (string.IsNullOrWhiteSpace(raw)) return null;
        if (raw.Length > 256) throw new ActivityFailure("activity_time_too_long");
        var text = raw.Trim();
        var explicitOffset = Offset.IsMatch(text);
        var fallback = source?.DefaultOffsetMinutes;
        if (!IsoTime.IsMatch(text) || !explicitOffset && fallback is null)
            return new(null, raw, "unknown", null);
        var suffix = fallback is { } minutes ? (minutes >= 0 ? "+" : "-") +
            TimeSpan.FromMinutes(Math.Abs(minutes)).ToString(@"hh\:mm", CultureInfo.InvariantCulture) : "";
        if (!DateTimeOffset.TryParse(explicitOffset ? text : text + suffix, CultureInfo.InvariantCulture, DateTimeStyles.None, out var instant))
            return new(null, raw, "unknown", null);
        return new(instant.ToUniversalTime(), raw, explicitOffset ? "explicit" : "source-default",
            explicitOffset ? null : fallback == 480 ? "UTC+8" : "UTC" + suffix);
    }
    internal static string Phase(ActivityEvent value, DateTimeOffset now)
    {
        var start = value.Start?.InstantUtc; var end = value.PlayEnd?.InstantUtc;
        if (start is not null && end is not null && start >= end) return "unknown";
        if (end <= now) return "ended";
        if (start > now) return "upcoming";
        return start is not null && end is not null ? "ongoing" : "unknown";
    }
    internal static string Hash(string value) => Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(value)));
    internal static string[] Boundaries(ActivitySource source, ActivityCache cache, DateTimeOffset now)
    {
        if (cache.Content is not { } content) return [];
        var points = content.Events.SelectMany(item => new[] { (item.Id + "/start", item.Start), (item.Id + "/end", item.PlayEnd) })
            .Concat([("overview/start", content.Overview.Start), ("overview/end", content.Overview.End)]);
        return points.Where(pair => pair.Item2?.InstantUtc is { } time && Math.Abs((time - now).TotalMinutes) <= 15)
            .Select(pair => Hash(source.Id + "/" + pair.Item1 + "/" + pair.Item2!.InstantUtc!.Value.ToString("O", CultureInfo.InvariantCulture) +
                "/" + (now < pair.Item2.InstantUtc ? "pre" : "post"))).Distinct(StringComparer.Ordinal).ToArray();
    }
}

internal static class ActivityCovers
{
    internal static readonly string[] Origins = ["https://resource.starrailassistant.top", "https://web.hycdn.cn", "https://i0.hdslb.com",
        "https://prod-alicdn-community.kurobbs.com", "https://webusstatic.yo-star.com", "https://fastcdn.mihoyo.com"];
    internal static bool Allowed(string? text) => text is { Length: > 0 and <= 2048 } && text == text.Trim() &&
        Uri.TryCreate(text, UriKind.Absolute, out var uri) && uri.Scheme == "https" && uri.IsDefaultPort &&
        uri.UserInfo.Length == 0 && uri.Fragment.Length == 0 && Origins.Contains(uri.GetLeftPart(UriPartial.Authority), StringComparer.OrdinalIgnoreCase);
    internal static string? Identity(string? text) => Allowed(text) ? ActivityTimes.Hash(text!) : null;
    internal static string? MediaType(ReadOnlySpan<byte> bytes, string mime)
    {
        if (mime == "image/png" && bytes.StartsWith(new byte[] { 137, 80, 78, 71, 13, 10, 26, 10 })) return mime;
        if (mime == "image/jpeg" && bytes.Length >= 3 && bytes[0] == 255 && bytes[1] == 216 && bytes[2] == 255) return mime;
        if (mime == "image/webp" && bytes.Length >= 12 && bytes[..4].SequenceEqual("RIFF"u8) && bytes.Slice(8, 4).SequenceEqual("WEBP"u8)) return mime;
        return null;
    }
}
