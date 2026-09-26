using System.Text.Json.Nodes;
using Xunit;

namespace NexusPipeline.Plugin.MaaFrameworkDriver.Tests;

public sealed class ProjectCompilerTests
{
    [Theory]
    [InlineData("options")]
    [InlineData("controllerOptions")]
    [InlineData("resourceOptions")]
    [InlineData("taskOptions")]
    public void UnknownConfiguredOptionsAreLocatedInsteadOfUsingProjectDefaults(string scope)
    {
        using var fixture = new Fixture();
        fixture.Write("""
        {"interface_version":2,"name":"PI","controller":[{"name":"PC","type":"Win32"}],
         "resource":[{"name":"R","path":["resource"]}],"task":[{"name":"T","entry":"Entry"}]}
        """);
        var values = new JsonObject { ["OldUnknown"] = "Yes" };
        var profile = scope switch
        {
            "options" => fixture.Profile with { Options = values },
            "controllerOptions" => fixture.Profile with { ControllerOptions = values },
            "resourceOptions" => fixture.Profile with { ResourceOptions = values },
            _ => fixture.Profile with { TaskOptions = new() { ["T"] = values } },
        };
        Assert.Contains(scope, Assert.Throws<InvalidDataException>(() =>
            new ProjectCompiler(fixture.Root, "interface.json").Compile(profile)).Message);
    }

    [Theory]
    [InlineData("\"global_option\":[\"Unknown\"]")]
    [InlineData("\"setting\":[{\"name\":\"S\",\"option\":[\"Unknown\"]}]")]
    public void GlobalAndSettingReferencesAreValidatedEvenWithoutSelectedTasks(string declaration)
    {
        using var fixture = new Fixture(); fixture.Write("{\"interface_version\":2,\"name\":\"PI\"," + declaration + "}");
        Assert.Contains("unknown reference", Assert.Throws<InvalidDataException>(() =>
            new ProjectCompiler(fixture.Root, "interface.json").Inspect()).Message);
    }
    [Fact]
    public void OrderedImportsCasesAndOverrideLevelsPreserveTaskIdentity()
    {
        using var fixture = new Fixture();
        File.WriteAllText(Path.Combine(fixture.Root, "more.json"), """
        {"task":[{"name":"Second","entry":"Two","group":["daily"]}],"group":[{"name":"daily"}],
         "option":{"Choice":{"type":"checkbox","default_case":["B","A"],"min_count":2,"cases":[
          {"name":"A","pipeline_override":{"Entry":{"next":["A"],"timeout":1}}},
          {"name":"B","pipeline_override":{"Entry":{"next":["B"],"timeout":2}}}]}}}
        """);
        fixture.Write("""
        {"interface_version":2,"name":"PI","version":"1","import":["more.json"],
         "controller":[{"name":"PC","type":"Win32","option":["Input"],"attach_resource_path":["resource2"]}],
         "resource":[{"name":"R","path":["resource"],"option":["Choice"]}],
         "task":[{"name":"First","entry":"Entry","option":["Final"]}],
         "option":{"Input":{"type":"input","inputs":[{"name":"N","default":"7","pipeline_type":"int","verify":"^\\d+$"}],"pipeline_override":{"Entry":{"timeout":"{N}"}}},
          "Final":{"cases":[{"name":"Done","pipeline_override":{"Entry":{"enabled":true}}}]}}}
        """);
        var result = new ProjectCompiler(fixture.Root, "interface.json").Compile(fixture.Profile with { SelectedTasks = ["Second", "First"] });
        Assert.Equal(new[] { "Second", "First" }, result.Tasks.Select(task => task.Name));
        var first = result.Tasks[1].Override["Entry"]!.AsObject();
        Assert.Equal("B", first["next"]![0]!.GetValue<string>());
        Assert.Equal(7L, first["timeout"]!.GetValue<long>());
        Assert.True(first["enabled"]!.GetValue<bool>());
        Assert.Equal(1, result.BaseResourceCount);
        Assert.Equal(2, result.ResourcePaths.Length);
    }

    [Theory]
    [InlineData("{\"interface_version\":2,\"name\":\"a\",\"name\":\"b\"}", "duplicate")]
    [InlineData("{\"interface_version\":2,\"name\":\"a\",\"import\":[\"interface.json\"]}", "cycle")]
    [InlineData("{\"interface_version\":2,\"name\":\"a\",\"import\":[\"../../outside.json\"]}", "outside")]
    public void UnsafeInputsAreRejectedBeforeExecution(string input, string expected)
    {
        using var fixture = new Fixture(); fixture.Write(input);
        Assert.Contains(expected, Assert.Throws<InvalidDataException>(() => new ProjectCompiler(fixture.Root, "interface.json")).Message);
    }

