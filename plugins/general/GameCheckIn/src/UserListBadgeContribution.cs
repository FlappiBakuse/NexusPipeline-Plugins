using NexusPipeline.Plugin.Abstractions;

namespace NexusPipeline.Plugin.GameCheckIn;

internal sealed class UserListBadgeContribution
{
    private readonly IPluginHostContextV1_4 _context;

    public UserListBadgeContribution(IPluginHostContextV1_4 context) { _context = context; }

    public IDisposable Register() => _context.UserListBadges.Register(new PluginUserListBadgeContribution("check-in-status", 100, ReadAsync));

    private async ValueTask<PluginUserListBadge?> ReadAsync(string userId, CancellationToken cancellationToken)
    {
        UserSettings settings = await _context.UserData.ReadConfigAsync<UserSettings>(userId, cancellationToken).ConfigureAwait(false)
            ?? new UserSettings();
        settings.Normalize();
        string? cn = await _context.UserData.GetSecretAsync(userId, "cnCookie", cancellationToken).ConfigureAwait(false);
        string? os = await _context.UserData.GetSecretAsync(userId, "osCookie", cancellationToken).ConfigureAwait(false);
        string? skland = await _context.UserData.GetSecretAsync(userId, "sklandToken", cancellationToken).ConfigureAwait(false);
        string? skport = await _context.UserData.GetSecretAsync(userId, "skportToken", cancellationToken).ConfigureAwait(false);
        string? kuro = await _context.UserData.GetSecretAsync(userId, "kuroToken", cancellationToken).ConfigureAwait(false);
        return Build(settings, cn, os, skland, skport, kuro, CheckInService.LocalDate(), _context.I18n);
    }

    internal static PluginUserListBadge? Build(
        UserSettings settings,
        string? cnCookie,
        string? osCookie,
        string? sklandToken,
        string? skportToken,
        string? kuroToken,
        string today,
        IPluginLocalization? localization = null)
    {
        settings.Normalize();
        if (!settings.Enabled) return null;

        var selections = new[]
        {
            new PlatformSelection("cn", settings.CnGames, cnCookie),
            new PlatformSelection("os", settings.OsGames, osCookie),
            new PlatformSelection("skland", settings.SklandGames, sklandToken),
            new PlatformSelection("skport", settings.SkportGames, skportToken),
            new PlatformSelection("kuro", settings.KuroGames, kuroToken),
        };
        PlatformSelection[] selected = selections.Where(item => item.Games.Count > 0).ToArray();
        if (selected.Length == 0)
        {
            return Badge(localization, "badge.no_games", "签到 · 未选择游戏", "warn", "badge.no_games_title", "未选择任何签到游戏");
        }

        int missingCount = selected.Count(item => !CheckInService.IsValidCredential(item.Credential));
        if (missingCount == selected.Length)
        {
            return Badge(localization, "badge.not_configured", "签到 · 未配置", "warn", "badge.credential_missing", "所选签到平台凭据未配置或不可用");
        }
        if (missingCount > 0)
        {
            return Badge(localization, "badge.partial", "签到 · 部分未配置", "warn", "badge.credential_missing", "部分签到平台凭据未配置或不可用");
        }

        string[] keys = selected
            .SelectMany(item => item.Games.Select(code => item.Platform + ":" + code))
            .ToArray();
        bool allDone = keys.All(key => settings.GameState.TryGetValue(key, out GameState? state)
            && state is not null
            && string.Equals(state.LastSuccessDate, today, StringComparison.Ordinal));
        if (allDone)
        {
            return Badge(localization, "badge.complete", "签到 · 今日完成", "ok", "badge.complete_title", "今日签到已经完成");
        }

        bool hasFailure = keys.Any(key => settings.GameState.TryGetValue(key, out GameState? state)
            && state is not null
            && string.Equals(state.LastAttemptDate, today, StringComparison.Ordinal)
            && !string.Equals(state.LastResult, "success", StringComparison.OrdinalIgnoreCase)
            && !string.Equals(state.LastResult, "already", StringComparison.OrdinalIgnoreCase));
        return hasFailure
            ? Badge(localization, "badge.failed", "签到 · 有失败", "bad", "badge.failed_title", "今日签到有失败")
            : Badge(localization, "badge.pending", "签到 · 待签到", "blue", "badge.pending_title", "已启用自动签到，等待今日运行");
    }

    private static PluginUserListBadge Badge(
        IPluginLocalization? localization,
        string labelKey,
        string labelFallback,
        string tone,
        string titleKey,
        string titleFallback)
    {
        var badge = new PluginUserListBadge(
            localization?.T(labelKey, labelFallback) ?? labelFallback,
            tone,
            localization?.T(titleKey, titleFallback) ?? titleFallback)
        {
            LocalizedLabel = new PluginLocalizedText(labelKey, labelFallback),
            LocalizedTitle = new PluginLocalizedText(titleKey, titleFallback),
        };
        return badge;
    }

    private sealed record PlatformSelection(string Platform, IReadOnlyList<string> Games, string? Credential);
}
