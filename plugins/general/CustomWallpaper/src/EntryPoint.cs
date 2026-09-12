using NexusPipeline.Plugin.Abstractions;

namespace NexusPipeline.Plugin.CustomWallpaper;

/// <summary>
/// 自定义壁纸插件：壁纸资产、配额、顺序、轮换、配色与插件 Web API 全部由插件实现；
/// 宿主只提供通用插件资产存储与二进制 Web API 传输。
/// </summary>
public sealed class EntryPoint : INexusPlugin
{
    private WallpaperService? _service;
    private WallpaperWebApi? _webApi;

    public async ValueTask InitializeAsync(IPluginHostContext context, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(context);
        if (context is not IPluginHostContextV1_6 host)
        {
            throw new NotSupportedException("自定义壁纸需要宿主提供 Plugin API v1.6 的插件资产存储能力。");
        }
        _service = new WallpaperService(host.Config, host.ScopedData, host.Assets, host.Logger);
        _webApi = new WallpaperWebApi(_service);
        _webApi.Register(host.WebApi);
        await _service.InitializeAsync(cancellationToken).ConfigureAwait(false);
    }

    /// <summary>插件启动时执行一次启动轮换；轮换方式为 startup 时随机选择本次服务使用的壁纸。</summary>
    public async ValueTask StartAsync(CancellationToken cancellationToken)
    {
        if (_service is not null)
        {
            await _service.AdvanceStartupRotationAsync(cancellationToken).ConfigureAwait(false);
        }
    }

    public ValueTask StopAsync(CancellationToken cancellationToken)
    {
        _webApi?.Dispose();
        _webApi = null;
        _service = null;
        return ValueTask.CompletedTask;
    }
}
