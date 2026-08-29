using NexusPipeline.Plugin.Abstractions;

namespace NexusPipeline.Plugin.GameCheckIn;

internal sealed class UserListBadgeContribution
{
    private readonly IPluginHostContextV1_2 _context;

    public UserListBadgeContribution(IPluginHostContextV1_2 context) { _context = context; }

    public IDisposable Register() => _context.UserListBadges.Register(new PluginUserListBadgeContribution("check-in-status", 100, ReadAsync));

    private async ValueTask<PluginUserListBadge?> ReadAsync(string userId, CancellationToken cancellationToken)
    {
        UserSettings settings = await _context.UserData.ReadConfigAsync<UserSettings>(userId, cancellationToken).ConfigureAwait(false)
            ?? new UserSettings();
        settings.Normalize();
        string? cn = await _context.UserData.GetSecretAsync(userId, "cnCookie", cancellationToken).ConfigureAwait(false);
        string? os = await _context.UserData.GetSecretAsync(userId, "osCookie", cancellationToken).ConfigureAwait(false);
        if (string.IsNullOrWhiteSpace(os)) os = await _context.UserData.GetSecretAsync(userId, "cookie", cancellationToken).ConfigureAwait(false);
        return Build(settings, cn, os, CheckInService.LocalDate());
    }

    internal static PluginUserListBadge? Build(UserSettings settings, string? cnCookie, string? osCookie, string today)
    {
        settings.Normalize();
        if (!settings.Enabled) return null;
        if (settings.CnGames.Count == 0 && settings.OsGames.Count == 0)
        {
            return new PluginUserListBadge("签到 · 未选择游戏", "warn", "未选择任何签到游戏");
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
            return new PluginUserListBadge("签到 · 未配置", "warn", $"{platform} Cookie 未配置或不可用");
        }
        if (cnMissing || osMissing)
        {
            string platform = cnSelected && osSelected ? "部分签到平台" : cnSelected ? "米游社" : "HoYoLAB";
            return new PluginUserListBadge($"签到 · {(cnSelected && osSelected ? "部分未配置" : "未配置")}", "warn", $"{platform} Cookie 未配置或不可用");
        }

        IEnumerable<string> keys = settings.CnGames.Select(code => "cn:" + code).Concat(settings.OsGames.Select(code => "os:" + code));
        List<string> keyList = keys.ToList();
        bool allDone = keyList.All(key => settings.GameState.TryGetValue(key, out GameState? state)
            && state is not null
            && string.Equals(state.LastSuccessDate, today, StringComparison.Ordinal));
        if (allDone) return new PluginUserListBadge("签到 · 今日完成", "ok", "今日签到已经完成");
        bool hasFailure = keyList.Any(key => settings.GameState.TryGetValue(key, out GameState? state)
            && state is not null
            && string.Equals(state.LastAttemptDate, today, StringComparison.Ordinal)
            && !string.Equals(state.LastResult, "success", StringComparison.OrdinalIgnoreCase)
            && !string.Equals(state.LastResult, "already", StringComparison.OrdinalIgnoreCase));
        return hasFailure
            ? new PluginUserListBadge("签到 · 有失败", "bad", "今日签到有失败")
            : new PluginUserListBadge("签到 · 待签到", "blue", "已启用自动签到，等待今日运行");
    }
}
