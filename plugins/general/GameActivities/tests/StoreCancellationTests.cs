using System.Net;
using System.Text.Json.Nodes;
using NexusPipeline.Plugin.Abstractions;
using NexusPipeline.Plugin.TestKit;
using Xunit;

namespace NexusPipeline.Plugin.GameActivities.Tests;

public sealed class StoreCancellationTests
{
    private const string Root = "sra/v3/blue-archive/cn/zh-CN/";
    private static readonly GameSource Source = GameSources.Resolve("blue-archive", "cn");
    private static string Raw() => ActivityNormalizer.Object(new { version = "1.0", versionName = "Controlled version", startTime = "2030-10-01T10:00:00", endTime = "2030-11-01T10:00:00", activities = new[] { new { name = "Controlled activity", description = "Unmodified description.", startTime = "2030-10-01T10:00:00", endTime = "2030-11-01T10:00:00", cover = "" } } }).ToJsonString();
    private static JsonObject Feed(DateTimeOffset now) => ActivityNormalizer.BuildSra(Source, JsonNode.Parse(Raw())!.AsObject(), now);

    [Fact]
    public async Task StopCancelsBeforeAtomicSnapshotWriteAndCompletesWithoutWaitingForTheGate()
    {
        var inner = new FakePluginHostContext(); var store = new WaitingStore(inner.ScopedData, scope => scope == Root + "merged");
        inner.Http.ResponseFactory = _ => new(HttpStatusCode.OK) { Content = new StringContent(Raw()) };
        await inner.Config.WriteAsync(new ActivitySettingsState(0, new() { SelectedGames = ["blue-archive"] }));
        var service = new ActivityCoordinator(new Context(inner, store)); await service.InitializeAsync(default);
        var operation = await service.QueueAsync(true, default);
        await store.Entered.Task.WaitAsync(TimeSpan.FromSeconds(5));
        await service.StopAsync(default).WaitAsync(TimeSpan.FromSeconds(5));
        await service.StopAsync(default);
        Assert.Equal("cancelled", ActivityPolicy.Text((await service.OperationAsync(ActivityPolicy.Text(operation["operationId"]), default))["status"]));
        Assert.False(inner.ScopedData.Contains(Root + "merged"));
        Assert.Equal(1, store.CancelledWrites);
    }



    [Fact]
    public Task SnapshotAccessFailureKeepsLastGoodAndRecoversAfterRestart()
        => DiskFailure(Root + "merged", new UnauthorizedAccessException("replacement denied"));

    [Fact]
    public Task FailedMergedWriteStillMarksMemoryStaleWhenFailureHealthCannotBePersisted()
        => DiskFailure(Root + "merged", new IOException("disk write failed"));

    private static async Task DiskFailure(string scope, Exception error)
    {
        var inner = new FakePluginHostContext(); var raw = Raw();
        await inner.Config.WriteAsync(new ActivitySettingsState(0, new() { SelectedGames = ["blue-archive"] }));
        await inner.ScopedData.WriteJsonAsync(Root + "merged", Feed(DateTimeOffset.UtcNow));
        inner.Http.ResponseFactory = _ => new(HttpStatusCode.OK) { Content = new StringContent(raw) };
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
        public async ValueTask WriteAsync<T>(string scope, T value, CancellationToken ct = default)
        {
            if (wait(scope)) { Entered.TrySetResult(); try { await Task.Delay(Timeout.InfiniteTimeSpan, ct); } catch (OperationCanceledException) { CancelledWrites++; throw; } }
            await inner.WriteAsync(scope, value, ct);
        }
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
