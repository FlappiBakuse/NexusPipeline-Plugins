using System.Net;
using System.Text.Json.Nodes;
using NexusPipeline.Plugin.TestKit;
using Xunit;

namespace NexusPipeline.Plugin.GameActivities.Tests;

public sealed class OfficialDirectoryTests
{
    private static readonly DateTimeOffset Now = DateTimeOffset.Parse("2026-10-10T00:00:00Z");

    [Fact]
    public async Task WikiCurrentPoolsIncludeReturnsButRequireBothCategoriesAndPublisherProgression()
    {
        var source = GameSources.Resolve("wuthering-waves", "default");
        var update = new OfficialNotice("「当前」3.7版本内容说明", "可通过[新角色池]角色活动唤取获得。\n可通过「新武器池」武器活动唤取获得。", "https://mc.kurogames.com/main/news/detail/5569", "zh-CN");
        var payload = JsonNode.Parse("""
            {"code":200,"data":{"contentJson":{"sideModules":[
              {"type":"events-side","title":"角色活动唤取","content":{"tabs":[
                {"name":"新角色池","countDown":{"type":"no-repeat","dateRange":["2026-09-30 11:00","2026-10-22 09:59"]}},
                {"name":"复刻角色池","countDown":{"type":"no-repeat","dateRange":["2026-09-30 11:00","2026-10-22 09:59"]}}]}},
              {"type":"events-side","title":"武器活动唤取","content":{"tabs":[
                {"name":"新武器池","countDown":{"type":"no-repeat","dateRange":["2026-09-30 11:00","2026-10-22 09:59"]}},
                {"name":"复刻武器池","countDown":{"type":"no-repeat","dateRange":["2026-09-30 11:00","2026-10-22 09:59"]}}]}}
            ]}}}
            """)!;
        var official = OfficialWikiCatalog.WutheringWaves([update], payload);
        var feed = ActivityNormalizer.Normalize(source, JsonNode.Parse("""{"version":"3.7","activities":[]}""")!.AsObject(), Now);
        OfficialActivityProvider.Merge(feed, official, source, Now);
        Assert.Equal("complete", ActivityPolicy.Text(feed["coverage"]!["gacha"]!["status"]));
        Assert.Equal(4, feed["activities"]!.AsArray().Count);
        Assert.All(feed["activities"]!.AsArray(), item =>
        {
            Assert.Equal("2026-10-22T01:59:00Z", ActivityPolicy.Text(item!["times"]!["playEnd"]!["instantUtc"]));
            Assert.Equal("source-default", ActivityPolicy.Text(item["times"]!["playEnd"]!["timeBasis"]));
        });
        Assert.All(feed["activities"]!.AsArray().Where(item => ActivityPolicy.Text(item?["title"]).StartsWith("复刻", StringComparison.Ordinal)), item => Assert.Null(item!["officialUrl"]));
        var publisherIds = OfficialGachaParser.Parse(source, update, "publisher").Select(item => ActivityPolicy.Text(item["eventId"])).ToArray();
        Assert.All(publisherIds, id => Assert.Contains(feed["activities"]!.AsArray(), item => ActivityPolicy.Text(item?["eventId"]) == id
            && ActivityPolicy.Text(item?["officialLinkKind"]) == "version-notice"));
        var context = new FakePluginHostContext();
        var raw = JsonNode.Parse("""{"version":"3.7","activities":[]}""")!.AsObject();
        var previous = ActivityNormalizer.Normalize(source, raw, Now);
        OfficialActivityProvider.Merge(previous, new([update], "partial", "test"), source, Now);
        await context.ScopedData.WriteJsonAsync("feed/wuthering-waves/default/zh-CN/merged/v1", previous);
        await context.ScopedData.WriteJsonAsync("feed/wuthering-waves/default/zh-CN/sra/v1", ActivityNormalizer.Object(new { raw }));
        await context.ScopedData.WriteAsync("feed/wuthering-waves/default/zh-CN/official/v4", new { CheckedAt = Now, Result = official });
        var service = new ActivityCoordinator(context); await service.InitializeAsync(default);
        try { Assert.Equal(4, (await service.FeedAsync(source, "zh-CN", default))!["activities"]!.AsArray().Count); }
        finally { await service.StopAsync(default); }
        var old = ActivityNormalizer.Normalize(source, JsonNode.Parse("""{"version":"3.6","activities":[]}""")!.AsObject(), Now);
        OfficialActivityProvider.Merge(old, official, source, Now);
        Assert.Empty(old["activities"]!.AsArray());
        Assert.Equal("partial", ActivityPolicy.Text(old["coverage"]!["gacha"]!["status"]));
        payload["data"]!["contentJson"]!["sideModules"]!.AsArray().RemoveAt(1);
        Assert.Throws<ActivityException>(() => OfficialWikiCatalog.WutheringWaves([update], payload));
    }

