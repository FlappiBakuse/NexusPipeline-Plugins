using System.Text.Json.Serialization;

namespace NexusPipeline.Plugin.HoyoLabCheckIn;

public sealed class UserSettings
{
    [JsonPropertyName("enabled")]
    public bool Enabled { get; set; } = true;

    [JsonPropertyName("games")]
    public List<string> Games { get; set; } = GameDefinitions.All.Select(game => game.Code).ToList();

    [JsonPropertyName("lastAttemptAt")]
    public string? LastAttemptAt { get; set; }

    [JsonPropertyName("gameState")]
    public Dictionary<string, GameState> GameState { get; set; } = new(StringComparer.OrdinalIgnoreCase);

    public void Normalize()
    {
        Games = (Games ?? new List<string>())
            .Where(GameDefinitions.IsKnown)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .Select(code => code.ToLowerInvariant())
            .ToList();
        GameState = GameState is null
            ? new Dictionary<string, GameState>(StringComparer.OrdinalIgnoreCase)
            : new Dictionary<string, GameState>(GameState, StringComparer.OrdinalIgnoreCase);
    }
}

public sealed class GameState
{
    [JsonPropertyName("lastSuccessDate")]
    public string? LastSuccessDate { get; set; }

    [JsonPropertyName("lastResult")]
    public string? LastResult { get; set; }
}

internal sealed record GameDefinition(
    string Code,
    string DisplayName,
    Uri Endpoint,
    string ActId,
    string SignGame);

internal static class GameDefinitions
{
    public static readonly IReadOnlyList<GameDefinition> All = new[]
    {
        new GameDefinition(
            "gi",
            "原神",
            new Uri("https://sg-hk4e-api.hoyolab.com/event/sol/sign"),
            "e202102251931481",
            "gi"),
        new GameDefinition(
            "hsr",
            "崩坏：星穹铁道",
            new Uri("https://sg-public-api.hoyolab.com/event/luna/os/sign"),
            "e202303301540311",
            "hsr"),
        new GameDefinition(
            "zzz",
            "绝区零",
            new Uri("https://sg-act-nap-api.hoyolab.com/event/luna/zzz/os/sign"),
            "e202406031448091",
            "zzz"),
    };

    public static bool IsKnown(string code) => All.Any(game => string.Equals(game.Code, code, StringComparison.OrdinalIgnoreCase));

    public static GameDefinition? Find(string code) => All.FirstOrDefault(game => string.Equals(game.Code, code, StringComparison.OrdinalIgnoreCase));
}

internal sealed record CheckInResult(string GameCode, string Code, string Message, bool Success);
