namespace NexusPipeline.Plugin.GameActivities;

internal sealed record ActivitySettings
{
    public int FormatVersion { get; init; } = 1;
    public bool OnboardingCompleted { get; init; }
    public string[] SelectedGames { get; init; } = [];
    public Dictionary<string, string> Progressions { get; init; } = new() { ["blue-archive"] = "cn", ["neverness-to-everness"] = "cn" };
    public int CarouselIntervalSeconds { get; init; } = 30;
    public bool PauseOnInteraction { get; init; } = true;
}
internal sealed record ActivitySettingsState(long Revision, ActivitySettings Settings);
internal sealed record GameSource(string GameId, string ProgressionId, string File, string Locale, string? SourceZone, string OfficialUrl);
internal static class GameSources
{
    public static readonly GameSource[] All = [
        new("blue-archive","cn","ba-cn","zh-CN","Asia/Shanghai","https://bluearchive-cn.com/"),
        new("blue-archive","jp","ba-jp","zh-CN","Asia/Shanghai","https://bluearchive.jp/news"),
        new("blue-archive","global","ba-global","zh-CN","Asia/Shanghai","https://forum.nexon.com/bluearchive-en/"),
        new("genshin-impact","default","ys","zh-CN","Asia/Shanghai","https://ys.mihoyo.com/main/news"),
        new("arknights-endfield","default","end","zh-CN","Asia/Shanghai","https://endfield.hypergryph.com/news"),
        new("stella-sora","default","xtlr","zh-CN","Asia/Shanghai","https://stellasora.yostar.cn/api/resource/news?index=1"),
        new("honkai-star-rail","default","sr","zh-CN","Asia/Shanghai","https://sr.mihoyo.com/news?nav=news&type=notice"),
        new("neverness-to-everness","cn","nte","zh-CN","Asia/Shanghai","https://yh.wanmei.com/news/index.html"),
        new("neverness-to-everness","global","nte-en-US","en-US","Asia/Shanghai","https://nte.perfectworld.com/en/article/news/index.html"),
        new("wuthering-waves","default","ww","zh-CN","Asia/Shanghai","https://mc.kurogames.com/main/news"),
        new("zenless-zone-zero","default","zzz","zh-CN","Asia/Shanghai","https://zzz.mihoyo.com/news")];
    public static string Key(GameSource source) => source.GameId + "/" + source.ProgressionId;
    public static TimeSpan OfficialDefaultOffset(GameSource source) => TimeSpan.FromHours(
        source.GameId == "blue-archive" && source.ProgressionId is "jp" or "global" ? 9 : 8);
    public static string OfficialDefaultZone(GameSource source) => OfficialDefaultOffset(source) == TimeSpan.FromHours(9) ? "UTC+09:00" : "UTC+08:00";
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
        return settings with { SelectedGames = settings.SelectedGames.ToArray(), Progressions = new(settings.Progressions) };
    }
}
internal sealed class ActivityException(string code, int status, DateTimeOffset? retryAfter = null) : Exception(code)
{
    public DateTimeOffset? RetryAfter { get; } = retryAfter;
    public string Code { get; } = code;
    public int Status { get; } = status;
}