    [Fact]
    public void HoyoComprehensivePhasesRequireEveryHeadingAndBothLimitedCategories()
    {
        var source = GameSources.Resolve("zenless-zone-zero", "default");
        var update = new OfficialNotice("3.2版本「当前」更新公告", "当前版本更新", "https://zzz.mihoyo.com/news/166026", "zh-CN");
        var phase = new OfficialNotice("3.2版本限时频段（下期）", """
            本期代理人与音擎调频活动时间为：2026-09-30 12:00~2026-10-20 14:59，包含如下内容：
            活动期间，限定S级代理人[新角色]、[复刻角色]以及默认A级代理人[默认角色]的调频获取概率将大幅提升！
            活动期间，限定S级音擎[新武器]、[复刻武器]以及默认A级音擎[默认武器]的调频获取概率将大幅提升！
            """, "https://zzz.mihoyo.com/news/166512", "zh-CN");
        JsonObject Feed() => ActivityNormalizer.Normalize(source, JsonNode.Parse("""{"version":"3.2","activities":[]}""")!.AsObject(), Now);
        var upper = phase with { Title = "3.2版本限时频段（上期）", Url = "https://zzz.mihoyo.com/news/165991",
            Text = phase.Text.Replace("2026-09-30 12:00", "3.2版本更新后", StringComparison.Ordinal).Replace("2026-10-20 14:59", "2026/09/30 11:59", StringComparison.Ordinal) };
        var official = new OfficialResult([update, phase, upper], "partial", "test");
        var feed = Feed(); OfficialActivityProvider.Merge(feed, official, source, Now);
        Assert.Equal("complete", ActivityPolicy.Text(feed["coverage"]!["gacha"]!["status"]));
        Assert.Equal(8, feed["activities"]!.AsArray().Count);
        var missing = Feed(); OfficialActivityProvider.Merge(missing, official with { Notices = [phase] }, source, Now);
        Assert.Equal("partial", ActivityPolicy.Text(missing["coverage"]!["gacha"]!["status"]));
        var unsupported = phase with { Text = phase.Text.Replace("限定S级音擎", "限时未知音擎", StringComparison.Ordinal) };
        var invalid = Feed(); OfficialActivityProvider.Merge(invalid, official with { Notices = [update, unsupported] }, source, Now);
        Assert.Equal("partial", ActivityPolicy.Text(invalid["coverage"]!["gacha"]!["status"]));
    }

    [Fact]
    public void ChinaDirectoryRequiresDedicatedNewReturningAndGuaranteedBatches()
    {
        var source = GameSources.Resolve("blue-archive", "cn");
        const string origin = "https://www.bluearchive-cn.com/news/";
        var update = new OfficialNotice("09月24日维护更新说明", """
            更新限时限定招募【新池】
            更新限时招募活动【3★限定成员必得招募】
            ■ 资源预加载
            提前预加载复刻活动【故事】，活动预计将于10月08日14:00开启。
            提前预加载成员【学生甲】及对应招募活动的游戏资源，活动预计将于10月08日14:00开启。
            """, origin + "1963", "zh-CN", PublishedAt: Now);
        var story = new OfficialNotice("【预告】限时复刻活动：故事", "活动持续时间：10月08日 14:00 ~ 10月22日 13:59", origin + "1974", "zh-CN", PublishedAt: Now);
        var newly = new OfficialNotice("【预告】限时招募：新学生", "限时限定招募【新池】\n■ 招募时间\n09月24日 维护结束后 ~ 10月01日 13:59", origin + "1961", "zh-CN", PublishedAt: Now);
        var returning = new OfficialNotice("【预告】限时招募：学生甲", "限时复刻招募【复刻池】\n■ 招募时间\n10月08日 14:00 ~ 10月22日 13:59", origin + "1973", "zh-CN", PublishedAt: Now);
        var special = new OfficialNotice("【预告】3★限定必得招募即将开启！", "3★限定成员必得招募券可使用时间：09月24日 维护结束后 ~ 10月29日 13:59", origin + "1944", "zh-CN", PublishedAt: Now);
        var feed = ActivityNormalizer.Normalize(source, JsonNode.Parse("""{"activities":[{"name":"限时复刻活动【故事】","startTime":"2026-10-08T14:00:00","endTime":"2026-10-22T14:00:59"}]}""")!.AsObject(), Now);
        var result = new OfficialResult([update, story, newly, returning, special], "partial", "test");
        OfficialActivityProvider.Merge(feed, result, source, Now);
        Assert.Equal("complete", ActivityPolicy.Text(feed["coverage"]!["gacha"]!["status"]));
        Assert.Equal(3, feed["activities"]!.AsArray().Count(item => ActivityPolicy.Gacha(item!)));
        Assert.Null(OfficialGachaDirectory.Qualify(feed, result with { Notices = [update, story, newly, returning] }, source));
        Assert.Null(OfficialGachaDirectory.Qualify(feed, result with { Notices = [update, story, newly, returning with { Text = returning.Text.Replace("10月08日", "10月15日", StringComparison.Ordinal) }, special] }, source));
    }