    [Fact]
    public void SameOptionAtFourLevelsKeepsIndependentValuesAndDefinitionOrder()
    {
        using var fixture = new Fixture();
        fixture.Write("""
        {"interface_version":2,"name":"PI","global_option":["Choice"],
         "controller":[{"name":"PC","type":"Win32","option":["Choice"]}],
         "resource":[{"name":"R","path":["resource"],"option":["Choice"]}],
         "task":[{"name":"GlobalOnly","entry":"Entry"},{"name":"Task","entry":"Entry","option":["Choice"]}],
         "option":{"Choice":{"cases":[
           {"name":"G","pipeline_override":{"Entry":{"g":true,"next":["G"]}}},
           {"name":"R","pipeline_override":{"Entry":{"r":true,"next":["R"]}}},
           {"name":"C","pipeline_override":{"Entry":{"c":true,"next":["C"]}}},
           {"name":"T","pipeline_override":{"Entry":{"t":true,"next":["T"]}}}]}}}
        """);
        var profile = fixture.Profile with { SelectedTasks = ["GlobalOnly", "Task"],
            Options = new() { ["Choice"] = "G" }, ResourceOptions = new() { ["Choice"] = "R" },
            ControllerOptions = new() { ["Choice"] = "C" }, TaskOptions = new() { ["Task"] = new JsonObject { ["Choice"] = "T" } } };
        var tasks = new ProjectCompiler(fixture.Root, "interface.json").Compile(profile).Tasks;
        Assert.Equal("C", tasks[0].Override["Entry"]!["next"]![0]!.GetValue<string>());
        Assert.Null(tasks[0].Override["Entry"]!["t"]);
        Assert.Equal("T", tasks[1].Override["Entry"]!["next"]![0]!.GetValue<string>());
        foreach (string field in new[] { "g", "r", "c", "t" }) Assert.True(tasks[1].Override["Entry"]![field]!.GetValue<bool>());
    }

    [Fact]
    public void HotkeySubstitutionsUseIntegersForBothDocumentedPrimaryForms()
    {
        using var fixture = new Fixture();
        fixture.Write("""
        {"interface_version":2,"name":"PI","controller":[{"name":"PC","type":"Win32"}],
         "resource":[{"name":"R","path":["resource"]}],"task":[{"name":"T","entry":"Entry","option":["Key"]}],
         "option":{"Key":{"type":"hotkey","hotkeys":[{"name":"Use","default":"Ctrl+Shift+A"}],
          "pipeline_override":{"Entry":{"key":"{Use}.primary","modifier":"{Use}.modifier1","second":"{Use.modifier2}","alias":"{Use}"}}}}}
        """);
        var pipeline = new ProjectCompiler(fixture.Root, "interface.json").Compile(fixture.Profile with { SelectedTasks = ["T"] }).Tasks[0].Override["Entry"]!;
        Assert.Equal(65, pipeline["key"]!.GetValue<int>()); Assert.Equal(65, pipeline["alias"]!.GetValue<int>());
        Assert.Equal(17, pipeline["modifier"]!.GetValue<int>()); Assert.Equal(16, pipeline["second"]!.GetValue<int>());
    }

    [Fact]
    public void InspectRejectsPlaintextPasswordDefaultWithoutTaskExecution()
    {
        using var fixture = new Fixture();
        fixture.Write("""
        {"interface_version":2,"name":"PI","option":{"Secret":{"type":"input","inputs":[{"name":"Password","password":true,"default":"do-not-display"}]}}}
        """);
        Assert.Contains("password default forbidden", Assert.Throws<InvalidDataException>(() => new ProjectCompiler(fixture.Root, "interface.json").Inspect()).Message);
    }

    [Fact]
    public void JsoncUrlCommentsAndInactiveSuboptionsArePreservedCorrectly()
    {
        using var fixture = new Fixture();
        fixture.Write("""
        { // Comment
          "interface_version":2,"name":"PI","github":"https://example.invalid/a//b",
          "controller":[{"name":"PC","type":"Win32"},{"name":"Android","type":"Adb"}],
          "resource":[{"name":"R","path":["resource"]}],
          "task":[{"name":"T","entry":"Entry","option":["Filtered"]}],
          "option":{"Filtered":{"controller":["Android"],"cases":[{"name":"Y","option":["Missing"]}]}},
        }
        """);
        var result = new ProjectCompiler(fixture.Root, "interface.json").Compile(fixture.Profile with { SelectedTasks = ["T"] });
        Assert.Empty(Assert.Single(result.Tasks).Override);
    }

