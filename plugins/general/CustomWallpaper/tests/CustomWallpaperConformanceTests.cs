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
        // 随机轮换只由插件启动生命周期与按时间轮换推进，插件不再暴露页面可触发的轮换接口。
        Assert.Equal(
            new[]
            {
                "GET asset",
                "GET state",
                "POST assets",
                "POST assets/delete",
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

    [Fact]
    public async Task TestKit_ProvidesRegistrationAndScopedStorageBoundaries()
    {
        var context = new FakePluginHostContext("CustomWallpaper");
        using IDisposable registration = context.Ui.Register(PluginUiContribution.Card(
            "card",
            PluginUiSlots.SettingsCards,
            "测试卡片",
            (_, _) => ValueTask.FromResult<JsonObject?>(new JsonObject())));

        await context.ScopedData.WriteJsonAsync("settings", new JsonObject { ["enabled"] = true });
        PluginAssetInfo asset = await context.Assets.WriteAsync("wallpapers", "png", new MemoryStream(new byte[] { 1, 2, 3 }));

        Assert.Single(context.Ui.Contributions);
        Assert.NotNull(await context.ScopedData.ReadJsonAsync("settings"));
        Assert.Single(await context.Assets.ListAsync("wallpapers"));
        Assert.Equal(asset.Id, (await context.Assets.ListAsync("wallpapers"))[0].Id);
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
