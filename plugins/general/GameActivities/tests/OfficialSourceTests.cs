using System.Net;
using System.Text.Json.Nodes;
using NexusPipeline.Plugin.TestKit;
using Xunit;

namespace NexusPipeline.Plugin.GameActivities.Tests;

public sealed class OfficialSourceTests
{
    private static readonly DateTimeOffset Now = DateTimeOffset.Parse("2026-10-10T00:00:00Z");
    private static HttpResponseMessage Response(string json) => new(HttpStatusCode.OK) { Content = new StringContent(json) };

    [Fact]
    public async Task BlueArchiveEndpointsPreserveIndependentProgressionAndOfficialLanguage()
    {
        var context = new FakePluginHostContext();
        context.Http.ResponseFactory = request => request.RequestUri!.Host == "api-web.bluearchive.jp"
            ? Response("""{"meta":{"ok":true},"data":{"rows":[{"id":696,"summary":"日本募集","content":"<p>日本サーバー</p>","publishTime":1791266100000}]}}""")
            : Response("""{"code":0,"data":{"rows":[{"id":1973,"title":"国服招募","content":"<p>国服</p>","publishTime":1791431836805}]}}""");
        var reader = new OfficialActivityProvider(new ActivityHttp(context.Http));
        var cn = Assert.Single((await reader.FetchAsync(GameSources.Resolve("blue-archive", "cn"), default)).Notices);
        var jp = Assert.Single((await reader.FetchAsync(GameSources.Resolve("blue-archive", "jp"), default)).Notices);
        Assert.Equal("zh-CN", cn.Locale); Assert.Equal("ja-JP", jp.Locale);
        Assert.Equal("https://www.bluearchive-cn.com/news/1973", cn.Url);
        Assert.Equal("https://bluearchive.jp/news/newsJump/696", jp.Url);
        Assert.Equal("国服", cn.Text); Assert.Equal("日本サーバー", jp.Text);
        Assert.NotNull(cn.PublishedAt); Assert.NotNull(jp.PublishedAt);
    }

    [Fact]
    public async Task HoyoReadersRetainApiProvenanceAndDeduplicateNoticeIdentity()
    {
        foreach (string game in new[] { "genshin-impact", "honkai-star-rail", "zenless-zone-zero" })
        {
            var context = new FakePluginHostContext();
            context.Http.ResponseFactory = _ => Response("""{"retcode":0,"data":{"list":[{"iInfoId":123,"sTitle":"公告","sContent":"<p>第一段</p><p>第二段</p><script>doNotRun()</script>"}]}}""");
            var result = await new OfficialActivityProvider(new ActivityHttp(context.Http)).FetchAsync(GameSources.Resolve(game, "default"), default);
            var notice = Assert.Single(result.Notices);
            Assert.Equal("第一段\n第二段", notice.Text);
            Assert.Contains("getContentList", notice.SourceUrl!);
            Assert.EndsWith("/123", notice.Url);
            Assert.Equal("partial", result.Status);
            var contentRequests = context.Http.Requests.Where(request => request.RequestUri!.AbsolutePath.EndsWith("getContentList", StringComparison.Ordinal)).ToArray();
            Assert.NotEmpty(contentRequests);
            Assert.All(contentRequests, request => Assert.Contains("sLangKey=zh-cn", request.RequestUri!.Query));
            Assert.All(context.Http.Requests.Except(contentRequests), request =>
            {
                Assert.Equal("genshin-impact", game);
                Assert.Equal("https://operation-webstatic.mihoyo.com/gacha_info/hk4e/cn_gf01/gacha/list.json", request.RequestUri!.AbsoluteUri);
            });
        }
    }

