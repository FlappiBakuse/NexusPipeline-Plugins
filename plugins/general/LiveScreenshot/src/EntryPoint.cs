using NexusPipeline.Plugin.Abstractions;

namespace NexusPipeline.Plugin.LiveScreenshot;

/// <summary>实时截图的采集由宿主执行预览端口负责，插件只提供调度中心 sidecar 前端模块。</summary>
public sealed class EntryPoint : INexusPlugin
{
    public ValueTask InitializeAsync(IPluginHostContext context, CancellationToken cancellationToken) => ValueTask.CompletedTask;

    public ValueTask StartAsync(CancellationToken cancellationToken) => ValueTask.CompletedTask;

    public ValueTask StopAsync(CancellationToken cancellationToken) => ValueTask.CompletedTask;
}
