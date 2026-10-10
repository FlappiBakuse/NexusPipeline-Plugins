using System.Net;
using System.Net.Http.Headers;
using System.Text.Json.Nodes;
using NexusPipeline.Plugin.TestKit;
using Xunit;

namespace NexusPipeline.Plugin.GameActivities.Tests;

public sealed class FaultMatrixTests
{
    private static readonly DateTimeOffset Now = DateTimeOffset.Parse("2026-10-10T00:00:00Z");
    private static readonly GameSource Source = GameSources.Resolve("blue-archive", "cn");
    private const string Root = "feed/blue-archive/cn/zh-CN/";
    private static JsonObject Raw(string start = "2026-10-01T12:00:00", string end = "2026-10-22T13:59:00")
        => ActivityNormalizer.Object(new { version = "1.4", activities = new[] { new { name = "活动", startTime = start, endTime = end } } });

    [Fact]
    public void UnknownStartsAreStartedWithoutInventingStartsOrDeadlines()
    {
        var raw = Raw(); raw["activities"]![0]!["startTime"] = null; raw["activities"]![0]!["endTime"] = null;
        var feed = ActivityNormalizer.Normalize(Source, raw, Now);
        var item = feed["activities"]![0]!;
        Assert.Equal("ongoing", ActivityPolicy.Status(item, Now)); Assert.Null(item["times"]!["start"]); Assert.Null(item["times"]!["playEnd"]);
        var unknown = OfficialTimeParser.Parse("10月22日 13:59", new("活动", "", "https://www.bluearchive-cn.com/news/1974", "zh-CN", PublishedAt: Now), "source");
        item["times"]!["playEnd"] = unknown;
        Assert.Equal("ongoing", ActivityPolicy.Status(item, Now)); Assert.Null(item["times"]!["playEnd"]!["instantUtc"]);
        item["times"]!["playEnd"] = Time(Now);
        Assert.Equal("ended", ActivityPolicy.Status(item, Now));
        item["times"]!["playEnd"] = null; item["times"]!["start"] = Time(Now.AddSeconds(1));
        Assert.Equal("upcoming", ActivityPolicy.Status(item, Now));
        item["times"]!["start"] = Time(Now);
        Assert.Equal("ongoing", ActivityPolicy.Status(item, Now));
    }

    [Fact]
    public async Task Conditional304ReusesOnlyItsRawCheckpointAndKeepsOutdatedContent()
    {
        var context = new FakePluginHostContext();
        var raw = Raw(end: "2026-10-02T12:00:00");
        var checkpoint = ActivityNormalizer.Object(new { etag = "\"old\"", raw });
        context.Http.ResponseFactory = request =>
        {
            Assert.Equal("\"old\"", Assert.Single(request.Headers.IfNoneMatch).ToString());
            return new(HttpStatusCode.NotModified);
        };
        var provider = new SraActivityProvider(new ActivityHttp(context.Http));
        var result = await provider.FetchAsync(Source, checkpoint, default);
        Assert.True(JsonNode.DeepEquals(raw, result.Raw)); Assert.Equal("\"old\"", result.ETag);
        result.Raw["version"] = "changed"; Assert.Equal("1.4", ActivityPolicy.Text(checkpoint["raw"]!["version"]));
        var feed = ActivityNormalizer.Normalize(Source, checkpoint["raw"]!.AsObject(), Now);
        Assert.Equal("outdated", ActivityPolicy.Text(feed["health"]!["contentState"]));
        context.Http.ResponseFactory = _ => new(HttpStatusCode.NotModified);
        Assert.Equal("invalid_304", (await Assert.ThrowsAsync<ActivityException>(() => provider.FetchAsync(Source, null, default))).Code);
    }

