using System.Net;
using System.Reflection;
using System.Text.Json.Nodes;
using AngleSharp.Dom;
using AngleSharp.Html.Parser;
using NexusPipeline.Plugin.TestKit;
using Xunit;

namespace NexusPipeline.Plugin.GameActivities.Tests;

public sealed class ReliabilityTests
{
    private static readonly GameSource Source = GameSources.Resolve("blue-archive", "cn");
    private static readonly DateTimeOffset Now = DateTimeOffset.Parse("2026-10-10T00:00:00Z");
    private const string Root = "feed/blue-archive/cn/zh-CN/";
    private static JsonObject Raw() => ActivityNormalizer.Object(new
    {
        activities = new[] { new { name = "活动", startTime = "2026-10-01T12:00:00", endTime = "2026-11-20T12:00:00" } }
    });

    [Fact]
    public async Task LastModifiedFallbackPersistsWhileOfficialTtlWaitsForExactlyTwelveHours()
    {
        var context = new FakePluginHostContext(); var clock = new Clock(Now); var raw = Raw();
        var modified = DateTimeOffset.Parse("2026-10-01T00:00:00Z");
        await context.Config.WriteAsync(new ActivitySettingsState(0, new() { SelectedGames = ["blue-archive"] }));
        await context.ScopedData.WriteJsonAsync(Root + "merged/v1", ActivityNormalizer.Normalize(Source, raw, Now.AddHours(-7)));
        await context.ScopedData.WriteAsync(Root + "official/v4", new { CheckedAt = Now, Result = new OfficialResult([], "partial", "test") });
        int aggregate = 0, official = 0;
        context.Http.ResponseFactory = request =>
        {
            if (request.RequestUri!.Host != "starrailassistant.top")
            {
                official++; return new(HttpStatusCode.OK) { Content = new StringContent("""{"code":0,"data":{"rows":[]}}""") };
            }
            aggregate++;
            Assert.Empty(request.Headers.IfNoneMatch);
            if (aggregate > 1)
            {
                Assert.Equal(modified, request.Headers.IfModifiedSince);
                return new(HttpStatusCode.NotModified);
            }
            var response = new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(raw.ToJsonString()) };
            response.Content.Headers.LastModified = modified; return response;
        };
        var service = new ActivityCoordinator(context, clock); await service.InitializeAsync(default);
        try
        {
            await Refresh(service); Assert.Equal(1, aggregate); Assert.Equal(0, official);
            var checkpoint = await context.ScopedData.ReadJsonAsync(Root + "sra/v1");
            Assert.Equal(modified, DateTimeOffset.Parse(ActivityPolicy.Text(checkpoint!["lastModified"])));
            await service.StopAsync(default); service = new ActivityCoordinator(context, clock); await service.InitializeAsync(default);
            clock.Now = Now.AddHours(6).AddSeconds(-1); await Refresh(service); Assert.Equal(1, aggregate);
            clock.Now = Now.AddHours(6); await Refresh(service); Assert.Equal(2, aggregate); Assert.Equal(0, official);
            clock.Now = Now.AddHours(12).AddSeconds(-1); await Refresh(service); Assert.Equal(2, aggregate); Assert.Equal(0, official);
            clock.Now = Now.AddHours(12); await Refresh(service); Assert.Equal(3, aggregate); Assert.Equal(1, official);
            clock.Now = Now.AddHours(18); await Refresh(service); Assert.Equal(4, aggregate); Assert.Equal(1, official);
            Assert.True(JsonNode.DeepEquals(raw, (await context.ScopedData.ReadJsonAsync(Root + "sra/v1"))!["raw"]));
            Assert.Equal(ActivityNormalizer.Utc(clock.Now), ActivityPolicy.Text((await service.FeedAsync(Source, Source.Locale, default))!["health"]!["lastCheckedAt"]));
        }
        finally { await service.StopAsync(default); }

