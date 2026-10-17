using System.Collections.Concurrent;
using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using NexusPipeline.Plugin.Abstractions;
using NexusPipeline.Plugin.GameCheckIn.Credentials;

namespace NexusPipeline.Plugin.GameCheckIn;

internal sealed partial class CheckInTaskService
{
    private async Task<CheckInTaskView> ToViewAsync(CheckInTask task, CancellationToken cancellationToken)
    {
        var credentials = new Dictionary<string, bool>(StringComparer.OrdinalIgnoreCase);
        var credentialStates = new Dictionary<string, CredentialFieldState>(StringComparer.OrdinalIgnoreCase);
        foreach (string platform in PlatformOrder)
        {
            string? value = await _context.Secrets
                .GetAsync(SecretKey(task.Id, "credential-" + platform), cancellationToken)
                .ConfigureAwait(false);
            credentials[platform] = !string.IsNullOrWhiteSpace(value);
            try
            {
                var record = CredentialRecord.Decode(value);
                credentialStates[platform] = new(record is not null, record?.Source, 0, "keep", MaskedAccount: record?.MaskedAccount);
            }
            catch (CredentialException ex) { credentialStates[platform] = new(true, null, 0, "keep", Error: ex.Code); }
        }
        DateTimeOffset now = _clock().ToLocalTime();
        DateTimeOffset? nextAt = task.Enabled
            ? task.Schedules.Where(schedule => schedule.Enabled)
                .Select(schedule => GetNextRunAt(schedule, now))
                .Where(value => value.HasValue)
                .Min()
            : null;
        return new CheckInTaskView
        {
            Id = task.Id,
            Name = task.Name,
            Remark = task.Remark,
            Enabled = task.Enabled,
            Games = Clone(task.Games),
            Schedules = task.Schedules.Select(schedule => new CheckInSchedule
            {
                Id = schedule.Id,
                Days = schedule.Days.ToList(),
                Enabled = schedule.Enabled,
                Time = schedule.Time,
            }).ToList(),
            Notification = Clone(task.Notification),
            Runs = task.Runs.Take(MaxRunHistory).Select(Clone).ToList(),
            Credentials = credentials,
            CredentialStates = credentialStates,
            IsRunning = _activeRuns.ContainsKey(task.Id),
            NextRunAt = nextAt,
            RecentRun = task.Runs.FirstOrDefault() is { } recent ? Clone(recent) : null,
        };
    }

    private object[] BuildPlatformOptions() => PlatformOrder.Select(platform =>
    {
        IReadOnlyList<(string Code, string Name)> games = platform switch
        {
            "cn" or "os" => GameDefinitions.All.Select(game => (game.Code, game.DisplayName)).ToArray(),
            "skland" => SklandGameDefinitions.All.Select(game => (game.Code, game.DisplayName)).ToArray(),
            "skport" => SkportGameDefinitions.All.Select(game => (game.Code, game.DisplayName)).ToArray(),
            "kuro" => KuroGameDefinitions.All.Select(game => (game.Code, game.DisplayName)).ToArray(),
            "tajiduo" => new[] { ("nte", "异环") },
            _ => Array.Empty<(string Code, string Name)>(),
        };
        return new
        {
            id = platform,
            name = _context.I18n.T("platform." + platform, platform),
            browserLogin = new { ready = _loginFlows.Ready(platform), status = BrowserLogin.GameCheckInLoginFlows.Readiness.Single(p => p.Platform == platform).Status },
            games = games.Select(game => new
            {
                id = game.Code,
                name = _context.I18n.T("game." + game.Code, game.Name),
            }),
        };
    }).Cast<object>().ToArray();

    private string BuildSummary(string taskName, IReadOnlyList<CheckInResult> results)
    {
        string taskLabel = _context.I18n.T("task.notification_name", "签到任务：{name}", new Dictionary<string, object?> { ["name"] = taskName });
        return taskLabel + "\n" + string.Join("\n", results.Select(result =>
        {
            string platform = _context.I18n.T("platform." + result.Platform, result.Platform);
            string gameName = GameName(result.Platform, result.GameCode);
            string label = _context.I18n.T(result.Success ? "result.success" : "result.failed", result.Success ? "成功" : "失败");
            return $"{platform} · {gameName}：{label}（{result.Message}）";
        }));
    }

    private string GameName(string platform, string code)
    {
        string fallback = platform switch
        {
            "cn" or "os" => GameDefinitions.Find(code)?.DisplayName ?? code,
            "skland" => SklandGameDefinitions.Find(code)?.DisplayName ?? code,
            "skport" => SkportGameDefinitions.Find(code)?.DisplayName ?? code,
            "kuro" => KuroGameDefinitions.Find(code)?.DisplayName ?? code,
            "tajiduo" => "异环",
            _ => code,
        };
        return _context.I18n.T("game." + code, fallback);
    }

    private CheckInResult LocalizeResult(CheckInResult result) => result with
    {
        Message = _context.I18n.T("result." + result.Code, result.Message),
    };

    private static CheckInTask Clone(CheckInTask value) => JsonSerializer.Deserialize<CheckInTask>(JsonSerializer.Serialize(value, JsonOptions), JsonOptions)!;
    private static CheckInRun Clone(CheckInRun value) => JsonSerializer.Deserialize<CheckInRun>(JsonSerializer.Serialize(value, JsonOptions), JsonOptions)!;
    private static Dictionary<string, List<string>> Clone(Dictionary<string, List<string>> value) => value.ToDictionary(pair => pair.Key, pair => pair.Value.ToList(), StringComparer.OrdinalIgnoreCase);
    private static T Clone<T>(T value) => JsonSerializer.Deserialize<T>(JsonSerializer.Serialize(value, JsonOptions), JsonOptions)!;
}
