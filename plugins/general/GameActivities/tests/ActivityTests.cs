using System.Text.Json;
using System.Text.Json.Nodes;
using NexusPipeline.Plugin.TestKit;
using Xunit;

namespace NexusPipeline.Plugin.GameActivities.Tests;

public sealed class ActivityTests
{
    private static readonly DateTimeOffset Now = DateTimeOffset.Parse("2026-10-09T00:00:00Z");
    private static JsonObject Raw() => JsonNode.Parse("""{"version":"2026-10","versionName":"Monthly","activities":[{"name":"Story","kind":"剧情活动","startTime":"2026-10-01T12:00:00","endTime":"2026-10-20T10:59:59"}]}""")!.AsObject();
    [Fact]
    public async Task OfficialNoticePreservesParagraphsFieldsAndListItemsWithoutExecutableMarkup()
    {
        var parser = new AngleSharp.Html.Parser.HtmlParser();
        using var document = await parser.ParseDocumentAsync("""
            <article><h2>活动换能</h2><p>活动时间：<strong>9月28日</strong>—10月12日<br>活动说明：奖励提升。</p>
            <ul><li>第一项 <span>奖励</span></li><li>第二项 &lt;原文&gt;</li></ul>
            <script>secretScript()</script><style>.hidden{}</style><footer>导航</footer></article>
            """, default);
        string text = OfficialNoticeText.Read(document.QuerySelector("article")!);
        Assert.Equal("活动换能\n活动时间：9月28日—10月12日\n活动说明：奖励提升。\n• 第一项 奖励\n• 第二项 <原文>", text);
    }
    [Fact]
    public void RegistryHasElevenIsolatedProgressionsAndRejectsInvalidSelection()
    {
        Assert.Equal(11, GameSources.All.Length); Assert.Equal(8, GameSources.All.Select(s => s.GameId).Distinct().Count());
        Assert.Throws<ActivityException>(() => GameSources.Resolve("genshin-impact", "global"));
        Assert.Throws<ActivityException>(() => GameSources.Validate(new() { SelectedGames = ["blue-archive", "blue-archive"] }));
        Assert.Equal("nte-en-US", GameSources.Resolve("neverness-to-everness", "global").File);
    }
    [Fact]
    public void NormalizationUsesProducerDefaultAndDoesNotInventFormalVersion()
    {
        var ba = ActivityNormalizer.Normalize(GameSources.Resolve("blue-archive", "cn"), Raw(), Now);
        Assert.Null(ba["version"]); Assert.Null(ba["contentPeriod"]); Assert.Equal("not-checked", ActivityPolicy.Text(ba["coverage"]!["gacha"]!["status"]));
        Assert.Equal("2026-10-20T02:59:59Z", ActivityPolicy.Text(ba["activities"]![0]!["times"]!["playEnd"]!["instantUtc"]));
        var global = ActivityNormalizer.Normalize(GameSources.Resolve("neverness-to-everness", "global"), Raw(), Now);
        Assert.Equal("2026-10-20T02:59:59Z", ActivityPolicy.Text(global["activities"]![0]!["times"]!["playEnd"]!["instantUtc"]));
        Assert.Null(global["primary"]!["eventId"]);
    }
    [Fact]
    public void SnapshotDigestIgnoresCheckClockAndSourceArrayOrder()
    {
        var feed = ActivityNormalizer.Normalize(GameSources.Resolve("blue-archive", "cn"), Raw(), Now); string digest = ActivityPolicy.Text(feed["snapshotId"]);
        feed["builtAt"] = "2026-10-10T00:00:00Z"; feed["sources"]![0]!["retrievedAt"] = "2026-10-10T00:00:00Z";
        ActivityNormalizer.Finalize(feed, Now.AddDays(1)); Assert.Equal(digest, ActivityPolicy.Text(feed["snapshotId"]));
    }
    [Fact]
    public void ProductionRejectsSyntheticAndInvalidTimeRanges()
    {
        var raw = Raw(); raw["dataClass"] = "synthetic";
        Assert.Throws<ActivityException>(() => ActivityNormalizer.Normalize(GameSources.All[0], raw, Now));
        raw = Raw(); raw["activities"]![0]!["endTime"] = "2026-09-01T00:00:00";
        Assert.Throws<ActivityException>(() => ActivityNormalizer.Normalize(GameSources.All[0], raw, Now));
    }
    [Fact]
    public void CountdownUsesExactMillisecondThresholdsAndNeverNegative()
    {
        var values = new (long Delta, string Unit, long First, long Second)[] { (259200000, "days", 3, 0), (259199999, "hours", 71, 59), (3600000, "hours", 1, 0), (3599999, "minutes", 59, 59), (60000, "minutes", 1, 0), (59999, "seconds", 59, 0), (1, "seconds", 1, 0), (0, "ended", 0, 0), (-1, "ended", 0, 0) };
        foreach (var value in values) { var result = JsonSerializer.SerializeToNode(ActivityPolicy.Countdown(value.Delta))!; Assert.Equal(value.Unit, ActivityPolicy.Text(result["unit"])); Assert.Equal(value.First, result["first"]!.GetValue<long>()); Assert.Equal(value.Second, result["second"]!.GetValue<long>()); }
    }
    [Fact]
    public void PrimaryRetainsCurrentStoryAndDetailsPutGachaFirst()
    {
        var feed = ActivityNormalizer.Normalize(GameSources.All[0], Raw(), Now); feed["contentPeriod"] = ActivityNormalizer.Object(new { key = "current", kind = "campaign", title = "Story", provenance = Array.Empty<object>() });
        var story = feed["activities"]![0]!.AsObject(); story["versionRelation"] = "current"; story["periodKey"] = "current";
        var urgent = story.DeepClone().AsObject(); urgent["eventId"] = "urgent"; urgent["importance"] = "routine"; urgent["category"] = "combat";
        var banner = story.DeepClone().AsObject(); banner["eventId"] = "banner"; banner["category"] = "gacha-character";
        feed["activities"]!.AsArray().Insert(0, urgent); feed["activities"]!.AsArray().Add(banner);
        Assert.Equal(ActivityPolicy.Text(story["eventId"]), ActivityPolicy.Primary(feed, Now).Id);
        Assert.Equal("banner", ActivityPolicy.Text(ActivityPolicy.Order(feed["activities"]!.AsArray().Select(n => n!), Now)[0]["eventId"]));
    }
    [Fact]
    public async Task SettingsUseCasPersistAcrossReloadAndDoNotFetchOnRead()
    {
        var context = new FakePluginHostContext(); var service = new ActivityCoordinator(context); await service.InitializeAsync(default);
        await service.SettingsAsync(0, new() { SelectedGames = ["blue-archive"], Progressions = new() { ["blue-archive"] = "jp", ["neverness-to-everness"] = "global" } }, default);
        await Assert.ThrowsAsync<ActivityException>(() => service.SettingsAsync(0, new(), default));
        var reloaded = new ActivityCoordinator(context); await reloaded.InitializeAsync(default); var state = await reloaded.StateAsync(default);
        Assert.Equal(1, state["settingsRevision"]!.GetValue<long>()); Assert.Equal("jp", ActivityPolicy.Text(state["settings"]!["progressions"]!["blue-archive"]));
        Assert.Null(await reloaded.FeedAsync(GameSources.Resolve("blue-archive", "jp"), "zh-CN", default));
        await service.StopAsync(default); await reloaded.StopAsync(default);
    }
    [Fact]
    public async Task LifecycleRegistersOneCardAndStopRemovesAllHandles()
    {
        var context = new FakePluginHostContext(); var plugin = new EntryPoint(); await plugin.InitializeAsync(context, default); await plugin.StartAsync(default); await plugin.StartAsync(default);
        Assert.Single(context.DashboardCards.Cards); Assert.Equal(6, context.WebApi.Routes.Count);
        await plugin.StopAsync(default); await plugin.StopAsync(default); Assert.Empty(context.DashboardCards.Cards); Assert.Empty(context.WebApi.Routes);
    }
    private static async Task WaitOperation(ActivityCoordinator service, string id)
    {
        using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(8));
        while (ActivityPolicy.Text((await service.OperationAsync(id, timeout.Token))["status"]) is "queued" or "running") await Task.Delay(10, timeout.Token);
    }
    [Fact]
    public async Task FailedSourceDoesNotBlockOtherGameAndOfflineRestartKeepsLastGood()
    {
        var context = new FakePluginHostContext();
        context.Http.ResponseFactory = request => request.RequestUri!.Host == "starrailassistant.top" && request.RequestUri.AbsolutePath.EndsWith("ys.json")
            ? new(System.Net.HttpStatusCode.OK) { Content = new StringContent(Raw().ToJsonString()) } : new(System.Net.HttpStatusCode.ServiceUnavailable);
        var service = new ActivityCoordinator(context); await service.InitializeAsync(default);
        await service.SettingsAsync(0, new() { SelectedGames = ["blue-archive", "genshin-impact"] }, default);
        var operation = await service.QueueAsync(true, default); await WaitOperation(service, ActivityPolicy.Text(operation["operationId"]));
        Assert.Equal("partial", ActivityPolicy.Text((await service.OperationAsync(ActivityPolicy.Text(operation["operationId"]), default))["status"]));
        Assert.Null(await service.FeedAsync(GameSources.All[0], "zh-CN", default));
        var good = await service.FeedAsync(GameSources.Resolve("genshin-impact", "default"), "zh-CN", default); Assert.NotNull(good); await service.StopAsync(default);
        context.Http.ResponseFactory = _ => new(System.Net.HttpStatusCode.ServiceUnavailable);
        var reloaded = new ActivityCoordinator(context); await reloaded.InitializeAsync(default);
        var refresh = await reloaded.QueueAsync(true, default); await WaitOperation(reloaded, ActivityPolicy.Text(refresh["operationId"]));
        var retained = await reloaded.FeedAsync(GameSources.Resolve("genshin-impact", "default"), "zh-CN", default);
        Assert.Equal(ActivityPolicy.Text(good["snapshotId"]), ActivityPolicy.Text(retained!["snapshotId"])); Assert.Equal("stale", ActivityPolicy.Text(retained["health"]!["cacheState"]));
        await reloaded.StopAsync(default);
    }
    [Fact]
    public async Task SelectionChangeCancelsLateResponseBeforePublishingFeed()
    {
        var context = new FakePluginHostContext(); using var entered = new ManualResetEventSlim(); using var release = new ManualResetEventSlim();
        context.Http.ResponseFactory = _ => { entered.Set(); if (!release.Wait(TimeSpan.FromSeconds(5))) throw new TimeoutException(); return new(System.Net.HttpStatusCode.OK) { Content = new StringContent(Raw().ToJsonString()) }; };
        var service = new ActivityCoordinator(context); await service.InitializeAsync(default); await service.SettingsAsync(0, new() { SelectedGames = ["blue-archive"] }, default);
        var operation = await service.QueueAsync(true, default); Assert.True(entered.Wait(TimeSpan.FromSeconds(5)));
        await service.SettingsAsync(1, new(), default); release.Set(); await WaitOperation(service, ActivityPolicy.Text(operation["operationId"]));
        Assert.Null(await service.FeedAsync(GameSources.All[0], "zh-CN", default)); await service.StopAsync(default);
        var reloaded = new ActivityCoordinator(context); await reloaded.InitializeAsync(default); Assert.Null(await reloaded.FeedAsync(GameSources.All[0], "zh-CN", default)); await reloaded.StopAsync(default);
    }
    [Fact]
    public async Task AssetValidationRejectsExecutableContentAndUnapprovedDestinations()
    {
        Assert.Null(ActivityAssetCache.Extension(System.Text.Encoding.UTF8.GetBytes("<svg></svg>"), "image/svg+xml"));
        Assert.Null(ActivityAssetCache.Extension(new byte[] { 137, 80, 78, 71, 13, 10, 26, 10 }, "text/html"));
        var context = new FakePluginHostContext(); var raw = Raw(); raw["activities"]![0]!["cover"] = "https://example.invalid/private";
        var feed = ActivityNormalizer.Normalize(GameSources.All[0], raw, Now);
        await new ActivityAssetCache(new ActivityHttp(context.Http), context.Assets, context.ScopedData).CacheAsync(feed, raw, default);
        Assert.Empty(context.Http.Requests); Assert.Equal(0, context.Assets.WriteCount);
    }

    [Fact]
    public void SraNarrativePrioritizesCurrentMainQuestThenEventStory()
    {
        var raw = JsonNode.Parse("""{"version":"7.1","versionName":"Current chapter","startTime":"2026-09-23T06:00:00","endTime":"2026-11-04T06:00:00","activities":[{"name":"Urgent challenge","description":"普通挑战","startTime":"2026-10-01T00:00:00","endTime":"2026-10-10T00:00:00"},{"name":"Festival","description":"重要活动剧情","startTime":"2026-09-24T10:00:00","endTime":"2026-10-12T03:59:59"},{"name":"Current chapter","description":"完成魔神任务第七章","startTime":"2026-09-23T11:00:00","endTime":"2026-11-03T14:59:59"}]}""")!.AsObject();
        var feed = ActivityNormalizer.Normalize(GameSources.Resolve("genshin-impact", "default"), raw, Now);
        var main = feed["activities"]!.AsArray().Single(item => ActivityPolicy.Text(item?["title"]) == "Current chapter")!;
        var festival = feed["activities"]!.AsArray().Single(item => ActivityPolicy.Text(item?["title"]) == "Festival")!;
        Assert.Equal("major-story", ActivityPolicy.Text(main["importance"])); Assert.Equal("current", ActivityPolicy.Text(main["versionRelation"]));
        Assert.Equal("7.1", ActivityPolicy.Text(feed["version"]!["number"]));
        Assert.Equal(ActivityPolicy.Text(main["eventId"]), ActivityPolicy.Primary(feed, Now).Id);
        Assert.Equal("2026-11-03T06:59:59Z", ActivityPolicy.Text(main["times"]!["playEnd"]!["instantUtc"]));
        feed["activities"]!.AsArray().Remove(main);
        Assert.Equal(ActivityPolicy.Text(festival["eventId"]), ActivityPolicy.Primary(feed, Now).Id);
        var reordered = feed["activities"]!.AsArray().Reverse().Select(item => item!.DeepClone()).ToArray(); feed["activities"] = new JsonArray(reordered);
        Assert.Equal(ActivityPolicy.Text(festival["eventId"]), ActivityPolicy.Primary(feed, Now).Id);
    }
    [Fact]
    public async Task OverviewCoverUsesTopLevelArtWithoutAssigningItToAnActivity()
    {
        var raw = JsonNode.Parse("""{"version":"2026-10","versionName":"Current tower","cover":"https://webusstatic.yo-star.com/current.png","activities":[{"name":"Current tower 主线更新纪念活动","description":"主线剧情","startTime":"2026-10-01T00:00:00","endTime":"2026-10-13T03:59:59","cover":""}]}""")!.AsObject();
        var source = GameSources.Resolve("stella-sora", "default"); var feed = ActivityNormalizer.Normalize(source, raw, Now);
        Assert.Null(feed["version"]); Assert.Equal("campaign", ActivityPolicy.Text(feed["contentPeriod"]!["kind"]));
        var context = new FakePluginHostContext(); context.Http.ResponseFactory = _ =>
        {
            var response = new HttpResponseMessage(System.Net.HttpStatusCode.OK) { Content = new ByteArrayContent(new byte[] { 137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0 }) };
            response.Content.Headers.ContentType = new("image/png"); return response;
        };
        await new ActivityAssetCache(new ActivityHttp(context.Http), context.Assets, context.ScopedData).CacheAsync(feed, raw, default);
        Assert.Equal(1, context.Assets.WriteCount);
        Assert.False(string.IsNullOrEmpty(ActivityPolicy.Text(feed["overview"]!["cover"]!["assetId"])));
        Assert.Null(feed["activities"]![0]!["cover"]);
        raw["versionName"] = "Future tower"; raw["cover"] = "https://webusstatic.yo-star.com/future.png";
        var future = ActivityNormalizer.Normalize(source, raw, Now);
        Assert.Null(future["contentPeriod"]); int before = context.Http.Requests.Count;
        await new ActivityAssetCache(new ActivityHttp(context.Http), context.Assets, context.ScopedData).CacheAsync(future, raw, default);
        Assert.Null(future["activities"]![0]!["cover"]);
        Assert.Equal("Future tower", ActivityPolicy.Text(future["overview"]!["title"]));
        Assert.Equal("https://webusstatic.yo-star.com/future.png", ActivityPolicy.Text(future["overview"]!["cover"]!["sourceUrl"]));
        Assert.Equal(before + 1, context.Http.Requests.Count);
    }

    [Fact]
    public void SraOverviewKeepsTopLevelPeriodAndAllActivityEntries()
    {
        var raw = Raw();
        raw["cover"] = "https://resource.starrailassistant.top/overview.webp";
        raw["startTime"] = "2026-10-01T04:00:00";
        raw["endTime"] = "2026-10-29T14:00:59";
        raw["activities"]!.AsArray().Add(JsonNode.Parse("""{"name":"网页活动","kind":"网页活动","startTime":"2026-10-08T00:00:00","endTime":"2026-10-12T00:00:00"}"""));
        var feed = ActivityNormalizer.Normalize(GameSources.All[0], raw, Now);
        ActivityAssetCache.RestoreOverview(feed, raw, new());
        Assert.Equal("Monthly", ActivityPolicy.Text(feed["overview"]!["title"]));
        Assert.Null(feed["overview"]!["number"]);
        Assert.Equal("2026-10-29T06:00:59Z", ActivityPolicy.Text(feed["overview"]!["end"]!["instantUtc"]));
        Assert.Equal("https://resource.starrailassistant.top/overview.webp", ActivityPolicy.Text(feed["overview"]!["cover"]!["sourceUrl"]));
        Assert.Equal(2, feed["activities"]!.AsArray().Count);
        Assert.Equal("web", ActivityPolicy.Text(feed["activities"]![1]!["channel"]));
    }

    [Fact]
    public async Task CarouselIntervalValidatesBoundsAndPersistsManualMode()
    {
        foreach (int seconds in new[] { -1, 10, 120 }) Assert.Equal(seconds, GameSources.Validate(new() { CarouselIntervalSeconds = seconds }).CarouselIntervalSeconds);
        foreach (int seconds in new[] { -2, 0, 6, 9, 121 }) Assert.Throws<ActivityException>(() => GameSources.Validate(new() { CarouselIntervalSeconds = seconds }));
        var context = new FakePluginHostContext();
        var service = new ActivityCoordinator(context);
        await service.InitializeAsync(default);
        await service.SettingsAsync(0, new() { CarouselIntervalSeconds = -1 }, default);
        await Assert.ThrowsAsync<ActivityException>(() => service.SettingsAsync(1, new() { CarouselIntervalSeconds = 9 }, default));
        await service.StopAsync(default);
        var reloaded = new ActivityCoordinator(context);
        await reloaded.InitializeAsync(default);
        var state = await reloaded.StateAsync(default);
        Assert.Equal(-1, state["settings"]!["carouselIntervalSeconds"]!.GetValue<int>());
        Assert.Equal(1, state["settingsRevision"]!.GetValue<long>());
        await reloaded.StopAsync(default);
    }

    [Fact]
    public async Task EnablePublishesReadyGameAndCoverWhileAnotherGameIsStillLoading()
    {
        var context = new FakePluginHostContext();
        using var entered = new ManualResetEventSlim();
        using var release = new ManualResetEventSlim();
        var raw = Raw();
        raw["version"] = "7.1";
        raw["cover"] = "https://i0.hdslb.com/ready.png";
        context.Http.ResponseFactory = request =>
        {
            if (request.RequestUri!.Host == "starrailassistant.top")
            {
                if (request.RequestUri.AbsolutePath.EndsWith("ba-cn.json"))
                {
                    entered.Set();
                    if (!release.Wait(TimeSpan.FromSeconds(10))) throw new TimeoutException();
                }
                return new(System.Net.HttpStatusCode.OK) { Content = new StringContent(raw.ToJsonString()) };
            }
            if (request.RequestUri.Host == "i0.hdslb.com")
            {
                var image = new HttpResponseMessage(System.Net.HttpStatusCode.OK) { Content = new ByteArrayContent([137, 80, 78, 71, 13, 10, 26, 10, 0]) };
                image.Content.Headers.ContentType = new("image/png");
                return image;
            }
            return new(System.Net.HttpStatusCode.ServiceUnavailable);
        };
        await context.Config.WriteAsync(new ActivitySettingsState(0, new() { SelectedGames = ["blue-archive", "genshin-impact"] }));
        var plugin = new EntryPoint();
        await plugin.InitializeAsync(context, default);
        try
        {
            await plugin.StartAsync(default);
            Assert.True(entered.Wait(TimeSpan.FromSeconds(5)));
            using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(5));
            JsonObject? ready;
            do
            {
                ready = await context.ScopedData.ReadJsonAsync("feed/genshin-impact/default/zh-CN/merged/v1", timeout.Token);
                if (ready?["overview"]?["cover"]?["assetId"] is not null) break;
                await Task.Delay(10, timeout.Token);
            } while (true);
            Assert.Equal("7.1", ActivityPolicy.Text(ready["overview"]!["number"]));
            Assert.False(release.IsSet);
            Assert.Null(await context.ScopedData.ReadJsonAsync("feed/blue-archive/cn/zh-CN/merged/v1"));
            Assert.Equal(1, context.Assets.WriteCount);
        }
        finally
        {
            release.Set();
            await plugin.StopAsync(default);
        }
    }

}
