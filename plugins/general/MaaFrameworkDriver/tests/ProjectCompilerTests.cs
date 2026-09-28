using System.Text.Json;
using System.Text.Json.Nodes;
using Xunit;

namespace NexusPipeline.Plugin.MaaFrameworkDriver.Tests;

public sealed class ProjectCompilerTests
{
    [Fact]
    public void PathInterpreterReplacementInvalidatesAuthorization()
    {
        using var fixture = new Fixture();
        string executable = Path.Combine(fixture.Root, "python159753.exe");
        File.WriteAllText(executable, "original owned interpreter; never executed");
        File.WriteAllText(Path.Combine(fixture.Root, "main.py"), "print(1)");
        fixture.Write("""
        {"interface_version":2,"name":"PI","controller":[{"name":"PC","type":"Win32"}],
         "resource":[{"name":"R","path":["resource"]}],"agent":{"child_exec":"python159753","child_args":["main.py"]}}
        """);
        string? originalPath = Environment.GetEnvironmentVariable("PATH");
        try
        {
            Environment.SetEnvironmentVariable("PATH", fixture.Root + Path.PathSeparator + originalPath);
            var first = new ProjectCompiler(fixture.Root, "interface.json").Compile(fixture.Profile);
            Assert.Equal(executable, Assert.Single(first.Agents).Executable);
            File.WriteAllText(executable, "replaced owned interpreter; never executed");
            Assert.NotEqual(first.ExecutionFingerprint,
                new ProjectCompiler(fixture.Root, "interface.json").Compile(fixture.Profile).ExecutionFingerprint);
        }
        finally { Environment.SetEnvironmentVariable("PATH", originalPath); }
    }

    [Theory]
    [InlineData(true)]
    public void LinkedInterpreterAndLocalDependencyAreRejectedWithoutReadingOutside(bool interpreter)
    {
        using var fixture = new Fixture();
        using var outside = new Fixture();
        string link = Path.Combine(fixture.Root, "linked");
        File.WriteAllText(Path.Combine(outside.Root, "python.exe"), "outside owned interpreter; never executed");
        File.WriteAllText(Path.Combine(outside.Root, "helper.py"), "outside owned dependency");
        File.WriteAllText(Path.Combine(fixture.Root, "python.exe"), "inside owned interpreter; never executed");
        File.WriteAllText(Path.Combine(fixture.Root, "main.py"), "print(1)");
        var start = new System.Diagnostics.ProcessStartInfo("cmd.exe") { UseShellExecute = false,
            CreateNoWindow = true, RedirectStandardOutput = true, RedirectStandardError = true };
        foreach (string argument in new[] { "/c", "mklink", "/J", link, outside.Root }) start.ArgumentList.Add(argument);
        using var process = System.Diagnostics.Process.Start(start)!;
        string output = process.StandardOutput.ReadToEnd() + process.StandardError.ReadToEnd();
        process.WaitForExit(); Assert.True(process.ExitCode == 0, output);
        try
        {
            var pi = JsonNode.Parse("""
            {"interface_version":2,"name":"PI","controller":[{"name":"PC","type":"Win32"}],
             "resource":[{"name":"R","path":["resource"]}],"agent":{"child_exec":"./python.exe","child_args":["main.py"]}}
            """)!;
            if (interpreter) pi["agent"]!["child_exec"] = Path.Combine(link, "python.exe");
            fixture.Write(pi.ToJsonString());
            var error = Assert.Throws<InvalidDataException>(() =>
                new ProjectCompiler(fixture.Root, "interface.json").Compile(fixture.Profile));
            Assert.Contains("link", error.Message);
            Assert.Equal("outside owned dependency", File.ReadAllText(Path.Combine(outside.Root, "helper.py")));
        }
        finally { Directory.Delete(link); }
    }

    [Fact]
    public void OversizedInterfaceFailsWithLocatedBudgetBeforeParsing()
    {
        using var fixture = new Fixture();
        using (var bytes = File.Create(Path.Combine(fixture.Root, "interface.json"))) bytes.SetLength(8L * 1024 * 1024 + 1);
        var error = Assert.Throws<InvalidDataException>(() => new ProjectCompiler(fixture.Root, "interface.json"));
        Assert.Contains("import", error.Message); Assert.Contains("byte budget", error.Message);
    }