    [Fact]
    public void GlobalDirectoryMatchesEveryNamedPoolAndItsClosingBatch()
    {
        var source = GameSources.Resolve("blue-archive", "global");
        const string origin = "https://forum.nexon.com/bluearchive-en/board_view?board=3218&thread=";
        var patch = new OfficialNotice("9/29 (Tue) Patch Notes", """
            1. Date: 9/29 (Tue) 2:00 AM – 5:00 AM (UTC)
            3. Compensation: Pyroxene x360
            2. Student Recruitment
            - [Returning] Student A (3★, Band) Unique Pick-Up Recruitment Schedule: 10/6 (Tue) 2:00 AM – 10/13 (Tue) 1:59 AM (UTC)
            3. Returning Event Story
            """, origin + "3549872", "en-US", PublishedAt: Now);
        var detail = new OfficialNotice("10/6(Tue) Pick-Up Recruitment Notice", """
            * Unique Pick-Up Recruitment Period: 10/6 (Tue) 2:00 AM – 10/13 (Tue) 1:59 AM (UTC)
            1) [Returning] Student A (3★, Band) Unique Pick-Up Recruitment
            """, origin + "3553804", "en-US", PublishedAt: Now);
        var feed = ActivityNormalizer.Normalize(source, JsonNode.Parse("""{"activities":[{"name":"Current story"}]}""")!.AsObject(), Now);
        feed["activities"]![0]!["officialUrl"] = patch.Url;
        OfficialActivityProvider.Merge(feed, new([patch, detail], "partial", "test"), source, Now);
        Assert.Equal("complete", ActivityPolicy.Text(feed["coverage"]!["gacha"]!["status"]));
        Assert.Null(OfficialGachaDirectory.Qualify(feed, new([patch with { Text = patch.Text.Replace("10/13", "10/20", StringComparison.Ordinal) }, detail], "partial", "test"), source));
    }

    [Fact]
    public async Task GenshinCatalogValidatesEveryDetailAndDoesNotExpirePermanentWishes()
    {
        string id = new('a', 40);
        var context = new FakePluginHostContext();
        context.Http.ResponseFactory = request => new(HttpStatusCode.OK) { Content = new StringContent(
            request.RequestUri!.AbsolutePath.EndsWith("gacha/list.json")
                ? "{\"retcode\":0,\"data\":{\"list\":[{\"gacha_id\":\"" + id + "\",\"gacha_type\":200,\"begin_time\":\"2026-09-23 07:00:00\",\"end_time\":\"2027-11-03 15:59:59\"}]}}"
                : request.RequestUri.AbsolutePath.EndsWith("zh-cn.json")
                    ? """{"gacha_type":200,"title":"「奔行世间」常驻祈愿","content":"<p>「奔行世间」常驻祈愿永久开放。</p>"}"""
                    : """{"retcode":0,"data":{"list":[]}}""") };
        var source = GameSources.Resolve("genshin-impact", "default");
        var official = await new OfficialActivityProvider(new ActivityHttp(context.Http)).FetchAsync(source, default);
        Assert.NotNull(official.Catalog);
        var feed = ActivityNormalizer.Normalize(source, JsonNode.Parse("""{"version":"7.1","activities":[]}""")!.AsObject(), Now);
        OfficialActivityProvider.Merge(feed, official, source, Now);
        var banner = Assert.Single(feed["activities"]!.AsArray())!;
        Assert.Equal("permanent", ActivityPolicy.Text(banner["availability"]));
        Assert.Null(banner["times"]!["playEnd"]);
        Assert.Equal("2026-09-22T23:00:00Z", ActivityPolicy.Text(banner["times"]!["start"]!["instantUtc"]));
        Assert.Equal("reported", ActivityPolicy.Text(banner["times"]!["start"]!["certainty"]));
        Assert.Equal("complete", ActivityPolicy.Text(feed["coverage"]!["gacha"]!["status"]));
        Assert.Contains(feed["sources"]!.AsArray(), item => ActivityPolicy.Text(item?["url"]).EndsWith("gacha/list.json", StringComparison.Ordinal));
        context.Http.ResponseFactory = _ => new(HttpStatusCode.OK) { Content = new StringContent("""{"retcode":0,"data":{"list":[]}}""") };
        Assert.Null((await new OfficialActivityProvider(new ActivityHttp(context.Http)).FetchAsync(source, default)).Catalog);
    }

