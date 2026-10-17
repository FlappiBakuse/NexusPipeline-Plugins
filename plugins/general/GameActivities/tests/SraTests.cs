using System.Net;
using System.Text.Json.Nodes;
using NexusPipeline.Plugin.TestKit;
using Xunit;

namespace NexusPipeline.Plugin.GameActivities.Tests;

public sealed class SraTests
{
    private static readonly GameSource Source = GameSources.Resolve("blue-archive", "cn");
    private static readonly DateTimeOffset Now = DateTimeOffset.Parse("2030-10-10T00:00:00Z");
    private static JsonObject Raw() => JsonNode.Parse("""
        {"version":"1.0","versionName":"Version","startTime":"2030-10-01T10:00:00","endTime":"2030-10-31T10:00:00",
         "activities":[{"name":"Activity","description":"Original description.\nSecond line.","kind":"Story","startTime":"2030-09-01T10:00:00","endTime":"2030-11-01T10:00:00"}],
         "gacha":[{"name":"Not an activity"}]}
        """)!.AsObject();
    private static async Task<JsonObject> Done(ActivityCoordinator service, bool manual = true)
    {
        string id = ActivityPolicy.Text((await service.QueueAsync(manual, default))["operationId"]);
        using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(5));
        while (true)
        {
            var operation = await service.OperationAsync(id, timeout.Token);
            if (ActivityPolicy.Text(operation["status"]) is not ("queued" or "running")) return operation;
            await Task.Delay(10, timeout.Token);
        }
    }
    [Fact]
    public async Task ElevenProfilesUseOnlyTheirOwnSraEndpoint()
    {
        Assert.Equal(11, GameSources.All.Length);
        Assert.Equal(8, GameSources.All.Select(s => s.GameId).Distinct().Count());
        Assert.Equal(11, GameSources.All.Select(s => s.Endpoint).Distinct().Count());
        foreach (var source in GameSources.All)
        {
            var context = new FakePluginHostContext();
            context.Http.ResponseFactory = request => { Assert.Equal(source.Endpoint, request.RequestUri); Assert.Equal(HttpMethod.Get, request.Method); return new(HttpStatusCode.OK) { Content = new StringContent(Raw().ToJsonString()) }; };
            var raw = await new SraActivityProvider(new ActivityHttp(context.Http)).ReadAsync(source, default);
            var feed = ActivityNormalizer.BuildSra(source, raw, Now);
            Assert.Equal(source.Locale, ActivityPolicy.Text(feed["contentLocale"])); Assert.Single(feed["activities"]!.AsArray());
            Assert.Single(context.Http.Requests);
        }
        Assert.Equal("en-US", GameSources.Resolve("neverness-to-everness", "global").Locale);
        Assert.Equal("zh-CN", GameSources.Resolve("blue-archive", "global").Locale);
    }
    [Theory]
    [InlineData("2030-10-01T10:00:00", "2030-10-01T02:00:00Z")]
    [InlineData("2030-10-01T10:00:00+09:00", "2030-10-01T01:00:00Z")]
    [InlineData("2030-10-01T10:00Z", "2030-10-01T10:00:00Z")]
    [InlineData("2030-10-01", null)]
    [InlineData("2030-02-30T10:00:00", null)]
    [InlineData("after maintenance", null)]
    public void TimeUsesSourceClockWithoutInventingDates(string raw, string? expected)
    {
        var point = ActivityNormalizer.Time(raw);
        Assert.Equal(raw, ActivityPolicy.Text(point?["rawValue"]));
        Assert.Equal(expected is null ? null : DateTimeOffset.Parse(expected), ActivityPolicy.Instant(point));
    }
    [Fact]
    public void MappingKeepsDescriptionAndCrossVersionActivitiesWithoutGacha()
    {
        var feed = ActivityNormalizer.BuildSra(Source, Raw(), Now); var item = Assert.Single(feed["activities"]!.AsArray())!;
        Assert.Equal("Original description.\nSecond line.", ActivityPolicy.Text(item["summary"]));
        Assert.Equal("Story", ActivityPolicy.Text(item["kind"]));
        Assert.True(ActivityPolicy.Instant(item["times"]?["start"]) < ActivityPolicy.Instant(feed["overview"]?["start"]));
        Assert.True(ActivityPolicy.Instant(item["times"]?["playEnd"]) > ActivityPolicy.Instant(feed["overview"]?["end"]));
        Assert.Null(feed["gacha"]); Assert.Null(feed["coverage"]); Assert.Null(item["officialUrl"]);
    }
    [Fact]
    public void IdentitySurvivesDescriptionAndEndRevisionAndKeepsDuplicateOccurrences()
    {
        var raw = Raw(); raw["activities"]!.AsArray().Add(raw["activities"]![0]!.DeepClone());
        var before = ActivityNormalizer.BuildSra(Source, raw, Now);
        raw["activities"]![0]!["description"] = "New description"; raw["activities"]![0]!["endTime"] = "2030-12-01T00:00:00";
        var after = ActivityNormalizer.BuildSra(Source, raw, Now);
        Assert.Equal(ActivityPolicy.Text(before["activities"]![0]!["eventId"]), ActivityPolicy.Text(after["activities"]![0]!["eventId"]));
        Assert.NotEqual(ActivityPolicy.Text(after["activities"]![0]!["eventId"]), ActivityPolicy.Text(after["activities"]![1]!["eventId"]));
        Assert.NotEqual(ActivityPolicy.Text(before["snapshotId"]), ActivityPolicy.Text(after["snapshotId"]));
        Assert.Equal(ActivityPolicy.Text(after["snapshotId"]), ActivityPolicy.Text(ActivityNormalizer.BuildSra(Source, raw, Now.AddHours(1))["snapshotId"]));
    }
    [Fact]
    public void MissingAndContradictoryTimesRemainUnknown()
    {
        var raw = Raw(); raw["activities"]![0]!["startTime"] = null; raw["activities"]![0]!["endTime"] = "invalid";
        var feed = ActivityNormalizer.BuildSra(Source, raw, Now); Assert.Equal("unknown", ActivityPolicy.Status(feed["activities"]![0]!, Now));
        raw["activities"]![0]!["startTime"] = "2030-12-01T00:00:00"; raw["activities"]![0]!["endTime"] = "2030-11-01T00:00:00";
        Assert.Equal("unknown", ActivityPolicy.Status(ActivityNormalizer.BuildSra(Source, raw, Now)["activities"]![0]!, Now));
    }
    [Fact]
    public async Task SuccessfulEmptySnapshotReplacesOldItemsAndSurvivesRestart()
    {
        var context = new FakePluginHostContext(); var raw = Raw(); var clock = new Clock(Now);
        await context.Config.WriteAsync(new ActivitySettingsState(0, new() { SelectedGames = ["blue-archive"] }));
        context.Http.ResponseFactory = _ => new(HttpStatusCode.OK) { Content = new StringContent(raw.ToJsonString()) };
        var service = new ActivityCoordinator(context, clock); await service.InitializeAsync(default);
        try
        {
            await Done(service); Assert.Single((await service.FeedAsync(Source, Source.Locale, default))!["activities"]!.AsArray());
            raw["activities"] = new JsonArray(); clock.Now = Now.AddMinutes(2); await Done(service);
            Assert.Empty((await service.FeedAsync(Source, Source.Locale, default))!["activities"]!.AsArray());
        }
        finally { await service.StopAsync(default); }
        service = new ActivityCoordinator(context, clock); await service.InitializeAsync(default);
        try { Assert.Empty((await service.FeedAsync(Source, Source.Locale, default))!["activities"]!.AsArray()); }
        finally { await service.StopAsync(default); }
    }
    [Theory]
    [InlineData("{}")]
    [InlineData("{\"version\":\"1\",\"activities\":null}")]
    [InlineData("{\"version\":\"1\",\"activities\":[{}]}")]
    [InlineData("<html>verification</html>")]
    public async Task InvalidResponsesKeepLastGood(string response)
    {
        var context = new FakePluginHostContext(); var clock = new Clock(Now);
        await context.Config.WriteAsync(new ActivitySettingsState(0, new() { SelectedGames = ["blue-archive"] }));
        var saved = ActivityNormalizer.BuildSra(Source, Raw(), Now);
        await context.ScopedData.WriteJsonAsync(ActivityCoordinator.Scope(Source,"merged"), saved);
        context.Http.ResponseFactory = _ => new(HttpStatusCode.OK) { Content = new StringContent(response) };
        var service = new ActivityCoordinator(context, clock); await service.InitializeAsync(default);
        try
        {
            Assert.Equal("failed", ActivityPolicy.Text((await Done(service))["status"]));
            var feed = (await service.FeedAsync(Source, Source.Locale, default))!;
            Assert.Equal(ActivityPolicy.Text(saved["snapshotId"]), ActivityPolicy.Text(feed["snapshotId"]));
            Assert.Equal("stale", ActivityPolicy.Text(feed["health"]!["cacheState"]));
        }
        finally { await service.StopAsync(default); }
    }
    [Fact]
    public async Task LegacyDataIsUntouchedAndFailedSourceDoesNotBlockAnother()
    {
        var context = new FakePluginHostContext(); var old = new JsonObject { ["unknown-user-field"] = 42 };
        const string legacy = "official/v2/blue-archive/cn/zh-CN/merged";
        const string ledger = "feed/blue-archive/cn/zh-CN/withdrawals/v1";
        await context.ScopedData.WriteJsonAsync(legacy, old); await context.ScopedData.WriteJsonAsync(ledger, old);
        await context.Config.WriteAsync(new ActivitySettingsState(0,new() { SelectedGames = ["blue-archive","stella-sora"] }));
        context.Http.ResponseFactory = request => request.RequestUri == Source.Endpoint ? new(HttpStatusCode.ServiceUnavailable) : new(HttpStatusCode.OK) { Content = new StringContent(Raw().ToJsonString()) };
        var service = new ActivityCoordinator(context); await service.InitializeAsync(default);
        try
        {
            Assert.Null(await service.FeedAsync(Source, Source.Locale, default));
            Assert.Equal("partial", ActivityPolicy.Text((await Done(service))["status"]));
            Assert.NotNull(await service.FeedAsync(GameSources.Resolve("stella-sora","default"),"zh-CN",default));
            var state = await service.StateAsync(default);
            var failedHealth = state["selectedFeeds"]!.AsArray().Single(f => ActivityPolicy.Text(f?["gameId"]) == Source.GameId)!["health"]!;
            Assert.Equal("empty", ActivityPolicy.Text(failedHealth["cacheState"]));
            Assert.Single(failedHealth["diagnostics"]!.AsArray());
            Assert.True(JsonNode.DeepEquals(old,await context.ScopedData.ReadJsonAsync(legacy)));
            Assert.True(JsonNode.DeepEquals(old,await context.ScopedData.ReadJsonAsync(ledger)));
            Assert.All(context.Http.Requests,r=>Assert.Equal("starrailassistant.top",r.RequestUri!.Host));
        }
        finally { await service.StopAsync(default); }
    }
    [Fact]
    public async Task ManualRateLimitAndSettingsCasRemainEnforced()
    {
        var context = new FakePluginHostContext(); await context.Config.WriteAsync(new ActivitySettingsState(0,new(){ SelectedGames=["blue-archive"] }));
        context.Http.ResponseFactory = _ => new(HttpStatusCode.OK) { Content = new StringContent(Raw().ToJsonString()) };
        var service=new ActivityCoordinator(context,new Clock(Now));await service.InitializeAsync(default);
        try
        {
            string[] order = GameSources.All.Select(source => source.GameId).Distinct().Reverse().ToArray();
            await service.SettingsAsync(0, new() { SelectedGames = ["blue-archive"], GameOrder = order }, default);
            var saved = await context.Config.ReadAsync<ActivitySettingsState>();
            Assert.Equal(order, saved!.Settings.GameOrder);
            Assert.Equal(new[] { "blue-archive" }, saved.Settings.SelectedGames);
            Assert.Throws<ActivityException>(() => GameSources.Validate(saved.Settings with { GameOrder = ["blue-archive"] }));
            var reopened = new ActivityCoordinator(context, new Clock(Now));
            await reopened.InitializeAsync(default);
            try { Assert.Equal(order, (await reopened.StateAsync(default))["settings"]!["gameOrder"]!.AsArray().Select(node => node!.GetValue<string>())); }
            finally { await reopened.StopAsync(default); }
            await Done(service);
            Assert.Equal("refresh_rate_limited",(await Assert.ThrowsAsync<ActivityException>(()=>service.QueueAsync(true,default))).Code);
            Assert.Equal("settings_conflict",(await Assert.ThrowsAsync<ActivityException>(()=>service.SettingsAsync(9,new(),default))).Code);
        }
        finally { await service.StopAsync(default); }
    }
    [Fact]

    public async Task LifecycleStopReleasesCardRoutesAndScheduler()

    {

        var context=new FakePluginHostContext();var plugin=new EntryPoint();await plugin.InitializeAsync(context,default);await plugin.StartAsync(default);

        Assert.Single(context.DashboardCards.Cards);await plugin.StopAsync(default);Assert.Empty(context.DashboardCards.Cards);Assert.Empty(context.WebApi.Routes);Assert.Empty(context.Scheduler.Definitions);

    }
    private sealed class Clock(DateTimeOffset now) : TimeProvider { public DateTimeOffset Now=now;public override DateTimeOffset GetUtcNow()=>Now; }
}
