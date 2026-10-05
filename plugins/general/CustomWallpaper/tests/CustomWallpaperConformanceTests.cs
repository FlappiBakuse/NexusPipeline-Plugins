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

}
