using AngleSharp.Html.Parser;
using System.Net;
using System.Text.Json.Nodes;
using NexusPipeline.Plugin.TestKit;
using Xunit;

namespace NexusPipeline.Plugin.GameActivities.Tests;

public sealed class OfficialScheduleTests
{
    private static readonly DateTimeOffset Now = DateTimeOffset.Parse("2026-10-10T00:00:00Z");
    private static JsonObject Feed(GameSource source, string name, string start, string end) => ActivityNormalizer.Normalize(source,
        ActivityNormalizer.Object(new { activities = new[] { new { name, startTime = start, endTime = end } } }), Now);

    [Fact]
    public void ChinaEventKeepsDistinctDeadlinesWithReportedDefaultClock()
    {
        var source = GameSources.Resolve("blue-archive", "cn");
        var feed = Feed(source, "限时复刻活动【-ive aLIVE!】", "2026-10-08T14:00:00", "2026-10-22T14:00:59");
        var notice = new OfficialNotice("【预告】限时活动：-ive aLIVE!", """
            • 活动持续时间：10月08日 14:00 ~ 10月22日 13:59
            • 商店兑换时间：10月08日 14:00 ~ 10月29日 13:59
            """, "https://www.bluearchive-cn.com/news/1974", "zh-CN", PublishedAt: Now);
        OfficialActivityProvider.Merge(feed, new([notice], "partial", "test"), source, Now);
        var activity = Assert.Single(feed["activities"]!.AsArray())!;
        Assert.Equal("10月22日 13:59", ActivityPolicy.Text(activity["times"]!["playEnd"]!["rawValue"]));
        Assert.Equal("10月29日 13:59", ActivityPolicy.Text(activity["times"]!["claimEnd"]!["rawValue"]));
        Assert.Equal("2026-10-22T05:59:00Z", ActivityPolicy.Text(activity["times"]!["playEnd"]!["instantUtc"]));
        Assert.Equal("2026-10-29T05:59:00Z", ActivityPolicy.Text(activity["times"]!["claimEnd"]!["instantUtc"]));
        Assert.Equal("reported", ActivityPolicy.Text(activity["times"]!["playEnd"]!["certainty"]));
        Assert.Equal("source-default", ActivityPolicy.Text(activity["times"]!["playEnd"]!["timeBasis"]));
        Assert.Contains(activity["provenance"]!.AsArray(), item => ActivityPolicy.Text(item?["note"]).Contains("2026-10-22T14:00:59", StringComparison.Ordinal));
        Assert.Contains(feed["health"]!["diagnostics"]!.AsArray(), item => ActivityPolicy.Text(item?["code"]) == "official_time_conflict");
        var otherBatch = Feed(source, "限时复刻活动【-ive aLIVE!】", "2026-09-08T14:00:00", "2026-09-22T14:00:59");
        OfficialActivityProvider.Merge(otherBatch, new([notice], "partial", "test"), source, Now);
        Assert.Equal("missing", ActivityPolicy.Text(otherBatch["activities"]![0]!["officialLinkKind"]));
    }

    [Fact]
    public void GlobalPatchUsesDeclaredUtcAndRetainsAggregateConflictEvidence()
    {
        var source = GameSources.Resolve("blue-archive", "global");
        var feed = Feed(source, "百中绽放的一朵\\ufeff ~光明正大的水上对决~ -复刻-", "2026-09-29T10:00:00", "2026-10-13T10:00:59");
        var notice = new OfficialNotice("9/29 (Tue) Patch Notes", """
            All listed times are based on Coordinated Universal Time (UTC) unless otherwise stated.
            3. Returning Event Story – A Flower Blooms Among the Hundred: Fair and Square Aquatic Showdown
            🔹 Event Period
            - Event Period: 9/29 (Tue) After Maintenance – 10/13 (Tue) 1:59 AM (UTC)
            - Shop, Treasure Hunt, and Event Reward Claim and Exchange Period: 9/29 (Tue) After Maintenance – 10/20 (Tue) 1:59 AM (UTC)
            4. Other content
            """, "https://forum.nexon.com/bluearchive-en/board_view?board=3217&thread=3549872", "en-US", PublishedAt: Now);
        OfficialActivityProvider.Merge(feed, new([notice], "partial", "test"), source, Now);
        var activity = Assert.Single(feed["activities"]!.AsArray())!;
        Assert.Equal("2026-10-13T01:59:00Z", ActivityPolicy.Text(activity["times"]!["playEnd"]!["instantUtc"]));
        Assert.Equal("2026-10-20T01:59:00Z", ActivityPolicy.Text(activity["times"]!["claimEnd"]!["instantUtc"]));
        Assert.Equal("confirmed", ActivityPolicy.Text(activity["times"]!["playEnd"]!["certainty"]));
        Assert.Equal("minute", ActivityPolicy.Text(activity["times"]!["playEnd"]!["precision"]));
        Assert.Null(activity["times"]!["start"]!["instantUtc"]);
        Assert.Contains(feed["health"]!["diagnostics"]!.AsArray(), item => ActivityPolicy.Text(item?["code"]) == "official_time_conflict");
    }