    [Fact]
    public async Task BadJsonHtmlRateLimitsAndOversizedResponsesKeepLastGoodAcrossRestart()
    {
        foreach (string fault in new[] { "json", "html", "retry-delta", "retry-date", "size-header", "size-stream" })
        {
            var context = new FakePluginHostContext(); await Seed(context, Raw());
            string before = ActivityPolicy.Text((await context.ScopedData.ReadJsonAsync(Root + "merged/v1"))!["snapshotId"]);
            string rawBefore = (await context.ScopedData.ReadJsonAsync(Root + "sra/v1"))!.ToJsonString();
            // HTTP dates and persisted nextCheckAt use whole-second precision.
            var clock = new Clock(DateTimeOffset.FromUnixTimeSeconds(DateTimeOffset.UtcNow.ToUnixTimeSeconds()));
            var retry = clock.Now.AddMinutes(10);
            context.Http.ResponseFactory = _ => fault switch
            {
                "json" => Json("{broken"), "html" => Json("<html>verification</html>"),
                "retry-delta" => RateLimit(new RetryConditionHeaderValue(TimeSpan.FromMinutes(10))),
                "retry-date" => RateLimit(new RetryConditionHeaderValue(retry)),
                "size-header" => OversizedHeader(),
                _ => new(HttpStatusCode.OK) { Content = new UnknownLengthContent(new byte[4194305]) }
            };
            var service = new ActivityCoordinator(context, clock); await service.InitializeAsync(default);
            try
            {
                var op = await service.QueueAsync(true, default); await Wait(service, ActivityPolicy.Text(op["operationId"]));
                Assert.Equal("failed", ActivityPolicy.Text((await service.OperationAsync(ActivityPolicy.Text(op["operationId"]), default))["status"]));
                var retained = await service.FeedAsync(Source, Source.Locale, default);
                Assert.Equal(before, ActivityPolicy.Text(retained!["snapshotId"])); Assert.Equal("stale", ActivityPolicy.Text(retained["health"]!["cacheState"]));
                Assert.Equal(rawBefore, (await context.ScopedData.ReadJsonAsync(Root + "sra/v1"))!.ToJsonString());
                var next = DateTimeOffset.Parse(ActivityPolicy.Text(retained["health"]!["nextCheckAt"]));
                Assert.InRange(next, clock.Now.AddMinutes(1), clock.Now.AddMinutes(11));
                if (fault.StartsWith("retry-", StringComparison.Ordinal)) Assert.True(next >= retry.AddSeconds(-2));
                await service.StopAsync(default);
                int requests = context.Http.Requests.Count;
                service = new ActivityCoordinator(context, clock); await service.InitializeAsync(default);
                Assert.Equal(before, ActivityPolicy.Text((await service.FeedAsync(Source, Source.Locale, default))!["snapshotId"]));
                Assert.Equal(requests, context.Http.Requests.Count);
                op = await service.QueueAsync(false, default); await Wait(service, ActivityPolicy.Text(op["operationId"]));
                Assert.Equal(requests, context.Http.Requests.Count);
            }
            finally { await service.StopAsync(default); }
        }
    }

    [Fact]
    public async Task OfficialRateLimitRetainsFieldsAndPersistsItsRetryAfter()
    {
        var context = new FakePluginHostContext(); var raw = Raw(); await Seed(context, raw);
        var notice = new OfficialNotice("活动", "活动时间：2026/10/01 12:00 ~ 2026/10/22 13:59 UTC+8",
            "https://www.bluearchive-cn.com/news/123", "zh-CN", PublishedAt: Now);
        await context.ScopedData.WriteAsync(Root + "official/v4", new { CheckedAt = DateTimeOffset.UtcNow.AddHours(-13), Result = new OfficialResult([notice], "partial", "test") });
        var retry = DateTimeOffset.FromUnixTimeSeconds(DateTimeOffset.UtcNow.ToUnixTimeSeconds() + 1200);
        context.Http.ResponseFactory = request => request.RequestUri!.Host == "starrailassistant.top" ? Json(raw.ToJsonString()) : RateLimit(new RetryConditionHeaderValue(retry));
        var service = new ActivityCoordinator(context); await service.InitializeAsync(default);
        try
        {
            var operation = await service.QueueAsync(true, default); await Wait(service, ActivityPolicy.Text(operation["operationId"]));
            Assert.Equal("partial", ActivityPolicy.Text((await service.OperationAsync(ActivityPolicy.Text(operation["operationId"]), default))["status"]));
            var feed = await service.FeedAsync(Source, Source.Locale, default);
            Assert.Equal("2026-10-22T05:59:00Z", ActivityPolicy.Text(feed!["activities"]![0]!["times"]!["playEnd"]!["instantUtc"]));
            Assert.True(DateTimeOffset.Parse(ActivityPolicy.Text(feed["health"]!["nextCheckAt"])) >= retry);
            Assert.Equal("stale", ActivityPolicy.Text(feed["health"]!["cacheState"]));
            await service.StopAsync(default);
            int count = context.Http.Requests.Count;
            service = new ActivityCoordinator(context); await service.InitializeAsync(default);
            operation = await service.QueueAsync(false, default); await Wait(service, ActivityPolicy.Text(operation["operationId"]));
            Assert.Equal(count, context.Http.Requests.Count);
        }
        finally { await service.StopAsync(default); }
    }

