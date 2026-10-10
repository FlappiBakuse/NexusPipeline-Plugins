using System.Net;
using System.Text.Json.Nodes;
using NexusPipeline.Plugin.Abstractions;
using NexusPipeline.Plugin.TestKit;
using Xunit;

namespace NexusPipeline.Plugin.GameActivities.Tests;

public sealed class StoreCancellationTests
{
    private const string Root = "feed/blue-archive/cn/zh-CN/";
    private static readonly GameSource Source = GameSources.Resolve("blue-archive", "cn");
    private static JsonObject Raw() => ActivityNormalizer.Object(new
    {
        version = "1.4", activities = new[] { new { name = "限时复刻活动【故事】", startTime = "2026-10-08T14:00:00", endTime = "2026-10-22T14:00:59" } }
    });

    [Fact]
    public async Task StopCancelsBeforeAtomicRawWriteAndCompletesWithoutWaitingForTheGate()
    {
        var inner = new FakePluginHostContext(); var store = new WaitingStore(inner.ScopedData, scope => scope == Root + "sra/v1");
        inner.Http.ResponseFactory = _ => new(HttpStatusCode.OK) { Content = new StringContent(Raw().ToJsonString()) };
        await inner.Config.WriteAsync(new ActivitySettingsState(0, new() { SelectedGames = ["blue-archive"] }));
        var service = new ActivityCoordinator(new Context(inner, store)); await service.InitializeAsync(default);
        var operation = await service.QueueAsync(true, default);
        await store.Entered.Task.WaitAsync(TimeSpan.FromSeconds(5));
        await service.StopAsync(default).WaitAsync(TimeSpan.FromSeconds(5));
        await service.StopAsync(default);
        Assert.Equal("cancelled", ActivityPolicy.Text((await service.OperationAsync(ActivityPolicy.Text(operation["operationId"]), default))["status"]));
        Assert.False(inner.ScopedData.Contains(Root + "sra/v1")); Assert.False(inner.ScopedData.Contains(Root + "merged/v1"));
        Assert.Equal(1, store.CancelledWrites);
    }

    [Fact]
    public async Task WithdrawalLedgerPreventsResurrectionWhenFinalSnapshotWriteIsCancelled()
    {
        var inner = new FakePluginHostContext(); var raw = Raw(); var now = DateTimeOffset.UtcNow;
        const string target = "https://www.bluearchive-cn.com/news/1974";
        var notice = new OfficialNotice("【预告】限时复刻活动：故事", "活动持续时间：10月08日 14:00 ~ 10月22日 13:59", target, "zh-CN", PublishedAt: now);
        var feed = ActivityNormalizer.Normalize(Source, raw, now); OfficialActivityProvider.Merge(feed, new([notice], "partial", "test"), Source, now);
        await inner.Config.WriteAsync(new ActivitySettingsState(0, new() { SelectedGames = ["blue-archive"] }));
        await inner.ScopedData.WriteJsonAsync(Root + "merged/v1", feed);
        await inner.ScopedData.WriteJsonAsync(Root + "sra/v1", ActivityNormalizer.Object(new { raw }));
        await inner.ScopedData.WriteAsync(Root + "official/v4", new { CheckedAt = now.AddHours(-13), Result = new OfficialResult([notice], "partial", "test") });
        inner.Http.ResponseFactory = request => new(HttpStatusCode.OK)
        {
            Content = new StringContent(request.RequestUri!.Host == "starrailassistant.top" ? raw.ToJsonString()
                : ActivityNormalizer.Object(new { code = 0, data = new { rows = new[] { new
                {
                    id = 2000, title = "活动取消公告", content = "<p><a href='" + target + "'>原活动已取消</a></p>", publishTime = now.ToUnixTimeMilliseconds()
                } } } }).ToJsonString())
        };
        var store = new WaitingStore(inner.ScopedData, scope => scope == Root + "merged/v1" && inner.ScopedData.Contains(Root + "withdrawals/v1"));
        var service = new ActivityCoordinator(new Context(inner, store)); await service.InitializeAsync(default);
        await service.QueueAsync(true, default); await store.Entered.Task.WaitAsync(TimeSpan.FromSeconds(5));
        await service.StopAsync(default).WaitAsync(TimeSpan.FromSeconds(5));
        Assert.Single((await inner.ScopedData.ReadJsonAsync(Root + "merged/v1"))!["activities"]!.AsArray());
        Assert.Single((await inner.ScopedData.ReadJsonAsync(Root + "withdrawals/v1"))!["entries"]!.AsArray());
        inner.Http.ResponseFactory = _ => throw new HttpRequestException("offline");
        var reloaded = new ActivityCoordinator(inner); await reloaded.InitializeAsync(default);
        try
        {
            Assert.Empty((await reloaded.FeedAsync(Source, Source.Locale, default))!["activities"]!.AsArray());
            Assert.Equal(1, store.CancelledWrites);
        }
        finally { await reloaded.StopAsync(default); }
    }

    [Fact]
    public Task RawReplacementAccessFailureKeepsLastGoodAndRecoversAfterRestart()
        => DiskFailure(Root + "sra/v1", new UnauthorizedAccessException("replacement denied"));

    [Fact]
    public Task FailedMergedWriteStillMarksMemoryStaleWhenFailureHealthCannotBePersisted()
        => DiskFailure(Root + "merged/v1", new IOException("disk write failed"));

