using System.Text.Json.Nodes;
using NexusPipeline.Plugin.Abstractions;

namespace NexusPipeline.Plugin.GameCheckIn;

internal sealed class UserSettingsContribution
{
    private readonly IPluginHostContextV1_4 _context;

    public UserSettingsContribution(IPluginHostContextV1_4 context) { _context = context; }

    public IDisposable Register()
    {
        var contribution = new PluginUserGlobalManagementContribution(
            "user-settings",
            "游戏自动签到",
            "按需配置米游社或 HoYoLAB Cookie，选择的平台会在用户脚本实际开始运行时触发签到。",
            100,
            new[]
            {
                new PluginUserGlobalManagementField("enabled", "启用自动签到", "switch", "关闭后保留配置但不执行签到。", Required: true) { LocalizedLabel = Text("field.enabled", "启用自动签到"), LocalizedDescription = Text("field.enabled_description", "关闭后保留配置但不执行签到。") },
                new PluginUserGlobalManagementField("cnGames", "米游社签到游戏", "multi-select", "选择官服签到游戏，可留空。", Options: GameOptions()) { LocalizedLabel = Text("field.cn_games", "米游社签到游戏"), LocalizedDescription = Text("field.cn_games_description", "选择官服签到游戏，可留空。") },
                new PluginUserGlobalManagementField("osGames", "HoYoLAB 签到游戏", "multi-select", "选择国际服签到游戏，可留空。", Options: GameOptions()) { LocalizedLabel = Text("field.os_games", "HoYoLAB 签到游戏"), LocalizedDescription = Text("field.os_games_description", "选择国际服签到游戏，可留空。") },
                new PluginUserGlobalManagementField("cnCookie", "米游社 Cookie", "secret", "官服原神、崩坏：星穹铁道和绝区零使用此 Cookie。", Placeholder: "请输入完整 Cookie", MaxLength: 16 * 1024) { LocalizedLabel = Text("field.cn_cookie", "米游社 Cookie"), LocalizedDescription = Text("field.cn_cookie_description", "官服原神、崩坏：星穹铁道和绝区零使用此 Cookie。"), LocalizedPlaceholder = Text("field.cookie_placeholder", "请输入完整 Cookie") },
                new PluginUserGlobalManagementField("osCookie", "HoYoLAB Cookie", "secret", "国际服原神、崩坏：星穹铁道和绝区零使用此 Cookie。", Placeholder: "请输入完整 Cookie", MaxLength: 16 * 1024) { LocalizedLabel = Text("field.os_cookie", "HoYoLAB Cookie"), LocalizedDescription = Text("field.os_cookie_description", "国际服原神、崩坏：星穹铁道和绝区零使用此 Cookie。"), LocalizedPlaceholder = Text("field.cookie_placeholder", "请输入完整 Cookie") },
                new PluginUserGlobalManagementField("lastStatus", "最近状态", "status", "最近一次实际尝试的结果。", ReadOnly: true) { LocalizedLabel = Text("field.last_status", "最近状态"), LocalizedDescription = Text("field.last_status_description", "最近一次实际尝试的结果。") },
            },
            ReadAsync,
            SaveAsync)
        {
            LocalizedTitle = Text("settings.title", "游戏自动签到"),
            LocalizedDescription = Text("settings.description", "按需配置米游社或 HoYoLAB Cookie，选择的平台会在用户脚本实际开始运行时触发签到。"),
        };
        return _context.UserGlobalManagement.Register(contribution);
    }

    private async ValueTask<JsonObject> ReadAsync(string userId, CancellationToken cancellationToken)
    {
        UserSettings settings = await _context.UserData.ReadConfigAsync<UserSettings>(userId, cancellationToken).ConfigureAwait(false)
            ?? new UserSettings();
        settings.Normalize();
        string? cnCookie = await _context.UserData.GetSecretAsync(userId, "cnCookie", cancellationToken).ConfigureAwait(false);
        string? osCookie = await _context.UserData.GetSecretAsync(userId, "osCookie", cancellationToken).ConfigureAwait(false);
        return new JsonObject
        {
            ["enabled"] = settings.Enabled,
            ["cnGames"] = new JsonArray(settings.CnGames.Select(value => JsonValue.Create(value)).ToArray()),
            ["osGames"] = new JsonArray(settings.OsGames.Select(value => JsonValue.Create(value)).ToArray()),
            ["cnCookie"] = new JsonObject { ["configured"] = !string.IsNullOrWhiteSpace(cnCookie) },
            ["osCookie"] = new JsonObject { ["configured"] = !string.IsNullOrWhiteSpace(osCookie) },
            ["lastStatus"] = BuildStatus(settings, _context.I18n),
        };
    }

