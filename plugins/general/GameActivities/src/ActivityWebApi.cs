using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using NexusPipeline.Plugin.Abstractions;

namespace NexusPipeline.Plugin.GameActivities;

internal sealed class ActivityWebApi(ActivityCoordinator coordinator, IPluginAssetStore assets) : IDisposable
{
    private readonly List<IDisposable> _registrations = [];

    public void Register(IPluginWebApiRegistry registry)
    {
        RegisterRoute(registry, "GET", "state", ReadStateAsync);
        RegisterRoute(registry, "GET", "feed", ReadFeedAsync);
        RegisterRoute(registry, "PUT", "settings", SaveSettingsAsync);
        RegisterRoute(registry, "POST", "refresh", RefreshAsync);
        RegisterRoute(registry, "GET", "refresh-status", ReadOperationAsync);
        RegisterRoute(registry, "GET", "assets", ReadAssetAsync);
    }

    private async ValueTask<PluginWebApiResponse> ReadStateAsync(PluginWebApiRequest request, CancellationToken ct)
    {
        return PluginWebApiResponse.Json(await coordinator.StateAsync(ct).ConfigureAwait(false));
    }

    private async ValueTask<PluginWebApiResponse> ReadFeedAsync(PluginWebApiRequest request, CancellationToken ct)
    {
        var source = GameSources.Resolve(Query(request, "gameId"), Query(request, "progressionId"));
        var feed = await coordinator.FeedAsync(source, Query(request, "contentLocale"), ct).ConfigureAwait(false);
        return feed is null ? PluginWebApiResponse.Empty() : PluginWebApiResponse.Json(feed);
    }

    private async ValueTask<PluginWebApiResponse> SaveSettingsAsync(PluginWebApiRequest request, CancellationToken ct)
    {
        var body = JsonNode.Parse(request.JsonBody ?? "")?.AsObject() ?? throw new ActivityException("invalid_settings", 400);
        long expected = body["expectedRevision"]?.GetValue<long>() ?? throw new ActivityException("invalid_settings", 400);
        var settings = body["settings"]?.Deserialize<ActivitySettings>(ActivityNormalizer.Json) ?? throw new ActivityException("invalid_settings", 400);
        var saved = await coordinator.SettingsAsync(expected, settings, ct).ConfigureAwait(false);
        return PluginWebApiResponse.Json(saved);
    }

    private async ValueTask<PluginWebApiResponse> RefreshAsync(PluginWebApiRequest request, CancellationToken ct)
    {
        if (request.JsonBody is not { Length: > 0 }
            || JsonNode.Parse(request.JsonBody) is not JsonObject body
            || body.Count != 1 || body["selected"]?.GetValue<bool>() != true)
        {
            throw new ActivityException("invalid_refresh", 400);
        }
        return PluginWebApiResponse.Json(await coordinator.QueueAsync(true, ct).ConfigureAwait(false), 202);
    }

    private async ValueTask<PluginWebApiResponse> ReadOperationAsync(PluginWebApiRequest request, CancellationToken ct)
    {
        var operation = await coordinator.OperationAsync(Query(request, "operationId"), ct).ConfigureAwait(false);
        return PluginWebApiResponse.Json(operation);
    }

    private async ValueTask<PluginWebApiResponse> ReadAssetAsync(PluginWebApiRequest request, CancellationToken ct)
    {
        string id = Query(request, "assetId");
        if (!Regex.IsMatch(id, "^[a-f0-9]{64}$")) throw new ActivityException("invalid_asset", 400);
        var content = await assets.OpenAsync(ActivityAssetCache.Scope, id, ct).ConfigureAwait(false);
        if (content is null) return PluginWebApiResponse.Empty(404);
        string mime = content.Info.Extension switch
        {
            "png" => "image/png",
            "jpg" or "jpeg" => "image/jpeg",
            "gif" => "image/gif",
            "webp" => "image/webp",
            "avif" => "image/avif",
            _ => "application/octet-stream"
        };
        return PluginWebApiResponse.Binary(content.Content, mime, contentLength: content.Info.SizeBytes);
    }

    private void RegisterRoute(IPluginWebApiRegistry registry, string method, string route,
        Func<PluginWebApiRequest, CancellationToken, ValueTask<PluginWebApiResponse>> handler)
    {
        _registrations.Add(registry.Register(new(method, route, PluginOperationAccess.General, async (request, ct) =>
        {
            try
            {
                return await handler(request, ct).ConfigureAwait(false);
            }
            catch (ActivityException error)
            {
                return PluginWebApiResponse.Json(ActivityNormalizer.Object(new { code = error.Code }), error.Status);
            }
            catch (Exception error) when (error is JsonException or InvalidOperationException or FormatException)
            {
                return PluginWebApiResponse.Json(ActivityNormalizer.Object(new { code = "invalid_request" }), 400);
            }
        })));
    }

    private static string Query(PluginWebApiRequest request, string key) => request.Query.GetValueOrDefault(key) ?? "";

    public void Dispose()
    {
        foreach (var registration in _registrations) registration.Dispose();
        _registrations.Clear();
    }
}
