using System.Text.Json.Nodes;
using Xunit;

namespace NexusPipeline.Plugin.MaaFrameworkDriver.Tests;

public sealed class ConfigurationImporterTests
{
    private static JsonObject Schema() => JsonNode.Parse("""
      {"controller":[{"name":"PC","type":"Win32"}],"resource":[{"name":"R"}],"task":[{"name":"A"},{"name":"B"}],
       "option":{"Flag":{"type":"switch","cases":[{"name":"Yes"},{"name":"No"}]},"Choice":{"cases":[{"name":"one"}]}}}
      """)!.AsObject();

    [Fact]
    public void ExplicitMxuInstanceMapsOrderAndOptionsWithoutChangingSource()
    {
        var source = JsonNode.Parse("""
          {"version":"1.0","instances":[{"id":"one","name":"fixture","controllerName":"PC","resourceName":"R","preActions":[],
           "tasks":[{"id":"b","taskName":"B","enabled":true,"optionValues":{"Flag":{"type":"switch","value":false}}},
                    {"id":"a","taskName":"A","enabled":true}]}],"settings":{}}
          """)!.AsObject();
        string before = source.ToJsonString();
        var profile = ConfigurationImporter.Map("mxu", source, Schema(), new(), "one");
        Assert.Equal(new[] { "B", "A" }, profile.SelectedTasks);
        Assert.Equal("No", profile.TaskOptions["B"]!["Flag"]!.GetValue<string>());
        Assert.Equal(before, source.ToJsonString()); Assert.Empty(profile.AuthorizedFingerprint);
    }

    [Fact]
    public void MxuNormalSavedDeviceAndPcLaunchMapToExplicitHostSettingsWithoutWritingSource()
    {
        var source = JsonNode.Parse("""
          {"version":"1.0","instances":[{"id":"one","name":"fixture","controllerId":"ui-id","resourceId":"r-id",
           "controllerName":"PC","resourceName":"R","savedDevice":{"windowName":"fixture","connectedProgramPath":""},
           "schedulePolicies":[],"preActions":[{"id":"launch","enabled":true,"program":"","args":"--fixture",
           "waitForExit":false,"skipIfRunning":true,"useCmd":false}],
           "tasks":[{"id":"a","taskName":"A","enabled":true,"optionValues":{},"collapsedOptions":{},"expanded":true}]}],"settings":{}}
          """)!.AsObject();
        source["instances"]![0]!["preActions"]![0]!["program"] = Environment.ProcessPath;
        string before = source.ToJsonString();
        var profile = ConfigurationImporter.Map("mxu", source, Schema(), new(), "one");
        Assert.True(profile.HostLaunchRequired);
        Assert.Equal(Environment.ProcessPath, profile.WindowExecutable);
        Assert.Equal("--fixture", profile.HostLaunchConfiguration["gameArgs"]!.GetValue<string>());
        Assert.Equal(0, profile.WindowProcessId);
        Assert.Equal(before, source.ToJsonString());
        source["instances"]![0]!["preActions"]![0]!["waitForExit"] = true;
        Assert.Throws<InvalidDataException>(() => ConfigurationImporter.Map("mxu", source, Schema(), new(), "one"));
    }

    [Fact]
    public void StandardMaaPiCliSavedShapeMapsAdbAndOptionLayers()
    {
        var source = JsonNode.Parse("""
          {"controller":{"name":"PC"},"resource":"R","adb":{"name":"fixture","adb_path":"adb.exe","address":"fixture:5555"},
           "global_option":[{"name":"Flag","value":"Yes"}],"controller_option":[{"name":"Flag","value":"No"}],
           "task":[{"name":"A","option":[{"name":"Choice","value":"one"}]}]}
          """)!.AsObject();
        var profile = ConfigurationImporter.Map("maapicli-v5.14.0", source, Schema(), new());
        Assert.Equal("fixture:5555", profile.AdbSerial);
        Assert.Equal("Yes", profile.Options["Flag"]!.GetValue<string>());
        Assert.Equal("No", profile.ControllerOptions["Flag"]!.GetValue<string>());
        Assert.Equal("one", profile.TaskOptions["A"]!["Choice"]!.GetValue<string>());
    }

    [Theory]
    [InlineData("{\"controller\":{\"name\":\"PC\"},\"resource\":\"R\",\"task\":[],\"executeUnknown\":true}")]
    [InlineData("{\"controller\":{\"name\":\"PC\"},\"resource\":\"R\",\"task\":[{\"name\":\"A\",\"option\":[{\"name\":\"removed\",\"value\":\"one\"}]}]}")]
    public void UnknownExecutionDataIsRejected(string json)
        => Assert.Throws<InvalidDataException>(() => ConfigurationImporter.Map("maapicli-v5.14.0", JsonNode.Parse(json)!.AsObject(), Schema(), new()));
}
