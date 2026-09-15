using System.Text.Json.Nodes;
using NexusPipeline.Plugin.Abstractions;

namespace NexusPipeline.Plugin.GameCheckIn;

internal sealed class UserSettingsContribution
{
    private const int MaxCredentialLength = 16 * 1024;
    private readonly IPluginHostContextV1_4 _context;

    public UserSettingsContribution(IPluginHostContextV1_4 context) { _context = context; }

    public IDisposable Register()
    {
        var contribution = new PluginUserGlobalManagementContribution(
            "user-settings",
            "游戏自动签到",
            "按需配置五个平台的游戏签到凭据，选择的平台会在用户脚本实际开始运行时触发游戏内签到。",
            100,
            new[]
            {
                new PluginUserGlobalManagementField(
                    "enabled",
                    "启用自动签到",
                    "switch",
                    "关闭后保留配置但不执行签到。",
                    Required: true)
                {
                    LocalizedLabel = Text("field.enabled", "启用自动签到"),
                    LocalizedDescription = Text("field.enabled_description", "关闭后保留配置但不执行签到。"),
                },
                new PluginUserGlobalManagementField(
                    "cnGames",
                    "米游社签到游戏",
                    "multi-select",
                    "选择米游社官服游戏，可留空。",
                    Options: MihoyoGameOptions())
                {
                    LocalizedLabel = Text("field.cn_games", "米游社签到游戏"),
                    LocalizedDescription = Text("field.cn_games_description", "选择米游社官服游戏，可留空。"),
                },
                new PluginUserGlobalManagementField(
                    "osGames",
                    "HoYoLAB 签到游戏",
                    "multi-select",
                    "选择 HoYoLAB 国际服游戏，可留空。",
                    Options: MihoyoGameOptions())
                {
                    LocalizedLabel = Text("field.os_games", "HoYoLAB 签到游戏"),
                    LocalizedDescription = Text("field.os_games_description", "选择 HoYoLAB 国际服游戏，可留空。"),
                },
                new PluginUserGlobalManagementField(
                    "sklandGames",
                    "森空岛签到游戏",
                    "multi-select",
                    "选择森空岛国服游戏，可留空。",
                    Options: SklandGameOptions())
                {
                    LocalizedLabel = Text("field.skland_games", "森空岛签到游戏"),
                    LocalizedDescription = Text("field.skland_games_description", "选择森空岛国服游戏，可留空。"),
                },
                new PluginUserGlobalManagementField(
                    "skportGames",
                    "SKPORT 签到游戏",
                    "multi-select",
                    "选择终末地国际服游戏，可留空。",
                    Options: SkportGameOptions())
                {
                    LocalizedLabel = Text("field.skport_games", "SKPORT 签到游戏"),
                    LocalizedDescription = Text("field.skport_games_description", "选择终末地国际服游戏，可留空。"),
                },
                new PluginUserGlobalManagementField(
                    "kuroGames",
                    "库街区签到游戏",
                    "multi-select",
                    "选择库街区游戏，可留空。",
                    Options: KuroGameOptions())
                {
                    LocalizedLabel = Text("field.kuro_games", "库街区签到游戏"),
                    LocalizedDescription = Text("field.kuro_games_description", "选择库街区游戏，可留空。"),
                },
                CredentialField(
                    "cnCookie",
                    "米游社 Cookie",
                    "米游社完整 Cookie，需含 stoken、mid、uid 登录字段",
                    "从米游社网页版请求中复制完整 Cookie；需包含 stoken、mid、uid 登录字段。"),
                CredentialField(
                    "osCookie",
                    "HoYoLAB Cookie",
                    "HoYoLAB 完整 Cookie，需含 ltoken、ltuid",
                    "从 HoYoLAB 网页版请求中复制完整 Cookie；需包含 ltoken、ltuid。"),
                CredentialField(
                    "sklandToken",
                    "森空岛 Token",
                    "森空岛 APP 抓取的鹰角通行证 Token",
                    "从森空岛 APP 的鹰角通行证请求中获取 Token；填写 Token 文本。"),
                CredentialField(
                    "skportToken",
                    "SKPORT Token",
                    "终末地国际服 / SKPORT 通行证 Token",
                    "从终末地国际服 / SKPORT 请求中获取通行证 Token；填写 Token 文本。"),
                CredentialField(
                    "kuroToken",
                    "库街区 Token",
                    "库街区 APP 抓包获取的 token",
                    "从库街区 APP 请求中获取 token；签到范围为游戏内签到。"),
                new PluginUserGlobalManagementField(
                    "lastStatus",
                    "最近状态",
                    "status",
                    "最近一次实际尝试的结果。",
                    ReadOnly: true)
                {
                    LocalizedLabel = Text("field.last_status", "最近状态"),
                    LocalizedDescription = Text("field.last_status_description", "最近一次实际尝试的结果。"),
                },
            },
            ReadAsync,
            SaveAsync)
        {
            LocalizedTitle = Text("settings.title", "游戏自动签到"),
            LocalizedDescription = Text("settings.description", "按需配置五个平台的游戏签到凭据，选择的平台会在用户脚本实际开始运行时触发游戏内签到。"),
        };
        return _context.UserGlobalManagement.Register(contribution);
    }

