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
        return Build(settings, cn, os, CheckInService.LocalDate(), _context.I18n);
    }

    internal static PluginUserListBadge? Build(UserSettings settings, string? cnCookie, string? osCookie, string today, IPluginLocalization? localization = null)
    {
        settings.Normalize();
        if (!settings.Enabled) return null;
        if (settings.CnGames.Count == 0 && settings.OsGames.Count == 0)
        {
            return Badge(localization, "badge.no_games", "签到 · 未选择游戏", "warn", "badge.no_games_title", "未选择任何签到游戏");
        }
        bool cnSelected = settings.CnGames.Count > 0;
        bool osSelected = settings.OsGames.Count > 0;
        bool cnConfigured = !cnSelected || CheckInService.IsValidCookie(cnCookie);
        bool osConfigured = !osSelected || CheckInService.IsValidCookie(osCookie);
        bool cnMissing = cnSelected && !cnConfigured;
        bool osMissing = osSelected && !osConfigured;
        if (cnMissing && osMissing)
        {
            string platform = cnSelected && osSelected ? "米游社和 HoYoLAB" : cnSelected ? "米游社" : "HoYoLAB";
            return Badge(localization, "badge.not_configured", "签到 · 未配置", "warn", "badge.cookie_missing", $"{platform} Cookie 未配置或不可用");
        }
        if (cnMissing || osMissing)
        {
            string platform = cnSelected && osSelected ? "部分签到平台" : cnSelected ? "米游社" : "HoYoLAB";
            return Badge(localization, cnSelected && osSelected ? "badge.partial" : "badge.not_configured", cnSelected && osSelected ? "签到 · 部分未配置" : "签到 · 未配置", "warn", "badge.cookie_missing", $"{platform} Cookie 未配置或不可用");
        }

        IEnumerable<string> keys = settings.CnGames.Select(code => "cn:" + code).Concat(settings.OsGames.Select(code => "os:" + code));
        List<string> keyList = keys.ToList();
        bool allDone = keyList.All(key => settings.GameState.TryGetValue(key, out GameState? state)
            && state is not null
            && string.Equals(state.LastSuccessDate, today, StringComparison.Ordinal));
        if (allDone) return Badge(localization, "badge.complete", "签到 · 今日完成", "ok", "badge.complete_title", "今日签到已经完成");
        bool hasFailure = keyList.Any(key => settings.GameState.TryGetValue(key, out GameState? state)
            && state is not null
            && string.Equals(state.LastAttemptDate, today, StringComparison.Ordinal)
            && !string.Equals(state.LastResult, "success", StringComparison.OrdinalIgnoreCase)
            && !string.Equals(state.LastResult, "already", StringComparison.OrdinalIgnoreCase));
        return hasFailure
            ? Badge(localization, "badge.failed", "签到 · 有失败", "bad", "badge.failed_title", "今日签到有失败")
            : Badge(localization, "badge.pending", "签到 · 待签到", "blue", "badge.pending_title", "已启用自动签到，等待今日运行");
    }

    private static PluginUserListBadge Badge(IPluginLocalization? localization, string labelKey, string labelFallback, string tone, string titleKey, string titleFallback)
    {
        var badge = new PluginUserListBadge(localization?.T(labelKey, labelFallback) ?? labelFallback, tone, localization?.T(titleKey, titleFallback) ?? titleFallback)
        {
            LocalizedLabel = new PluginLocalizedText(labelKey, labelFallback),
            LocalizedTitle = new PluginLocalizedText(titleKey, titleFallback),
        };
        return badge;
    }
}
