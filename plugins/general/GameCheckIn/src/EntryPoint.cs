using NexusPipeline.Plugin.Abstractions;

namespace NexusPipeline.Plugin.GameCheckIn;

public sealed class EntryPoint : INexusPlugin
{
    private CheckInTaskService? _service;

    public ValueTask InitializeAsync(IPluginHostContext context, CancellationToken cancellationToken)
    {
        if (context is not IPluginHostContextV1_8 v18)
        {
            throw new InvalidOperationException("游戏自动签到需要 Plugin API v1.8，已拒绝初始化");
        }
        _service = new CheckInTaskService(v18);
        return ValueTask.CompletedTask;
    }

    public ValueTask StartAsync(CancellationToken cancellationToken) =>
        _service?.StartAsync(cancellationToken) ?? ValueTask.CompletedTask;

    public async ValueTask StopAsync(CancellationToken cancellationToken)
    {
        if (_service is null) return;
        await _service.StopAsync(cancellationToken).ConfigureAwait(false);
        _service = null;
    }
}
