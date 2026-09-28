using System.Text.Json.Nodes;
using NexusPipeline.Plugin.Abstractions;
using NexusPipeline.Plugin.CustomWallpaper;
using NexusPipeline.Plugin.TestKit;
using Xunit;

namespace NexusPipeline.Plugin.CustomWallpaper.Tests;

public sealed class CustomWallpaperConformanceTests
{
    [Fact]
    public async Task Lifecycle_RegistersWebApiAndStopIsIdempotent()
    {
        await using PluginLifecycleHarness harness = await PluginLifecycleHarness.StartAsync(
            new EntryPoint(),
            new FakePluginHostContext("CustomWallpaper"));

        Assert.True(harness.Started);
        Assert.Equal("CustomWallpaper", harness.Context.PluginName);
        // Web 会话轮换通过明确的插件 API 推进，插件启动生命周期不触发随机轮换。
        Assert.Equal(
            new[]
            {
                "GET asset",
                "GET state",
                "POST assets",
                "POST assets/delete",
                "POST rotation/advance-session",
                "PUT assets/palette",
                "PUT settings",
            },
            harness.Context.WebApi.Routes
                .Select(route => $"{route.Method} {route.Route}")
                .OrderBy(value => value, StringComparer.Ordinal));

        await harness.StopAsync();
        await harness.StopAsync();
        Assert.True(harness.Stopped);
        Assert.Empty(harness.Context.WebApi.Routes);
    }

    [Fact]
    public async Task Lifecycle_RequiresThePluginAssetPort()
    {
        var legacy = new LegacyHostContext();
        EntryPoint plugin = new();

        await Assert.ThrowsAsync<NotSupportedException>(() =>
            plugin.InitializeAsync(legacy, CancellationToken.None).AsTask());
    }

    /// <summary>只实现到 v1.3 的宿主上下文，用于验证插件在缺少资产端口时明确拒绝初始化。</summary>
    private sealed class LegacyHostContext : IPluginHostContextV1_3
    {
        public string PluginName => "legacy-host";

        public IPluginLogger Logger { get; } = new RecordingPluginLogger();

        public IPluginConfigStore Config { get; } = new InMemoryPluginConfigStore();

        public IPluginSecretStore Secrets { get; } = new InMemoryPluginSecretStore();

        public IPluginNotificationService Notifications { get; } = new RecordingPluginNotificationService();

        public IPluginJobScheduler Scheduler { get; } = new RecordingPluginJobScheduler();

        public IPluginUserDataStore UserData { get; } = new InMemoryPluginUserDataStore();

        public IPluginUserGlobalManagementRegistry UserGlobalManagement { get; } = new RecordingPluginUserGlobalRegistry();

        public IPluginExecutionEventService ExecutionEvents { get; } = new RecordingPluginExecutionEvents();

        public IPluginHttpClientFactory Http { get; } = new RecordingPluginHttpClientFactory();

        public IPluginUserListBadgeRegistry UserListBadges { get; } = new RecordingPluginUserBadgeRegistry();

        public IPluginUiContributionRegistry Ui { get; } = new RecordingPluginUiRegistry();

        public IPluginScopedDataStore ScopedData { get; } = new InMemoryPluginScopedDataStore();

        public IPluginWebApiRegistry WebApi { get; } = new RecordingPluginWebApiRegistry();

        public IPluginHistoryContributionRegistry History { get; } = new RecordingPluginHistoryRegistry();
    }
}