    [Fact]
    public void NteDirectoryRequiresEveryComprehensiveHeadingAndCorrectVersion()
    {
        var source = GameSources.Resolve("neverness-to-everness", "global");
        var notice = new OfficialNotice("Ver. 1.4 Current Patch Notes", """
            ● New Limited S-Class Character: Character A
            Available: September 30 (after update) – October 21, 05:59 (UTC+8)
            ● Limited S-Class Arc "Arc A"
            Available: September 30 (after update) – October 21, 05:59 (UTC+8)
            ● "Box A" Mystery Boxes Return
            Available: September 30 (after update) – November 11, 05:59 (UTC+8)
            """, "https://nte.perfectworld.com/en/article/news/gamenews/20260929/264409.html", "en-US");
        JsonObject Feed() => ActivityNormalizer.Normalize(source, JsonNode.Parse("""{"version":"1.4","activities":[]}""")!.AsObject(), Now);
        var feed = Feed();
        OfficialActivityProvider.Merge(feed, new([notice], "partial", "test"), source, Now);
        Assert.Equal("complete", ActivityPolicy.Text(feed["coverage"]!["gacha"]!["status"]));
        Assert.Equal(3, feed["activities"]!.AsArray().Count);
        var missing = Feed();
        OfficialActivityProvider.Merge(missing, new([notice with { Text = notice.Text + "\n● New Limited S-Class Character: Missing Schedule" }], "partial", "test"), source, Now);
        Assert.Equal("partial", ActivityPolicy.Text(missing["coverage"]!["gacha"]!["status"]));
        var old = Feed();
        OfficialActivityProvider.Merge(old, new([notice with { Title = "Ver. 1.3 Old Patch Notes" }], "partial", "test"), source, Now);
        Assert.Equal("partial", ActivityPolicy.Text(old["coverage"]!["gacha"]!["status"]));
        Assert.Empty(old["activities"]!.AsArray());
    }

    [Fact]
    public void JapaneseDeclaredPickupCountMustMatchTheCurrentOpeningBatch()
    {
        var source = GameSources.Resolve("blue-archive", "jp");
        var notice = new OfficialNotice("ピックアップ募集紹介：現在", """
            計2名のピックアップ募集になります。
            ピックアップ名：「募集甲」
            ピックアップ名：「募集乙」
            ▼実施期間
            2026年10月7日(水) メンテナンス後 ~ 2026年10月21日(水) 10:59
            """, "https://bluearchive.jp/news/newsJump/696", "ja-JP");
        var feed = ActivityNormalizer.Normalize(source, JsonNode.Parse("""{"activities":[{"name":"現在のイベント"}]}""")!.AsObject(), Now);
        feed["activities"]![0]!["times"]!["start"] = OfficialTimeParser.Parse("2026年10月7日(水) メンテナンス後", notice, "sra:ba-jp");
        OfficialActivityProvider.Merge(feed, new([notice], "partial", "test"), source, Now);
        Assert.Equal("complete", ActivityPolicy.Text(feed["coverage"]!["gacha"]!["status"]));
        var incomplete = notice with { Text = notice.Text.Replace("計2名", "計3名", StringComparison.Ordinal) };
        Assert.Null(OfficialGachaDirectory.Qualify(feed, new([incomplete], "partial", "test"), source));
    }

    [Fact]
    public void GuaranteedRecruitmentUsesTicketUseEndAndDirectSelectionIsNotGacha()
    {
        var source = GameSources.Resolve("blue-archive", "cn");
        var notice = new OfficialNotice("【预告】3★限定必得招募即将开启！", """
            3★限定成员必得招募券可购买时间：09月24日 维护结束后 ~ 10月22日 13:59
            3★限定成员必得招募券可使用时间：09月24日 维护结束后 ~ 10月29日 13:59
            """, "https://www.bluearchive-cn.com/news/1944", "zh-CN", PublishedAt: Now);
        var banner = Assert.Single(OfficialGachaParser.Parse(source, notice, "official:test"));
        Assert.Equal("10月29日 13:59", ActivityPolicy.Text(banner["times"]!["playEnd"]!["rawValue"]));
        Assert.Empty(OfficialGachaParser.Parse(source, notice with { Title = "【预告】3★自选招募即将开启！" }, "official:test"));
    }

