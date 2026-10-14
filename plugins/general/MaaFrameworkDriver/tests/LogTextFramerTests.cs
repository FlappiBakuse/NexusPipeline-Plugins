using Xunit;

namespace NexusPipeline.Plugin.MaaFrameworkDriver.Tests;

public sealed class LogTextFramerTests
{
    [Fact]
    public async Task StreamingLogsPreserveLargeOutputAndRedactAcrossFramesAndReads()
    {
        string secret = "owned-secret-at-boundary";
        string input = new string('x', 2040) + secret + "\n" + new string('中', 1024 * 1024 + 37) + "\nfinal";
        var frames = new List<string>();
        var framer = new LogTextFramer(text => { frames.Add(text); return ValueTask.CompletedTask; }, [secret]);
        for (int index = 0; index < input.Length; index += 71)
            await framer.AppendAsync(input.Substring(index, Math.Min(71, input.Length - index)));
        await framer.AppendAsync("", complete: true);
        Assert.Equal(input.Replace(secret, "[redacted]", StringComparison.Ordinal), string.Concat(frames));
        Assert.All(frames, text => Assert.InRange(text.Length, 1, 2048));
        Assert.DoesNotContain(secret, string.Concat(frames));
        frames.Clear();
        var multiline = new LogTextFramer(text => { frames.Add(text); return ValueTask.CompletedTask; }, ["owned\nsecret"]);
        await multiline.AppendAsync("prefix owned\n"); await multiline.AppendAsync("secret tail", complete: true);
        Assert.Equal("prefix [redacted] tail", string.Concat(frames));
    }
}
