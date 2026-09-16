namespace NexusPipeline.Plugin.GameCheckIn;

internal sealed record GameDefinition(
    string Code,
    string DisplayName,
    HoyoLabGameDefinition Os,
    MiyousheGameDefinition Cn);

internal sealed record HoyoLabGameDefinition(
    Uri InfoEndpoint,
    Uri SignEndpoint,
    string ActId,
    string SignGame,
    string Referer = "https://act.hoyolab.com/");

internal sealed record MiyousheGameDefinition(
    string GameBiz,
    Uri InfoEndpoint,
    Uri SignEndpoint,
    string ActId,
    string SignGame,
    string Referer = "https://www.miyoushe.com/ys/");

internal static class GameDefinitions
{
    public static readonly Uri RolesEndpoint = new("https://api-takumi.mihoyo.com/binding/api/getUserGameRolesByCookie");

    public static readonly IReadOnlyList<GameDefinition> All = new[]
    {
        new GameDefinition(
            "gi",
            "原神",
            new HoyoLabGameDefinition(
                new Uri("https://sg-hk4e-api.hoyolab.com/event/sol/info"),
                new Uri("https://sg-hk4e-api.hoyolab.com/event/sol/sign"),
                "e202102251931481",
                "gi"),
            new MiyousheGameDefinition(
                "hk4e_cn",
                new Uri("https://api-takumi.mihoyo.com/event/luna/info"),
                new Uri("https://api-takumi.mihoyo.com/event/luna/sign"),
                "e202311201442471",
                "hk4e")),
        new GameDefinition(
            "hsr",
            "崩坏：星穹铁道",
            new HoyoLabGameDefinition(
                new Uri("https://sg-public-api.hoyolab.com/event/luna/os/info"),
                new Uri("https://sg-public-api.hoyolab.com/event/luna/os/sign"),
                "e202303301540311",
                "hsr"),
            new MiyousheGameDefinition(
                "hkrpg_cn",
                new Uri("https://api-takumi.mihoyo.com/event/luna/info"),
                new Uri("https://api-takumi.mihoyo.com/event/luna/sign"),
                "e202304121516551",
                "hkrpg")),
        new GameDefinition(
            "zzz",
            "绝区零",
            new HoyoLabGameDefinition(
                new Uri("https://sg-act-nap-api.hoyolab.com/event/luna/zzz/os/info"),
                new Uri("https://sg-act-nap-api.hoyolab.com/event/luna/zzz/os/sign"),
                "e202406031448091",
                "zzz"),
            new MiyousheGameDefinition(
                "nap_cn",
                new Uri("https://act-nap-api.mihoyo.com/event/luna/zzz/info"),
                new Uri("https://act-nap-api.mihoyo.com/event/luna/zzz/sign"),
                "e202406242138391",
                "zzz")),
        new GameDefinition(
            "bh3",
            "崩坏3",
            new HoyoLabGameDefinition(
                new Uri("https://sg-public-api.hoyolab.com/event/mani/info"),
                new Uri("https://sg-public-api.hoyolab.com/event/mani/sign"),
                "e202110291205111",
                "honkai3rd",
                "https://act.hoyolab.com/"),
            new MiyousheGameDefinition(
                "bh3_cn",
                new Uri("https://api-takumi.mihoyo.com/event/luna/info"),
                new Uri("https://api-takumi.mihoyo.com/event/luna/sign"),
                "e202306201626331",
                "bh3",
                "https://www.miyoushe.com/bh3/")),
    };

    public static bool IsKnown(string code) => All.Any(game => string.Equals(game.Code, code, StringComparison.OrdinalIgnoreCase));

    public static GameDefinition? Find(string code) => All.FirstOrDefault(game => string.Equals(game.Code, code, StringComparison.OrdinalIgnoreCase));
}

internal sealed record SklandGameDefinition(
    string Code,
    string DisplayName,
    string GameId,
    bool IsEndfield);

internal static class SklandGameDefinitions
{
    public static readonly IReadOnlyList<SklandGameDefinition> All = new[]
    {
        new SklandGameDefinition("ak", "明日方舟", "1", false),
        new SklandGameDefinition("endfield", "明日方舟：终末地", "3", true),
    };

    public static bool IsKnown(string code) => All.Any(game => string.Equals(game.Code, code, StringComparison.OrdinalIgnoreCase));

    public static SklandGameDefinition? Find(string code) => All.FirstOrDefault(game => string.Equals(game.Code, code, StringComparison.OrdinalIgnoreCase));
}

internal static class SkportGameDefinitions
{
    public static readonly IReadOnlyList<SklandGameDefinition> All = new[]
    {
        new SklandGameDefinition("endfield", "Arknights: Endfield", "3", true),
    };

    public static bool IsKnown(string code) => All.Any(game => string.Equals(game.Code, code, StringComparison.OrdinalIgnoreCase));

    public static SklandGameDefinition? Find(string code) => All.FirstOrDefault(game => string.Equals(game.Code, code, StringComparison.OrdinalIgnoreCase));
}

internal sealed record KuroGameDefinition(
    string Code,
    string DisplayName,
    string GameId);

internal static class KuroGameDefinitions
{
    public static readonly IReadOnlyList<KuroGameDefinition> All = new[]
    {
        new KuroGameDefinition("ww", "鸣潮", "3"),
        new KuroGameDefinition("pgr", "战双帕弥什", "2"),
    };

    public static bool IsKnown(string code) => All.Any(game => string.Equals(game.Code, code, StringComparison.OrdinalIgnoreCase));

    public static KuroGameDefinition? Find(string code) => All.FirstOrDefault(game => string.Equals(game.Code, code, StringComparison.OrdinalIgnoreCase));
}

internal sealed record CheckInResult(string Platform, string GameCode, string Code, string Message, bool Success);
