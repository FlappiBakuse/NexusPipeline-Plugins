using System.Collections.Concurrent;
using System.Text;
using NexusPipeline.Plugin.Abstractions;

namespace NexusPipeline.Plugin.HoyoLabCheckIn;

internal sealed class CheckInService
{
    private const int MaxCookieBytes = 16 * 1024;
    private readonly IPluginHostContextV1_1 _context;
    private readonly HoyoLabClient _client;
    private readonly ConcurrentDictionary<string, SemaphoreSlim> _userFlights = new(StringComparer.OrdinalIgnoreCase);

    public CheckInService(IPluginHostContextV1_1 context)
    {
        _context = context;
        _client = new HoyoLabClient(context.Http);
    }

    public async ValueTask HandleUserRunStartingAsync(
        PluginUserRunStartingEvent eventData,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(eventData.UserId))
        {
            return;
        }
        SemaphoreSlim flight = _userFlights.GetOrAdd(eventData.UserId, _ => new SemaphoreSlim(1, 1));
        if (!await flight.WaitAsync(0, cancellationToken).ConfigureAwait(false))
        {
            return;
        }
        try
        {
            await RunForUserAsync(eventData, cancellationToken).ConfigureAwait(false);
        }
        finally
        {
            flight.Release();
        }
    }

    private async Task RunForUserAsync(
        PluginUserRunStartingEvent eventData,
        CancellationToken cancellationToken)
    {
        UserSettings settings = await _context.UserData
            .ReadConfigAsync<UserSettings>(eventData.UserId, cancellationToken)
            .ConfigureAwait(false) ?? new UserSettings();
        settings.Normalize();
        if (!settings.Enabled)
        {
            return;
        }

        string today = DateTimeOffset.Now.ToLocalTime().ToString("yyyy-MM-dd");
        List<GameDefinition> pendingGames = settings.Games
            .Select(GameDefinitions.Find)
            .Where(game => game is not null)
            .Cast<GameDefinition>()
            .Where(game => !HasSucceededToday(settings, game.Code, today))
            .ToList();
        if (pendingGames.Count == 0)
        {
            return;
        }

        string? cookie = await _context.UserData
            .GetSecretAsync(eventData.UserId, "cookie", cancellationToken)
            .ConfigureAwait(false);
        var results = new List<CheckInResult>();
        if (!IsValidCookie(cookie))
        {
            results.AddRange(pendingGames.Select(game =>
                new CheckInResult(game.Code, "invalid_cookie", "Cookie 未配置或格式无效", false)));
        }
        else
        {
            foreach (GameDefinition game in pendingGames)
            {
                results.Add(await _client.SignAsync(game, cookie!, cancellationToken).ConfigureAwait(false));
            }
        }

        settings.LastAttemptAt = DateTimeOffset.Now.ToLocalTime().ToString("O");
        foreach (CheckInResult result in results.Where(item => item.Success))
        {
            settings.GameState[result.GameCode] = new GameState
            {
                LastSuccessDate = today,
                LastResult = result.Code,
            };
        }
        try
        {
            await _context.UserData.WriteConfigAsync(eventData.UserId, settings, cancellationToken).ConfigureAwait(false);
        }
        catch (Exception ex)
        {
            _context.Logger.Warn($"用户签到状态保存失败：{ex.Message}");
        }

        await SendSummaryAsync(eventData, results, cancellationToken).ConfigureAwait(false);
    }

    private async Task SendSummaryAsync(
        PluginUserRunStartingEvent eventData,
        IReadOnlyList<CheckInResult> results,
        CancellationToken cancellationToken)
    {
        bool allSucceeded = results.All(result => result.Success);
        string title = allSucceeded ? "HoYoLAB 自动签到成功" : "HoYoLAB 自动签到有失败";
        string body = $"用户：{eventData.UserName}\n"
            + string.Join("\n", results.Select(result =>
            {
                GameDefinition? game = GameDefinitions.Find(result.GameCode);
                return $"{game?.DisplayName ?? result.GameCode}：{(result.Success ? "成功" : "失败")}（{result.Message}）";
            }));
        try
        {
            await _context.Notifications.SendAsync(new PluginNotification(title, body), cancellationToken).ConfigureAwait(false);
        }
        catch (Exception ex)
        {
            _context.Logger.Warn($"签到通知发送失败：{ex.Message}");
        }
    }

    private static bool HasSucceededToday(UserSettings settings, string gameCode, string today) =>
        settings.GameState.TryGetValue(gameCode, out GameState? state)
        && string.Equals(state.LastSuccessDate, today, StringComparison.Ordinal);

    internal static bool IsValidCookie(string? cookie)
    {
        if (string.IsNullOrWhiteSpace(cookie) || Encoding.UTF8.GetByteCount(cookie) > MaxCookieBytes)
        {
            return false;
        }
        return cookie.IndexOfAny(new[] { '\r', '\n' }) < 0;
    }
}