    [Fact]
    public void DisplayChangesDoNotAlterNativeAuthorizationButExecutableChangesDo()
    {
        using var fixture = new Fixture();
        const string pi = """
        {"interface_version":2,"name":"PI","label":"LABEL","controller":[{"name":"PC","type":"Win32"}],
         "resource":[{"name":"R","path":["resource"]}],"task":[]}
        """;
        fixture.Write(pi);
        string original = new ProjectCompiler(fixture.Root, "interface.json").Compile(fixture.Profile).ExecutionFingerprint;
        fixture.Write(pi.Replace("LABEL", "new display"));
        Assert.Equal(original, new ProjectCompiler(fixture.Root, "interface.json").Compile(fixture.Profile).ExecutionFingerprint);
        File.WriteAllText(Path.Combine(fixture.Root, "native", "MaaFramework.dll"), "changed");
        Assert.NotEqual(original, new ProjectCompiler(fixture.Root, "interface.json").Compile(fixture.Profile).ExecutionFingerprint);
        original = new ProjectCompiler(fixture.Root, "interface.json").Compile(fixture.Profile).ExecutionFingerprint;
        File.WriteAllText(Path.Combine(fixture.Root, "resource", "changed.json"), "{\"Entry\":{\"action\":\"Command\"}}");
        Assert.NotEqual(original, new ProjectCompiler(fixture.Root, "interface.json").Compile(fixture.Profile).ExecutionFingerprint);
    }

    [Fact]
    public void EmptyPasswordDefaultCanBeInspectedButExecutionRequiresProtectedReference()
    {
        using var fixture = new Fixture();
        fixture.Write("""
        {"interface_version":2,"name":"PI","controller":[{"name":"PC","type":"Win32"}],
         "resource":[{"name":"R","path":["resource"]}],"task":[{"name":"T","entry":"Entry","option":["Secret"]}],
         "option":{"Secret":{"type":"input","inputs":[{"name":"P","password":true,"default":""}],"pipeline_override":{"Entry":{"text":"{P}"}}}}}
        """);
        Assert.Equal("", new ProjectCompiler(fixture.Root, "interface.json").Inspect()["option"]!["Secret"]!["inputs"]![0]!["default"]!.GetValue<string>());
        Assert.Contains("protected secret", Assert.Throws<InvalidDataException>(() =>
            new ProjectCompiler(fixture.Root, "interface.json").Compile(fixture.Profile with { SelectedTasks = ["T"] })).Message);
        var result = new ProjectCompiler(fixture.Root, "interface.json").Compile(fixture.Profile with {
            SelectedTasks = ["T"], Options = new() { ["Secret"] = new JsonObject { ["P"] = "secret:owned-ref" } } });
        Assert.Equal("secret:owned-ref", result.Tasks[0].Override["Entry"]!["text"]!.GetValue<string>());
    }

    [Theory]
    [InlineData("null")]
    [InlineData("\"720,1280\"")]
    [InlineData("[720]")]
    [InlineData("[720,0]")]
    [InlineData("[720,\"1280\"]")]
    [InlineData("[720,1280,1]")]
    public void InvalidDisplayExpansionCannotSilentlyUseAnotherDisplayMode(string expansion)
    {
        using var fixture = new Fixture();
        fixture.Write("""
        {"interface_version":2,"name":"PI","controller":[{"name":"PC","type":"Win32","display_expand":EXPANSION}],
         "resource":[{"name":"R","path":["resource"]}],"task":[]}
        """.Replace("EXPANSION", expansion));
        Assert.Contains("two positive dimensions", Assert.Throws<InvalidDataException>(() =>
            new ProjectCompiler(fixture.Root, "interface.json").Compile(fixture.Profile)).Message);
    }

    [Theory]
    [InlineData("\"task\":[{\"name\":\"T\",\"entry\":\"Entry\",\"future_execution\":true}]", "task.T.future_execution")]
    [InlineData("\"controller\":[{\"name\":\"PC\",\"type\":\"Win32\",\"win32\":{\"future_input\":true}}]", "win32.future_input")]
    [InlineData("\"pretask\":{\"exec\":\"unknown.exe\",\"shell\":true}", "pretask.shell")]
    public void UnknownExecutionDeclarationsAreLocatedBeforePreviewOrRun(string declaration, string location)
    {
        using var fixture = new Fixture();
        fixture.Write("{\"interface_version\":2,\"name\":\"PI\"," + declaration + "}");
        Assert.Contains(location, Assert.Throws<InvalidDataException>(() =>
            new ProjectCompiler(fixture.Root, "interface.json")).Message);
    }

