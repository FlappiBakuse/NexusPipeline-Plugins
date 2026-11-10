using System.Globalization;
using System.Text.Json.Serialization;

namespace NexusPipeline.Extensions.GameCheckIn;

internal sealed record CheckInSchedule
{
    [JsonRequired] public string Id { get; init; } = "";
    [JsonRequired] public int[] Days { get; init; } = [];
    [JsonRequired] public bool Enabled { get; init; }
    [JsonRequired] public string Time { get; init; } = "";
    internal int LocalMinute => TimeOnly.ParseExact(Time, "HH:mm", CultureInfo.InvariantCulture).Hour * 60 +
        TimeOnly.ParseExact(Time, "HH:mm", CultureInfo.InvariantCulture).Minute;
    internal CheckInSchedule Validate()
    {
        if (!Guid.TryParse(Id, out var id) || id == Guid.Empty || Days is null || Days.Length is < 1 or > 7 ||
            Days.Distinct().Count() != Days.Length || Days.Any(day => day is < 0 or > 6) ||
            Time is null || Time.Length != 5 || !TimeOnly.TryParseExact(Time, "HH:mm", CultureInfo.InvariantCulture, DateTimeStyles.None, out _))
            throw new CheckInFailure("checkin_schedule_invalid");
        return this with { Id = id.ToString("D"), Days = Days.Order().ToArray() };
    }
}
internal sealed record CheckInNotification
{
    [JsonRequired] public bool Enabled { get; init; }
    [JsonRequired] public string[] NotificationTaskIds { get; init; } = [];
    internal CheckInNotification Validate()
    {
        if (NotificationTaskIds is null || NotificationTaskIds.Length > 99 || NotificationTaskIds.Any(id => !Guid.TryParseExact(id, "D", out var parsed) || parsed == Guid.Empty || parsed.ToString("D") != id) ||
            NotificationTaskIds.Distinct(StringComparer.Ordinal).Count() != NotificationTaskIds.Length)
            throw new CheckInFailure("checkin_notification_invalid");
        return this with { NotificationTaskIds = NotificationTaskIds.ToArray() };
    }
}
internal sealed record CheckInTask
{
    [JsonRequired] public Guid Id { get; init; }
    [JsonRequired] public long Revision { get; init; }
    [JsonRequired] public string Name { get; init; } = "";
    [JsonRequired] public string Remark { get; init; } = "";
    [JsonRequired] public bool Enabled { get; init; }
    [JsonRequired] public Dictionary<string, string[]> Games { get; init; } = new(StringComparer.Ordinal);
    [JsonRequired] public CheckInSchedule[] Schedules { get; init; } = [];
    [JsonRequired] public CheckInNotification Notification { get; init; } = new();
    [JsonRequired] public CheckInProtocolIdentity Protocol { get; init; } = CheckInProtocolIdentity.Create();
    internal CheckInTask Validate()
    {
        if (Id == Guid.Empty || Revision is < 1 or > 9007199254740991 || string.IsNullOrWhiteSpace(Name) || Name.Trim().Length > 100 || Name.Any(char.IsControl) ||
            Remark is null || System.Text.Encoding.UTF8.GetByteCount(Remark) > 512 || Games is null || Games.Count > 6 || Enabled && Games.Count == 0 || Schedules is null || Schedules.Length > 30 ||
            Schedules.Any(schedule => schedule is null) || Schedules.Select(schedule => schedule.Id).Distinct(StringComparer.Ordinal).Count() != Schedules.Length || Notification is null)
            throw new CheckInFailure("checkin_task_invalid");
        if (Protocol is null) throw new CheckInFailure("checkin_protocol_identity_invalid");
        Protocol.Validate();
        var schedules = Schedules.Select(schedule => schedule.Validate()).ToArray();
        if (schedules.Select(schedule => schedule.Id).Distinct(StringComparer.Ordinal).Count() != schedules.Length)
            throw new CheckInFailure("checkin_schedule_duplicate");
        var games = new Dictionary<string, string[]>(StringComparer.Ordinal);
        foreach (var (platform, selected) in Games)
        {
            var known = CheckInCatalog.Platform(platform);
            if (selected is null || selected.Length == 0 || selected.Length > known.Games.Length ||
                selected.Distinct(StringComparer.Ordinal).Count() != selected.Length) throw new CheckInFailure("checkin_games_invalid");
            foreach (var game in selected) CheckInCatalog.Game(platform, game);
            games.Add(platform, known.Games.Where(game => selected.Contains(game.Code, StringComparer.Ordinal)).Select(game => game.Code).ToArray());
        }
        return this with { Name = Name.Trim(), Games = games, Schedules = schedules,
            Notification = Notification.Validate() };
    }
}
internal sealed record CheckInGameResult([property: JsonRequired] string Platform, [property: JsonRequired] string GameCode,
    [property: JsonRequired] string Code, [property: JsonRequired] string Message, [property: JsonRequired] bool Success,
    [property: JsonRequired] string EffectState = "notSubmitted");
