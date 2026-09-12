using System.Text;
using System.Text.Json.Nodes;
using NexusPipeline.Plugin.Abstractions;

namespace NexusPipeline.Plugin.CustomWallpaper;

/// <summary>插件自有 Web API：状态、设置、二进制上传与读取、配色与轮换。</summary>
internal sealed class WallpaperWebApi
{
    private readonly WallpaperService _service;
    private readonly List<IDisposable> _registrations = new();

    public WallpaperWebApi(WallpaperService service)
    {
        _service = service;
    }

    public void Register(IPluginWebApiRegistry registry)
    {
        ArgumentNullException.ThrowIfNull(registry);
        _registrations.Add(registry.Register(new PluginWebApiRoute("GET", "state", HandleState)));
        _registrations.Add(registry.Register(new PluginWebApiRoute("PUT", "settings", HandleSettings)));
        _registrations.Add(registry.Register(new PluginWebApiRoute("POST", "assets", HandleUpload)));
        _registrations.Add(registry.Register(new PluginWebApiRoute("POST", "assets/delete", HandleDelete)));
        _registrations.Add(registry.Register(new PluginWebApiRoute("PUT", "assets/palette", HandlePalette)));
        _registrations.Add(registry.Register(new PluginWebApiRoute("GET", "asset", HandleAsset)));
    }

    public void Dispose()
    {
        foreach (IDisposable registration in _registrations)
        {
            registration.Dispose();
        }
        _registrations.Clear();
    }

    private async ValueTask<PluginWebApiResponse> HandleState(PluginWebApiRequest request, CancellationToken cancellationToken)
    {
        try
        {
            return PluginWebApiResponse.Json(await _service.GetStateAsync(cancellationToken).ConfigureAwait(false));
        }
        catch (WallpaperException ex)
        {
            return Error(ex);
        }
    }

    private async ValueTask<PluginWebApiResponse> HandleSettings(PluginWebApiRequest request, CancellationToken cancellationToken)
    {
        try
        {
            JsonNode? node = ParseJson(request.JsonBody);
            JsonObject patch = node as JsonObject ?? new JsonObject();
            return PluginWebApiResponse.Json(await _service.ApplySettingsAsync(patch, cancellationToken).ConfigureAwait(false));
        }
        catch (WallpaperException ex)
        {
            return Error(ex);
        }
    }

    private async ValueTask<PluginWebApiResponse> HandleUpload(PluginWebApiRequest request, CancellationToken cancellationToken)
    {
        try
        {
            if (request.OpenBodyStream is null)
            {
                throw new WallpaperException("invalid_image", "壁纸文件内容与声明类型不匹配");
            }
            await using Stream body = await request.OpenBodyStream(cancellationToken).ConfigureAwait(false);
            string fileName = request.Query.TryGetValue("name", out string? value) ? value : "";
            return PluginWebApiResponse.Json(await _service.UploadAsync(
                body,
                request.ContentType,
                fileName,
                request.ContentLength,
                cancellationToken).ConfigureAwait(false));
        }
        catch (WallpaperException ex)
        {
            return Error(ex);
        }
    }

    private async ValueTask<PluginWebApiResponse> HandleDelete(PluginWebApiRequest request, CancellationToken cancellationToken)
    {
        try
        {
            JsonObject body = ParseJson(request.JsonBody) as JsonObject ?? new JsonObject();
            return PluginWebApiResponse.Json(await _service.DeleteAsync(
                body["id"]?.ToString() ?? "",
                cancellationToken).ConfigureAwait(false));
        }
        catch (WallpaperException ex)
        {
            return Error(ex);
        }
    }

    private async ValueTask<PluginWebApiResponse> HandlePalette(PluginWebApiRequest request, CancellationToken cancellationToken)
    {
        try
        {
            JsonObject body = ParseJson(request.JsonBody) as JsonObject ?? new JsonObject();
            JsonObject palette = body["palette"] as JsonObject ?? new JsonObject();
            return PluginWebApiResponse.Json(await _service.SavePaletteAsync(
                body["id"]?.ToString() ?? "",
                palette,
                cancellationToken).ConfigureAwait(false));
        }
        catch (WallpaperException ex)
        {
            return Error(ex);
        }
    }

    private async ValueTask<PluginWebApiResponse> HandleAsset(PluginWebApiRequest request, CancellationToken cancellationToken)
    {
        PluginAssetContent? content = null;
        try
        {
            string id = request.Query.TryGetValue("id", out string? value) ? value : "";
            content = await _service.OpenAssetAsync(id, cancellationToken).ConfigureAwait(false);
            if (content is null)
            {
                throw new WallpaperException("not_found", "壁纸资源不存在");
            }
            // 宿主读取完响应后释放二进制流；此处保留句柄给宿主。
            var stream = content.Content;
            return PluginWebApiResponse.Binary(stream, ContentTypeFor(content.Info.Extension), 200, content.Info.SizeBytes);
        }
        catch (WallpaperException ex)
        {
            content?.Dispose();
            return Error(ex);
        }
    }

    private static string ContentTypeFor(string extension) => extension.ToLowerInvariant() switch
    {
        "png" => "image/png",
        "webp" => "image/webp",
        _ => "image/jpeg",
    };

    private static PluginWebApiResponse Error(WallpaperException exception) => new(400, new JsonObject
    {
        ["ok"] = false,
        ["code"] = exception.Code,
    });

    private static JsonNode? ParseJson(string? body)
    {
        if (string.IsNullOrWhiteSpace(body))
        {
            return null;
        }
        try
        {
            return JsonNode.Parse(body);
        }
        catch
        {
            return null;
        }
    }
}
