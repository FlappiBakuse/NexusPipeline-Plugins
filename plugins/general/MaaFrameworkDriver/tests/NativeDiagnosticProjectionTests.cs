using System.Text.Json.Nodes;
using Xunit;

namespace NexusPipeline.Plugin.MaaFrameworkDriver.Tests;

public sealed class NativeDiagnosticProjectionTests
{
    [Theory]
    [InlineData("[]")]
    [InlineData("null")]
    [InlineData("{\"task_id\":\"private-token\"}")]
    [InlineData("{\"node_id\":{\"private\":true}}")]
    [InlineData("{broken")]
    public void MalformedOptionalCallbacksRemainBoundedDiagnostics(string details)
    {
        JsonObject fact = NativeDiagnosticProjection.Project("callback", details);
        Assert.Equal("diagnostic.details_invalid", fact["code"]!.GetValue<string>());
        Assert.DoesNotContain("private", fact.ToJsonString());
    }

    [Fact]
    public void OversizedCallbacksAndSensitiveDetailsDoNotBecomeTaskFacts()
    {
        var oversized = NativeDiagnosticProjection.Project(new string('m', 129), new string('s', 65537));
        Assert.Equal("diagnostic.message_truncated", oversized["message"]!.GetValue<string>());
        Assert.Equal("diagnostic.details_truncated", oversized["code"]!.GetValue<string>());
        var valid = NativeDiagnosticProjection.Project("MaaTasker.Task.Succeeded", "{\"task_id\":42,\"node_id\":3,\"credentials\":\"private-token\"}");
        Assert.Equal(42, valid["task_id"]!.GetValue<long>());
        Assert.Equal(3, valid["node_id"]!.GetValue<long>());
        Assert.DoesNotContain("private-token", valid.ToJsonString());
        Assert.Null(valid["status"]);
    }
}
