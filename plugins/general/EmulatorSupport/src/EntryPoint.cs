using NexusPipeline.Plugin.Abstractions;

namespace NexusPipeline.Plugin.EmulatorSupport;

public sealed class EntryPoint : INexusPlugin
{
    private IDisposable? _registration;

    public ValueTask InitializeAsync(IPluginHostContext context, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        if (context is not IPluginHostContextV1_7 api)
        {
            throw new InvalidOperationException("模拟器支持扩展需要 Plugin API 1.7。");
        }
        _registration = api.EmulatorSupport.Register(new EmulatorSupportProvider());
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
