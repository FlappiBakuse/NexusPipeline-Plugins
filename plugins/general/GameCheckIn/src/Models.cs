using System.Text.Json.Serialization;

namespace NexusPipeline.Plugin.GameCheckIn;

public sealed class UserSettings
{
    [JsonPropertyName("schemaVersion")]
    public int SchemaVersion { get; set; } = 3;

    [JsonPropertyName("enabled")]
    public bool Enabled { get; set; } = true;

    [JsonPropertyName("cnGames")]
    public List<string> CnGames { get; set; } = new();

    [JsonPropertyName("osGames")]
    public List<string> OsGames { get; set; } = new();

    [JsonPropertyName("sklandGames")]
    public List<string> SklandGames { get; set; } = new();

    [JsonPropertyName("skportGames")]
    public List<string> SkportGames { get; set; } = new();

    [JsonPropertyName("kuroGames")]
    public List<string> KuroGames { get; set; } = new();

    [JsonPropertyName("cnDeviceId")]
    public string CnDeviceId { get; set; } = "";

    [JsonPropertyName("kuroDevCode")]
    public string KuroDevCode { get; set; } = "";

    [JsonPropertyName("kuroDistinctId")]
    public string KuroDistinctId { get; set; } = "";

    [JsonPropertyName("lastAttemptAt")]
    public string? LastAttemptAt { get; set; }

    [JsonPropertyName("gameState")]
    public Dictionary<string, GameState> GameState { get; set; } = new(StringComparer.OrdinalIgnoreCase);

    public void Normalize()
    {
        CnGames = NormalizeGames(CnGames, GameDefinitions.IsKnown);
        OsGames = NormalizeGames(OsGames, GameDefinitions.IsKnown);
        SklandGames = NormalizeGames(SklandGames, SklandGameDefinitions.IsKnown);
        SkportGames = NormalizeGames(SkportGames, SkportGameDefinitions.IsKnown);
        KuroGames = NormalizeGames(KuroGames, KuroGameDefinitions.IsKnown);

        if (string.IsNullOrWhiteSpace(CnDeviceId) || !Guid.TryParse(CnDeviceId, out _))
        {
            CnDeviceId = Guid.NewGuid().ToString();
        }
        if (string.IsNullOrWhiteSpace(KuroDevCode))
        {
            KuroDevCode = Guid.NewGuid().ToString("N");
        }
        if (string.IsNullOrWhiteSpace(KuroDistinctId))
        {
            KuroDistinctId = Guid.NewGuid().ToString("N");
        }

        var normalized = new Dictionary<string, GameState>(StringComparer.OrdinalIgnoreCase);
        foreach ((string key, GameState? value) in GameState ?? new Dictionary<string, GameState>())
        {
            if (value is null) continue;
            string normalizedKey = NormalizeStateKey(key);
            if (string.IsNullOrWhiteSpace(normalizedKey)) continue;
            normalized[normalizedKey] = value;
        }
        GameState = normalized;
        SchemaVersion = 3;
    }

    private static List<string> NormalizeGames(IEnumerable<string>? values, Func<string, bool> isKnown) =>
        (values ?? Array.Empty<string>())
        .Where(value => isKnown(value))
        .Distinct(StringComparer.OrdinalIgnoreCase)
        .Select(code => code.ToLowerInvariant())
        .ToList();

    internal static string NormalizeStateKey(string key)
    {
        string[] parts = (key ?? "").Split(':', 2, StringSplitOptions.RemoveEmptyEntries);
        if (parts.Length != 2)
        {
            return "";
        }

        string platform = parts[0].ToLowerInvariant();
        string game = parts[1].ToLowerInvariant();
        bool valid = platform switch
        {
            "cn" or "os" => GameDefinitions.IsKnown(game),
            "skland" => SklandGameDefinitions.IsKnown(game),
            "skport" => SkportGameDefinitions.IsKnown(game),
            "kuro" => KuroGameDefinitions.IsKnown(game),
            _ => false,
        };
        return valid ? platform + ":" + game : "";
    }
}

public sealed class GameState
{
    [JsonPropertyName("lastAttemptDate")]
    public string? LastAttemptDate { get; set; }

    [JsonPropertyName("lastSuccessDate")]
    public string? LastSuccessDate { get; set; }

    [JsonPropertyName("lastResult")]
    public string? LastResult { get; set; }

    // JSON name stays stable for the existing user data; code now treats all platform credentials uniformly.
    [JsonPropertyName("cookieFingerprint")]
    public string? CredentialFingerprint { get; set; }
}

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
