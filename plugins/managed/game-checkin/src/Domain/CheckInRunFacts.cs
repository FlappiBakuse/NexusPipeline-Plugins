namespace NexusPipeline.Extensions.GameCheckIn;

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
