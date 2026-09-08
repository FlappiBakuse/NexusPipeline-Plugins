using NexusPipeline.Plugin.LiveScreenshot;
using NexusPipeline.Plugin.TestKit;
using Xunit;

namespace NexusPipeline.Plugin.LiveScreenshot.Tests;

public sealed class LiveScreenshotConformanceTests
{
    [Fact]
    public async Task Lifecycle_IsStartableAndStopIsIdempotent()
    {
        await using PluginLifecycleHarness harness = await PluginLifecycleHarness.StartAsync(
            new EntryPoint(),
            new FakePluginHostContext("LiveScreenshot"));

        Assert.True(harness.Started);
        await harness.StopAsync();
        await harness.StopAsync();
        Assert.True(harness.Stopped);
    }
}