    [Theory]
    [InlineData("agent.deps.json")]
    public void DirectExecutableSidecarCodeChangesRequireAuthorization(string dependency)
    {
        using var fixture = new Fixture();
        Directory.CreateDirectory(Path.Combine(fixture.Root, "agent"));
        File.WriteAllText(Path.Combine(fixture.Root, "agent", "agent.exe"), "inert owned identity fixture");
        string sidecar = Path.Combine(fixture.Root, "agent", dependency);
        File.WriteAllText(sidecar, "original");
        fixture.Write("""
        {"interface_version":2,"name":"PI","controller":[{"name":"PC","type":"Win32"}],
         "resource":[{"name":"R","path":["resource"]}],"agent":{"child_exec":"agent/agent.exe"}}
        """);
        string before = new ProjectCompiler(fixture.Root, "interface.json").Compile(fixture.Profile).ExecutionFingerprint;
        File.WriteAllText(sidecar, "modified");
        Assert.NotEqual(before, new ProjectCompiler(fixture.Root, "interface.json").Compile(fixture.Profile).ExecutionFingerprint);
    }
    [Fact]
    public void RawArgumentsStaySeparateFromGeneratedOptionPayload()
    {
        using var fixture = new Fixture();
        File.WriteAllText(Path.Combine(fixture.Root, "pretask.exe"), "non-executed code identity fixture");
        string[] arguments = ["", "{literal}", " { \"key\" : \"secret:literal\" } ", "secret:literal", "中文", "a\"b"];
        var pi = JsonNode.Parse("""
        {"interface_version":2,"name":"PI","controller":[{"name":"PC","type":"Win32"}],
         "resource":[{"name":"R","path":["resource"]}],"task":[],
         "pretask":{"exec":"./pretask.exe","option":["Mode"]},
         "option":{"Mode":{"cases":[{"name":"Selected"}]}}}
        """)!;
        pi["pretask"]!["args"] = new JsonArray(arguments.Select(a => (JsonNode?)JsonValue.Create(a)).ToArray());
        fixture.Write(pi.ToJsonString());
        var program = Assert.Single(new ProjectCompiler(fixture.Root, "interface.json").Compile(fixture.Profile).Pretasks);
        Assert.Equal(arguments, program.Arguments);
        var serialized = JsonSerializer.SerializeToNode(program)!;
        Assert.Equal("Selected", serialized["GeneratedOptionPayload"]!["Mode"]!.GetValue<string>());
    }

    [Theory]
    [InlineData("agent/main.py")]
    public void ScriptEntryAndLocalDependencyContentInvalidateAuthorization(string entry)
    {
        using var fixture = new Fixture();
        Directory.CreateDirectory(Path.Combine(fixture.Root, "agent"));
        string script = Path.Combine(fixture.Root, "agent", "main.py");
        string dependency = Path.Combine(fixture.Root, "helper.py");
        File.WriteAllText(script, "import helper\n"); File.WriteAllText(dependency, "value = 1\n");
        File.WriteAllText(Path.Combine(fixture.Root, "python.exe"), "non-executed interpreter identity fixture");
        var pi = JsonNode.Parse("""
        {"interface_version":2,"name":"PI","controller":[{"name":"PC","type":"Win32"}],
         "resource":[{"name":"R","path":["resource"]}],"agent":{"child_exec":"./python.exe"}}
        """)!;
        pi["agent"]!["child_args"] = new JsonArray("-u", entry); fixture.Write(pi.ToJsonString());
        string first = new ProjectCompiler(fixture.Root, "interface.json").Compile(fixture.Profile).ExecutionFingerprint;
        File.WriteAllText(script, "import helper\nprint(1)\n");
        string second = new ProjectCompiler(fixture.Root, "interface.json").Compile(fixture.Profile).ExecutionFingerprint;
        Assert.NotEqual(first, second);
        File.WriteAllText(dependency, "value = 2\n");
        Assert.NotEqual(second, new ProjectCompiler(fixture.Root, "interface.json").Compile(fixture.Profile).ExecutionFingerprint);
        pi["agent"]!["child_args"] = new JsonArray("-u", "./agent/main.py"); fixture.Write(pi.ToJsonString());
        string canonical = new ProjectCompiler(fixture.Root, "interface.json").Compile(fixture.Profile).ExecutionFingerprint;
        pi["agent"]!["child_args"] = new JsonArray("-u", "agent/main.py"); fixture.Write(pi.ToJsonString());
        Assert.Equal(canonical, new ProjectCompiler(fixture.Root, "interface.json").Compile(fixture.Profile).ExecutionFingerprint);
    }

    [Theory]
    [InlineData("-m")]
    public void DynamicPythonEntryIsRejectedBeforeExecution(string option)
    {
        using var fixture = new Fixture();
        File.WriteAllText(Path.Combine(fixture.Root, "python.exe"), "non-executed interpreter identity fixture");
        var pi = JsonNode.Parse("""
        {"interface_version":2,"name":"PI","controller":[{"name":"PC","type":"Win32"}],
         "resource":[{"name":"R","path":["resource"]}],"agent":{"child_exec":"./python.exe"}}
        """)!;
        pi["agent"]!["child_args"] = new JsonArray(option, "dynamic-code"); fixture.Write(pi.ToJsonString());
        Assert.Contains("exec.args", Assert.Throws<InvalidDataException>(() => new ProjectCompiler(fixture.Root, "interface.json").Compile(fixture.Profile)).Message);
    }

    [Theory]
    [InlineData("options")]
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
