using System.Net;
using System.Text.Json.Nodes;
using NexusPipeline.Plugin.TestKit;
using Xunit;

namespace NexusPipeline.Plugin.GameActivities.Tests;

public sealed class WithdrawalTests
{
    private static readonly DateTimeOffset Now = DateTimeOffset.Parse("2026-10-10T00:00:00Z");
    private const string Target = "https://www.bluearchive-cn.com/news/1974";
    private static JsonObject Raw(string start = "2026-10-08T14:00:00") => ActivityNormalizer.Object(new
    {
        version = "1.4", activities = new[]
        {
            new { name = "限时复刻活动【故事】", startTime = start, endTime = "2026-10-22T14:00:59" },
            new { name = "另一个活动", startTime = "2026-10-08T14:00:00", endTime = "2026-10-25T14:00:00" }
        }
    });
    private static OfficialNotice Notice() => new("【预告】限时复刻活动：故事",
        "活动持续时间：10月08日 14:00 ~ 10月22日 13:59", Target, "zh-CN", PublishedAt: Now);

    [Fact]
    public async Task ExplicitCancellationSurvivesRestartAndStaleAggregateCorrections()
    {
        var context = new FakePluginHostContext();
        var source = GameSources.Resolve("blue-archive", "cn");
        var raw = Raw();
        var feed = ActivityNormalizer.Normalize(source, raw, Now);
        OfficialActivityProvider.Merge(feed, new([Notice()], "partial", "test"), source, Now);
        Assert.Equal("exact-activity", ActivityPolicy.Text(feed["activities"]![0]!["officialLinkKind"]));
        await context.Config.WriteAsync(new ActivitySettingsState(0, new() { SelectedGames = ["blue-archive"] }));
        await context.ScopedData.WriteJsonAsync("feed/blue-archive/cn/zh-CN/merged/v1", feed);
        await context.ScopedData.WriteJsonAsync("feed/blue-archive/cn/zh-CN/sra/v1", ActivityNormalizer.Object(new { raw }));
        await context.ScopedData.WriteAsync("feed/blue-archive/cn/zh-CN/official/v4", new
        {
            CheckedAt = DateTimeOffset.UtcNow.AddHours(-13), Result = new OfficialResult([Notice()], "partial", "test")
        });
        context.Http.ResponseFactory = request => new(HttpStatusCode.OK)
        {
            Content = new StringContent(request.RequestUri!.Host == "starrailassistant.top" ? Raw("2026-10-09T14:00:00").ToJsonString()
                : ActivityNormalizer.Object(new { code = 0, data = new { rows = new[] { new
                {
                    id = 2000, title = "活动取消公告", content = "<p>取消活动，原公告：<a href='" + Target + "'>故事</a></p>",
                    publishTime = Now.ToUnixTimeMilliseconds()
                } } } }).ToJsonString())
        };
        var service = new ActivityCoordinator(context);
        await service.InitializeAsync(default);
        try
        {
            var operation = await service.QueueAsync(true, default); await Wait(service, ActivityPolicy.Text(operation["operationId"]));
            var result = await service.FeedAsync(source, source.Locale, default);
            Assert.Equal("另一个活动", ActivityPolicy.Text(Assert.Single(result!["activities"]!.AsArray())!["title"]));
            var ledger = await context.ScopedData.ReadJsonAsync("feed/blue-archive/cn/zh-CN/withdrawals/v1");
            Assert.Single(ledger!["entries"]!.AsArray());
            Assert.Equal(Target, ActivityPolicy.Text(ledger["entries"]![0]!["targetUrl"]));
            await service.StopAsync(default);
            await context.ScopedData.DeleteAsync("feed/blue-archive/cn/zh-CN/official/v4");
            context.Http.ResponseFactory = request => request.RequestUri!.Host == "starrailassistant.top"
                ? new(HttpStatusCode.OK) { Content = new StringContent(Raw("2026-10-10T14:00:00").ToJsonString()) }
                : new(HttpStatusCode.NotFound);
            service = new ActivityCoordinator(context); await service.InitializeAsync(default);
            Assert.Single((await service.FeedAsync(source, source.Locale, default))!["activities"]!.AsArray());
            operation = await service.QueueAsync(true, default); await Wait(service, ActivityPolicy.Text(operation["operationId"]));
            result = await service.FeedAsync(source, source.Locale, default);
            Assert.Equal("另一个活动", ActivityPolicy.Text(Assert.Single(result!["activities"]!.AsArray())!["title"]));
            Assert.Contains(result["health"]!["diagnostics"]!.AsArray(), value => ActivityPolicy.Text(value?["code"]) == "official_withdrawal");
            Assert.Equal(2, (await context.ScopedData.ReadJsonAsync("feed/blue-archive/cn/zh-CN/sra/v1"))!["raw"]!["activities"]!.AsArray().Count);
        }
        finally { await service.StopAsync(default); }
    }

