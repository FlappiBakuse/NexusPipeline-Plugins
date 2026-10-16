namespace NexusPipeline.Plugin.GameActivities;

internal sealed record ActivitySettings
{
    public int FormatVersion { get; init; } = 1;
    public bool OnboardingCompleted { get; init; }
    public string[]? GameOrder { get; init; }
    public string[] SelectedGames { get; init; } = [];
    public Dictionary<string, string> Progressions { get; init; } = new() { ["blue-archive"] = "cn", ["neverness-to-everness"] = "cn" };
    public int CarouselIntervalSeconds { get; init; } = 30;
    public bool PauseOnInteraction { get; init; } = true;
}
internal sealed record ActivitySettingsState(long Revision, ActivitySettings Settings);
internal sealed record GameSource(string GameId, string ProgressionId, string File, string Locale = "zh-CN")
{
    public Uri Endpoint => new("https://starrailassistant.top/api/v1/activity/" + File + ".json");
}
internal static class GameSources
{
    public static readonly GameSource[] All = [
        new("blue-archive", "cn", "ba-cn"), new("blue-archive", "jp", "ba-jp"), new("blue-archive", "global", "ba-global"),
        new("genshin-impact", "default", "ys"), new("arknights-endfield", "default", "end"), new("stella-sora", "default", "xtlr"),
        new("honkai-star-rail", "default", "sr"), new("wuthering-waves", "default", "ww"), new("zenless-zone-zero", "default", "zzz"),
        new("neverness-to-everness", "cn", "nte"), new("neverness-to-everness", "global", "nte-en-US", "en-US")
    ];
    public static string Key(GameSource source) => source.GameId + "/" + source.ProgressionId;
    public static GameSource Resolve(string game, string progression) => All.SingleOrDefault(source => source.GameId == game && source.ProgressionId == progression)
        ?? throw new ActivityException("invalid_progression", 400);
    public static GameSource[] Selected(ActivitySettings settings) => settings.SelectedGames.Select(game => Resolve(game,
        settings.Progressions.GetValueOrDefault(game, "default"))).ToArray();
    public static ActivitySettings Validate(ActivitySettings settings)
    {
        if (settings.FormatVersion != 1 || settings.SelectedGames is null || settings.Progressions is null
            || settings.SelectedGames.Length > 8 || settings.SelectedGames.Distinct().Count() != settings.SelectedGames.Length
            || (settings.CarouselIntervalSeconds != -1 && settings.CarouselIntervalSeconds is < 10 or > 120) || !settings.PauseOnInteraction
            || settings.Progressions.Count != 2 || !settings.Progressions.ContainsKey("blue-archive") || !settings.Progressions.ContainsKey("neverness-to-everness"))
            throw new ActivityException("invalid_settings", 400);
        Resolve("blue-archive", settings.Progressions["blue-archive"]);
        Resolve("neverness-to-everness", settings.Progressions["neverness-to-everness"]);
        Selected(settings);
        string[] games = All.Select(source => source.GameId).Distinct().ToArray();
        string[] order = settings.GameOrder ?? settings.SelectedGames.Concat(games.Except(settings.SelectedGames)).ToArray();
        if (order.Length != games.Length || order.Distinct().Count() != games.Length || order.Except(games).Any())
            throw new ActivityException("invalid_settings", 400);
        return settings with { GameOrder = order.ToArray(), SelectedGames = order.Where(settings.SelectedGames.Contains).ToArray(), Progressions = new(settings.Progressions) };
    }
}
internal sealed class ActivityException(string code, int status, DateTimeOffset? retryAfter = null) : Exception(code)
{
    public DateTimeOffset? RetryAfter { get; } = retryAfter;
    public string Code { get; } = code;
    public int Status { get; } = status;
}
