using System.Net;
using System.Text.Json.Nodes;
using NexusPipeline.Plugin.TestKit;
using Xunit;

namespace NexusPipeline.Plugin.GameActivities.Tests;

public sealed class SourceMergeTests
{
    private static readonly DateTimeOffset Now = DateTimeOffset.Parse("2026-10-10T00:00:00Z");
    private static JsonObject Raw(string title = "故事", string start = "2026-10-08T14:00:00", string end = "2026-10-22T14:00:59", string version = "1.4")
        => ActivityNormalizer.Object(new { version, activities = new[] { new { name = title, startTime = start, endTime = end } } });

    [Fact]
    public void CorrectedOpeningKeepsItsIdentityAndSeparateRerunRemainsSeparate()
    {
        var source = GameSources.Resolve("neverness-to-everness", "global");
        var old = ActivityNormalizer.Normalize(source, Raw(), Now);
        string id = ActivityPolicy.Text(old["activities"]![0]!["eventId"]);
        var corrected = ActivityNormalizer.Normalize(source, Raw(start: "2026-10-09T14:00:00"), Now);
        Assert.NotEqual(id, ActivityPolicy.Text(corrected["activities"]![0]!["eventId"]));
        EventIdentityResolver.Reconcile(corrected, old);
        Assert.Equal(id, ActivityPolicy.Text(corrected["activities"]![0]!["eventId"]));
        Assert.Equal("2026-10-09T06:00:00Z", ActivityPolicy.Text(corrected["activities"]![0]!["times"]!["start"]!["instantUtc"]));
        var persisted = JsonNode.Parse(corrected.ToJsonString())!.AsObject();
        var next = ActivityNormalizer.Normalize(source, Raw(start: "2026-10-10T14:00:00"), Now);
        EventIdentityResolver.Reconcile(next, persisted);
        Assert.Equal(id, ActivityPolicy.Text(next["activities"]![0]!["eventId"]));
        var rerun = ActivityNormalizer.Normalize(source, Raw(start: "2026-10-23T14:00:00", end: "2026-11-01T14:00:00"), Now);
        EventIdentityResolver.Reconcile(rerun, persisted);
        Assert.NotEqual(id, ActivityPolicy.Text(rerun["activities"]![0]!["eventId"]));
        var anotherServer = ActivityNormalizer.Normalize(GameSources.Resolve("neverness-to-everness", "cn"), Raw(start: "2026-10-09T14:00:00"), Now);
        EventIdentityResolver.Reconcile(anotherServer, old);
        Assert.NotEqual(id, ActivityPolicy.Text(anotherServer["activities"]![0]!["eventId"]));
    }

    [Fact]
    public void RenameRequiresSameExactOfficialNoticeAndAnOverlappingBatch()
    {
        var source = GameSources.Resolve("stella-sora", "default");
        var notice = new OfficialNotice("原名称", "活动时间：2026/10/08 14:00 ~ 2026/10/22 13:59", "https://stellasora.yostar.cn/news/123", "zh-CN", PublishedAt: Now);
        var old = ActivityNormalizer.Normalize(source, Raw("原名称"), Now);
        OfficialActivityProvider.Merge(old, new([notice], "partial", "test"), source, Now);
        var next = ActivityNormalizer.Normalize(source, Raw("新名称", "2026-10-08T15:00:00"), Now);
        OfficialActivityProvider.Merge(next, new([notice with { Title = "新名称", Text = notice.Text.Replace("14:00", "15:00", StringComparison.Ordinal) }], "partial", "test"), source, Now);
        EventIdentityResolver.Reconcile(next, old);
        Assert.Equal(ActivityPolicy.Text(old["activities"]![0]!["eventId"]), ActivityPolicy.Text(next["activities"]![0]!["eventId"]));
        var unrelated = ActivityNormalizer.Normalize(source, Raw("第三名称"), Now);
        OfficialActivityProvider.Merge(unrelated, new([notice with { Title = "第三名称", Url = "https://stellasora.yostar.cn/news/456" }], "partial", "test"), source, Now);
        EventIdentityResolver.Reconcile(unrelated, old);
        Assert.NotEqual(ActivityPolicy.Text(old["activities"]![0]!["eventId"]), ActivityPolicy.Text(unrelated["activities"]![0]!["eventId"]));
    }