    private async ValueTask SaveAsync(string userId, JsonObject values, CancellationToken cancellationToken)
    {
        UserSettings settings = await _context.UserData.ReadConfigAsync<UserSettings>(userId, cancellationToken).ConfigureAwait(false)
            ?? new UserSettings();
        settings.Normalize();
        settings.Enabled = values["enabled"]?.GetValue<bool>() ?? false;
        List<string> cnGames = ReadGames(values["cnGames"]);
        List<string> osGames = ReadGames(values["osGames"]);
        if (settings.Enabled && cnGames.Count == 0 && osGames.Count == 0)
        {
            throw new PluginUserVisibleException(
                "game_required",
                "validation.game_required",
                "启用自动签到时至少选择一个签到游戏");
        }
        settings.CnGames = cnGames;
        settings.OsGames = osGames;
        await SaveSecretAsync(userId, "cnCookie", values["cnCookie"] as JsonObject, cancellationToken).ConfigureAwait(false);
        await SaveSecretAsync(userId, "osCookie", values["osCookie"] as JsonObject, cancellationToken).ConfigureAwait(false);
        await _context.UserData.WriteConfigAsync(userId, settings, cancellationToken).ConfigureAwait(false);
    }

    private async Task SaveSecretAsync(string userId, string key, JsonObject? secret, CancellationToken cancellationToken)
    {
        if (secret is null)
        {
            throw new PluginUserVisibleException(
                "cookie_format",
                "validation.cookie_format",
                $"{key} 字段格式不正确");
        }
        string action = secret["action"]?.ToString()?.Trim().ToLowerInvariant() ?? "keep";
        switch (action)
        {
            case "keep": return;
            case "clear":
                await _context.UserData.SetSecretAsync(userId, key, null, cancellationToken).ConfigureAwait(false);
                return;
            case "set":
                string cookie = secret["value"]?.ToString() ?? "";
                if (!CheckInService.IsValidCookie(cookie))
                {
                    throw new PluginUserVisibleException(
                        "cookie_invalid",
                        "validation.cookie_invalid",
                        "Cookie 不能为空、不能包含换行且长度不能超过 16 KiB");
                }
                await _context.UserData.SetSecretAsync(userId, key, cookie, cancellationToken).ConfigureAwait(false);
                return;
            default:
                throw new PluginUserVisibleException(
                    "cookie_action",
                    "validation.cookie_action",
                    "Cookie 操作无效");
        }
    }

    private IReadOnlyList<PluginUserGlobalManagementOption> GameOptions() =>
        GameDefinitions.All.Select(game => new PluginUserGlobalManagementOption(game.Code, game.DisplayName)
        {
            LocalizedLabel = Text("game." + game.Code, game.DisplayName),
        }).ToArray();

    private List<string> ReadGames(JsonNode? node)
    {
        if (node is not JsonArray array)
        {
            throw new PluginUserVisibleException(
                "games_format",
                "validation.games_format",
                "签到游戏字段格式不正确");
        }
        List<string> games = array.Select(item => item?.ToString()?.Trim().ToLowerInvariant() ?? "")
            .Where(GameDefinitions.IsKnown).Distinct(StringComparer.OrdinalIgnoreCase).ToList();
        if (games.Count != array.Count)
        {
            throw new PluginUserVisibleException(
                "games_invalid",
                "validation.games_invalid",
                "签到游戏选项无效");
        }
        return games;
    }

    private PluginLocalizedText Text(string key, string fallback) => new(key, fallback);

    internal static string BuildStatus(UserSettings settings, IPluginLocalization? localization = null)
    {
        if (string.IsNullOrWhiteSpace(settings.LastAttemptAt)) return localization?.T("status.never", "尚未尝试") ?? "尚未尝试";
        List<string> states = settings.GameState
            .Where(pair => !string.IsNullOrWhiteSpace(pair.Value.LastAttemptDate) || !string.IsNullOrWhiteSpace(pair.Value.LastSuccessDate))
            .Select(pair =>
            {
                string[] parts = pair.Key.Split(':', 2);
                string platform = parts.Length == 2 && parts[0] == "cn"
                    ? localization?.T("platform.cn", "米游社") ?? "米游社"
                    : localization?.T("platform.os", "HoYoLAB") ?? "HoYoLAB";
                string gameCode = parts.Length == 2 ? parts[^1] : "";
                string game = localization?.T("game." + gameCode, GameDefinitions.Find(gameCode)?.DisplayName ?? gameCode)
                    ?? GameDefinitions.Find(gameCode)?.DisplayName
                    ?? gameCode;
                string result = localization?.T(
                    "result." + pair.Value.LastResult,
                    pair.Value.LastResult)
                    ?? pair.Value.LastResult;
                return $"{platform} · {game}：{result}";
            })
            .ToList();
        return states.Count == 0
            ? $"最近尝试：{settings.LastAttemptAt}"
            : string.Join(localization?.Locale.StartsWith("en", StringComparison.OrdinalIgnoreCase) == true ? "; " : "；", states);
    }
}