    [Fact]
    public void JapaneseRerunUsesProgressionDefaultAndKeepsMaintenanceStartUnknown()
    {
        var source = GameSources.Resolve("blue-archive", "jp");
        var feed = Feed(source, "【复刻】「我们是神秘学研究会！ ～学院的不思议与古老的咒文～」", "2026-10-07T10:00:00", "2026-10-21T10:00:59");
        var notice = new OfficialNotice("【復刻イベント】「我らオカルト研究会！ ～学院の不思議と古の呪文～」紹介", """
            ▼開催期間
            2026年10月7日(水) メンテナンス後 ~ 2026年10月21日(水) 10:59
            ▼報酬交換期間
            2026年10月7日(水) メンテナンス後 ~ 2026年10月28日(水) 10:59
            毎日4:00(JST)
            """, "https://bluearchive.jp/news/newsJump/698", "ja-JP", PublishedAt: Now);
        OfficialActivityProvider.Merge(feed, new([notice], "partial", "test"), source, Now);
        var activity = Assert.Single(feed["activities"]!.AsArray())!;
        Assert.Equal("2026年10月21日(水) 10:59", ActivityPolicy.Text(activity["times"]!["playEnd"]!["rawValue"]));
        Assert.Equal("2026年10月28日(水) 10:59", ActivityPolicy.Text(activity["times"]!["claimEnd"]!["rawValue"]));
        Assert.Equal("UTC+09:00", ActivityPolicy.Text(activity["times"]!["playEnd"]!["sourceZone"]));
        Assert.Equal("2026-10-21T01:59:00Z", ActivityPolicy.Text(activity["times"]!["playEnd"]!["instantUtc"]));
        Assert.Equal("2026-10-28T01:59:00Z", ActivityPolicy.Text(activity["times"]!["claimEnd"]!["instantUtc"]));
        Assert.Equal("reported", ActivityPolicy.Text(activity["times"]!["playEnd"]!["certainty"]));
        Assert.Null(activity["times"]!["start"]!["instantUtc"]);
    }

    [Fact]
    public void DefaultClocksNeverOverrideExplicitOffsetsOrInventMissingDates()
    {
        var notice = new OfficialNotice("活动", "", "https://bluearchive.jp/news/newsJump/698", "ja-JP", PublishedAt: Now);
        foreach (var source in GameSources.All)
        {
            var time = OfficialTimeParser.Parse("2026/10/21 10:59", notice, "official:test", source: source)!;
            string expected = source.GameId == "blue-archive" && source.ProgressionId is "jp" or "global"
                ? "2026-10-21T01:59:00Z" : "2026-10-21T02:59:00Z";
            Assert.Equal(expected, ActivityPolicy.Text(time["instantUtc"]));
            Assert.Equal("source-default", ActivityPolicy.Text(time["timeBasis"]));
            Assert.Equal("reported", ActivityPolicy.Text(time["certainty"]));
            var explicitUtc = OfficialTimeParser.Parse("2026/10/21 10:59 UTC", notice, "official:test", source: source)!;
            Assert.Equal("2026-10-21T10:59:00Z", ActivityPolicy.Text(explicitUtc["instantUtc"]));
            Assert.Equal("confirmed", ActivityPolicy.Text(explicitUtc["certainty"]));
            Assert.Null(OfficialTimeParser.Parse("维护结束后", notice, "official:test", source: source)!["instantUtc"]);
            Assert.Null(OfficialTimeParser.Parse("版本更新维护前", notice, "official:test", source: source)!["instantUtc"]);
            Assert.Null(OfficialTimeParser.Parse("10月21日", notice, "official:test", source: source)!["instantUtc"]);
            Assert.Null(OfficialTimeParser.Parse("10月21日 10:59", notice with { PublishedAt = null }, "official:test", source: source)!["instantUtc"]);
            Assert.Null(OfficialTimeParser.Parse("2026/10/21 10:59 UTC+99", notice, "official:test", source: source)!["instantUtc"]);
            Assert.Null(OfficialTimeParser.Parse(null, notice, "official:test", source: source));
        }
    }

