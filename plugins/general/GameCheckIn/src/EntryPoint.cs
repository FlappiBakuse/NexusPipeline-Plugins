using NexusPipeline.Plugin.Abstractions;

namespace NexusPipeline.Plugin.GameCheckIn;

public sealed class EntryPoint : INexusPlugin
{
    private IDisposable? _contribution;
    private IDisposable? _badgeContribution;
    private IDisposable? _subscription;

    public ValueTask InitializeAsync(IPluginHostContext context, CancellationToken cancellationToken)
    {
        if (context is not IPluginHostContextV1_2 v12)
        {
            throw new InvalidOperationException("游戏自动签到需要 Plugin API v1.2，已拒绝初始化");
        }
        _contribution = new UserSettingsContribution(v12).Register();
        _badgeContribution = new UserListBadgeContribution(v12).Register();
        CheckInService service = new(v12);
        _subscription = v12.ExecutionEvents.SubscribeUserRunStarting(
            eventData => service.HandleUserRunStartingAsync(eventData, CancellationToken.None));
        return ValueTask.CompletedTask;
    }

    public ValueTask StartAsync(CancellationToken cancellationToken) => ValueTask.CompletedTask;

    public ValueTask StopAsync(CancellationToken cancellationToken)
    {
        _subscription?.Dispose();
        _badgeContribution?.Dispose();
        _contribution?.Dispose();
        _subscription = null;
        _badgeContribution = null;
        _contribution = null;
        return ValueTask.CompletedTask;
    }
}
