using System.Collections.Concurrent;
using System.Security.Cryptography;
using System.Text;
using NexusPipeline.Plugin.Abstractions;

namespace NexusPipeline.Plugin.GameCheckIn;

internal sealed class CheckInService
{
    private const int MaxCookieBytes = 16 * 1024;
    private readonly IPluginHostContextV1_2 _context;
    private readonly HoyoLabClient _osClient;
    private readonly MiyousheClient _cnClient;
    private readonly ConcurrentDictionary<string, SemaphoreSlim> _userFlights = new(StringComparer.OrdinalIgnoreCase);

    public CheckInService(IPluginHostContextV1_2 context)
    {
        _context = context;
        _osClient = new HoyoLabClient(context.Http);
        _cnClient = new MiyousheClient(context.Http);
    }

    public async ValueTask HandleUserRunStartingAsync(
        PluginUserRunStartingEvent eventData,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(eventData.UserId)) return;
        SemaphoreSlim flight = _userFlights.GetOrAdd(eventData.UserId, _ => new SemaphoreSlim(1, 1));
        if (!await flight.WaitAsync(0, cancellationToken).ConfigureAwait(false)) return;
        try { await RunForUserAsync(eventData, cancellationToken).ConfigureAwait(false); }
        finally { flight.Release(); }
    }

    private async Task RunForUserAsync(
        PluginUserRunStartingEvent eventData,
        CancellationToken cancellationToken)
    {
        UserSettings settings = await _context.UserData
            .ReadConfigAsync<UserSettings>(eventData.UserId, cancellationToken)
            .ConfigureAwait(false) ?? new UserSettings();
        settings.Normalize();
        await PersistSettingsAsync(eventData.UserId, settings, cancellationToken).ConfigureAwait(false);
        if (!settings.Enabled) return;

        string? cnCookie = await _context.UserData.GetSecretAsync(eventData.UserId, "cnCookie", cancellationToken).ConfigureAwait(false);
        string? osCookie = await _context.UserData.GetSecretAsync(eventData.UserId, "osCookie", cancellationToken).ConfigureAwait(false);
        string today = LocalDate();
        string cnFingerprint = CookieFingerprint(cnCookie);
        string osFingerprint = CookieFingerprint(osCookie);
        var results = new List<CheckInResult>();

        await RunPlatformAsync(
            "cn",
            settings.CnGames,
            cnCookie,
            cnFingerprint,
            today,
            settings,
            (game, cookie) => _cnClient.SignAsync(game, cookie, settings.CnDeviceId, cancellationToken),
            results,
            cancellationToken).ConfigureAwait(false);
        await RunPlatformAsync(
            "os",
            settings.OsGames,
            osCookie,
            osFingerprint,
            today,
            settings,
            (game, cookie) => _osClient.SignAsync(game, cookie, cancellationToken),
            results,
            cancellationToken).ConfigureAwait(false);

        if (results.Count == 0) return;
        settings.LastAttemptAt = DateTimeOffset.Now.ToString("O");
        foreach (CheckInResult result in results)
        {
            ApplyResult(settings, result, today, result.Platform == "cn" ? cnFingerprint : osFingerprint);
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

    private async Task PersistSettingsAsync(
        string userId,
        UserSettings settings,
        CancellationToken cancellationToken)
    {
        try
        {
            await _context.UserData.WriteConfigAsync(userId, settings, cancellationToken).ConfigureAwait(false);
        }
        catch (Exception ex)
        {
            _context.Logger.Warn($"用户签到配置保存失败：{ex.Message}");
        }
    }

    private async Task RunPlatformAsync(
        string platform,
        IReadOnlyList<string> selectedGames,
        string? cookie,
        string fingerprint,
        string today,
        UserSettings settings,
        Func<GameDefinition, string, Task<CheckInResult>> sign,
        List<CheckInResult> results,
        CancellationToken cancellationToken)
    {
        foreach (string code in selectedGames)
        {
            GameDefinition? game = GameDefinitions.Find(code);
            if (game is null || HasTerminalToday(settings, platform, code, today, fingerprint)) continue;
            if (!IsValidCookie(cookie))
            {
                results.Add(new CheckInResult(platform, code, "invalid_cookie", "Cookie 未配置或格式无效", false));
                continue;
            }
            try
            {
                results.Add(await sign(game, cookie!).ConfigureAwait(false));
            }
            catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
            {
                throw;
            }
            catch (Exception ex)
            {
                _context.Logger.Warn($"{platform}:{code} 签到请求异常：{ex.Message}");
                results.Add(new CheckInResult(platform, code, "transport_error", "请求失败", false));
            }
        }
    }

    private async Task SendSummaryAsync(
        PluginUserRunStartingEvent eventData,
        IReadOnlyList<CheckInResult> results,
        CancellationToken cancellationToken)
    {
        bool allSucceeded = results.All(result => result.Success);
        string title = allSucceeded ? "游戏自动签到成功" : "游戏自动签到有失败";
        string body = $"用户：{eventData.UserName}\n"
            + string.Join("\n", results.Select(result =>
            {
                GameDefinition? game = GameDefinitions.Find(result.GameCode);
                string platform = result.Platform == "cn" ? "米游社" : "HoYoLAB";
                return $"{platform} · {game?.DisplayName ?? result.GameCode}：{(result.Success ? "成功" : "失败")}（{result.Message}）";
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

    internal static void ApplyResult(UserSettings settings, CheckInResult result, string today, string fingerprint = "")
    {
        string key = UserSettings.NormalizeStateKey(result.Platform + ":" + result.GameCode);
        if (!settings.GameState.TryGetValue(key, out GameState? state) || state is null) state = new GameState();
        state.LastAttemptDate = today;
        state.LastResult = result.Code;
        state.CookieFingerprint = fingerprint;
        if (result.Success) state.LastSuccessDate = today;
        settings.GameState[key] = state;
    }

    internal static bool HasTerminalToday(UserSettings settings, string platform, string gameCode, string today, string fingerprint)
    {
        string key = UserSettings.NormalizeStateKey(platform + ":" + gameCode);
        return settings.GameState.TryGetValue(key, out GameState? state)
            && state is not null
            && (string.Equals(state.LastSuccessDate, today, StringComparison.Ordinal)
                || (string.Equals(state.LastAttemptDate, today, StringComparison.Ordinal)
                    && state.LastResult is "captcha_required" or "first_bind" or "invalid_cookie"
                    && string.Equals(state.CookieFingerprint ?? "", fingerprint, StringComparison.OrdinalIgnoreCase)));
    }

    internal static string CookieFingerprint(string? cookie)
    {
        if (!IsValidCookie(cookie)) return "";
        return Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(cookie!))).ToLowerInvariant();
    }

    internal static bool IsValidCookie(string? cookie)
    {
        if (string.IsNullOrWhiteSpace(cookie) || Encoding.UTF8.GetByteCount(cookie) > MaxCookieBytes) return false;
        return cookie.IndexOfAny(new[] { '\r', '\n' }) < 0;
    }

    internal static string LocalDate() => DateTimeOffset.Now.ToString("yyyy-MM-dd");
}
