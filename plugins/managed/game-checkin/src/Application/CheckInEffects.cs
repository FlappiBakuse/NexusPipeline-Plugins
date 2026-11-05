namespace NexusPipeline.Extensions.GameCheckIn;

internal sealed record CheckInEffectScope(string Platform, string GameCode, string RoleId, string ServerId);
internal sealed record CheckInEffectLease(string Id, string State);
internal interface ICheckInEffects
{
    ValueTask<CheckInEffectLease> BeginGameAsync(string platform, string gameCode, CancellationToken cancellationToken);
    ValueTask GameConfirmedAsync(CheckInEffectLease lease, CancellationToken cancellationToken);
    ValueTask<CheckInEffectLease> AcquireAsync(CheckInEffectScope scope, CancellationToken cancellationToken);
    ValueTask SubmittedAsync(CheckInEffectLease lease, CancellationToken cancellationToken);
    ValueTask ConfirmedAsync(CheckInEffectLease lease, string evidenceCode, CancellationToken cancellationToken);
}
internal sealed record CheckInGameGate(CheckInEffectLease Lease, bool MaySubmit, CheckInGameResult? Result);
internal static class CheckInEffectGate
{
    internal static async ValueTask<CheckInGameGate> BeginAsync(ICheckInEffects effects, string platform, string game, CancellationToken cancellationToken)
    {
        var lease = await effects.BeginGameAsync(platform, game, cancellationToken);
        return lease.State switch {
            "new" => new(lease, true, null), "unknown" => new(lease, false, null),
            "confirmed" => new(lease, false, CheckInResults.Result(platform, game, "already", true, "confirmed")),
            "busy" => new(lease, false, CheckInResults.Result(platform, game, "effect_busy", effectState: "unknown")),
            _ => new(lease, false, CheckInResults.Result(platform, game, "effect_unavailable")) };
    }
    internal static async Task<CheckInGameResult> FinishAsync(ICheckInEffects effects, CheckInGameGate gate, CheckInGameResult result, CancellationToken cancellationToken)
    {
        if (!result.Success) return result;
        try { await effects.GameConfirmedAsync(gate.Lease, cancellationToken); return result; }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested) { throw; }
        catch (Exception error) when (error is not OutOfMemoryException)
        { return CheckInResults.Result(result.Platform, result.GameCode, "success_unconfirmed", effectState: "unknown"); }
    }
}
internal static class CheckInResults
{
    internal static CheckInGameResult Result(string platform, string game, string code, bool success = false, string effectState = "notSubmitted") =>
        new(platform, game, code, code switch {
            "success" => "签到状态已确认", "already" => "今日已签到", "no_role" => "当前账号没有可签到角色",
            "role_selection_required" => "多个角色需要明确选择", "success_unconfirmed" or "effect_unknown" => "提交结果未知，不能自动重复",
            "captcha_required" or "challenge_incomplete" => "需要在官方页面人工验证", "invalid_cookie" or "credential_expired" => "凭据失效，请重新登录",
            "transport_error" => "官方请求失败", "credential_changed" => "凭据已变更，已停止后续操作",
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