    [Fact]
    public async Task GlobalBlueArchiveRejectsAnotherCommunityBeforeReadingEvents()
    {
        var context = new FakePluginHostContext();
        context.Http.ResponseFactory = _ => Response("""{"communityId":"315","alias":"bluearchive-en"}""");
        var error = await Assert.ThrowsAsync<ActivityException>(() => new OfficialActivityProvider(new ActivityHttp(context.Http))
            .FetchAsync(GameSources.Resolve("blue-archive", "global"), default));
        Assert.Equal("official_progression_mismatch", error.Code);
        Assert.Single(context.Http.Requests);
    }

    [Fact]
    public async Task KuroUsesCurrentHomeCatalogAndRejectsAnotherGameDetail()
    {
        var context = new FakePluginHostContext();
        context.Http.ResponseFactory = request => request.RequestUri!.AbsolutePath.EndsWith("MainMenu.json")
            ? Response("""{"article":[{"articleId":5569,"articleType":52},{"articleId":5569,"articleType":0}]}""")
            : Response("""{"gameId":"G152","articleId":5569,"articleTitle":"当前版本","articleContent":"<p>当前说明</p>"}""");
        var reader = new OfficialActivityProvider(new ActivityHttp(context.Http));
        var result = await reader.FetchAsync(GameSources.Resolve("wuthering-waves", "default"), default);
        Assert.Equal("当前说明", Assert.Single(result.Notices).Text); Assert.Equal(3, context.Http.Requests.Count);
        Assert.Equal(HttpMethod.Post, context.Http.Requests.Last().Method);
        Assert.Equal(OfficialWikiCatalog.Endpoint, context.Http.Requests.Last().RequestUri!.AbsoluteUri);
        context.Http.ResponseFactory = request => request.RequestUri!.AbsolutePath.EndsWith("MainMenu.json")
            ? Response("""{"article":[{"articleId":5569,"articleType":52}]}""")
            : Response("""{"gameId":"G153","articleId":5569,"articleTitle":"其他进度","articleContent":"<p>错误正文</p>"}""");
        var error = await Assert.ThrowsAsync<ActivityException>(() => reader.FetchAsync(GameSources.Resolve("wuthering-waves", "default"), default));
        Assert.Equal("official_progression_mismatch", error.Code);
    }

    [Fact]
    public void GlobalRecruitmentSplitsStudentsAndPreservesExplicitUtcMinutePrecision()
    {
        var notice = new OfficialNotice("10/6(Tue) Pick-Up Recruitment Notice", """
            * Unique Pick-Up Recruitment Period: 10/6 (Tue) 2:00 AM – 10/13 (Tue) 1:59 AM (UTC)
            1) [Returning] Kazusa (3 ★, Band) Unique Pick-Up Recruitment
            2) [Returning] Yoshimi (3 ★, Band) Unique Pick-Up Recruitment
            * Pick-Up Recruitment Period: 10/6 (Tue) 2:00 AM – 10/13 (Tue) 1:59 AM (UTC)
            1) [Returning] Natsu (3 ★, Band) Pick-Up Recruitment
            """, "https://forum.nexon.com/bluearchive-en/board_view?board=3218&thread=3553804", "en-US", PublishedAt: Now);
        var banners = OfficialGachaParser.Parse(GameSources.Resolve("blue-archive", "global"), notice, "official:test").ToArray();
        Assert.Equal(3, banners.Length); Assert.Equal(3, banners.Select(item => ActivityPolicy.Text(item["eventId"])).Distinct().Count());
        Assert.All(banners, item =>
        {
            Assert.Equal("gacha-character", ActivityPolicy.Text(item["category"]));
            Assert.Equal("2026-10-13T01:59:00Z", ActivityPolicy.Text(item["times"]!["playEnd"]!["instantUtc"]));
            Assert.Equal("minute", ActivityPolicy.Text(item["times"]!["playEnd"]!["precision"]));
            Assert.Contains("10/13 (Tue) 1:59 AM (UTC)", ActivityPolicy.Text(item["times"]!["playEnd"]!["rawValue"]));
        });
        var changed = notice with { Text = notice.Text.Replace("10/13 (Tue) 1:59 AM", "10/14 (Wed) 1:59 AM") };
        Assert.Equal(banners.Select(item => ActivityPolicy.Text(item["eventId"])), OfficialGachaParser.Parse(GameSources.Resolve("blue-archive", "global"), changed, "official:test").Select(item => ActivityPolicy.Text(item["eventId"])));
    }