        context.Http.ResponseFactory = request =>
        {
            Assert.Equal("\"preferred\"", Assert.Single(request.Headers.IfNoneMatch).ToString());
            Assert.Null(request.Headers.IfModifiedSince);
            return new(HttpStatusCode.NotModified);
        };
        var etagCheckpoint = ActivityNormalizer.Object(new { etag = "\"preferred\"", lastModified = modified, raw });
        var result = await new SraActivityProvider(new ActivityHttp(context.Http)).FetchAsync(Source, etagCheckpoint, default);
        Assert.Equal(modified, result.LastModified); Assert.True(JsonNode.DeepEquals(raw, result.Raw));
    }

    [Fact]
    public async Task CancellationInsideOfficialTextTraversalReturnsNoPartialDescription()
    {
        using var document = await new HtmlParser().ParseDocumentAsync("<article><p>第一段</p><p>第二段</p></article>");
        using var cancellation = new CancellationTokenSource();
        var element = DispatchProxy.Create<IElement, CancellingElement>();
        var proxy = (CancellingElement)element; proxy.Target = document.QuerySelector("article")!; proxy.Cancellation = cancellation;
        Assert.Throws<OperationCanceledException>(() => OfficialNoticeText.Read(element, cancellation.Token));
        Assert.True(proxy.TraversalEntered);
    }

    [Fact]
    public async Task FullImageQuotaEvictsLeastRecentlyReferencedAndKeepsEveryReferencedAsset()
    {
        var context = new FakePluginHostContext(); var manifest = new JsonObject(); var ids = new List<string>();
        for (int i = 0; i < 16; i++)
        {
            byte[] bytes = Picture(i);
            var asset = await context.Assets.WriteAsync("activity", "png", new MemoryStream(bytes, false)); ids.Add(asset.Id);
            string url = Url(i);
            manifest[ActivityNormalizer.Hash(url)] = ActivityNormalizer.Object(new { id = asset.Id, url, lastReferencedAt = ActivityNormalizer.Utc(Now.AddDays(-20 + i)) });
        }
        Assert.Equal(134217728L, (await context.Assets.ListAsync("activity")).Sum(asset => asset.SizeBytes));
        await context.ScopedData.WriteJsonAsync("asset-manifest", manifest);
        var protectedFeed = ActivityNormalizer.Normalize(GameSources.Resolve("blue-archive", "jp"), Raw(), Now);
        protectedFeed["overview"]!["cover"] = ActivityNormalizer.Object(new { assetId = ids[0] });
        await context.ScopedData.WriteJsonAsync("feed/blue-archive/jp/zh-CN/merged/v1", protectedFeed);
        var touched = Raw(); touched["cover"] = Url(1);
        await new ActivityAssetCache(new ActivityHttp(context.Http), context.Assets, context.ScopedData)
            .CacheAsync(ActivityNormalizer.Normalize(Source, touched, Now), touched, default);
        var touchedManifest = await context.ScopedData.ReadJsonAsync("asset-manifest");
        Assert.True(DateTimeOffset.Parse(ActivityPolicy.Text(touchedManifest![ActivityNormalizer.Hash(Url(1))]!["lastReferencedAt"])) > Now.AddDays(-1));
        context.Http.ResponseFactory = request =>
        {
            var response = new HttpResponseMessage(HttpStatusCode.OK) { Content = new ByteArrayContent(Picture(request.RequestUri!.AbsolutePath.EndsWith("17.png", StringComparison.Ordinal) ? 17 : 16)) };
            response.Content.Headers.ContentType = new("image/png"); return response;
        };
        var incoming = Raw(); incoming["cover"] = Url(16); var feed = ActivityNormalizer.Normalize(Source, incoming, Now);
        await new ActivityAssetCache(new ActivityHttp(context.Http), context.Assets, context.ScopedData).CacheAsync(feed, incoming, default);
        var remaining = await context.Assets.ListAsync("activity");
        Assert.Equal(134217728L, remaining.Sum(asset => asset.SizeBytes));
        Assert.Contains(remaining, asset => asset.Id == ids[0]); Assert.Contains(remaining, asset => asset.Id == ids[1]);
        Assert.DoesNotContain(remaining, asset => asset.Id == ids[2]);
        Assert.Contains(remaining, asset => asset.Id == ActivityPolicy.Text(feed["overview"]!["cover"]!["assetId"]));

        protectedFeed["activities"] = new JsonArray(remaining.Select(asset => (JsonNode)ActivityNormalizer.Object(new { cover = new { assetId = asset.Id } })).ToArray());
        await context.ScopedData.WriteJsonAsync("feed/blue-archive/jp/zh-CN/merged/v1", protectedFeed);
        int writes = context.Assets.WriteCount, deletes = context.Assets.DeleteCount;
        var blocked = Raw(); blocked["cover"] = Url(17);
        var blockedFeed = ActivityNormalizer.Normalize(Source, blocked, Now);
        await new ActivityAssetCache(new ActivityHttp(context.Http), context.Assets, context.ScopedData).CacheAsync(blockedFeed, blocked, default);
        Assert.Equal(writes, context.Assets.WriteCount); Assert.Equal(deletes, context.Assets.DeleteCount);
        Assert.Null(blockedFeed["overview"]!["cover"]);

        protectedFeed["activities"] = new JsonArray();
        await context.ScopedData.WriteJsonAsync("feed/blue-archive/jp/zh-CN/merged/v1", protectedFeed);
        var withOrphan = await context.ScopedData.ReadJsonAsync("asset-manifest");
        withOrphan!.Remove(ActivityNormalizer.Hash(Url(15)));
        foreach (var entry in withOrphan.Select(pair => pair.Value)) entry!["lastReferencedAt"] = "2099-01-01T00:00:00Z";
        await context.ScopedData.WriteJsonAsync("asset-manifest", withOrphan);
        await new ActivityAssetCache(new ActivityHttp(context.Http), context.Assets, context.ScopedData).CacheAsync(blockedFeed, blocked, default);
        remaining = await context.Assets.ListAsync("activity");
        Assert.Equal(134217728L, remaining.Sum(asset => asset.SizeBytes));
        Assert.DoesNotContain(remaining, asset => asset.Id == ids[15]);
        Assert.Contains(remaining, asset => asset.Id == ids[0]);
        Assert.NotNull(blockedFeed["overview"]!["cover"]!["assetId"]);
    }

    private static string Url(int i) => "https://resource.starrailassistant.top/quota/" + i + ".png";
    private static byte[] Picture(int i)
    {
        byte[] bytes = new byte[8388608]; new byte[] { 137, 80, 78, 71, 13, 10, 26, 10 }.CopyTo(bytes, 0); bytes[8] = (byte)i; return bytes;
    }
    private static async Task Refresh(ActivityCoordinator service)
    {
        var op = await service.QueueAsync(false, default); string id = ActivityPolicy.Text(op["operationId"]);
        using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(8));
        while (ActivityPolicy.Text((await service.OperationAsync(id, timeout.Token))["status"]) is "queued" or "running") await Task.Delay(10, timeout.Token);
        Assert.Equal("succeeded", ActivityPolicy.Text((await service.OperationAsync(id, default))["status"]));
    }
    public class CancellingElement : DispatchProxy
    {
        public IElement Target { get; set; } = null!;
        public CancellationTokenSource Cancellation { get; set; } = null!;
        public bool TraversalEntered { get; private set; }
        protected override object? Invoke(MethodInfo? method, object?[]? args)
        {
            if (method!.Name == "get_ChildNodes") { TraversalEntered = true; Cancellation.Cancel(); }
            return method.Invoke(Target, args);
        }
    }
    private sealed class Clock(DateTimeOffset now) : TimeProvider
    {
        public DateTimeOffset Now { get; set; } = now;
        public override DateTimeOffset GetUtcNow() => Now;
    }
}