    [Fact]
    public async Task CachedOfficialDeadlineSurvivesProgressivePublicationAndFreshCorrectionWins()
    {
        var context = new FakePluginHostContext();
        var source = GameSources.Resolve("blue-archive", "cn");
        var raw = Raw("限时复刻活动【故事】", version: "2026-10");
        raw["cover"] = "https://resource.starrailassistant.top/overview.png";
        raw["activities"]![0]!["cover"] = "https://resource.starrailassistant.top/event.png";
        var notice = new OfficialNotice("【预告】限时复刻活动：故事", "活动持续时间：10月08日 14:00 ~ 10月22日 13:59", "https://www.bluearchive-cn.com/news/1974", "zh-CN", PublishedAt: Now);
        await context.Config.WriteAsync(new ActivitySettingsState(0, new() { SelectedGames = ["blue-archive"] }));
        await context.ScopedData.WriteAsync("feed/blue-archive/cn/zh-CN/official/v4", new
        {
            CheckedAt = DateTimeOffset.UtcNow.AddHours(-13), Result = new OfficialResult([notice], "partial", "test")
        });
        using var entered = new ManualResetEventSlim(); using var release = new ManualResetEventSlim();
        context.Http.ResponseFactory = request =>
        {
            if (request.RequestUri!.Host == "starrailassistant.top") return new(HttpStatusCode.OK) { Content = new StringContent(raw.ToJsonString()) };
            if (request.RequestUri.Host == "resource.starrailassistant.top")
            {
                var content = new ByteArrayContent([137, 80, 78, 71, 13, 10, 26, 10]);
                content.Headers.ContentType = new("image/png");
                return new(HttpStatusCode.OK) { Content = content };
            }
            entered.Set();
            if (!release.Wait(TimeSpan.FromSeconds(5))) throw new TimeoutException();
            return new(HttpStatusCode.OK) { Content = new StringContent(ActivityNormalizer.Object(new
            {
                code = 0, data = new { rows = new[] { new { id = 1974, title = notice.Title, content = "<p>活动持续时间：10月08日 14:00 ~ 10月22日 14:59</p>", publishTime = Now.ToUnixTimeMilliseconds() } } }
            }).ToJsonString()) };
        };
        var service = new ActivityCoordinator(context); await service.InitializeAsync(default);
        try
        {
            var operation = await service.QueueAsync(true, default);
            Assert.True(entered.Wait(TimeSpan.FromSeconds(5)));
            var interim = await service.FeedAsync(source, "zh-CN", default);
            Assert.Equal("10月22日 13:59", ActivityPolicy.Text(interim!["activities"]![0]!["times"]!["playEnd"]!["rawValue"]));
            Assert.Equal("2026-10-22T05:59:00Z", ActivityPolicy.Text(interim["activities"]![0]!["times"]!["playEnd"]!["instantUtc"]));
            release.Set(); await Wait(service, ActivityPolicy.Text(operation["operationId"]));
            var final = await service.FeedAsync(source, "zh-CN", default);
            Assert.Equal("10月22日 14:59", ActivityPolicy.Text(final!["activities"]![0]!["times"]!["playEnd"]!["rawValue"]));
            Assert.Single(final["activities"]!.AsArray());
            Assert.NotNull(final["overview"]!["cover"]!["assetId"]);
            Assert.Contains(final["overview"]!["provenance"]!.AsArray(), value => ActivityPolicy.Text(value?["field"]) == "/cover");
            await service.StopAsync(default);
            context.Http.ResponseFactory = _ => throw new HttpRequestException("offline");
            for (int restart = 0; restart < 2; restart++)
            {
                service = new ActivityCoordinator(context);
                await service.InitializeAsync(default);
                var retained = await service.FeedAsync(source, "zh-CN", default);
                Assert.Equal(ActivityPolicy.Text(final["snapshotId"]), ActivityPolicy.Text(retained!["snapshotId"]));
                Assert.Equal(final["overview"]!["cover"]!.ToJsonString(), retained["overview"]!["cover"]!.ToJsonString());
                if (restart == 0) await service.StopAsync(default);
            }
        }
        finally { release.Set(); await service.StopAsync(default); }
    }

