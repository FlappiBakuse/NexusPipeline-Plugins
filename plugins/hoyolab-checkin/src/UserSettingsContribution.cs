using System.Text.Json.Nodes;
using NexusPipeline.Plugin.Abstractions;

namespace NexusPipeline.Plugin.HoyoLabCheckIn;

internal sealed class UserSettingsContribution
{
    private const string ContributionId = "user-settings";
    private readonly IPluginHostContextV1_1 _context;

    public UserSettingsContribution(IPluginHostContextV1_1 context)
    {
        _context = context;
    }

    public IDisposable Register()
    {
        return _context.UserGlobalManagement.Register(new PluginUserGlobalManagementContribution(
            ContributionId,
            "HoYoLAB 自动签到",
            "管理用户的签到开关、Cookie 和目标游戏。签到只在用户脚本实际开始运行时触发。",
            100,
            new[]
            {
                new PluginUserGlobalManagementField("enabled", "启用自动签到", "switch", "关闭后保留配置但不执行签到。", Required: true),
                new PluginUserGlobalManagementField("cookie", "HoYoLAB Cookie", "secret", "完整 Cookie 将由宿主加密保存。", Placeholder: "请输入完整 Cookie", MaxLength: 16 * 1024),
                new PluginUserGlobalManagementField(
                    "games",
                    "签到游戏",
                    "multi-select",
                    "选择需要签到的游戏。",
                    Required: true,
                    Options: GameDefinitions.All.Select(game => new PluginUserGlobalManagementOption(game.Code, game.DisplayName)).ToArray()),
                new PluginUserGlobalManagementField("lastStatus", "最近状态", "status", "最近一次实际尝试的结果。", ReadOnly: true),
            },
            ReadAsync,
            SaveAsync));
    }

    private async ValueTask<JsonObject> ReadAsync(string userId, CancellationToken cancellationToken)
    {
        UserSettings settings = await _context.UserData
            .ReadConfigAsync<UserSettings>(userId, cancellationToken)
            .ConfigureAwait(false) ?? new UserSettings();
        settings.Normalize();
        string? cookie = await _context.UserData.GetSecretAsync(userId, "cookie", cancellationToken).ConfigureAwait(false);
        return new JsonObject
        {
            ["enabled"] = settings.Enabled,
            ["cookie"] = new JsonObject { ["configured"] = !string.IsNullOrWhiteSpace(cookie) },
            ["games"] = new JsonArray(settings.Games.Select(game => JsonValue.Create(game)).ToArray()),
            ["lastStatus"] = BuildStatus(settings),
        };
    }

    private async ValueTask SaveAsync(
        string userId,
        JsonObject values,
        CancellationToken cancellationToken)
    {
        UserSettings settings = await _context.UserData
            .ReadConfigAsync<UserSettings>(userId, cancellationToken)
            .ConfigureAwait(false) ?? new UserSettings();
        settings.Normalize();
        settings.Enabled = values["enabled"]?.GetValue<bool>() ?? false;
        settings.Games = ReadGames(values["games"]);
        JsonObject secret = values["cookie"] as JsonObject
            ?? throw new InvalidDataException("Cookie 字段格式不正确");
        string action = secret["action"]?.ToString()?.Trim().ToLowerInvariant() ?? "keep";
        switch (action)
        {
            case "keep":
                break;
            case "clear":
                await _context.UserData.SetSecretAsync(userId, "cookie", null, cancellationToken).ConfigureAwait(false);
                break;
            case "set":
                string cookie = secret["value"]?.ToString() ?? "";
                if (!CheckInService.IsValidCookie(cookie))
                {
                    throw new InvalidDataException("Cookie 不能为空、不能包含换行且长度不能超过 16 KiB");
                }
                await _context.UserData.SetSecretAsync(userId, "cookie", cookie, cancellationToken).ConfigureAwait(false);
                break;
            default:
                throw new InvalidDataException("Cookie 操作无效");
        }
        await _context.UserData.WriteConfigAsync(userId, settings, cancellationToken).ConfigureAwait(false);
    }

    private static List<string> ReadGames(JsonNode? node)
    {
        if (node is not JsonArray array)
        {
            throw new InvalidDataException("签到游戏字段格式不正确");
        }
        List<string> games = array
            .Select(item => item?.ToString()?.Trim().ToLowerInvariant() ?? "")
            .Where(GameDefinitions.IsKnown)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();
        if (games.Count != array.Count)
        {
            throw new InvalidDataException("签到游戏选项无效");
        }
        return games;
    }

    private static string BuildStatus(UserSettings settings)
    {
        if (string.IsNullOrWhiteSpace(settings.LastAttemptAt))
        {
            return "尚未尝试";
        }
        List<string> states = settings.GameState
            .Where(pair => !string.IsNullOrWhiteSpace(pair.Value.LastSuccessDate))
            .Select(pair => $"{GameDefinitions.Find(pair.Key)?.DisplayName ?? pair.Key}：{pair.Value.LastResult}")
            .ToList();
        return states.Count == 0 ? $"最近尝试：{settings.LastAttemptAt}" : string.Join("；", states);
    }
}
