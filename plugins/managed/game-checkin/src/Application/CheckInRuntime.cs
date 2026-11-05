namespace NexusPipeline.Extensions.GameCheckIn;

internal sealed record CheckInNotificationTarget(string Id, string Name, string Type, bool Enabled, bool Configured);
internal sealed record CheckInTaskFact(Guid TaskId, bool IsRunning, DateTimeOffset? NextRunAt, CheckInRun? RecentRun, CheckInRun[] Runs);
internal sealed record CheckInRuntimeSnapshot(string TimeZoneId, CheckInTaskFact[] Tasks, CheckInNotificationTarget[] NotificationTasks);
internal interface ICheckInTaskQuiescence
{
    ValueTask<IAsyncDisposable> HoldAsync(Guid taskId, long expectedTaskRevision, CancellationToken cancellationToken);
}
internal interface ICheckInRuntime : ICheckInTaskQuiescence
{
    ValueTask<CheckInRuntimeSnapshot> ReadAsync(CheckInTaskStore store, CancellationToken cancellationToken);
    ValueTask RunNowAsync(Guid taskId, long expectedTaskRevision, CancellationToken cancellationToken);
}
internal sealed record CheckInTaskView(Guid Id, string Name, string Remark, bool Enabled, Dictionary<string, string[]> Games,
    CheckInSchedule[] Schedules, CheckInNotification Notification, bool IsRunning, DateTimeOffset? NextRunAt, CheckInRun? RecentRun, CheckInRun[] Runs);
internal sealed record CheckInPlatformView(string Id, string Name, CheckInGameView[] Games, CheckInBrowserAvailability BrowserLogin);
internal sealed record CheckInGameView(string Id, string Name);
internal sealed record CheckInBrowserAvailability(bool Ready, string Status);
internal sealed record CheckInState(long Revision, long ConfigurationRevision, string TimeZoneId, CheckInTaskView[] Tasks,
    CheckInPlatformView[] Platforms, CheckInNotificationTarget[] NotificationTasks);
internal sealed record CheckInEditorState(string EditorSessionId, long Revision, Dictionary<string, CredentialFieldView> Fields, CheckInTaskView? Task);

internal sealed class CheckInViews(ICheckInPersistence persistence, ICheckInRuntime runtime, ICheckInNativeLogin native)
{
    private long revision;
    internal async ValueTask<CheckInState> StateAsync(CheckInClient client, CancellationToken cancellationToken)
    {
        client.Require(); var snapshot = await persistence.ReadTasksAsync(cancellationToken);
        var facts = await runtime.ReadAsync(snapshot.Store, cancellationToken);
        var byId = facts.Tasks.ToDictionary(fact => fact.TaskId);
        var availability = await native.ReadAsync(client, cancellationToken);
        var platforms = CheckInCatalog.Platforms.Select(platform => {
            var ready = platform.Id == "tajiduo" ? availability.NativeReady : availability.NativeReady && availability.BrowserReady;
            return new CheckInPlatformView(platform.Id, platform.Name, platform.Games.Select(game => new CheckInGameView(game.Code, game.Name)).ToArray(),
                new(ready, ready ? "ready" : "manualOnly"));
        }).ToArray();
        client.Require();
        return new(Interlocked.Increment(ref revision), snapshot.Revision, facts.TimeZoneId,
            snapshot.Store.Tasks.Select(task => View(task, byId[task.Id])).ToArray(), platforms, facts.NotificationTasks);
    }
    internal async ValueTask RunNowAsync(CheckInClient client, Guid taskId, CancellationToken cancellationToken)
    {
        client.Require(); var snapshot = await persistence.ReadTasksAsync(cancellationToken);
        var task = snapshot.Store.Tasks.SingleOrDefault(task => task.Id == taskId) ?? throw new CheckInFailure("checkin_task_not_found");
        await runtime.RunNowAsync(task.Id, task.Revision, cancellationToken);
    }
    internal static CheckInTaskView View(CheckInTask task, CheckInTaskFact? fact = null) => new(task.Id, task.Name, task.Remark, task.Enabled,
        task.Games, task.Schedules, task.Notification, fact?.IsRunning ?? false, fact?.NextRunAt, fact?.RecentRun, fact?.Runs ?? []);
}
