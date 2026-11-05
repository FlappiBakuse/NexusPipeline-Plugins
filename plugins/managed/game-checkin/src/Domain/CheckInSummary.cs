namespace NexusPipeline.Extensions.GameCheckIn;

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