    [Fact]
    public void DisplayTranslationCannotRenameTasksCasesOrRewritePipelineValues()
    {
        using var fixture = new Fixture();
        File.WriteAllText(Path.Combine(fixture.Root, "zh.json"), "{\"name\":\"Translated\",\"label\":\"Display\"}");
        fixture.Write("""
        {"interface_version":2,"name":"PI","languages":{"zh_cn":"zh.json"},
         "controller":[{"name":"PC","type":"Win32"}],"resource":[{"name":"R","path":["resource"]}],
         "task":[{"name":"$name","label":"$label","entry":"$name","pipeline_override":{"Entry":{"label":"$label"}}}]}
        """);
        var compiler = new ProjectCompiler(fixture.Root, "interface.json");
        var task = compiler.Inspect()["task"]![0]!;
        Assert.Equal("$name", task["name"]!.GetValue<string>());
        Assert.Equal("Display", task["label"]!.GetValue<string>());
        Assert.Null(task["pipeline_override"]);
        Assert.Equal("$label", compiler.Compile(fixture.Profile with { SelectedTasks = ["$name"] }).Tasks[0]
            .Override["Entry"]!["label"]!.GetValue<string>());
        string before = compiler.Compile(fixture.Profile with { SelectedTasks = ["$name"] }).ExecutionFingerprint;
        fixture.Write(File.ReadAllText(Path.Combine(fixture.Root, "interface.json")).Replace("\"label\":\"$label\"}}", "\"label\":\"changed\"}}"));
        Assert.NotEqual(before, new ProjectCompiler(fixture.Root, "interface.json").Compile(
            fixture.Profile with { SelectedTasks = ["$name"] }).ExecutionFingerprint);
    }

    [Fact]
    public void OfficialStellaAgentInfiniteRpcTimeoutRetainsHostStartupAndCancelBoundaries()
    {
        using var fixture = new Fixture();
        File.WriteAllText(Path.Combine(fixture.Root, "fixture-agent.exe"), "owned compiler fixture; never executed");
        fixture.Write("""
        {"interface_version":2,"name":"PI","controller":[{"name":"PC","type":"Win32"}],
         "resource":[{"name":"R","path":["resource"]}],"agent":{"child_exec":"./fixture-agent.exe","timeout":-1}}
        """);
        Assert.Equal(-1, Assert.Single(new ProjectCompiler(fixture.Root, "interface.json").Compile(fixture.Profile).Agents).TimeoutMilliseconds);
    }

    [Fact]
    public void PresetUsesDeclaredTaskOrderDisabledTasksAndPerTaskOverrides()
    {
        using var fixture = new Fixture();
        fixture.Write("""
        {"interface_version":2,"name":"PI","controller":[{"name":"PC","type":"Win32"}],
         "resource":[{"name":"R","path":["resource"]}],"task":[{"name":"A","entry":"Entry","option":["X"]},{"name":"B","entry":"Other"}],
         "group":[{"name":"daily"}],"setting":[{"name":"Common","option":["X"]}],
         "option":{"X":{"cases":[{"name":"Y","pipeline_override":{"Entry":{"timeout":1}}},{"name":"N","pipeline_override":{"Entry":{"timeout":2}}}]}},
         "preset":[{"name":"Daily","task":[{"name":"B","enabled":false},{"name":"A","option":{"X":"N"}}]}]}
        """);
        var compiler = new ProjectCompiler(fixture.Root, "interface.json");
        var selected = compiler.ApplyPreset(fixture.Profile, "Daily");
        Assert.Equal(new[] { "A" }, selected.SelectedTasks);
        Assert.Equal(2, compiler.Compile(selected).Tasks[0].Override["Entry"]!["timeout"]!.GetValue<int>());
        Assert.Single(compiler.Inspect()["setting"]!.AsArray());
    }

    private sealed class Fixture : IDisposable
    {
        internal string Root { get; } = Path.Combine(Path.GetTempPath(), "nxp-pi-" + Guid.NewGuid().ToString("N"));
        internal DriverProfile Profile => new() { ProfileId = "p", Revision = "r", PackageRoot = Root,
            Controller = "PC", Resource = "R", NativeDirectory = "native", NativeVersion = "v5.14.0" };
        internal Fixture()
        {
            Directory.CreateDirectory(Root);
            foreach (string path in new[] { "resource", "resource2", "native" }) Directory.CreateDirectory(Path.Combine(Root, path));
            File.WriteAllText(Path.Combine(Root, "native", "MaaFramework.dll"), "test fixture bytes; never loaded");
        }
        internal void Write(string text) => File.WriteAllText(Path.Combine(Root, "interface.json"), text);
        public void Dispose() => Directory.Delete(Root, true);
    }
}