    [Fact]
    public void CancellationRequiresAnExactNoticeAndKeepsIndependentReruns()
    {
        var source = GameSources.Resolve("blue-archive", "cn");
        var feed = ActivityNormalizer.Normalize(source, Raw(), Now);
        OfficialActivityProvider.Merge(feed, new([Notice()], "partial", "test"), source, Now);
        var unsupported = new OfficialNotice("活动取消公告", "取消", "https://www.bluearchive-cn.com/news/2000", "zh-CN",
            LinkedNoticeUrls: ["https://www.bluearchive-cn.com/", "https://elsewhere.invalid/news/1974"]);
        var ledger = ActivityWithdrawals.Record(ActivityWithdrawals.Empty(source), feed, new([unsupported], "partial", "test"), source, Now);
        Assert.Empty(ledger["entries"]!.AsArray());
        var unlinked = unsupported with { Title = "活动取消？原公告仍有效", LinkedNoticeUrls = [Target] };
        ledger = ActivityWithdrawals.Record(ledger, feed, new([unlinked], "partial", "test"), source, Now);
        Assert.Empty(ledger["entries"]!.AsArray());
        ledger = ActivityWithdrawals.Record(ledger, feed, new([Notice() with { IsWithdrawn = true }], "partial", "test"), source, Now);
        var correctedRaw = Raw("2026-10-09T14:00:00");
        var rerun = correctedRaw["activities"]![0]!.DeepClone();
        rerun["startTime"] = "2026-10-23T14:00:00"; rerun["endTime"] = "2026-11-01T14:00:00";
        correctedRaw["activities"]!.AsArray().Add(rerun);
        var corrected = ActivityNormalizer.Normalize(source, correctedRaw, Now);
        ActivityWithdrawals.Apply(corrected, ledger); ActivityNormalizer.Finalize(corrected, Now);
        Assert.Equal(2, corrected["activities"]!.AsArray().Count);
        Assert.Contains(corrected["activities"]!.AsArray(), value => ActivityPolicy.Text(value?["times"]?["start"]?["rawValue"]) == "2026-10-23T14:00:00");
        var anotherServer = ActivityNormalizer.Normalize(GameSources.Resolve("blue-archive", "jp"), correctedRaw, Now);
        Assert.Throws<ActivityException>(() => ActivityWithdrawals.Apply(anotherServer, ledger));
        var distinctNotice = feed.DeepClone().AsObject();
        distinctNotice["activities"]![0]!["eventId"] = "separate-event";
        distinctNotice["activities"]![0]!["officialUrl"] = "https://www.bluearchive-cn.com/news/1975";
        ActivityWithdrawals.Apply(distinctNotice, ledger);
        Assert.Contains(distinctNotice["activities"]!.AsArray(), value => ActivityPolicy.Text(value?["eventId"]) == "separate-event");
        var versionFields = feed.DeepClone().AsObject();
        versionFields["activities"]![0]!["eventId"] = "retained-aggregate";
        versionFields["activities"]![0]!["officialLinkKind"] = "version-notice";
        var fieldsOnly = ActivityWithdrawals.Record(ActivityWithdrawals.Empty(source), versionFields, new([Notice() with { IsWithdrawn = true }], "partial", "test"), source, Now);
        ActivityWithdrawals.Apply(versionFields, fieldsOnly); ActivityNormalizer.Finalize(versionFields, Now);
        Assert.Equal(2, versionFields["activities"]!.AsArray().Count);
        Assert.Null(versionFields["activities"]![0]!["officialUrl"]);
        Assert.Null(versionFields["activities"]![0]!["times"]!["playEnd"]!["instantUtc"]);
    }

    [Fact]
    public async Task NexonRechecksOmittedKnownThreadsAndRequiresAnExplicitBoundDeletion()
    {
        var context = new FakePluginHostContext();
        const string url = "https://forum.nexon.com/bluearchive-en/board_view?board=3217&thread=123";
        var previous = new OfficialResult([new("Event", "old", url, "en-US")], "partial", "test");
        int mode = 0;
        context.Http.ResponseFactory = request =>
        {
            string path = request.RequestUri!.AbsolutePath;
            if (path.Contains("/community/", StringComparison.Ordinal)) return Json("""{"communityId":314,"alias":"bluearchive-en"}""");
            if (path.Contains("/board/", StringComparison.Ordinal)) return Json("""{"threads":[]}""");
            Assert.Equal("/api/v1/thread/123", path);
            if (mode == 0) return new(HttpStatusCode.NotFound);
            return Json(mode == 1 ? """{"communityId":314,"boardId":3217,"threadId":123,"isDelete":true,"title":"Event","content":""}"""
                : """{"communityId":314,"boardId":3217,"threadId":456,"isDelete":true}""");
        };
        var reader = new OfficialSourceReader(new ActivityHttp(context.Http));
        await Assert.ThrowsAsync<HttpRequestException>(() => reader.ReadAsync(GameSources.Resolve("blue-archive", "global"), default, previous));
        mode = 1;
        var result = await reader.ReadAsync(GameSources.Resolve("blue-archive", "global"), default, previous);
        Assert.True(Assert.Single(result.Notices).IsWithdrawn); Assert.Equal(url, result.Notices[0].Url);
        mode = 2;
        Assert.Equal("official_progression_mismatch", (await Assert.ThrowsAsync<ActivityException>(() => reader.ReadAsync(GameSources.Resolve("blue-archive", "global"), default, previous))).Code);
    }

    private static HttpResponseMessage Json(string value) => new(HttpStatusCode.OK) { Content = new StringContent(value) };
    private static async Task Wait(ActivityCoordinator service, string id)
    {
        using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(8));
        while (ActivityPolicy.Text((await service.OperationAsync(id, timeout.Token))["status"]) is "queued" or "running") await Task.Delay(10, timeout.Token);
    }
}