    [Fact]
    public void DefaultOfficialClockIsReportedAndDoesNotClaimCatalogCompleteness()
    {
        var source = GameSources.Resolve("blue-archive", "cn");
        var notice = new OfficialNotice("【预告】限时招募：夏（乐队）", "■ 招募时间\n10月08日 14:00 ~ 10月22日 13:59", "https://www.bluearchive-cn.com/news/1973", "zh-CN", PublishedAt: Now);
        var feed = ActivityNormalizer.Normalize(source, JsonNode.Parse("""{"version":"2026-10","activities":[]}""")!.AsObject(), Now);
        OfficialActivityProvider.Merge(feed, new([notice], "partial", "Bounded official catalog"), source, Now);
        var banner = Assert.Single(feed["activities"]!.AsArray());
        Assert.Equal("2026-10-22T05:59:00Z", ActivityPolicy.Text(banner!["times"]!["playEnd"]!["instantUtc"]));
        Assert.Equal("reported", ActivityPolicy.Text(banner["times"]!["playEnd"]!["certainty"]));
        Assert.Equal("10月22日 13:59", ActivityPolicy.Text(banner["times"]!["playEnd"]!["rawValue"]));
        Assert.Equal("partial", ActivityPolicy.Text(feed["coverage"]!["gacha"]!["status"]));
        Assert.Contains(feed["sources"]!.AsArray(), item => ActivityPolicy.Text(item?["sourceUpdatedAt"]) == "2026-10-10T00:00:00Z");
        var stella = new OfficialNotice("「沐于温情笑意中」限时招募开启", "5星旅人\n▌招募时间 2026/09/29 维护结束后 ~ 2026/10/20 10:59", "https://stellasora.yostar.cn/news/4760", "zh-CN");
        var relative = Assert.Single(OfficialGachaParser.Parse(GameSources.Resolve("stella-sora", "default"), stella, "official:test"));
        Assert.Equal("2026/09/29 维护结束后", ActivityPolicy.Text(relative["times"]!["start"]!["rawValue"]));
        Assert.Null(relative["times"]!["start"]!["instantUtc"]);
        Assert.Equal("2026/10/20 10:59", ActivityPolicy.Text(relative["times"]!["playEnd"]!["rawValue"]));
    }