    private static async Task DiskFailure(string scope, Exception error)
    {
        var inner = new FakePluginHostContext(); var raw = Raw();
        await inner.Config.WriteAsync(new ActivitySettingsState(0, new() { SelectedGames = ["blue-archive"] }));
        await inner.ScopedData.WriteJsonAsync(Root + "merged/v1", ActivityNormalizer.Normalize(Source, raw, DateTimeOffset.UtcNow));
        await inner.ScopedData.WriteJsonAsync(Root + "sra/v1", ActivityNormalizer.Object(new { raw }));
        await inner.ScopedData.WriteAsync(Root + "official/v4", new { CheckedAt = DateTimeOffset.UtcNow, Result = new OfficialResult([], "partial", "test") });
        inner.Http.ResponseFactory = _ => new(HttpStatusCode.OK) { Content = new StringContent(raw.ToJsonString()) };
        var store = new FailingStore(inner.ScopedData, scope, error);
        var service = new ActivityCoordinator(new Context(inner, store)); await service.InitializeAsync(default);
        var prior = (await service.FeedAsync(Source, Source.Locale, default))!;
        var disk = await inner.ScopedData.ReadJsonAsync(scope);
        try
        {
            var operation = await service.QueueAsync(true, default); string id = ActivityPolicy.Text(operation["operationId"]);
            using var deadline = new CancellationTokenSource(TimeSpan.FromSeconds(5));
            while (ActivityPolicy.Text((await service.OperationAsync(id, deadline.Token))["status"]) is "queued" or "running") await Task.Delay(10, deadline.Token);
            Assert.Equal("failed", ActivityPolicy.Text((await service.OperationAsync(id, default))["status"]));
            var failed = (await service.FeedAsync(Source, Source.Locale, default))!;
            Assert.Equal("stale", ActivityPolicy.Text(failed["health"]!["cacheState"]));
            Assert.Equal(ActivityPolicy.Text(prior["snapshotId"]), ActivityPolicy.Text(failed["snapshotId"]));
            Assert.Contains(failed["health"]!["diagnostics"]!.AsArray(), row => ActivityPolicy.Text(row?["code"]) == "refresh_failed" && ActivityPolicy.Text(row?["message"]) == error.GetType().Name);
            Assert.True(JsonNode.DeepEquals(disk, await inner.ScopedData.ReadJsonAsync(scope)));
            Assert.True(store.Failures > 0);
        }
        finally { await service.StopAsync(default); }
        service = new ActivityCoordinator(inner); await service.InitializeAsync(default);
        try
        {
            var operation = await service.QueueAsync(true, default); string id = ActivityPolicy.Text(operation["operationId"]);
            using var deadline = new CancellationTokenSource(TimeSpan.FromSeconds(5));
            while (ActivityPolicy.Text((await service.OperationAsync(id, deadline.Token))["status"]) is "queued" or "running") await Task.Delay(10, deadline.Token);
            Assert.Equal("succeeded", ActivityPolicy.Text((await service.OperationAsync(id, default))["status"]));
            Assert.Equal("fresh", ActivityPolicy.Text((await service.FeedAsync(Source, Source.Locale, default))!["health"]!["cacheState"]));
        }
        finally { await service.StopAsync(default); }
    }

    private sealed class FailingStore(IPluginScopedDataStore inner, string target, Exception error) : IPluginScopedDataStore
    {
        public int Failures { get; private set; }
        public ValueTask<T?> ReadAsync<T>(string scope, CancellationToken ct = default) => inner.ReadAsync<T>(scope, ct);
        public ValueTask<JsonObject?> ReadJsonAsync(string scope, CancellationToken ct = default) => inner.ReadJsonAsync(scope, ct);
        public ValueTask WriteAsync<T>(string scope, T value, CancellationToken ct = default)
        {
            ct.ThrowIfCancellationRequested();
            if (scope == target) { Failures++; throw error; }
            return inner.WriteAsync(scope, value, ct);
        }
        public ValueTask WriteJsonAsync(string scope, JsonObject value, CancellationToken ct = default) => WriteAsync(scope, value, ct);
        public ValueTask DeleteAsync(string scope, CancellationToken ct = default) => inner.DeleteAsync(scope, ct);
    }

    private sealed class WaitingStore(IPluginScopedDataStore inner, Func<string, bool> wait) : IPluginScopedDataStore
    {
        public TaskCompletionSource Entered { get; } = new(TaskCreationOptions.RunContinuationsAsynchronously);
        public int CancelledWrites { get; private set; }
        public ValueTask<T?> ReadAsync<T>(string scope, CancellationToken ct = default) => inner.ReadAsync<T>(scope, ct);
        public ValueTask<JsonObject?> ReadJsonAsync(string scope, CancellationToken ct = default) => inner.ReadJsonAsync(scope, ct);
        public ValueTask WriteAsync<T>(string scope, T value, CancellationToken ct = default) => inner.WriteAsync(scope, value, ct);
        public ValueTask DeleteAsync(string scope, CancellationToken ct = default) => inner.DeleteAsync(scope, ct);
        public async ValueTask WriteJsonAsync(string scope, JsonObject value, CancellationToken ct = default)
        {
            if (wait(scope))
            {
                Entered.TrySetResult();
                try { await Task.Delay(Timeout.InfiniteTimeSpan, ct); }
                catch (OperationCanceledException) { CancelledWrites++; throw; }
            }
            await inner.WriteJsonAsync(scope, value, ct);
        }
    }

    private sealed class Context(IPluginHostContext inner, IPluginScopedDataStore store) : IPluginHostContext
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
        public IPluginHttpClientFactory Http => inner.Http;
        public IPluginUserListBadgeRegistry UserListBadges => inner.UserListBadges;
        public IPluginUiContributionRegistry Ui => inner.Ui;
        public IPluginScopedDataStore ScopedData => store;
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
