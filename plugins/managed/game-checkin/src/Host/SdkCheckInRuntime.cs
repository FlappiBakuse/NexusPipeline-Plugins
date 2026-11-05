using NexusPipeline.Extensibility.Scheduling;

namespace NexusPipeline.Extensions.GameCheckIn;

internal sealed class SdkCheckInRuntime(IWorkTasks tasks, ICheckInPersistence persistence,
    SdkCheckInWork control, SdkCheckInNotifications notifications) : ICheckInRuntime
{
    public async ValueTask<CheckInRuntimeSnapshot> ReadAsync(CheckInTaskStore store, CancellationToken cancellationToken)
    {
        var facts = new List<CheckInTaskFact>(); string? zone = null;
        foreach (var batch in store.Tasks.Chunk(128))
        {
            var ids = batch.Select(task => task.Id).ToArray(); var snapshot = await tasks.ReadAsync(SdkCheckInWork.ProviderId, ids, cancellationToken);
            var requested = ids.ToHashSet();
            if (snapshot.Tasks is null || snapshot.Tasks.Count != ids.Length || snapshot.Tasks.Select(task => task.TaskId).Distinct().Count() != ids.Length ||
                snapshot.Tasks.Any(task => !requested.Contains(task.TaskId) || task.Revision is < 1 or > 9007199254740991 ||
                    task.NextRunAt is { Offset: var offset } && offset != TimeSpan.Zero)) throw new CheckInFailure("checkin_runtime_snapshot_invalid");
            var byId = snapshot.Tasks.ToDictionary(task => task.TaskId);
            if (zone is not null && zone != snapshot.Clock.TimeZoneId) throw new CheckInFailure("checkin_runtime_snapshot_invalid");
            zone = snapshot.Clock.TimeZoneId;
            foreach (var saved in batch)
            {
                var actual = byId[saved.Id];
                if (actual.Revision != saved.Revision) throw new CheckInFailure("checkin_configuration_conflict");
                var cache = await persistence.ReadRunAsync(saved.Id, cancellationToken);
                var runs = Project(actual, cache.Run);
                facts.Add(new(saved.Id, actual.IsRunning, actual.NextRunAt, runs.FirstOrDefault(), runs));
            }
        }
        zone ??= (await control.ReadClockAsync(cancellationToken)).TimeZoneId;
        try { _ = TimeZoneInfo.FindSystemTimeZoneById(zone); }
        catch (Exception error) when (error is TimeZoneNotFoundException or InvalidTimeZoneException or ArgumentException)
        { throw new CheckInFailure("checkin_runtime_snapshot_invalid"); }
        return new(zone, facts.ToArray(), await notifications.ReadAsync(cancellationToken));
    }
    public ValueTask RunNowAsync(Guid taskId, long expectedTaskRevision, CancellationToken cancellationToken) => control.RunNowAsync(taskId, expectedTaskRevision, cancellationToken);
    public ValueTask<IAsyncDisposable> HoldAsync(Guid taskId, long expectedTaskRevision, CancellationToken cancellationToken) => control.HoldAsync(taskId, expectedTaskRevision, cancellationToken);
    private static CheckInRun[] Project(WorkTaskInfo task, CheckInRun? cached)
    {
        if (task.Runs is null || task.Runs.Count > 16 || task.Runs.Select(run => (run.RunId, run.AttemptId)).Distinct().Count() != task.Runs.Count)
            throw new CheckInFailure("checkin_runtime_snapshot_invalid");
        return task.Runs.Select(actual => {
            Validate(actual); var status = Status(actual);
            if (cached is not null && cached.Id == actual.RunId.ToString("D") && cached.AttemptId == actual.AttemptId.ToString("D") && cached.TaskRevision == actual.TaskRevision)
                return CheckInRunFacts.Merge(cached, new(actual.RunId, actual.AttemptId, actual.TaskRevision, status, actual.CompletedAtUtc));
            return new CheckInRun(actual.RunId.ToString("D"), actual.Trigger == "manual" ? "manual" : "scheduled", status,
                actual.AcceptedAtUtc, actual.CompletedAtUtc, [], actual.AttemptId.ToString("D"), actual.TaskRevision);
        }).ToArray();
    }
    private static string Status(WorkRunFact run) => run.Completion != "returned" ? "unknown" : run.BusinessOutcome switch {
        "succeeded" => "success", "partial" => "partial", "failed" => "failed", "cancelled" => "cancelled", _ => "unknown" };
    private static void Validate(WorkRunFact run)
    {
        if (run.OperationId == Guid.Empty || run.RunId == Guid.Empty || run.AttemptId == Guid.Empty || run.TaskRevision is < 1 or > 9007199254740991 ||
            run.Trigger is not ("manual" or "schedule") || run.Completion is not ("accepted" or "running" or "notStarted" or "returned" or "unknown") ||
            run.BusinessOutcome is not (null or "succeeded" or "partial" or "failed" or "cancelled" or "unverified" or "notApplicable") ||
            (run.Completion == "returned") != (run.BusinessOutcome is not null) || run.Completion == "returned" && run.CompletedAtUtc is null ||
            run.CompletedAtUtc < run.AcceptedAtUtc) throw new CheckInFailure("checkin_runtime_snapshot_invalid");
    }
}