    [Fact]
    public void HoyoBannerTemplatesKeepCharactersWeaponsAndIndependentEndings()
    {
        var starRail = new OfficialNotice("4.6版本活动跃迁（其一）", """
            限定5星角色「角色甲」与限定5星光锥「光锥甲」跃迁成功概率限时提升，跃迁时间为 2026/09/28 4.6版本更新后 - 2026/11/10 15:00。
            限定5星角色「角色乙」与限定5星光锥「光锥乙」将会返场，跃迁时间为 2026/09/28 4.6版本更新后 - 2026/10/21 11:59。
            ● 「角色池甲」角色活动跃迁期间，限定5星角色「角色甲」
            ● 「光锥池甲」光锥活动跃迁期间，限定5星光锥「光锥甲」
            ● 「角色池乙」角色活动跃迁期间，限定5星角色「角色乙」
            ● 「光锥池乙」光锥活动跃迁期间，限定5星光锥「光锥乙」
            """, "https://sr.mihoyo.com/news/166487", "zh-CN");
        var banners = OfficialGachaParser.Parse(GameSources.Resolve("honkai-star-rail", "default"), starRail, "official:test").ToArray();
        Assert.Equal(4, banners.Length);
        Assert.Equal(2, banners.Count(item => ActivityPolicy.Text(item["category"]) == "gacha-weapon"));
        Assert.Equal(new[] { "2026/11/10 15:00", "2026/10/21 11:59" }, banners.Select(item => ActivityPolicy.Text(item["times"]!["playEnd"]!["rawValue"])).Distinct());
        Assert.Equal(new[] { "2026-11-10T07:00:00Z", "2026-10-21T03:59:00Z" }, banners.Select(item => ActivityPolicy.Text(item["times"]!["playEnd"]!["instantUtc"])).Distinct());
        var zenless = new OfficialNotice("3.2版本限时频段（下期）", """
            本期代理人与音擎调频活动时间为：2026-09-30 12:00~2026-10-20 14:59，包含如下内容：
            活动期间，限定S级代理人[代理人甲]、[代理人乙]以及默认A级代理人[其他]的调频获取概率将大幅提升！
            活动期间，限定S级音擎[音擎甲]、[音擎乙]以及默认A级音擎[其他]的调频获取概率将大幅提升！
            """, "https://zzz.mihoyo.com/news/166512", "zh-CN");
        Assert.Equal(4, OfficialGachaParser.Parse(GameSources.Resolve("zenless-zone-zero", "default"), zenless, "official:test").Count());
        var genshin = new OfficialNotice("「神铸赋形」祈愿：武器概率UP！", "限定5星武器的祈愿获取概率将大幅提升！", "https://ys.mihoyo.com/main/news/detail/166638", "zh-CN");
        var weapon = Assert.Single(OfficialGachaParser.Parse(GameSources.Resolve("genshin-impact", "default"), genshin, "official:test"));
        Assert.Equal("gacha-weapon", ActivityPolicy.Text(weapon["category"]));
        Assert.Null(weapon["times"]!["playEnd"]);
    }

    [Fact]
    public void EndfieldAndKuroTemplatesDoNotTurnRelativeOrImageOnlySchedulesIntoInstants()
    {
        var endfield = new OfficialNotice("「绚丽异彩」重构寻访#1与「点绘申领」重构申领#1开放", "▼//开放时间\n2026/09/24 12:00（服务器时间） - 版本更新维护前", "https://endfield.hypergryph.com/news/2651", "zh-CN");
        var banners = OfficialGachaParser.Parse(GameSources.Resolve("arknights-endfield", "default"), endfield, "official:test").ToArray();
        Assert.Equal(2, banners.Length);
        Assert.All(banners, item => { Assert.Null(item["times"]!["playEnd"]!["instantUtc"]); Assert.Equal("版本更新维护前", ActivityPolicy.Text(item["times"]!["playEnd"]!["rawValue"])); });
        var kuro = new OfficialNotice("「当前」3.7版本内容说明", "※可通过[但愿长圆如此夜]角色活动唤取获得。\n※可通过「玉阙玄华」武器活动唤取获得。", "https://mc.kurogames.com/main/news/detail/5569", "zh-CN");
        var pools = OfficialGachaParser.Parse(GameSources.Resolve("wuthering-waves", "default"), kuro, "official:test").ToArray();
        Assert.Equal(2, pools.Length); Assert.All(pools, item => Assert.Null(item["times"]!["playEnd"]));
    }

    [Fact]
    public void NteGlobalUsesEachExplicitOffsetWithoutPromotingServerTime()
    {
        var notice = new OfficialNotice("Ver. 1.4 「Current」 Patch Notes", """
            ● New Limited S-Class Character: Blackbird
            Available: September 30 (after update) – October 21, 05:59 (UTC+8)
            ● Limited S-Class Arc "The Last Rose" Returns
            Available: September 30 (after update) – October 21, 05:59 (UTC+8)
            ● "Everdriving" Mystery Boxes Return
            Available: September 30 (after update) – November 11, 05:59 (UTC+8)
            ● "Stamina Recharge" Limited-Time Event
            Duration: October 5, 05:00 – October 19, 04:59 (server time)
            """, "https://nte.perfectworld.com/en/article/news/gamenews/20260929/264409.html", "en-US");
        var banners = OfficialGachaParser.Parse(GameSources.Resolve("neverness-to-everness", "global"), notice, "official:test").ToArray();
        Assert.Equal(3, banners.Length);
        Assert.All(banners, item => Assert.Null(item["times"]!["start"]!["instantUtc"]));
        Assert.All(banners, item => Assert.Null(item["times"]!["start"]!["sourceZone"]));
        Assert.Equal("2026-10-20T21:59:00Z", ActivityPolicy.Text(banners[0]["times"]!["playEnd"]!["instantUtc"]));
        Assert.Contains("(UTC+8)", ActivityPolicy.Text(banners[0]["times"]!["playEnd"]!["rawValue"]));
    }