internal sealed record CheckInRun([property: JsonRequired] string Id, [property: JsonRequired] string Trigger,
    [property: JsonRequired] string Status, [property: JsonRequired] DateTimeOffset StartedAt, [property: JsonRequired] DateTimeOffset? CompletedAt,
    [property: JsonRequired] CheckInGameResult[] Results, [property: JsonRequired] string AttemptId, [property: JsonRequired] long TaskRevision);
internal static class CheckInResults
{
    internal static CheckInGameResult Result(string platform, string game, string code, bool success = false, string effectState = "notSubmitted") =>
        new(platform, game, code, code switch {
            "success" => "签到状态已确认", "already" => "今日已签到", "no_role" => "当前账号没有可签到角色",
            "role_selection_required" => "多个角色需要明确选择", "success_unconfirmed" or "effect_unknown" => "提交结果未知，不能自动重复",
            "captcha_required" or "challenge_incomplete" => "需要在官方页面人工验证", "invalid_cookie" or "credential_expired" => "凭据失效，请重新登录",
            "transport_error" => "官方请求失败", "response_invalid" => "官方响应格式无效",
            "internal_error" => "本地处理失败，请保留错误记录", "credential_changed" => "凭据已变更，已停止后续操作",
            "effect_busy" => "相同凭据和游戏已有受理中的操作，结果尚未确认",
            "tajiduo_sdk_credential_required" => "原生凭据缺少 SDK 登录字段，请重新官方登录或填写完整原生 JSON", _ => "接口状态未通过核验" }, success, effectState);
    internal static CheckInGameResult Aggregate(string platform, string game, IReadOnlyList<CheckInGameResult> results)
    {
        if (results.Count == 0) return Result(platform, game, "no_role");
        var unknown = results.FirstOrDefault(result => result.EffectState == "unknown");
        if (unknown is not null) return unknown;
        var failed = results.FirstOrDefault(result => !result.Success);
        if (failed is not null) return failed;
        return Result(platform, game, results.Any(result => result.Code == "success") ? "success" : "already", true, "confirmed");
    }
}
internal sealed record CheckInTaskStore
{
    [JsonRequired] public int FormatVersion { get; init; } = 1;
    [JsonRequired] public CheckInTask[] Tasks { get; init; } = [];
    internal CheckInTaskStore Validate()
    {
        if (FormatVersion != 1 || Tasks is null || Tasks.Length > 4096 || Tasks.Any(task => task is null) || Tasks.Select(task => task.Id).Distinct().Count() != Tasks.Length)
            throw new CheckInFailure("checkin_store_unsupported");
        var validated = Tasks.Select(task => task.Validate()).ToArray();
        if (validated.Sum(task => task.Schedules.Length) > 4096) throw new CheckInFailure("checkin_plan_limit");
        if (validated.Select(task => task.Name).Distinct(StringComparer.OrdinalIgnoreCase).Count() != validated.Length)
            throw new CheckInFailure("checkin_task_name_duplicate");
        return this with { Tasks = validated };
    }
}
internal sealed record CheckInProtocolIdentity
{
    [JsonRequired] public Guid CnDeviceId { get; init; }
    [JsonRequired] public Guid KuroDeviceId { get; init; }
    [JsonRequired] public Guid KuroDistinctId { get; init; }
    internal static CheckInProtocolIdentity Create() => new() { CnDeviceId = Guid.NewGuid(), KuroDeviceId = Guid.NewGuid(), KuroDistinctId = Guid.NewGuid() };
    internal void Validate()
    {
        if (CnDeviceId == Guid.Empty || KuroDeviceId == Guid.Empty || KuroDistinctId == Guid.Empty)
            throw new CheckInFailure("checkin_protocol_identity_invalid");
    }
}