    private async ValueTask<JsonObject> ReadAsync(string userId, CancellationToken cancellationToken)
    {
        UserSettings settings = await _context.UserData.ReadConfigAsync<UserSettings>(userId, cancellationToken).ConfigureAwait(false)
            ?? new UserSettings();
        settings.Normalize();
        var result = new JsonObject
        {
            ["enabled"] = settings.Enabled,
            ["cnGames"] = ToJsonArray(settings.CnGames),
            ["osGames"] = ToJsonArray(settings.OsGames),
            ["sklandGames"] = ToJsonArray(settings.SklandGames),
            ["skportGames"] = ToJsonArray(settings.SkportGames),
            ["kuroGames"] = ToJsonArray(settings.KuroGames),
            ["lastStatus"] = BuildStatus(settings, _context.I18n),
        };
        foreach (string key in CredentialKeys)
        {
            string? credential = await _context.UserData.GetSecretAsync(userId, key, cancellationToken).ConfigureAwait(false);
            result[key] = new JsonObject { ["configured"] = CheckInService.IsValidCredential(credential) };
        }
        return result;
    }

    private async ValueTask SaveAsync(string userId, JsonObject values, CancellationToken cancellationToken)
    {
        UserSettings settings = await _context.UserData.ReadConfigAsync<UserSettings>(userId, cancellationToken).ConfigureAwait(false)
            ?? new UserSettings();
        settings.Normalize();
        settings.Enabled = values["enabled"]?.GetValue<bool>() ?? false;
        List<string> cnGames = ReadGames(values["cnGames"], GameDefinitions.IsKnown);
        List<string> osGames = ReadGames(values["osGames"], GameDefinitions.IsKnown);
        List<string> sklandGames = ReadGames(values["sklandGames"], SklandGameDefinitions.IsKnown);
        List<string> skportGames = ReadGames(values["skportGames"], SkportGameDefinitions.IsKnown);
        List<string> kuroGames = ReadGames(values["kuroGames"], KuroGameDefinitions.IsKnown);
        if (settings.Enabled
            && cnGames.Count == 0
            && osGames.Count == 0
            && sklandGames.Count == 0
            && skportGames.Count == 0
            && kuroGames.Count == 0)
        {
            throw new PluginUserVisibleException(
                "game_required",
                "validation.game_required",
                "启用自动签到时至少选择一个签到游戏");
        }

        settings.CnGames = cnGames;
        settings.OsGames = osGames;
        settings.SklandGames = sklandGames;
        settings.SkportGames = skportGames;
        settings.KuroGames = kuroGames;
        foreach (string key in CredentialKeys)
        {
            await SaveCredentialAsync(userId, key, values[key] as JsonObject, cancellationToken).ConfigureAwait(false);
        }
        await _context.UserData.WriteConfigAsync(userId, settings, cancellationToken).ConfigureAwait(false);
    }

    private async Task SaveCredentialAsync(
        string userId,
        string key,
        JsonObject? secret,
        CancellationToken cancellationToken)
    {
        if (secret is null)
        {
            throw new PluginUserVisibleException(
                "credential_format",
                "validation.credential_format",
                $"{key} 字段格式不正确");
        }
        string action = secret["action"]?.ToString()?.Trim().ToLowerInvariant() ?? "keep";
        switch (action)
        {
            case "keep":
                return;
            case "clear":
                await _context.UserData.SetSecretAsync(userId, key, null, cancellationToken).ConfigureAwait(false);
                return;
            case "set":
                string credential = secret["value"]?.ToString() ?? "";
                if (!CheckInService.IsValidCredential(credential))
                {
                    throw new PluginUserVisibleException(
                        "credential_invalid",
                        "validation.credential_invalid",
                        "凭据不能为空、不能包含换行且长度不能超过 16 KiB");
                }
                await _context.UserData.SetSecretAsync(userId, key, credential, cancellationToken).ConfigureAwait(false);
                return;
            default:
                throw new PluginUserVisibleException(
                    "credential_action",
                    "validation.credential_action",
                    "凭据操作无效");
        }
    }