    [Fact]
    public async Task StellaReadsStructuredDetailAndKeepsPlayAndShopSeparate()
    {
        var context = new FakePluginHostContext();
        context.Http.ResponseFactory = request => new(HttpStatusCode.OK) { Content = new StringContent(request.RequestUri!.AbsolutePath.EndsWith("/4757")
            ? """{"code":0,"data":{"news":{"id":4757,"title":"09月29日维护更新说明","publishTime":1790632800000,"content":"<p>2026年09月29日</p><p>✦ 全新剧情<br>- 主线剧情第九章「遥远的塔」<br>开放时间：2026/09/29 维护结束后<br>✦ 全新活动<br>- 遥远的塔<br>活动时间：2026/09/29 维护结束后 ~ 2026/10/13 03:59<br>活动商店与奖励兑换时间：2026/09/29 维护结束后 ~ 2026/10/20 10:59<br>- 月华窃梦人<br>活动时间：2026/09/29 维护结束后 ~ 2026/10/13 03:59</p>"}}}"""
            : request.RequestUri.Query.EndsWith("=1") ? """{"code":0,"data":{"rows":[{"id":4757,"title":"更新","description":"摘要","link":"https://stellasora.yostar.cn/news/4757"}]}}"""
            : """{"code":0,"data":{"rows":[]}}""") };
        var source = GameSources.Resolve("stella-sora", "default");
        var official = await new OfficialActivityProvider(new ActivityHttp(context.Http)).FetchAsync(source, default);
        var feed = Feed(source, "「遥远的塔」主线更新纪念活动", "2026-09-29T17:00:00", "2026-10-13T03:59:59");
        OfficialActivityProvider.Merge(feed, official, source, Now);
        var activity = Assert.Single(feed["activities"]!.AsArray())!;
        Assert.Equal("2026/10/13 03:59", ActivityPolicy.Text(activity["times"]!["playEnd"]!["rawValue"]));
        Assert.Equal("2026/10/20 10:59", ActivityPolicy.Text(activity["times"]!["claimEnd"]!["rawValue"]));
        Assert.EndsWith("/4757", Assert.Single(official.Notices).SourceUrl!);
        Assert.DoesNotContain("月华窃梦人", ActivityPolicy.Text(activity["description"]));
    }

    [Fact]
    public async Task WithdrawnTimesAreExcludedBeforeScheduleParsing()
    {
        using var document = await new HtmlParser().ParseDocumentAsync("<article><p><del>10/13 02:00</del><s>10/13 03:00</s><span style='text-decoration: line-through'>10/13 04:00</span>10/13 01:59</p></article>");
        Assert.Equal("10/13 01:59", OfficialNoticeText.Read(document.QuerySelector("article")!));
    }

    [Fact]
    public void GlobalRelativeRecruitmentStillHasItsOfficialEnd()
    {
        var notice = new OfficialNotice("9/29 (Tue) Pick-Up Recruitment Notice", """
            * Pick-Up Recruitment Period: 9/29 (Tue) After Maintenance – 10/6 (Tue) 1:59 AM (UTC)
            1) Nagusa (3 ★, Swimsuit) Pick-Up Recruitment
            """, "https://forum.nexon.com/bluearchive-en/board_view?board=3218&thread=3550498", "en-US", PublishedAt: Now);
        var banner = Assert.Single(OfficialGachaParser.Parse(GameSources.Resolve("blue-archive", "global"), notice, "official:test"));
        Assert.Null(banner["times"]!["start"]!["instantUtc"]);
        Assert.Equal("2026-10-06T01:59:00Z", ActivityPolicy.Text(banner["times"]!["playEnd"]!["instantUtc"]));
    }
}