    [Fact]
    public async Task OlderSourceVersionCannotReplaceFeedOrRawCheckpoint()
    {
        var context = new FakePluginHostContext();
        var source = GameSources.Resolve("genshin-impact", "default");
        var raw = Raw(version: "7.1");
        await context.Config.WriteAsync(new ActivitySettingsState(0, new() { SelectedGames = ["genshin-impact"] }));
        await context.ScopedData.WriteJsonAsync("feed/genshin-impact/default/zh-CN/merged/v1", ActivityNormalizer.Normalize(source, raw, Now));
        await context.ScopedData.WriteJsonAsync("feed/genshin-impact/default/zh-CN/sra/v1", ActivityNormalizer.Object(new { raw }));
        context.Http.ResponseFactory = _ => new(HttpStatusCode.OK) { Content = new StringContent(Raw(version: "6.8").ToJsonString()) };
        var service = new ActivityCoordinator(context); await service.InitializeAsync(default);
        try
        {
            var operation = await service.QueueAsync(true, default); await Wait(service, ActivityPolicy.Text(operation["operationId"]));
            Assert.Equal("failed", ActivityPolicy.Text((await service.OperationAsync(ActivityPolicy.Text(operation["operationId"]), default))["status"]));
            var retained = await service.FeedAsync(source, "zh-CN", default);
            Assert.Equal("7.1", ActivityPolicy.Text(retained!["version"]!["number"]));
            Assert.Equal("7.1", ActivityPolicy.Text((await context.ScopedData.ReadJsonAsync("feed/genshin-impact/default/zh-CN/sra/v1"))!["raw"]!["version"]));
            Assert.Single(context.Http.Requests);
        }
        finally { await service.StopAsync(default); }
    }

    [Fact]
    public async Task LegacyUnselectedCacheWithoutOverviewRebuildsWithoutDiscardingState()
    {
        var context = new FakePluginHostContext();
        var source = GameSources.Resolve("blue-archive", "cn");
        var raw = Raw(version: "2026-10");
        raw["cover"] = "https://resource.starrailassistant.top/overview.png";
        raw["activities"]![0]!["cover"] = "https://resource.starrailassistant.top/event.png";
        var legacy = ActivityNormalizer.Normalize(source, raw, Now);
        legacy.Remove("overview");
        legacy["activities"]![0]!["cover"] = ActivityNormalizer.Object(new
        {
            sourceUrl = "https://resource.starrailassistant.top/event.png", assetId = "cached-event", alt = "故事", sourceRef = "sra:ba-cn"
        });
        string identity = ActivityPolicy.Text(legacy["activities"]![0]!["eventId"]);
        string stored = legacy.ToJsonString();
        await context.Config.WriteAsync(new ActivitySettingsState(7, new()
        {
            SelectedGames = ["blue-archive"], Progressions = new() { ["blue-archive"] = "jp", ["neverness-to-everness"] = "cn" }
        }));
        await context.ScopedData.WriteJsonAsync("feed/blue-archive/cn/zh-CN/merged/v1", legacy);
        await context.ScopedData.WriteJsonAsync("feed/blue-archive/cn/zh-CN/sra/v1", ActivityNormalizer.Object(new { raw }));
        await context.ScopedData.WriteJsonAsync("asset-manifest", new JsonObject
        {
            [ActivityNormalizer.Hash(ActivityPolicy.Text(raw["cover"]))] = ActivityNormalizer.Object(new { id = "cached-overview" })
        });
        var service = new ActivityCoordinator(context);
        await service.InitializeAsync(default);
        try
        {
            var state = await service.StateAsync(default);
            Assert.Equal(7, state["settingsRevision"]!.GetValue<long>());
            Assert.Equal("jp", ActivityPolicy.Text(state["selectedFeeds"]![0]!["progressionId"]));
            var rebuilt = await service.FeedAsync(source, "zh-CN", default);
            Assert.Equal("cached-overview", ActivityPolicy.Text(rebuilt!["overview"]!["cover"]!["assetId"]));
            Assert.Equal(identity, ActivityPolicy.Text(rebuilt["activities"]![0]!["eventId"]));
            Assert.Equal("cached-event", ActivityPolicy.Text(rebuilt["activities"]![0]!["cover"]!["assetId"]));
            Assert.Equal(stored, (await context.ScopedData.ReadJsonAsync("feed/blue-archive/cn/zh-CN/merged/v1"))!.ToJsonString());
            Assert.Empty(context.Http.Requests);
        }
        finally { await service.StopAsync(default); }
    }

    private static async Task Wait(ActivityCoordinator service, string id)
    {
        using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(8));
        while (ActivityPolicy.Text((await service.OperationAsync(id, timeout.Token))["status"]) is "queued" or "running") await Task.Delay(10, timeout.Token);
    }
}
