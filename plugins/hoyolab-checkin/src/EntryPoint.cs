using NexusPipeline.Plugin.Abstractions;

namespace NexusPipeline.Plugin.HoyoLabCheckIn;

public sealed class EntryPoint : INexusPlugin
{
    private IPluginHostContextV1_1? _context;
    private IDisposable? _contribution;
    private IDisposable? _subscription;

    public ValueTask InitializeAsync(IPluginHostContext context, CancellationToken cancellationToken)
    {
        if (context is not IPluginHostContextV1_1 v11)
        {
            throw new InvalidOperationException("HoYoLAB 自动签到需要 Plugin API v1.1，已拒绝初始化");
        }
        _context = v11;
        UserSettingsContribution contribution = new(v11);
        _contribution = contribution.Register();
        CheckInService service = new(v11);
        _subscription = v11.ExecutionEvents.SubscribeUserRunStarting(
            eventData => service.HandleUserRunStartingAsync(eventData, CancellationToken.None));
        return ValueTask.CompletedTask;
    }

    public ValueTask StartAsync(CancellationToken cancellationToken) => ValueTask.CompletedTask;

    public ValueTask StopAsync(CancellationToken cancellationToken)
    {
        _subscription?.Dispose();
        _contribution?.Dispose();
        _subscription = null;
        _contribution = null;
        _context = null;
        return ValueTask.CompletedTask;
    }
}
