using System.Text.Json.Nodes;
using NexusPipeline.Plugin.Abstractions;
using NexusPipeline.Plugin.CustomWallpaper;
using NexusPipeline.Plugin.TestKit;
using Xunit;

namespace NexusPipeline.Plugin.CustomWallpaper.Tests;

public sealed class CustomWallpaperConformanceTests
{
    [Fact]
    public async Task Lifecycle_IsStartableAndStopIsIdempotent()
    {
        await using PluginLifecycleHarness harness = await PluginLifecycleHarness.StartAsync(
            new EntryPoint(),
            new FakePluginHostContext("CustomWallpaper"));

        Assert.True(harness.Started);
        Assert.Equal("CustomWallpaper", harness.Context.PluginName);
        await harness.StopAsync();
        await harness.StopAsync();
        Assert.True(harness.Stopped);
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
        Assert.Single(context.Ui.Contributions);
        Assert.NotNull(await context.ScopedData.ReadJsonAsync("settings"));
    }
}
