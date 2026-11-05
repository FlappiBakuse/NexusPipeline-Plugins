namespace NexusPipeline.Extensions.GameActivities;

internal sealed record ActivitySource(string GameId, string ProgressionId, string File, string Server, string Locale = "zh-CN",
    int? DefaultOffsetMinutes = null)
{
    internal string Id => GameId + "/" + ProgressionId;
    internal string DocumentName => "feed-" + File.ToLowerInvariant();
    internal Uri Endpoint => new("https://starrailassistant.top/api/v1/activity/" + File + ".json");
}

internal static class ActivitySources
{
    internal static readonly ActivitySource[] All = [
        new("blue-archive", "cn", "ba-cn", "国服", DefaultOffsetMinutes: 480), new("blue-archive", "jp", "ba-jp", "日服", DefaultOffsetMinutes: 480),
        new("blue-archive", "global", "ba-global", "国际服", DefaultOffsetMinutes: 480), new("genshin-impact", "default", "ys", "默认", DefaultOffsetMinutes: 480),
        new("arknights-endfield", "default", "end", "默认", DefaultOffsetMinutes: 480), new("stella-sora", "default", "xtlr", "默认", DefaultOffsetMinutes: 480),
        new("honkai-star-rail", "default", "sr", "默认", DefaultOffsetMinutes: 480), new("wuthering-waves", "default", "ww", "默认", DefaultOffsetMinutes: 480),
        new("zenless-zone-zero", "default", "zzz", "默认", DefaultOffsetMinutes: 480), new("neverness-to-everness", "cn", "nte", "国服", DefaultOffsetMinutes: 480),
        new("neverness-to-everness", "global", "nte-en-US", "国际服", "en-US", 480)
    ];
    internal static readonly string[] Games = All.Select(source => source.GameId).Distinct(StringComparer.Ordinal).ToArray();
    internal static ActivitySource Resolve(string id) => All.SingleOrDefault(source => source.Id == id)
        ?? throw new ActivityFailure("activity_feed_unknown");
    internal static ActivitySource[] Selected(ActivitySettings settings) => settings.SelectedGames.Select(game =>
        All.Single(source => source.GameId == game && source.ProgressionId == settings.Progressions.GetValueOrDefault(game, "default"))).ToArray();
}

internal sealed record ActivitySettings
{
    [System.Text.Json.Serialization.JsonRequired] public int FormatVersion { get; init; } = 1;
    [System.Text.Json.Serialization.JsonRequired] public string[] SelectedGames { get; init; } = [];
    [System.Text.Json.Serialization.JsonRequired] public string[] GameOrder { get; init; } = ActivitySources.Games.ToArray();
    [System.Text.Json.Serialization.JsonRequired] public Dictionary<string, string> Progressions { get; init; } = new(StringComparer.Ordinal)
        { ["blue-archive"] = "cn", ["neverness-to-everness"] = "cn" };
    [System.Text.Json.Serialization.JsonRequired] public int RotationSeconds { get; init; } = 30;
    [System.Text.Json.Serialization.JsonRequired] public bool PauseOnInteraction { get; init; } = true;

    internal ActivitySettings Validate()
    {
        if (FormatVersion != 1 || SelectedGames is null || GameOrder is null || Progressions is null ||
            SelectedGames.Length > 8 || SelectedGames.Distinct(StringComparer.Ordinal).Count() != SelectedGames.Length ||
            SelectedGames.Except(ActivitySources.Games, StringComparer.Ordinal).Any() || GameOrder.Length != 8 ||
            GameOrder.Distinct(StringComparer.Ordinal).Count() != 8 || GameOrder.Except(ActivitySources.Games, StringComparer.Ordinal).Any() ||
            RotationSeconds != -1 && RotationSeconds is < 10 or > 120 || !PauseOnInteraction || Progressions.Count != 2 ||
            !Progressions.TryGetValue("blue-archive", out var ba) || !new[] { "cn", "jp", "global" }.Contains(ba) ||
            !Progressions.TryGetValue("neverness-to-everness", out var nte) || !new[] { "cn", "global" }.Contains(nte))
            throw new ActivityFailure("activity_settings_invalid");
        return this with { GameOrder = GameOrder.ToArray(), SelectedGames = GameOrder.Where(SelectedGames.Contains).ToArray(),
            Progressions = new(Progressions, StringComparer.Ordinal) };
    }
}

internal sealed class ActivityFailure(string code, DateTimeOffset? retryAfter = null) : Exception(code)
{
    internal string Code { get; } = code;
    internal DateTimeOffset? RetryAfter { get; } = retryAfter;
}