    [Fact]
    public async Task ConcurrentRefreshJoinsOneOperationAndReadsDoNotFetch()
    {
        var context = new FakePluginHostContext();
        using var entered = new ManualResetEventSlim(); using var release = new ManualResetEventSlim();
        context.Http.ResponseFactory = request =>
        {
            if (request.RequestUri!.Host != "starrailassistant.top") return Json("""{"code":0,"data":{"rows":[]}}""");
            entered.Set(); if (!release.Wait(TimeSpan.FromSeconds(5))) throw new TimeoutException(); return Json(Raw().ToJsonString());
        };
        await context.Config.WriteAsync(new ActivitySettingsState(0, new() { SelectedGames = ["blue-archive"] }));
        var service = new ActivityCoordinator(context); await service.InitializeAsync(default);
        try
        {
            var first = await service.QueueAsync(true, default); Assert.True(entered.Wait(TimeSpan.FromSeconds(5)));
            var joined = await Task.WhenAll(Enumerable.Range(0, 16).Select(_ => service.QueueAsync(true, default)));
            Assert.All(joined, value => { Assert.True(value["joinedExisting"]!.GetValue<bool>()); Assert.Equal(ActivityPolicy.Text(first["operationId"]), ActivityPolicy.Text(value["operationId"])); });
            for (int read = 0; read < 10; read++) { await service.StateAsync(default); await service.FeedAsync(Source, Source.Locale, default); }
            Assert.Single(context.Http.Requests);
            release.Set(); await Wait(service, ActivityPolicy.Text(first["operationId"]));
            Assert.Equal("refresh_rate_limited", (await Assert.ThrowsAsync<ActivityException>(() => service.QueueAsync(true, default))).Code);
            Assert.Single(context.Http.Requests, request => request.RequestUri!.Host == "starrailassistant.top");
        }
        finally { release.Set(); await service.StopAsync(default); }
    }

    [Fact]
    public async Task TtlAndBoundaryChecksCoalescePersistAndNeverReplayHistoricalBoundaries()
    {
        var activityBoundary = Raw(end: "2026-10-10T08:10:00");
        var versionBoundary = Raw(end: "2026-10-02T12:00:00");
        versionBoundary["startTime"] = "2026-10-01T12:00:00";
        versionBoundary["endTime"] = "2026-10-10T08:10:00";
        foreach (var raw in new[] { activityBoundary, versionBoundary })
        {
            var context = new FakePluginHostContext();
            var clock = new Clock(Now);
            await Seed(context, raw);
            context.Http.ResponseFactory = _ => Json(raw.ToJsonString());
            var service = new ActivityCoordinator(context, clock); await service.InitializeAsync(default);
            try
            {
                await Refresh(service); Assert.Single(context.Http.Requests);
                await Refresh(service); Assert.Single(context.Http.Requests);
                await service.StopAsync(default);
                service = new ActivityCoordinator(context, clock); await service.InitializeAsync(default);
                await Refresh(service); Assert.Single(context.Http.Requests);
                clock.Now = Now.AddMinutes(10);
                await Refresh(service); Assert.Equal(2, context.Http.Requests.Count);
                await Refresh(service); Assert.Equal(2, context.Http.Requests.Count);
                clock.Now = Now.AddDays(60);
                await Refresh(service); Assert.Equal(3, context.Http.Requests.Count);
                await Refresh(service); Assert.Equal(3, context.Http.Requests.Count);
            }
            finally { await service.StopAsync(default); }
        }
    }

    [Fact]
    public async Task InvalidAndRedirectedPicturesKeepPreviouslyDecodedAssets()
    {
        var context = new FakePluginHostContext(); var raw = Raw(); raw["cover"] = "https://resource.starrailassistant.top/good.png";
        var original = ActivityNormalizer.Normalize(Source, raw, Now);
        context.Http.ResponseFactory = _ =>
        {
            var content = new ByteArrayContent([137, 80, 78, 71, 13, 10, 26, 10]); content.Headers.ContentType = new("image/png");
            return new(HttpStatusCode.OK) { Content = content };
        };
        await new ActivityAssetCache(new ActivityHttp(context.Http), context.Assets, context.ScopedData).CacheAsync(original, raw, default);
        string id = ActivityPolicy.Text(original["overview"]!["cover"]!["assetId"]); Assert.NotEmpty(id);
        foreach (string fault in new[] { "svg", "html", "mime", "redirect", "too-large" })
        {
            raw["cover"] = "https://resource.starrailassistant.top/" + fault + ".png";
            var feed = ActivityNormalizer.Normalize(Source, raw, Now); ActivityFeedMerger.PreserveOfficialFields(feed, original);
            context.Http.ResponseFactory = _ => fault switch
            {
                "redirect" => new(HttpStatusCode.Redirect) { Headers = { Location = new("https://example.invalid/private") } },
                "too-large" => OversizedHeader(8388609),
                _ => new(HttpStatusCode.OK) { Content = new StringContent(fault == "svg" ? "<svg/>" : "<html/>", System.Text.Encoding.UTF8, fault == "mime" ? "image/png" : fault == "svg" ? "image/svg+xml" : "text/html") }
            };
            await new ActivityAssetCache(new ActivityHttp(context.Http), context.Assets, context.ScopedData).CacheAsync(feed, raw, default);
            Assert.Equal(id, ActivityPolicy.Text(feed["overview"]!["cover"]!["assetId"]));
            Assert.Equal(1, context.Assets.WriteCount); Assert.Equal(0, context.Assets.DeleteCount);
            Assert.DoesNotContain(context.Http.Requests, request => request.RequestUri!.Host == "example.invalid");
        }
    }

