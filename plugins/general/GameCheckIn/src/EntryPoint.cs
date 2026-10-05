using NexusPipeline.Plugin.Abstractions;

namespace NexusPipeline.Plugin.GameCheckIn;

public sealed class EntryPoint : INexusPlugin
{
    private CheckInTaskService? _service;

    public ValueTask InitializeAsync(IPluginHostContext context, CancellationToken cancellationToken)
    {
        _service = new CheckInTaskService(context);
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
