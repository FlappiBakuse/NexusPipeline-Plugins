using System.Net;
using System.Text.Json.Nodes;
using NexusPipeline.Plugin.Abstractions;
using NexusPipeline.Plugin.TestKit;
using Xunit;

namespace NexusPipeline.Plugin.GameActivities.Tests;

public sealed class SraRefreshTests
{
    private static readonly GameSource China = GameSources.Resolve("blue-archive", "cn");
    private static HttpResponseMessage Index(bool jp = false, bool image = false) => new(HttpStatusCode.OK) { Content = new StringContent(ActivityNormalizer.Object(new { version = "1.0", versionName = "Controlled version", startTime = "2030-10-01T10:00:00", endTime = "2030-11-01T10:00:00", activities = new[] { new { name = "Controlled activity", description = "Unmodified description.", startTime = "2030-10-01T10:00:00", endTime = "2030-11-01T10:00:00", cover = image ? "https://resource.starrailassistant.top/controlled.png" : "" } } }).ToJsonString()) };
    private static HttpResponseMessage Image(int value) { var response = new HttpResponseMessage(HttpStatusCode.OK) { Content = new ByteArrayContent([137,80,78,71,13,10,26,10,(byte)value]) }; response.Content.Headers.ContentType = new("image/png"); return response; }
    private static async Task<JsonObject> Done(ActivityCoordinator service, string id)
    {
        using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(10));
        while (true) { var value = await service.OperationAsync(id, timeout.Token); if (ActivityPolicy.Text(value["status"]) is not ("queued" or "running")) return value; await Task.Delay(10, timeout.Token); }
    }
    [Fact]
    public async Task SelectionChangeCancelsOldWorkAndManualOperationCoversTheNewSelection()
    {
        var inner = new FakePluginHostContext(); var entered = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously); var cancelled = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        await inner.Config.WriteAsync(new ActivitySettingsState(0, new() { SelectedGames = ["blue-archive"] }));
        var http = new Factory(async (request, ct) =>
        {
            if (request.RequestUri!.AbsolutePath.EndsWith("/ba-cn.json")) { entered.TrySetResult(); try { await Task.Delay(Timeout.InfiniteTimeSpan, ct); } catch (OperationCanceledException) { cancelled.TrySetResult(); throw; } }
            return Index(true);
        });
        var service = new ActivityCoordinator(new Context(inner, http)); await service.InitializeAsync(default);
        try
        {
            var old = await service.QueueAsync(false, default); await entered.Task.WaitAsync(TimeSpan.FromSeconds(5));
            await service.SettingsAsync(0, new() { SelectedGames = ["blue-archive"], Progressions = new() { ["blue-archive"] = "jp", ["neverness-to-everness"] = "cn" } }, default);
            var manual = await service.QueueAsync(true, default); await cancelled.Task.WaitAsync(TimeSpan.FromSeconds(5));
            var done = await Done(service, ActivityPolicy.Text(manual["operationId"])); Assert.Equal(1, done["checkedFeedCount"]!.GetValue<int>()); Assert.Equal(0, done["failedFeedCount"]!.GetValue<int>());
            Assert.NotEqual(ActivityPolicy.Text(old["operationId"]), ActivityPolicy.Text(manual["operationId"]));
            Assert.Null(await service.FeedAsync(China, China.Locale, default)); Assert.NotNull(await service.FeedAsync(GameSources.Resolve("blue-archive", "jp"), "zh-CN", default));
        }
        finally { await service.StopAsync(default); }
    }
    [Fact]
    public async Task CarouselTimingChangeDoesNotCancelSourceWork()
    {
        var inner = new FakePluginHostContext(); var entered = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously); var release = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        await inner.Config.WriteAsync(new ActivitySettingsState(0, new() { SelectedGames = ["blue-archive"] }));
        bool cancelled = false;
        var service = new ActivityCoordinator(new Context(inner, new Factory(async (_, ct) => { entered.TrySetResult(); try { await release.Task.WaitAsync(ct); } catch (OperationCanceledException) { cancelled = true; throw; } return Index(); })));
        await service.InitializeAsync(default);
        try
        {
            var operation = await service.QueueAsync(false, default); await entered.Task.WaitAsync(TimeSpan.FromSeconds(5));
            await service.SettingsAsync(0, new() { SelectedGames = ["blue-archive"], CarouselIntervalSeconds = 90 }, default); release.TrySetResult();
            Assert.Equal("succeeded", ActivityPolicy.Text((await Done(service, ActivityPolicy.Text(operation["operationId"]))) ["status"])); Assert.False(cancelled);
        }
        finally { release.TrySetResult(); await service.StopAsync(default); }
    }
    [Fact]
    public async Task TextPublishesBeforeSlowImagesAndImageOnlyUpdatesChangeTheSnapshot()
    {
        var inner = new FakePluginHostContext(); var entered = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously); var release = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        await inner.Config.WriteAsync(new ActivitySettingsState(0, new() { SelectedGames = ["blue-archive"] }));
        var service = new ActivityCoordinator(new Context(inner, new Factory(async (request, ct) => { if (request.RequestUri!.Host != "starrailassistant.top") { entered.TrySetResult(); await release.Task.WaitAsync(ct); return Image(1); } return Index(image: true); })));
        await service.InitializeAsync(default);
        try
        {
            var operation = await service.QueueAsync(true, default); await entered.Task.WaitAsync(TimeSpan.FromSeconds(5));
            var text = (await service.FeedAsync(China, China.Locale, default))!; Assert.Single(text["activities"]!.AsArray()); Assert.Null(text["activities"]![0]!["cover"]!["assetId"]);
            Assert.Equal("running", ActivityPolicy.Text((await service.OperationAsync(ActivityPolicy.Text(operation["operationId"]), default))["status"]));
            release.TrySetResult(); var done = await Done(service, ActivityPolicy.Text(operation["operationId"])); Assert.Equal(0, done["failedFeedCount"]!.GetValue<int>());
            var illustrated = (await service.FeedAsync(China, China.Locale, default))!; Assert.NotNull(illustrated["activities"]![0]!["cover"]!["assetId"]);
            Assert.NotEqual(ActivityPolicy.Text(text["snapshotId"]), ActivityPolicy.Text(illustrated["snapshotId"]));
        }
        finally { release.TrySetResult(); await service.StopAsync(default); }
    }
    [Fact]
    public async Task SameUrlWithoutStrongValidatorRehashesAndInvalidImagesKeepLastGood()
    {
        var inner = new FakePluginHostContext(); int response = 1, requests = 0, failed = 0;
        var feed = ActivityNormalizer.BuildSra(China, ActivityNormalizer.Object(new { version = "1.0", versionName = "Controlled version", startTime = "2030-10-01T10:00:00", endTime = "2030-11-01T10:00:00", activities = new[] { new { name = "Controlled activity", description = "Unmodified description.", startTime = "2030-10-01T10:00:00", endTime = "2030-11-01T10:00:00", cover = "https://resource.starrailassistant.top/controlled.png" } } }), DateTimeOffset.UtcNow);
        var factory = new Factory((request, _) => { requests++; Assert.Empty(request.Headers.IfNoneMatch); var message = response == 3 ? new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent("<html>not an image</html>") } : Image(response); message.Headers.ETag = new("\"semantic\"", true); return Task.FromResult(message); });
        async Task Cache() => await new ActivityAssetCache(new ActivityHttp(factory), inner.Assets, inner.ScopedData).CacheAsync(feed, China, true, default,
            (_, _, id) => { feed["activities"]![0]!["cover"]!["assetId"] = id; return Task.CompletedTask; }, _ => failed++);
        await Cache(); string first = ActivityPolicy.Text(feed["activities"]![0]!["cover"]!["assetId"]); response = 2; await Cache();
        string second = ActivityPolicy.Text(feed["activities"]![0]!["cover"]!["assetId"]); Assert.NotEqual(first, second); response = 3; await Cache();
        Assert.Equal(second, ActivityPolicy.Text(feed["activities"]![0]!["cover"]!["assetId"])); Assert.Equal(1, failed); Assert.Equal(3, requests);
        Assert.Empty(await inner.Assets.ListAsync("activity"));
    }
    [Fact]
    public async Task ManualJoinPromotesPartialAutomaticWorkToAllSavedSubscriptions()
    {
        var inner = new FakePluginHostContext(); var clock = new Clock(DateTimeOffset.Parse("2030-10-01T00:00:00Z"));
        await inner.Config.WriteAsync(new ActivitySettingsState(0, new() { SelectedGames = ["blue-archive", "stella-sora"] }));
        var stella = GameSources.Resolve("stella-sora", "default");
        HttpResponseMessage Reply(HttpRequestMessage r) => Index();
        var initial = new ActivityCoordinator(new Context(inner, new Factory((r, _) => Task.FromResult(Reply(r)))), clock); await initial.InitializeAsync(default);
        await Done(initial, ActivityPolicy.Text((await initial.QueueAsync(false, default))["operationId"])); await initial.StopAsync(default);
        var chinaFeed = (await inner.ScopedData.ReadJsonAsync(ActivityCoordinator.Scope(China, "merged")))!;
        chinaFeed["health"]!["nextCheckAt"] = ActivityNormalizer.Utc(clock.Now.AddSeconds(-1));
        await inner.ScopedData.WriteJsonAsync(ActivityCoordinator.Scope(China, "merged"), chinaFeed);
        var entered = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously); var release = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously); int chinaRequests = 0, stellaLists = 0;
        var service = new ActivityCoordinator(new Context(inner, new Factory(async (r, ct) =>
        {
            if (r.RequestUri!.AbsolutePath.EndsWith("/ba-cn.json")) { Interlocked.Increment(ref chinaRequests); entered.TrySetResult(); await release.Task.WaitAsync(ct); }
            else if (r.RequestUri == stella.Endpoint) Interlocked.Increment(ref stellaLists);
            return Reply(r);
        })), clock); await service.InitializeAsync(default);
        try
        {
            var automatic = await service.QueueAsync(false, default); await entered.Task.WaitAsync(TimeSpan.FromSeconds(5));
            Assert.Equal(0, stellaLists); var manual = await service.QueueAsync(true, default);
            Assert.True(manual["joinedExisting"]!.GetValue<bool>()); Assert.Equal(ActivityPolicy.Text(automatic["operationId"]), ActivityPolicy.Text(manual["operationId"]));
            release.TrySetResult(); var done = await Done(service, ActivityPolicy.Text(manual["operationId"]));
            Assert.Equal(2, done["checkedFeedCount"]!.GetValue<int>()); Assert.Equal(0, done["failedFeedCount"]!.GetValue<int>()); Assert.Equal(1, stellaLists); Assert.Equal(2, chinaRequests);
        }
        finally { release.TrySetResult(); await service.StopAsync(default); }
    }
    [Fact]
    public async Task EndTimeTriggersOneBoundaryCheckAndFailureBackoff()
    {
        var inner = new FakePluginHostContext(); var clock = new Clock(DateTimeOffset.Parse("2030-10-01T00:00:00Z"));
        await inner.Config.WriteAsync(new ActivitySettingsState(0, new() { SelectedGames = ["blue-archive"] }));
        inner.Http.ResponseFactory = _ => Index(); var initial = new ActivityCoordinator(inner, clock); await initial.InitializeAsync(default);
        await Done(initial, ActivityPolicy.Text((await initial.QueueAsync(false, default))["operationId"])); var saved = (await initial.FeedAsync(China, China.Locale, default))!; await initial.StopAsync(default);
        var point = saved["activities"]![0]!["times"]!["playEnd"]!; point["instantUtc"] = "2030-10-01T01:00:00Z"; saved["activities"]![0]!["times"]!["start"]!["instantUtc"] = "2030-09-01T00:00:00Z";
        saved["health"]!["nextCheckAt"] = "2030-10-01T06:00:00Z"; await inner.ScopedData.WriteJsonAsync(ActivityCoordinator.Scope(China, "merged"), saved);
        clock.Now = DateTimeOffset.Parse("2030-10-01T01:01:00Z"); int requests = 0;
        inner.Http.ResponseFactory = _ => { requests++; return new(HttpStatusCode.ServiceUnavailable); };
        var service = new ActivityCoordinator(inner, clock); await service.InitializeAsync(default);
        try
        {
            Assert.Equal("ended", ActivityPolicy.Status(saved["activities"]![0]!, clock.Now));
            var checkedOnce = await Done(service, ActivityPolicy.Text((await service.QueueAsync(false, default))["operationId"])); Assert.Equal(1, checkedOnce["checkedFeedCount"]!.GetValue<int>());
            Assert.Equal(1, requests); Assert.NotEmpty((await inner.ScopedData.ReadJsonAsync("sra/v3/boundary-checks"))!);
            await Done(service, ActivityPolicy.Text((await service.QueueAsync(false, default))["operationId"])); Assert.Equal(1, requests);
            Assert.Equal("ended", ActivityPolicy.Status((await service.FeedAsync(China, China.Locale, default))!["activities"]![0]!, clock.Now));
        }
        finally { await service.StopAsync(default); }
    }
    private sealed class Clock(DateTimeOffset now) : TimeProvider
    {
        public DateTimeOffset Now = now;
        public override DateTimeOffset GetUtcNow() => Now;
    }
    private sealed class Factory(Func<HttpRequestMessage, CancellationToken, Task<HttpResponseMessage>> send) : IPluginHttpClientFactory
    {
        private sealed class Handler(Func<HttpRequestMessage, CancellationToken, Task<HttpResponseMessage>> send) : HttpMessageHandler
        { protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct) => send(request, ct); }
        public HttpClient CreateClient(Uri? destination = null, TimeSpan? timeout = null, bool allowAutoRedirect = false) => new(new Handler(send)) { Timeout = timeout ?? TimeSpan.FromSeconds(30) };
    }
    private sealed class Context(FakePluginHostContext inner, IPluginHttpClientFactory http) : IPluginHostContext
    {
        public string PluginName => inner.PluginName;
        public IPluginLogger Logger => inner.Logger;
        public IPluginConfigStore Config => inner.Config;
        public IPluginSecretStore Secrets => inner.Secrets;
        public IPluginNotificationService Notifications => inner.Notifications;
        public IPluginJobScheduler Scheduler => inner.Scheduler;
        public IPluginUserDataStore UserData => inner.UserData;
        public IPluginUserGlobalManagementRegistry UserGlobalManagement => inner.UserGlobalManagement;
        public IPluginExecutionEventService ExecutionEvents => inner.ExecutionEvents;
        public IPluginHttpClientFactory Http => http;
        public IPluginUserListBadgeRegistry UserListBadges => inner.UserListBadges;
        public IPluginUiContributionRegistry Ui => inner.Ui;
        public IPluginScopedDataStore ScopedData => inner.ScopedData;
        public IPluginWebApiRegistry WebApi => inner.WebApi;
        public IPluginHistoryContributionRegistry History => inner.History;
        public IPluginLocalization I18n => inner.I18n;
        public IPluginAssetStore Assets => inner.Assets;
        public IPluginEmulatorSupportRegistry EmulatorSupport => inner.EmulatorSupport;
        public IPluginExecutionProviderRegistry ExecutionProviders => inner.ExecutionProviders;
        public IPluginDashboardCardRegistry DashboardCards => inner.DashboardCards;
        public IPluginBrowserLoginRegistry BrowserLogin => inner.BrowserLogin;
    }
}