    [Fact]
    public void StarRailPetDrawsAndEndfieldCountBasedArsenalKeepTheirOwnCategoryAndEnd()
    {
        var pet = new OfficialNotice("「星际幻宠」乐园：活动", "▌「星际潮玩」抽取活动说明\n■活动时间\n4.6版本期间", "https://sr.mihoyo.com/news/166234", "zh-CN");
        var draw = Assert.Single(OfficialGachaParser.Parse(GameSources.Resolve("honkai-star-rail", "default"), pet, "official:test"));
        Assert.Equal("gacha-other", ActivityPolicy.Text(draw["category"]));
        Assert.Equal("4.6版本期间", ActivityPolicy.Text(draw["times"]!["playEnd"]!["rawValue"]));
        Assert.Null(draw["times"]!["playEnd"]!["instantUtc"]);
        var source = GameSources.Resolve("honkai-star-rail", "default");
        var feed = ActivityNormalizer.Normalize(source, JsonNode.Parse("""{"version":"4.6","startTime":"2026-09-28T11:00:00","endTime":"2026-11-11T06:00:00","activities":[{"name":"「星际幻宠」乐园：星际潮玩","startTime":"2026-09-28T11:00:00","endTime":"2026-11-11T06:00:00"}]}""")!.AsObject(), Now);
        string eventId = ActivityPolicy.Text(feed["activities"]![0]!["eventId"]);
        OfficialActivityProvider.Merge(feed, new([pet], "partial", "test"), source, Now);
        var merged = Assert.Single(feed["activities"]!.AsArray())!;
        Assert.Equal(eventId, ActivityPolicy.Text(merged["eventId"]));
        Assert.Equal("gacha-other", ActivityPolicy.Text(merged["category"]));
        Assert.Null(merged["times"]!["playEnd"]!["instantUtc"]);
        var update = new OfficialNotice("4.6版本「当前版本」版本更新说明", "4.6版本的持续时间为 2026/09/28 更新后 - 2026/11/11 06:00。\n■「星际幻宠」乐园\n●活动期间，开拓者可在「星际潮玩」中抽取幻宠。\n●开放时间：4.6版本更新后 - 2026/11/11 06:00\n■另一活动\n●开放时间：2026/10/21 12:00 - 2026/11/11 03:59",
            "https://sr.mihoyo.com/news/166489", "zh-CN");
        foreach (var notices in new[] { new[] { pet, update }, new[] { update, pet } })
        {
            var complete = ActivityNormalizer.Normalize(source, JsonNode.Parse("""{"version":"4.6","startTime":"2026-09-28T11:00:00","endTime":"2026-11-11T06:00:00","activities":[{"name":"「星际幻宠」乐园：星际潮玩","startTime":"2026-09-28T11:00:00","endTime":"2026-11-11T06:00:00"}]}""")!.AsObject(), Now);
            OfficialActivityProvider.Merge(complete, new(notices, "partial", "test"), source, Now);
            var current = Assert.Single(complete["activities"]!.AsArray())!;
            Assert.Equal("2026/11/11 06:00", ActivityPolicy.Text(current["times"]!["playEnd"]!["rawValue"]));
            Assert.Equal("2026-11-10T22:00:00Z", ActivityPolicy.Text(current["times"]!["playEnd"]!["instantUtc"]));
            Assert.Equal("source-default", ActivityPolicy.Text(current["times"]!["playEnd"]!["timeBasis"]));
            Assert.Equal("gacha-other", ActivityPolicy.Text(current["category"]));
        }
        var arsenal = new OfficialNotice("「幽寒申领」限时特卖说明", "· 开放时间：「雪凇幽梦」版本更新后开启，于3次「特许寻访」后结束（从「冬猎」起计算）\n每申领1次，可随机获得武器。", "https://endfield.hypergryph.com/news/5989", "zh-CN");
        var weapon = Assert.Single(OfficialGachaParser.Parse(GameSources.Resolve("arknights-endfield", "default"), arsenal, "official:test"));
        Assert.Equal("于3次「特许寻访」后结束（从「冬猎」起计算）", ActivityPolicy.Text(weapon["times"]!["playEnd"]!["rawValue"]));
        Assert.Null(weapon["times"]!["playEnd"]!["instantUtc"]);
    }
}
