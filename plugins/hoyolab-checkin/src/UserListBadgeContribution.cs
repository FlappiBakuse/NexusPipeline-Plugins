using NexusPipeline.Plugin.Abstractions;

namespace NexusPipeline.Plugin.HoyoLabCheckIn;

internal sealed class UserListBadgeContribution
{
    private const string ContributionId = "check-in-status";
    private readonly IPluginHostContextV1_2 _context;

    public UserListBadgeContribution(IPluginHostContextV1_2 context)
    {
        _context = context;
    }

    public IDisposable Register()
    {
        return _context.UserListBadges.Register(new PluginUserListBadgeContribution(
            ContributionId,
            100,
            ReadAsync));
    }

    private async ValueTask<PluginUserListBadge?> ReadAsync(string userId, CancellationToken cancellationToken)
    {
        UserSettings settings = await _context.UserData
            .ReadConfigAsync<UserSettings>(userId, cancellationToken)
            .ConfigureAwait(false) ?? new UserSettings();
        settings.Normalize();
        string? cookie = await _context.UserData
            .GetSecretAsync(userId, "cookie", cancellationToken)
            .ConfigureAwait(false);
        return Build(settings, cookie, LocalDate());
    }

    internal static PluginUserListBadge? Build(UserSettings settings, string? cookie, string today)
    {
        settings.Normalize();
        if (!settings.Enabled)
        {
            return null;
        }
        if (settings.Games.Count == 0)
        {
            return new PluginUserListBadge(
                "签到 · 未选择游戏",
                "warn",
                "未选择任何签到游戏");
        }
        if (!CheckInService.IsValidCookie(cookie))
        {
            return new PluginUserListBadge(
                "签到 · 未配置",
                "warn",
                "HoYoLAB Cookie 未配置或不可用");
        }

        bool allSucceeded = settings.Games.All(gameCode =>
            settings.GameState.TryGetValue(gameCode, out GameState? state)
            && state is not null
            && string.Equals(state.LastSuccessDate, today, StringComparison.Ordinal));
        if (allSucceeded)
        {
            return new PluginUserListBadge(
                "签到 · 今日完成",
                "ok",
                "今日签到已经完成");
        }

        bool hasFailure = settings.Games.Any(gameCode =>
            settings.GameState.TryGetValue(gameCode, out GameState? state)
            && state is not null
            && string.Equals(state.LastAttemptDate, today, StringComparison.Ordinal)
            && !string.Equals(state.LastResult, "success", StringComparison.OrdinalIgnoreCase)
            && !string.Equals(state.LastResult, "already", StringComparison.OrdinalIgnoreCase)
            && !string.Equals(state.LastResult, "invalid_cookie", StringComparison.OrdinalIgnoreCase));
        if (hasFailure)
        {
            return new PluginUserListBadge(
                "签到 · 有失败",
                "bad",
                "今日签到有失败");
        }

        return new PluginUserListBadge(
            "签到 · 待签到",
            "blue",
            "已启用自动签到，等待今日运行");
    }

    private static string LocalDate() =>
        DateTimeOffset.Now.ToLocalTime().ToString("yyyy-MM-dd");
}
