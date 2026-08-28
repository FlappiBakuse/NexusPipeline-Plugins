using NexusPipeline.Plugin.Abstractions;

namespace NexusPipeline.Plugin.CustomWallpaper;

/// <summary>自定义壁纸的持久化由宿主 Frontend API 管理，managed-code 生命周期保留为稳定的插件身份与权限锚点。</summary>
public sealed class EntryPoint : INexusPlugin
{
    public ValueTask InitializeAsync(IPluginHostContext context, CancellationToken cancellationToken) => ValueTask.CompletedTask;

    public ValueTask StartAsync(CancellationToken cancellationToken) => ValueTask.CompletedTask;

    public ValueTask StopAsync(CancellationToken cancellationToken) => ValueTask.CompletedTask;
}
