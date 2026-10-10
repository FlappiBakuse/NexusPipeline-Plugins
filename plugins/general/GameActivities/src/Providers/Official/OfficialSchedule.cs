using System.Globalization;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;

namespace NexusPipeline.Plugin.GameActivities;

internal sealed record OfficialSchedule(string Start, string PlayEnd, string? ClaimEnd = null);

internal static class OfficialTimeParser
{
    public const string Version = "5";
    public static JsonObject? Parse(string? raw, OfficialNotice notice, string sourceRef, string? rangeContext = null, GameSource? source = null)
    {
        if (string.IsNullOrWhiteSpace(raw)) return null;
        string context = rangeContext ?? raw;
        string? zone = null;
        TimeSpan? offset = null;
        bool usesDefault = false;
        var utc = Regex.Match(context, @"UTC\s*(?<sign>[+−-])?\s*(?<hours>\d{1,2})?(?::(?<minutes>\d{2}))?\b", RegexOptions.IgnoreCase);
        if (utc.Success)
        {
            int hours = utc.Groups["hours"].Success ? int.Parse(utc.Groups["hours"].Value, CultureInfo.InvariantCulture) : 0;
            int minutes = utc.Groups["minutes"].Success ? int.Parse(utc.Groups["minutes"].Value, CultureInfo.InvariantCulture) : 0;
            if (hours <= 14 && minutes < 60 && (hours != 14 || minutes == 0))
            {
                offset = new TimeSpan(hours, minutes, 0) * (utc.Groups["sign"].Value is "-" or "−" ? -1 : 1);
                zone = offset == TimeSpan.Zero ? "UTC" : "UTC" + (offset < TimeSpan.Zero ? "-" : "+") + offset.Value.Duration().ToString(@"hh\:mm", CultureInfo.InvariantCulture);
            }
        }
        else if (context.Contains("北京时间", StringComparison.Ordinal)) { zone = "Asia/Shanghai"; offset = TimeSpan.FromHours(8); }
        else if (Regex.IsMatch(context, @"\bJST\b")) { zone = "Asia/Tokyo"; offset = TimeSpan.FromHours(9); }
        else if (notice.Text.Contains("All listed times are based on Coordinated Universal Time (UTC) unless otherwise stated.", StringComparison.Ordinal)
            && !Regex.IsMatch(context, @"server time|服务器时间", RegexOptions.IgnoreCase)) { zone = "UTC"; offset = TimeSpan.Zero; }
        else if (source is not null)
        {
            offset = GameSources.OfficialDefaultOffset(source);
            zone = GameSources.OfficialDefaultZone(source);
            usesDefault = true;
        }

        bool relative = Regex.IsMatch(raw, @"维护|メンテナンス|更新后|after (?:maintenance|update)|before .*maintenance", RegexOptions.IgnoreCase);
        var clock = Clock(raw, Year(notice));
        DateTimeOffset? instant = !relative && clock is { } date && offset is { } shift ? new(date, shift) : null;
        return ActivityNormalizer.Object(new
        {
            instantUtc = instant is { } time ? ActivityNormalizer.Utc(time) : null,
            rawValue = raw,
            timeBasis = instant is null ? "unknown" : usesDefault ? "source-default" : zone == "UTC" ? "utc" : "explicit-offset",
            sourceZone = instant is null ? null : zone,
            precision = Regex.IsMatch(raw, @"\d{1,2}:\d{2}:\d{2}") ? "second" : Regex.IsMatch(raw, @"\d{1,2}:\d{2}") ? "minute" : "unknown",
            certainty = instant is null ? "unknown" : usesDefault ? "reported" : "confirmed",
            sourceRef
        });
    }

    public static int? Year(OfficialNotice notice)
    {
        if (notice.PublishedAt is { } published) return published.Year;
        var path = Regex.Match(new Uri(notice.Url).AbsolutePath, @"/(?<year>20\d{2})\d{4}/");
        if (path.Success) return int.Parse(path.Groups["year"].Value, CultureInfo.InvariantCulture);
        var years = Regex.Matches(notice.Text, @"\b(?<year>20\d{2})(?:年|[/\-])").Select(match => match.Groups["year"].Value).Distinct().ToArray();
        return years.Length == 1 ? int.Parse(years[0], CultureInfo.InvariantCulture) : null;
    }

    private static DateTime? Clock(string raw, int? year)
    {
        string value = Regex.Replace(raw, @"\([^)]*\)|（[^）]*）", " ").Trim();
        var date = Regex.Match(value, @"(?:(?<year>20\d{2})[年/\-])?(?<month>\d{1,2})[月/\-](?<day>\d{1,2})(?:日)?\s*(?<hour>\d{1,2}):(?<minute>\d{2})(?::(?<second>\d{2}))?\s*(?<ampm>[AP]M)?", RegexOptions.IgnoreCase);
        if (date.Success)
        {
            int? y = date.Groups["year"].Success ? int.Parse(date.Groups["year"].Value, CultureInfo.InvariantCulture) : year;
            if (y is null) return null;
            int hour = int.Parse(date.Groups["hour"].Value, CultureInfo.InvariantCulture);
            string ampm = date.Groups["ampm"].Value.ToUpperInvariant();
            if (ampm.Length > 0)
            {
                if (hour is < 1 or > 12) return null;
                hour = hour % 12 + (ampm == "PM" ? 12 : 0);
            }
            int second = date.Groups["second"].Success ? int.Parse(date.Groups["second"].Value, CultureInfo.InvariantCulture) : 0;
            try { return new DateTime(y.Value, int.Parse(date.Groups["month"].Value, CultureInfo.InvariantCulture), int.Parse(date.Groups["day"].Value, CultureInfo.InvariantCulture), hour, int.Parse(date.Groups["minute"].Value, CultureInfo.InvariantCulture), second, DateTimeKind.Unspecified); }
            catch (ArgumentOutOfRangeException) { return null; }
        }
        return year is { } englishYear && DateTime.TryParseExact(englishYear + " " + value,
            "yyyy MMMM d, HH:mm", CultureInfo.InvariantCulture, DateTimeStyles.None, out var english) ? english : null;
    }

    public static OfficialSchedule? Range(string text)
    {
        var range = Regex.Match(text, @"(?<start>[^\n]+?)\s*(?:[~～–]|\s+-\s+|(?<=后)-|(?<=\d{2}:\d{2})-)\s*(?<end>[^\n]+)");
        return range.Success ? new(range.Groups["start"].Value.Trim(), range.Groups["end"].Value.Trim()) : null;
    }
}
