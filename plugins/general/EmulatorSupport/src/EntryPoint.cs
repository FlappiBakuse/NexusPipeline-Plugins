using NexusPipeline.Plugin.Abstractions;

namespace NexusPipeline.Plugin.EmulatorSupport;

public sealed class EntryPoint : INexusPlugin
{
    private IDisposable? _registration;

    public ValueTask InitializeAsync(IPluginHostContext context, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        _registration = context.EmulatorSupport.Register(new EmulatorSupportProvider());
        context.Logger.Info("已注册雷电、夜神和 BlueStacks 模拟器支持。");
        return ValueTask.CompletedTask;
    }

    public ValueTask StartAsync(CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        return ValueTask.CompletedTask;
    }

    public ValueTask StopAsync(CancellationToken cancellationToken)
    {
        _registration?.Dispose();
        _registration = null;
        return ValueTask.CompletedTask;
    }
}
