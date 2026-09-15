using System.Collections.Concurrent;
using System.Security.Cryptography;
using System.Text;
using NexusPipeline.Plugin.Abstractions;

namespace NexusPipeline.Plugin.GameCheckIn;

internal sealed class CheckInService
{
    private const int MaxCredentialBytes = 16 * 1024;
    private readonly IPluginHostContextV1_4 _context;
    private readonly HoyoLabClient _osClient;
    private readonly MiyousheClient _cnClient;
    private readonly SklandClient _sklandClient;
    private readonly SklandClient _skportClient;
    private readonly KuroClient _kuroClient;
    private readonly ConcurrentDictionary<string, SemaphoreSlim> _userFlights = new(StringComparer.OrdinalIgnoreCase);

    public CheckInService(IPluginHostContextV1_4 context)
    {
        _context = context;
        _osClient = new HoyoLabClient(context.Http);
        _cnClient = new MiyousheClient(context.Http);
        _sklandClient = new SklandClient(context.Http, "skland");
        _skportClient = new SklandClient(context.Http, "skport");
        _kuroClient = new KuroClient(context.Http);
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

        string? cnCookie = await ReadSecretAsync(eventData.UserId, "cnCookie", cancellationToken).ConfigureAwait(false);
        string? osCookie = await ReadSecretAsync(eventData.UserId, "osCookie", cancellationToken).ConfigureAwait(false);
        string? sklandToken = await ReadSecretAsync(eventData.UserId, "sklandToken", cancellationToken).ConfigureAwait(false);
        string? skportToken = await ReadSecretAsync(eventData.UserId, "skportToken", cancellationToken).ConfigureAwait(false);
        string? kuroToken = await ReadSecretAsync(eventData.UserId, "kuroToken", cancellationToken).ConfigureAwait(false);

        string today = LocalDate();
        var credentials = new Dictionary<string, string?>(StringComparer.OrdinalIgnoreCase)
        {
            ["cn"] = cnCookie,
            ["os"] = osCookie,
            ["skland"] = sklandToken,
            ["skport"] = skportToken,
            ["kuro"] = kuroToken,
        };
        var fingerprints = credentials.ToDictionary(
            pair => pair.Key,
            pair => CredentialFingerprint(pair.Value),
            StringComparer.OrdinalIgnoreCase);
        var results = new List<CheckInResult>();

        await RunGamesAsync(
            "cn",
            settings.CnGames,
            cnCookie,
            fingerprints["cn"],
            today,
            settings,
            GameDefinitions.Find,
            (game, credential) => _cnClient.SignAsync(game, credential, settings.CnDeviceId, cancellationToken),
            results,
            cancellationToken).ConfigureAwait(false);
        await RunGamesAsync(
            "os",
            settings.OsGames,
            osCookie,
            fingerprints["os"],
            today,
            settings,
            GameDefinitions.Find,
            (game, credential) => _osClient.SignAsync(game, credential, cancellationToken),
            results,
            cancellationToken).ConfigureAwait(false);
        await RunGamesAsync(
            "skland",
            settings.SklandGames,
            sklandToken,
            fingerprints["skland"],
            today,
            settings,
            SklandGameDefinitions.Find,
            (game, credential) => _sklandClient.SignAsync(game, credential, cancellationToken),
            results,
            cancellationToken).ConfigureAwait(false);
        await RunGamesAsync(
            "skport",
            settings.SkportGames,
            skportToken,
            fingerprints["skport"],
            today,
            settings,
            SkportGameDefinitions.Find,
            (game, credential) => _skportClient.SignAsync(game, credential, cancellationToken),
            results,
            cancellationToken).ConfigureAwait(false);
        await RunGamesAsync(
            "kuro",
            settings.KuroGames,
            kuroToken,
            fingerprints["kuro"],
            today,
            settings,
            KuroGameDefinitions.Find,
            (game, credential) => _kuroClient.SignAsync(
                game,
                credential,
                settings.KuroDevCode,
                settings.KuroDistinctId,
                cancellationToken),
            results,
            cancellationToken).ConfigureAwait(false);

        if (results.Count == 0) return;
        settings.LastAttemptAt = DateTimeOffset.Now.ToString("O");
        foreach (CheckInResult result in results)
        {
            ApplyResult(settings, result, today, fingerprints.GetValueOrDefault(result.Platform, ""));
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

    private async Task<string?> ReadSecretAsync(
        string userId,
        string key,
        CancellationToken cancellationToken)
    {
        try
        {
            return await _context.UserData.GetSecretAsync(userId, key, cancellationToken).ConfigureAwait(false);
        }
        catch (Exception ex)
        {
            _context.Logger.Warn($"读取用户签到凭据失败（{key}）：{ex.Message}");
            return null;
        }
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

    private async Task RunGamesAsync<TGame>(
        string platform,
        IReadOnlyList<string> selectedGames,
        string? credential,
        string fingerprint,
        string today,
        UserSettings settings,
        Func<string, TGame?> find,
        Func<TGame, string, Task<CheckInResult>> sign,
        List<CheckInResult> results,
        CancellationToken cancellationToken)
        where TGame : class
    {
        foreach (string code in selectedGames)
        {
            TGame? game = find(code);
            if (game is null || HasTerminalToday(settings, platform, code, today, fingerprint)) continue;
            if (!IsValidCredential(credential))
            {
                results.Add(new CheckInResult(
                    platform,
                    code,
                    "invalid_credential",
                    _context.I18n.T("result.invalid_credential", "凭据未配置或格式无效"),
                    false));
                continue;
            }
            try
            {
                CheckInResult result = await sign(game, credential!).ConfigureAwait(false);
                results.Add(LocalizeResult(result));
            }
            catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
            {
                throw;
            }
            catch (Exception ex)
            {
                _context.Logger.Warn($"{platform}:{code} 签到请求异常：{ex.Message}");
                results.Add(new CheckInResult(
                    platform,
                    code,
                    "transport_error",
                    _context.I18n.T("result.request_failed", "请求失败"),
                    false));
            }
        }
    }

    private CheckInResult LocalizeResult(CheckInResult result)
    {
        string fallback = result.Success ? "签到成功" : result.Message;
        string message = _context.I18n.T("result." + result.Code, fallback);
        return result with { Message = message };
    }

    private async Task SendSummaryAsync(
        PluginUserRunStartingEvent eventData,
        IReadOnlyList<CheckInResult> results,
        CancellationToken cancellationToken)
    {
        bool allSucceeded = results.All(result => result.Success);
        string title = allSucceeded
            ? _context.I18n.T("notification.success", "游戏自动签到成功")
            : _context.I18n.T("notification.failed", "游戏自动签到有失败");
        string body = _context.I18n.T(
                "notification.user",
                "用户：{user}",
                new Dictionary<string, object?> { ["user"] = eventData.UserName })
            + "\n"
            + string.Join("\n", results.Select(result =>
            {
                string platform = _context.I18n.T("platform." + result.Platform, PlatformFallback(result.Platform));
                string gameName = _context.I18n.T("game." + result.GameCode, GameFallback(result.Platform, result.GameCode));
                string resultLabel = result.Success
                    ? _context.I18n.T("result.success", "成功")
                    : _context.I18n.T("result.failed", "失败");
                return $"{platform} · {gameName}：{resultLabel}（{result.Message}）";
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
        if (string.IsNullOrWhiteSpace(key)) return;
        if (!settings.GameState.TryGetValue(key, out GameState? state) || state is null) state = new GameState();
        state.LastAttemptDate = today;
        state.LastResult = result.Code;
        state.CredentialFingerprint = fingerprint;
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
                    && (state.LastResult is "captcha_required"
                        or "first_bind"
                        or "invalid_cookie"
                        or "invalid_credential"
                        or "credential_expired"
                        or "manual_action_required"
                        or "no_role")
                    && string.Equals(state.CredentialFingerprint ?? "", fingerprint, StringComparison.OrdinalIgnoreCase)));
    }

    internal static string CredentialFingerprint(string? credential)
    {
        if (!IsValidCredential(credential)) return "";
        return Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(credential!))).ToLowerInvariant();
    }

    internal static bool IsValidCredential(string? credential)
    {
        if (string.IsNullOrWhiteSpace(credential) || Encoding.UTF8.GetByteCount(credential) > MaxCredentialBytes) return false;
        return credential.IndexOfAny(new[] { '\r', '\n' }) < 0;
    }

    internal static string LocalDate() => DateTimeOffset.Now.ToString("yyyy-MM-dd");

    private static string PlatformFallback(string platform) => platform switch
    {
        "cn" => "米游社",
        "os" => "HoYoLAB",
        "skland" => "森空岛",
        "skport" => "SKPORT",
        "kuro" => "库街区",
        _ => platform,
    };

    private static string GameFallback(string platform, string gameCode) => platform switch
    {
        "cn" or "os" => GameDefinitions.Find(gameCode)?.DisplayName ?? gameCode,
        "skland" => SklandGameDefinitions.Find(gameCode)?.DisplayName ?? gameCode,
        "skport" => SkportGameDefinitions.Find(gameCode)?.DisplayName ?? gameCode,
        "kuro" => KuroGameDefinitions.Find(gameCode)?.DisplayName ?? gameCode,
        _ => gameCode,
    };
}