    [Fact]
    public void MergeRejectsIncidentalNameMentionsAndOldVersionBanners()
    {
        var source = GameSources.Resolve("zenless-zone-zero", "default");
        var feed = ActivityNormalizer.Normalize(source, JsonNode.Parse("""{"version":"3.2","activities":[{"name":"活动甲","description":"源介绍"}]}""")!.AsObject(), Now);
        var notice = new OfficialNotice("3.1版本限时频段（下期）", """
            修复了活动甲中的已知问题。
            本期代理人与音擎调频活动时间为：2026-08-30 12:00~2026-09-20 14:59
            活动期间，限定S级代理人[旧代理人]以及默认A级代理人[其他]的调频获取概率将大幅提升！
            """, "https://zzz.mihoyo.com/news/165000", "zh-CN");
        OfficialActivityProvider.Merge(feed, new([notice], "partial", "bounded"), source, Now);
        var activity = Assert.Single(feed["activities"]!.AsArray());
        Assert.Equal("源介绍", ActivityPolicy.Text(activity!["description"]));
        Assert.Equal("missing", ActivityPolicy.Text(activity["officialLinkKind"]));
        Assert.DoesNotContain(feed["activities"]!.AsArray(), item => ActivityPolicy.Gacha(item!));
        var topicSource = GameSources.Resolve("stella-sora", "default");
        var topic = ActivityNormalizer.Normalize(topicSource, JsonNode.Parse("""{"versionName":"当前剧情","activities":[{"name":"当前剧情","kind":"剧情活动","startTime":"2026-10-01T00:00:00","endTime":"2026-10-20T00:00:00"}]}""")!.AsObject(), Now);
        Assert.Equal("campaign", ActivityPolicy.Text(topic["contentPeriod"]!["kind"]));
    }

    [Fact]
    public void NteChinaNeverUsesGlobalDatesOrOffsetForDomesticBoards()
    {
        var notice = new OfficialNotice("《异环》1.4版本「祷歌为谁而诵」更新公告", """
            ● 全新限定S级角色「黑羽」
            开放时间：9月24日版本更新后-10月15日05:59
            ● 全新限定S级弧盘「罪与罚」
            开放时间：9月24日版本更新后-10月15日05:59
            ● 盲盒「失速狂飙」返场
            活动时间：9月24日版本更新后 - 11月5日05:59
            """, "https://yh.wanmei.com/news/gamebroad/20260923/264278.html", "zh-CN");
        var banners = OfficialGachaParser.Parse(GameSources.Resolve("neverness-to-everness", "cn"), notice, "official:test").ToArray();
        Assert.Equal(3, banners.Length);
        Assert.Equal("2026-10-14T21:59:00Z", ActivityPolicy.Text(banners[0]["times"]!["playEnd"]!["instantUtc"]));
        Assert.Equal("2026-11-04T21:59:00Z", ActivityPolicy.Text(banners[2]["times"]!["playEnd"]!["instantUtc"]));
        Assert.Equal("10月15日05:59", ActivityPolicy.Text(banners[0]["times"]!["playEnd"]!["rawValue"]));
        Assert.Empty(OfficialGachaParser.Parse(GameSources.Resolve("neverness-to-everness", "global"), notice, "official:test"));
    }
}