    [Fact]
    public async Task StopCancelsPendingHttpWithoutPublishingOrWritingRawCheckpoint()
    {
        var context = new FakePluginHostContext(); using var entered = new ManualResetEventSlim(); using var release = new ManualResetEventSlim();
        context.Http.ResponseFactory = _ => { entered.Set(); if (!release.Wait(TimeSpan.FromSeconds(5))) throw new TimeoutException(); return Json(Raw().ToJsonString()); };
        await context.Config.WriteAsync(new ActivitySettingsState(0, new() { SelectedGames = ["blue-archive"] }));
        var service = new ActivityCoordinator(context); await service.InitializeAsync(default);
        var operation = await service.QueueAsync(true, default); Assert.True(entered.Wait(TimeSpan.FromSeconds(5)));
        var stopping = service.StopAsync(default); release.Set(); await stopping;
        Assert.Equal("cancelled", ActivityPolicy.Text((await service.OperationAsync(ActivityPolicy.Text(operation["operationId"]), default))["status"]));
        Assert.False(context.ScopedData.Contains(Root + "sra/v1")); Assert.False(context.ScopedData.Contains(Root + "merged/v1"));
    }

    private static JsonObject Time(DateTimeOffset value) => ActivityNormalizer.Object(new
    {
        instantUtc = ActivityNormalizer.Utc(value), certainty = "confirmed", timeBasis = "UTC", precision = "second"
    });
    private static async Task Seed(FakePluginHostContext context, JsonObject raw)
    {
        await context.Config.WriteAsync(new ActivitySettingsState(0, new() { SelectedGames = ["blue-archive"] }));
        var feed = ActivityNormalizer.Normalize(Source, raw, Now); feed["health"]!["nextCheckAt"] = ActivityNormalizer.Utc(Now.AddHours(-1));
        await context.ScopedData.WriteJsonAsync(Root + "merged/v1", feed);
        await context.ScopedData.WriteJsonAsync(Root + "sra/v1", ActivityNormalizer.Object(new { etag = "\"last-good\"", raw }));
        await context.ScopedData.WriteAsync(Root + "official/v4", new { CheckedAt = Now.AddDays(60), Result = new OfficialResult([], "partial", "test") });
    }
    private static HttpResponseMessage Json(string value) => new(HttpStatusCode.OK) { Content = new StringContent(value) };
    private static HttpResponseMessage RateLimit(RetryConditionHeaderValue retry) => new(HttpStatusCode.TooManyRequests) { Headers = { RetryAfter = retry } };
    private static HttpResponseMessage OversizedHeader(int size = 4194305)
    {
        var content = new ByteArrayContent([]); content.Headers.ContentLength = size; return new(HttpStatusCode.OK) { Content = content };
    }
    private static async Task Refresh(ActivityCoordinator service)
    {
        var op = await service.QueueAsync(false, default); await Wait(service, ActivityPolicy.Text(op["operationId"]));
    }
    private static async Task Wait(ActivityCoordinator service, string id)
    {
        using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(8));
        while (ActivityPolicy.Text((await service.OperationAsync(id, timeout.Token))["status"]) is "queued" or "running") await Task.Delay(10, timeout.Token);
    }
    private sealed class Clock(DateTimeOffset now) : TimeProvider
    {
        public DateTimeOffset Now { get; set; } = now;
        public override DateTimeOffset GetUtcNow() => Now;
    }
    private sealed class UnknownLengthContent(byte[] bytes) : HttpContent
    {
        protected override bool TryComputeLength(out long length) { length = 0; return false; }
        protected override Task SerializeToStreamAsync(Stream stream, TransportContext? context) => stream.WriteAsync(bytes).AsTask();
    }
}