    private PluginUserGlobalManagementField CredentialField(
        string key,
        string label,
        string placeholder,
        string description) =>
        new PluginUserGlobalManagementField(
            key,
            label,
            "secret",
            description,
            Placeholder: placeholder,
            MaxLength: MaxCredentialLength)
        {
            LocalizedLabel = Text("field." + key, label),
            LocalizedDescription = Text("field." + key + "_description", description),
            LocalizedPlaceholder = Text("field." + key + "_placeholder", placeholder),
        };

    private IReadOnlyList<PluginUserGlobalManagementOption> MihoyoGameOptions() =>
        GameDefinitions.All.Select(game => new PluginUserGlobalManagementOption(game.Code, game.DisplayName)
        {
            LocalizedLabel = Text("game." + game.Code, game.DisplayName),
        }).ToArray();

    private IReadOnlyList<PluginUserGlobalManagementOption> SklandGameOptions() =>
        SklandGameDefinitions.All.Select(game => new PluginUserGlobalManagementOption(game.Code, game.DisplayName)
        {
            LocalizedLabel = Text("game." + game.Code, game.DisplayName),
        }).ToArray();

    private IReadOnlyList<PluginUserGlobalManagementOption> SkportGameOptions() =>
        SkportGameDefinitions.All.Select(game => new PluginUserGlobalManagementOption(game.Code, game.DisplayName)
        {
            LocalizedLabel = Text("game." + game.Code, game.DisplayName),
        }).ToArray();

    private IReadOnlyList<PluginUserGlobalManagementOption> KuroGameOptions() =>
        KuroGameDefinitions.All.Select(game => new PluginUserGlobalManagementOption(game.Code, game.DisplayName)
        {
            LocalizedLabel = Text("game." + game.Code, game.DisplayName),
        }).ToArray();

    private static JsonArray ToJsonArray(IEnumerable<string> values) =>
        new(values.Select(value => JsonValue.Create(value)).ToArray());

    private static List<string> ReadGames(JsonNode? node, Func<string, bool> isKnown)
    {
        if (node is not JsonArray array)
        {
            throw new PluginUserVisibleException(
                "games_format",
                "validation.games_format",
                "签到游戏字段格式不正确");
        }
        List<string> games = array.Select(item => item?.ToString()?.Trim().ToLowerInvariant() ?? "").ToList();
        if (games.Any(game => !isKnown(game)))
        {
            throw new PluginUserVisibleException(
                "games_invalid",
                "validation.games_invalid",
                "签到游戏选项无效");
        }
        return games.Distinct(StringComparer.OrdinalIgnoreCase).ToList();
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
                string platformCode = parts.Length == 2 ? parts[0] : "";
                string platform = localization?.T("platform." + platformCode, PlatformFallback(platformCode))
                    ?? PlatformFallback(platformCode);
                string gameCode = parts.Length == 2 ? parts[1] : "";
                string game = localization?.T("game." + gameCode, GameFallback(platformCode, gameCode))
                    ?? GameFallback(platformCode, gameCode);
                string result = localization?.T(
                        "result." + (pair.Value.LastResult ?? "unknown"),
                        pair.Value.LastResult ?? "未知")
                    ?? pair.Value.LastResult
                    ?? "未知";
                return $"{platform} · {game}：{result}";
            })
            .ToList();
        return states.Count == 0
            ? $"最近尝试：{settings.LastAttemptAt}"
            : string.Join(localization?.Locale.StartsWith("en", StringComparison.OrdinalIgnoreCase) == true ? "; " : "；", states);
    }

    private static string PlatformFallback(string platform) => platform switch
    {
        "cn" => "米游社",
        "os" => "HoYoLAB",
        "skland" => "森空岛",
        "skport" => "SKPORT",
        "kuro" => "库街区",
        _ => platform,
    };

    private static string GameFallback(string platform, string code) => platform switch
    {
        "cn" or "os" => GameDefinitions.Find(code)?.DisplayName ?? code,
        "skland" => SklandGameDefinitions.Find(code)?.DisplayName ?? code,
        "skport" => SkportGameDefinitions.Find(code)?.DisplayName ?? code,
        "kuro" => KuroGameDefinitions.Find(code)?.DisplayName ?? code,
        _ => code,
    };

    private static readonly string[] CredentialKeys =
    {
        "cnCookie",
        "osCookie",
        "sklandToken",
        "skportToken",
        "kuroToken",
    };
}
