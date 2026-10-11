using System.Net;
using System.Text.Json.Nodes;
using NexusPipeline.Plugin.Abstractions;
using NexusPipeline.Plugin.TestKit;
using Xunit;

namespace NexusPipeline.Plugin.GameActivities.Tests;

public sealed class SraHttpAndAssetTests
{
    [Fact]
    public async Task WeakTextValidatorsAndLastModifiedRoundTripWithoutChangingSemantics()
    {
        var context = new FakePluginHostContext(); var modified = DateTimeOffset.Parse("2030-10-01T00:00:00Z"); int calls = 0;
        context.Http.ResponseFactory = request =>
        {
            calls++; Assert.Equal(HttpMethod.Get, request.Method);
            if (calls == 1) { Assert.Equal("W/\"doc-v1\"", request.Headers.IfNoneMatch.ToString()); Assert.Null(request.Headers.IfModifiedSince); }
            else { Assert.Empty(request.Headers.IfNoneMatch); Assert.Equal(modified, request.Headers.IfModifiedSince); }
            return new(HttpStatusCode.NotModified);
        };
        var http = new ActivityHttp(context.Http); var url = new Uri("https://starrailassistant.top/api/v1/activity/sr.json");
        var weak = await http.ReadAsync(url, "W/\"doc-v1\"", 1024, default, lastModified: modified);
        Assert.True(weak.NotModified); Assert.Equal("W/\"doc-v1\"", weak.ETag); Assert.Empty(weak.Bytes);
        var dated = await http.ReadAsync(url, null, 1024, default, lastModified: modified);
        Assert.True(dated.NotModified); Assert.Equal(modified, dated.LastModified); Assert.Equal(2, calls);
    }

    [Fact]
    public async Task CancelledManifestScanRetriesAllReferencesBeforeEvictingAssets()
    {
        var context = new FakePluginHostContext(); using var budget = new CancellationTokenSource();
        var lateSource = GameSources.All[^1]; string scope = ActivityCoordinator.Scope(lateSource, "merged");
        await context.ScopedData.WriteJsonAsync(scope, ActivityNormalizer.Object(new { activities = new[] { new { cover = new { assetId = "protected-late" } } } }));
        var store = new CancelledScan(context.ScopedData, scope, budget); var assets = new FullAssets();
        context.Http.ResponseFactory = _ => { var r = new HttpResponseMessage(HttpStatusCode.OK) { Content = new ByteArrayContent([137,80,78,71,13,10,26,10,1]) }; r.Content.Headers.ContentType = new("image/png"); return r; };
        var source = GameSources.Resolve("blue-archive", "cn");
        var feed = ActivityNormalizer.BuildSra(source, ActivityNormalizer.Object(new { version = "1.0", versionName = "Controlled version", startTime = "2030-10-01T10:00:00", endTime = "2030-11-01T10:00:00", activities = new[] { new { name = "Controlled activity", description = "Unmodified description.", startTime = "2030-10-01T10:00:00", endTime = "2030-11-01T10:00:00", cover = "https://resource.starrailassistant.top/controlled.png" } } }), DateTimeOffset.UtcNow);
        var cache = new ActivityAssetCache(new ActivityHttp(context.Http), assets, store); int published = 0, failed = 0;
        Task Run(CancellationToken ct) => cache.CacheAsync(feed, source, true, ct, (_, _, _) => { published++; return Task.CompletedTask; }, _ => failed++);
        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => Run(budget.Token)); Assert.Empty(context.Http.Requests);
        await Run(default); Assert.Equal(2, store.LateReads); Assert.Equal(0, assets.Deletes); Assert.Equal(0, assets.Writes); Assert.Equal(0, published); Assert.Equal(1, failed);
    }
    private sealed class CancelledScan(IPluginScopedDataStore inner, string lateScope, CancellationTokenSource budget) : IPluginScopedDataStore
    {
        public int LateReads;
        public ValueTask<T?> ReadAsync<T>(string scope, CancellationToken ct = default) => inner.ReadAsync<T>(scope, ct);
        public ValueTask<JsonObject?> ReadJsonAsync(string scope, CancellationToken ct = default)
        {
            if (scope == lateScope && ++LateReads == 1) { budget.Cancel(); ct.ThrowIfCancellationRequested(); }
            return inner.ReadJsonAsync(scope, ct);
        }
        public ValueTask WriteAsync<T>(string scope, T value, CancellationToken ct = default) => inner.WriteAsync(scope, value, ct);
        public ValueTask WriteJsonAsync(string scope, JsonObject value, CancellationToken ct = default) => inner.WriteJsonAsync(scope, value, ct);
        public ValueTask DeleteAsync(string scope, CancellationToken ct = default) => inner.DeleteAsync(scope, ct);
    }
    private sealed class FullAssets : IPluginAssetStore
    {
        public int Deletes, Writes;
        public ValueTask<IReadOnlyList<PluginAssetInfo>> ListAsync(string scope, CancellationToken ct = default)
        { Assert.Equal("activity-v3", scope); return ValueTask.FromResult<IReadOnlyList<PluginAssetInfo>>([new("protected-late", scope, "png", 134217728, DateTimeOffset.UnixEpoch)]); }
        public ValueTask<bool> DeleteAsync(string scope, string id, CancellationToken ct = default) { Deletes++; return ValueTask.FromResult(true); }
        public ValueTask<PluginAssetInfo> WriteAsync(string scope, string extension, Stream content, CancellationToken ct = default) { Writes++; return ValueTask.FromResult(new PluginAssetInfo("unexpected", scope, extension, content.Length, DateTimeOffset.UtcNow)); }
        public ValueTask<PluginAssetContent?> OpenAsync(string scope, string id, CancellationToken ct = default) => ValueTask.FromResult<PluginAssetContent?>(null);
    }
}
