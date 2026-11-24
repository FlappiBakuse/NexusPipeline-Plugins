using System.Text.Json.Serialization;

namespace NexusPipeline.Extensions.GameCheckIn;

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

internal sealed record CheckInRunDocument
{
    [JsonRequired] public int FormatVersion { get; init; } = 1;
    [JsonRequired] public CheckInRun Run { get; init; } = null!;
    internal CheckInRunDocument Validate()
    {
        if (FormatVersion != 1 || Run is null || !Guid.TryParse(Run.Id, out var id) || id == Guid.Empty ||
            !Guid.TryParse(Run.AttemptId, out var attempt) || attempt == Guid.Empty || Run.TaskRevision is < 1 or > 9007199254740991 ||
            Run.Trigger is not ("scheduled" or "manual") || Run.Status is not ("running" or "success" or "partial" or "failed" or "cancelled" or "interrupted" or "unknown") ||
            Run.Results is null || Run.Results.Length > 14 || Run.CompletedAt < Run.StartedAt ||
            Run.Status == "running" && Run.CompletedAt is not null || Run.Results.Any(result => result is null) ||
            Run.Results.Select(result => (result.Platform, result.GameCode)).Distinct().Count() != Run.Results.Length)
            throw new CheckInFailure("checkin_run_format_unsupported");
        foreach (var result in Run.Results)
        {
            _ = CheckInCatalog.Game(result.Platform, result.GameCode);
            if (string.IsNullOrWhiteSpace(result.Code) || result.Code.Length > 128 || result.Code.Any(character => !char.IsAsciiLetterOrDigit(character) && character != '_') ||
                result.Message is null || result.Message.Length > 512 || result.EffectState is not ("notSubmitted" or "unknown" or "confirmed") ||
                result.Success && result.EffectState == "unknown") throw new CheckInFailure("checkin_run_format_unsupported");
        }
        return this;
    }
}

internal sealed record CheckInHostRunFact(Guid RunId, Guid AttemptId, long TaskRevision, string Status, DateTimeOffset? CompletedAt);
internal static class CheckInRunFacts
{
    internal static CheckInRun Merge(CheckInRun cached, CheckInHostRunFact actual)
    {
        if (cached.Id != actual.RunId.ToString("D") || cached.AttemptId != actual.AttemptId.ToString("D") || cached.TaskRevision != actual.TaskRevision ||
            actual.Status is not ("running" or "success" or "partial" or "failed" or "cancelled" or "interrupted" or "unknown"))
            throw new CheckInFailure("checkin_run_identity_mismatch");
        if (actual.Status == "running") return cached;
        var results = cached.Results.Select(result => result.Code switch {
            "running" => CheckInResults.Result(result.Platform, result.GameCode, "result_unverified", effectState: "unknown"),
            "pending" when actual.CompletedAt is not null => CheckInResults.Result(result.Platform, result.GameCode, "not_executed"), _ => result }).ToArray();
        var status = actual.Status is "cancelled" or "interrupted" or "unknown" or "failed" or "partial" ? actual.Status : results.Any(result => result.EffectState == "unknown") ? "unknown" :
            results.All(result => result.Success) ? "success" : results.Any(result => result.Success) ? "partial" : "failed";
        return cached with { Status = status, CompletedAt = actual.CompletedAt, Results = results };
    }
}

internal sealed record CheckInSummary(string Title, string Body)
{
    internal static CheckInSummary Create(CheckInTask task, CheckInRun run)
    {
        task = task.Validate(); new CheckInRunDocument { Run = run }.Validate();
        if (run.TaskRevision != task.Revision || run.Status == "running" || run.Results.Length != task.Games.Values.Sum(games => games.Length) ||
            run.Results.Any(result => !task.Games.GetValueOrDefault(result.Platform)?.Contains(result.GameCode, StringComparer.Ordinal) ?? true))
            throw new CheckInFailure("checkin_summary_not_terminal");
        var title = run.Status switch {
            "success" => "游戏自动签到成功", "partial" => "游戏自动签到部分完成", "unknown" => "游戏自动签到结果未知",
            "cancelled" => "游戏自动签到已取消", "interrupted" => "游戏自动签到已中断", _ => "游戏自动签到有失败" };
        var lines = run.Results.Select(result => {
            var platform = CheckInCatalog.Platform(result.Platform); var game = CheckInCatalog.Game(result.Platform, result.GameCode);
            var state = result.EffectState == "unknown" ? "结果未知" : result.Success ? "已确认" : "未确认";
            var message = CheckInResults.Result(result.Platform, result.GameCode, result.Code).Message;
            return platform.Name + " / " + game.Name + "：" + message + "（" + state + "）";
        });
        var body = task.Name + "\n" + string.Join("\n", lines);
        if (body.Length > 4000) throw new CheckInFailure("checkin_summary_too_large");
        return new(title, body);
    }
}
