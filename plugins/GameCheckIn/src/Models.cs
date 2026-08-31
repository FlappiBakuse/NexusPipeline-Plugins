using System.Text.Json.Serialization;

namespace NexusPipeline.Plugin.GameCheckIn;

public sealed class UserSettings
{
    [JsonPropertyName("schemaVersion")]
    public int SchemaVersion { get; set; } = 2;

    [JsonPropertyName("enabled")]
    public bool Enabled { get; set; } = true;

    [JsonPropertyName("cnGames")]
    public List<string> CnGames { get; set; } = new();

    [JsonPropertyName("osGames")]
    public List<string> OsGames { get; set; } = new();

    [JsonPropertyName("cnDeviceId")]
    public string CnDeviceId { get; set; } = "";

    [JsonPropertyName("lastAttemptAt")]
    public string? LastAttemptAt { get; set; }

    [JsonPropertyName("gameState")]
    public Dictionary<string, GameState> GameState { get; set; } = new(StringComparer.OrdinalIgnoreCase);

    public void Normalize()
    {
        CnGames = NormalizeGames(CnGames);
        OsGames = NormalizeGames(OsGames);
        if (string.IsNullOrWhiteSpace(CnDeviceId) || !Guid.TryParse(CnDeviceId, out _))
        {
            CnDeviceId = Guid.NewGuid().ToString();
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
        SchemaVersion = 2;
    }

    private static List<string> NormalizeGames(IEnumerable<string>? values) =>
        (values ?? Array.Empty<string>())
        .Where(GameDefinitions.IsKnown)
        .Distinct(StringComparer.OrdinalIgnoreCase)
        .Select(code => code.ToLowerInvariant())
        .ToList();

    internal static string NormalizeStateKey(string key)
    {
        string[] parts = (key ?? "").Split(':', 2, StringSplitOptions.RemoveEmptyEntries);
        if (parts.Length != 2
            || (!parts[0].Equals("cn", StringComparison.OrdinalIgnoreCase)
                && !parts[0].Equals("os", StringComparison.OrdinalIgnoreCase))
            || !GameDefinitions.IsKnown(parts[1]))
        {
            return "";
        }
        return parts[0].ToLowerInvariant() + ":" + parts[1].ToLowerInvariant();
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

    [JsonPropertyName("cookieFingerprint")]
    public string? CookieFingerprint { get; set; }
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
    string SignGame);

internal sealed record MiyousheGameDefinition(
    string GameBiz,
    Uri InfoEndpoint,
    Uri SignEndpoint,
    string ActId,
    string SignGame);

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
    };

    public static bool IsKnown(string code) => All.Any(game => string.Equals(game.Code, code, StringComparison.OrdinalIgnoreCase));

    public static GameDefinition? Find(string code) => All.FirstOrDefault(game => string.Equals(game.Code, code, StringComparison.OrdinalIgnoreCase));
}

internal sealed record CheckInResult(string Platform, string GameCode, string Code, string Message, bool Success);
