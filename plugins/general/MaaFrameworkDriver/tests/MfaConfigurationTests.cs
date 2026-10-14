using System.Text.Json.Nodes;
using Xunit;

namespace NexusPipeline.Plugin.MaaFrameworkDriver.Tests;

public sealed class MfaConfigurationTests
{
    [Fact]
    public void NativeInputsUseLocalIdentityAndPreserveUnknownBytes()
    {
        string root = Path.Combine(Path.GetTempPath(), "nxp-native-plan-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(root);
        try
        {
            string pi = """
                {"interface_version":2,"name":"Unregistered","version":"999","controller":[],"resource":[],"task":[]}
                """;
            File.WriteAllText(Path.Combine(root, "interface.json"), pi);
            var original = new DriverProfile { SchemaVersion = 3, PackageRoot = root, ProfileId = "owned" };
            Assert.Contains("incomplete_distribution", Assert.Throws<InvalidDataException>(() => RuntimeInputs.Bind(original, default)).Message);
            string native = Path.Combine(root, "maafw"); Directory.CreateDirectory(native);
            foreach (string name in new[] { "MaaFramework.dll", "MaaToolkit.dll", "MaaAgentClient.dll" })
                File.Copy(Environment.ProcessPath!, Path.Combine(native, name));
            var bound = RuntimeInputs.Bind(original, default);
            RuntimeInputs.Verify(bound, default);
            File.WriteAllText(Path.Combine(root, "interface.json"), pi.Replace("Unregistered", "Renamed").Replace("999", "1"));
            Assert.Equal(bound.RuntimeInputs!.LockHash, RuntimeInputs.Bind(original, default).RuntimeInputs!.LockHash);
            string unknown = Path.Combine(native, "user-data.bin"); byte[] bytes = [0, 255, 1, 254]; File.WriteAllBytes(unknown, bytes);
            RuntimeInputs.Verify(bound, default);
            File.AppendAllText(Path.Combine(native, "MaaFramework.dll"), "changed");
            Assert.Contains("inputs_changed", Assert.Throws<InvalidDataException>(() => RuntimeInputs.Verify(bound, default)).Message);
            Assert.Equal(bytes, File.ReadAllBytes(unknown));
            File.WriteAllText(Path.Combine(native, "MaaFramework.dll"), "not a PE");
            Assert.ThrowsAny<Exception>(() => RuntimeInputs.Bind(original, default));
            Assert.False(Directory.Exists(Path.Combine(root, ".nexus")));
        }
        finally { Directory.Delete(root, true); }
    }

    [Fact]
    public void CliIdenticalEntriesKeepDistinctIdentityAndSourceReorderCreatesNewPlan()
    {
        var source = JsonNode.Parse("""
            {"controller":{"name":"PC"},"resource":"R","task":[{"name":"T","option":[]},{"name":"T","option":[]}]}
            """)!.AsObject();
        var mapped = ConfigurationImporter.Map("maapicli-v5.14.0", source, Schema, new(), "cli");
        Assert.Equal(2, mapped.TaskOccurrences.Length);
        Assert.NotEqual(mapped.TaskOccurrences[0].OccurrenceId, mapped.TaskOccurrences[1].OccurrenceId);
        var repeated = ConfigurationImporter.Map("maapicli-v5.14.0", source, Schema, mapped, "cli");
        Assert.Equal(mapped.TaskOccurrences.Select(t => t.OccurrenceId), repeated.TaskOccurrences.Select(t => t.OccurrenceId));
        source["task"]!.AsArray().Insert(0, new JsonObject { ["name"] = "Deleted", ["option"] = new JsonArray() });
        var changed = ConfigurationImporter.Map("maapicli-v5.14.0", source, Schema, mapped, "cli");
        Assert.DoesNotContain(changed.TaskOccurrences[1].OccurrenceId, mapped.TaskOccurrences.Select(t => t.OccurrenceId));
    }
    private static JsonObject Schema => JsonNode.Parse("""
        {"controller":[{"name":"PC","type":"Win32"}],"resource":[{"name":"R"}],
         "task":[{"name":"T","entry":"Entry","repeatable":true,"option":["Choice"]},{"name":"Deleted","entry":"Old","default_check":true}],
         "option":{"Choice":{"cases":[{"name":"Y"},{"name":"N"}]},
         "Many":{"type":"checkbox","cases":[{"name":"a"},{"name":"b"}]},
         "Input":{"type":"input","inputs":[{"name":"Text"}]}}}
        """)!.AsObject();
    private static JsonObject Global => new() { ["CurrentControllerName"] = "PC", ["Resource"] = "R",
        ["CurrentTasks"] = new JsonArray("Deleted<|||>Old") };

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public void SavedWindowHintsPreserveHostIdentityAndTaskSelection(bool inherited)
    {
        var local = new JsonObject { ["TaskItems"] = new JsonArray(Task(0)) };
        var global = Global;
        var owner = inherited ? global : local;
        string prefix = inherited ? "Instance.a." : "";
        owner[prefix + "DesktopWindowClassName"] = "UnityWndClass";
        owner[prefix + "DesktopWindowName"] = "Saved game title";
        owner[prefix + "AgentTcpMode"] = true;
        var target = new DriverProfile { WindowHandle = 42, WindowProcessId = 7,
            WindowExecutable = "D:/Games/Verified.exe", WindowSelection = "exact_process" };
        var mapped = MfaConfigurationMapper.Map(local, global, Schema, target, "a");
        Assert.Equal(target.WindowHandle, mapped.WindowHandle);
        Assert.Equal(target.WindowProcessId, mapped.WindowProcessId);
        Assert.Equal(target.WindowExecutable, mapped.WindowExecutable);
        Assert.Equal(target.WindowSelection, mapped.WindowSelection);
        Assert.Equal("UnityWndClass", mapped.ImportProvenance["savedWindowHints"]?["DesktopWindowClassName"]?.GetValue<string>());
        Assert.True(mapped.ImportProvenance["guiAgentTcpMode"]!.GetValue<bool>());
        Assert.True(Assert.Single(mapped.TaskOccurrences).Enabled);
        owner[prefix + "DesktopWindowName"] = 123;
        Assert.Contains("DesktopWindowName", Assert.Throws<InvalidDataException>(() =>
            MfaConfigurationMapper.Map(local, global, Schema, target, "a")).Message);
        owner[prefix + "DesktopWindowName"] = "Saved game title";
        owner[prefix + "AgentTcpMode"] = "true";
        Assert.Contains("AgentTcpMode", Assert.Throws<InvalidDataException>(() =>
            MfaConfigurationMapper.Map(local, global, Schema, target, "a")).Message);
    }
    private static JsonObject Task(int index, int repeat = 1) => new() { ["name"] = "T", ["entry"] = "Entry",
        ["default_check"] = true, ["repeat_count"] = repeat,
        ["option"] = new JsonArray(new JsonObject { ["name"] = "Choice", ["index"] = index }) };

    [Fact]
    public void FlatMfaInstancesKeepSelectionAndIsolationWithoutWritingSource()
    {
        string root = Path.Combine(Path.GetTempPath(), "maa-flat-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(Path.Combine(root, "config"));
        try
        {
            File.WriteAllText(Path.Combine(root, "interface.json"), """
                {"interface_version":2,"name":"Flat source","controller":[{"name":"Android","type":"Adb"}],
                "resource":[{"name":"R","path":"resource"}],"task":[{"name":"A","entry":"A"},{"name":"B","entry":"B","option":["Parent"]}],
                "option":{"Parent":{"cases":[{"name":"On","option":["Child"],"pipeline_override":{"B":{"enabled":true}}}]},
                "Child":{"cases":[{"name":"Default","pipeline_override":{"Unexpected":{"enabled":true}}}]}}}
                """);
            File.WriteAllText(Path.Combine(root, "appsettings.json"), """
                {"Instances.List":"default,second","Instance.default.Config":"Default","Instance.second.Config":"Other"}
                """);
            var source = JsonNode.Parse("""
                {"Resource":"R","Instance.default.Timer.Timer1.Schedule":"0||",
                "Instance.default.CurrentTasks":["A<|||>A","B<|||>B"],
                "Instance.default.TaskItems":[{"name":"B","entry":"B","default_check":true,"option":[{"name":"Parent","index":0}]},{"name":"A","entry":"A","default_check":false}]}
                """)!.AsObject();
            string path = Path.Combine(root, "config", "config.json");
            File.WriteAllText(path, source.ToJsonString());
            File.WriteAllText(Path.Combine(root, "config", "mfa_Other.json"), """
                {"Resource":"R","Instance.default.Prescript":"do not inherit",
                "Instance.second.CurrentTasks":["A<|||>A","B<|||>B"],
                "Instance.second.TaskItems":[{"name":"A","entry":"A","default_check":true},{"name":"B","entry":"B","default_check":false}]}
                """);
            byte[] before = File.ReadAllBytes(path);
            var candidates = SourceDiscovery.Discover(root).Candidates;
            Assert.Equal(2, candidates.Length);
            var first = SourceDiscovery.Read(new() { SchemaVersion = 3, PackageRoot = root }, candidates[0]);
            var second = SourceDiscovery.Read(new() { SchemaVersion = 3, PackageRoot = root }, candidates[1]);
            Assert.Equal("B", Assert.Single(new ProjectCompiler(root, "interface.json").CompileSemantics(first).Tasks).Entry);
            Assert.Null(Assert.Single(new ProjectCompiler(root, "interface.json").CompileSemantics(first).Tasks).Override["Unexpected"]);
            Assert.Equal("A", Assert.Single(new ProjectCompiler(root, "interface.json").CompileSemantics(second).Tasks).Entry);
            Assert.Equal("mfa-flat-instance", first.SourceBinding!.SourceSchemaVersion);
            Assert.Equal(before, File.ReadAllBytes(path));
            source["Instance.default.Prescript"] = "must not execute";
            File.WriteAllText(path, source.ToJsonString());
            Assert.Throws<InvalidDataException>(() => SourceDiscovery.Read(new() { SchemaVersion = 3, PackageRoot = root }, candidates[0]));
            Assert.Throws<InvalidDataException>(() => SourceDiscovery.RequireCurrent(first, default));
            Assert.Throws<InvalidDataException>(() => ConfigurationSources.MfaFlatPath(new() { ["DefaultConfig"] = "../escape" }, "default"));
        }
        finally { Directory.Delete(root, true); }
    }

    [Fact]
    public void DiscoveryAndSemanticMappingNeedNoNativeAndAdmissionRejectsChangedSource()
    {
        string root = Path.Combine(Path.GetTempPath(), "maa-discovery-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(Path.Combine(root, "config", "instances"));
        try
        {
            File.WriteAllText(Path.Combine(root, "interface.json"), """
                {"interface_version":2,"name":"PI","controller":[{"name":"PC","type":"Win32"}],
                "resource":[{"name":"R","path":"missing-resource"}],"task":[{"name":"T","entry":"Entry"}],
                "agent":{"child_exec":"missing-python.exe","child_args":["missing.py"]}}
                """);
            File.WriteAllText(Path.Combine(root, "appsettings.json"), "{}");
            File.WriteAllText(Path.Combine(root, "config", "config.json"), "{\"CurrentControllerName\":\"PC\",\"Resource\":\"R\"}");
            string source = Path.Combine(root, "config", "instances", "a.json");
            File.WriteAllText(source, "{\"InstanceName\":\"Account A\",\"TaskItems\":[{\"name\":\"T\",\"entry\":\"Entry\",\"default_check\":true}]}");
            byte[] before = File.ReadAllBytes(source);
            var discovery = SourceDiscovery.Discover(root);
            var candidate = Assert.Single(discovery.Candidates);
            Assert.Equal("a", candidate.InstanceId);
            var profile = SourceDiscovery.Read(new() { SchemaVersion = 3, PackageRoot = root, ProfileId = "a" }, candidate);
            Assert.Single(new ProjectCompiler(root, "interface.json").CompileSemantics(profile).Tasks);
            Assert.Throws<InvalidDataException>(() => new ProjectCompiler(root, "interface.json").Compile(profile));
            SourceDiscovery.RequireCurrent(profile, CancellationToken.None);
            Assert.Equal(before, File.ReadAllBytes(source));
            var snapshot = new ProjectCompiler(root, "interface.json");
            snapshot.ReadScopedFile("config/instances/a.json");
            File.Move(source, source + ".old");
            File.WriteAllBytes(source, before);
            Assert.Throws<InvalidDataException>(() => snapshot.VerifyReadSnapshot());
            File.AppendAllText(source, " ");
            var error = Assert.Throws<InvalidDataException>(() => SourceDiscovery.RequireCurrent(profile, CancellationToken.None));
            Assert.StartsWith("source.sync_pending", error.Message);
            File.WriteAllText(Path.Combine(root, "config", "instances", "b.json"), "{\"InstanceName\":\"Account A\"}");
            Assert.Equal(2, SourceDiscovery.Discover(root).Candidates.Length);
            Directory.CreateDirectory(Path.Combine(root, "assets"));
            File.Copy(Path.Combine(root, "interface.json"), Path.Combine(root, "assets", "interface.json"));
            Assert.Equal(new[] { "interface.json", "assets/interface.json" }, SourceDiscovery.Discover(root).InterfaceCandidates);
        }
        finally { Directory.Delete(root, true); }
    }

    [Fact]
    public void GuiWaitActionsKeepOrderParametersAndRejectUnknownActions()
    {
        JsonObject Wait(string name, string entry, JsonObject parameters) => new() { ["name"] = name, ["entry"] = entry,
            ["default_check"] = true, ["pipeline_override"] = new JsonObject { [entry] = new JsonObject {
                ["action"] = "Custom", ["custom_action"] = entry, ["custom_action_param"] = parameters } } };
        var local = new JsonObject { ["TaskItems"] = new JsonArray(Wait("At time", "TimedWaitAction", new() { ["hour"] = 9, ["minute"] = 30 }),
            Task(0), Wait("Delay", "CountdownAction", new() { ["seconds"] = 2 })) };
        var mapped = MfaConfigurationMapper.Map(local, Global, Schema, new(), "a");
        Assert.Equal(new[] { "TimedWaitAction", "", "CountdownAction" }, mapped.TaskOccurrences.Select(t => t.GuiAction));
        var now = new DateTime(2026, 10, 12, 9, 30, 0);
        var parameters = GuiWaitActions.Validate("TimedWaitAction", mapped.TaskOccurrences[0].PipelineOverride);
        Assert.Equal(TimeSpan.FromDays(1), GuiWaitActions.Remaining("TimedWaitAction", parameters, now));
        Assert.Equal(TimeSpan.FromMinutes(1), GuiWaitActions.Remaining("TimedWaitAction", parameters, now.AddMinutes(-1)));
        Assert.Equal(TimeSpan.FromSeconds(2), GuiWaitActions.Remaining("CountdownAction",
            GuiWaitActions.Validate("CountdownAction", mapped.TaskOccurrences[2].PipelineOverride), now));
        local["TaskItems"]![0]!["pipeline_override"]!["TimedWaitAction"]!["custom_action_param"]!["hour"] = 24;
        Assert.Throws<InvalidDataException>(() => MfaConfigurationMapper.Map(local, Global, Schema, new(), "a"));
        Assert.Throws<InvalidDataException>(() => MfaConfigurationMapper.Map(new() { ["TaskItems"] = new JsonArray(
            Wait("Shutdown", "ComputerOperationAction", new() { ["operation"] = "shutdown" })) }, Global, Schema, new(), "a"));
    }

    [Fact]
    public void SavedWin32MethodsOverridePiWithoutMutationAndRejectUnknownBits()
    {
        var schema = Schema;
        schema["controller"]![0]!["win32"] = new JsonObject { ["mouse"] = "SendMessage" };
        string before = schema.ToJsonString();
        var instance = new JsonObject { ["Win32ControlMouseType"] = "SendMessageWithCursorPos",
            ["Win32ControlKeyboardType"] = 64, ["Win32ControlScreenCapType"] = "18" };
        var profile = MfaConfigurationMapper.Map(instance, Global, schema, new(), "a");
        var result = ControllerConfiguration.Apply(schema["controller"]![0]!.AsObject(), profile.ControllerConfiguration);
        Assert.Equal("SendMessageWithCursorPos", result["win32"]!["mouse"]!.GetValue<string>());
        Assert.Equal("PostMessageWithCursorPos", result["win32"]!["keyboard"]!.GetValue<string>());
        Assert.Equal("FramePool, PrintWindow", result["win32"]!["screencap"]!.GetValue<string>());
        Assert.Equal(before, schema.ToJsonString());
        foreach (var invalid in new[] { "0", "3", "512", "Unknown", "SendMessage, Seize" })
            Assert.Throws<InvalidDataException>(() => ControllerConfiguration.Normalize("mouse", JsonValue.Create(invalid)!));
        Assert.Throws<InvalidDataException>(() => ControllerConfiguration.Normalize("screencap", JsonValue.Create(64)!));
        var global = Global; global["Instance.default.UnknownExecutionSetting"] = true;
        Assert.Throws<InvalidDataException>(() => MfaConfigurationMapper.Map(instance, global, schema, new(), "a"));
    }

    [Fact]
    public void InstanceInheritanceUsesLocalScopedDefaultThenGlobalWithoutWrites()
    {
        JsonObject local = new() { ["Value"] = "local" }, global = new() { ["Instance.a.Value"] = "scoped", ["Instance.default.Value"] = "default", ["Value"] = "global" };
        string before = global.ToJsonString();
        Assert.Equal("local", MfaConfigurationMapper.Inherit(local, global, "a", "Value")!.GetValue<string>());
        Assert.Equal(before, global.ToJsonString());
        local.Clear(); Assert.Equal("scoped", MfaConfigurationMapper.Inherit(local, global, "a", "Value")!.GetValue<string>());
        global.Remove("Instance.a.Value"); Assert.Equal("default", MfaConfigurationMapper.Inherit(local, global, "a", "Value")!.GetValue<string>());
        global.Remove("Instance.default.Value"); Assert.Equal("global", MfaConfigurationMapper.Inherit(local, global, "a", "Value")!.GetValue<string>());
        Assert.Empty(local);
    }

    [Fact]
    public void DuplicateTasksKeepOptionsRepeatDeletionHistoryAndIdentityAfterReorder()
    {
        var local = new JsonObject { ["TaskItems"] = new JsonArray(Task(0, 2), Task(1)) };
        string before = local.ToJsonString();
        var mapped = MfaConfigurationMapper.Map(local, Global, Schema, new(), "a");
        Assert.Equal(2, mapped.TaskOccurrences.Length);
        Assert.Equal(2, mapped.TaskOccurrences[0].RepeatCount);
        Assert.Equal("Y", mapped.TaskOccurrences[0].Options["Choice"]!.GetValue<string>());
        Assert.Equal("N", mapped.TaskOccurrences[1].Options["Choice"]!.GetValue<string>());
        Assert.NotEqual(mapped.TaskOccurrences[0].OccurrenceId, mapped.TaskOccurrences[1].OccurrenceId);
        Assert.Equal(before, local.ToJsonString());
        var reordered = MfaConfigurationMapper.Map(new() { ["TaskItems"] = new JsonArray(Task(1), Task(0, 2)) }, Global, Schema, mapped, "a");
        Assert.Equal(mapped.TaskOccurrences[1].OccurrenceId, reordered.TaskOccurrences[0].OccurrenceId);
        Assert.Equal(mapped.TaskOccurrences[0].OccurrenceId, reordered.TaskOccurrences[1].OccurrenceId);
        Assert.Throws<InvalidDataException>(() => MfaConfigurationMapper.Map(new() { ["TaskItems"] = new JsonArray(Task(0), Task(0)) }, Global, Schema, new(), "a"));
    }

    [Fact]
    public void FourOptionLayersAndNestedCasesStayIndependentAndUnknownActionsFail()
    {
        JsonArray Values(int index) => new(new JsonObject { ["name"] = "Choice", ["index"] = index });
        var local = new JsonObject { ["TaskItems"] = new JsonArray(Task(1)), ["GlobalOptionItems"] = Values(0),
            ["ResourceOptionItems"] = new JsonObject { ["R"] = Values(1) }, ["ControllerOptionItems"] = new JsonObject { ["PC"] = Values(0) } };
        var mapped = MfaConfigurationMapper.Map(local, Global, Schema, new(), "a");
        Assert.Equal("Y", mapped.Options["Choice"]!.GetValue<string>());
        Assert.Equal("N", mapped.ResourceOptions["Choice"]!.GetValue<string>());
        Assert.Equal("Y", mapped.ControllerOptions["Choice"]!.GetValue<string>());
        Assert.Equal("N", mapped.TaskOccurrences[0].Options["Choice"]!.GetValue<string>());
        local["AfterTask"] = "Shutdown";
        Assert.Contains("AfterTask", Assert.Throws<InvalidDataException>(() => MfaConfigurationMapper.Map(local, Global, Schema, new(), "a")).Message);
        local.Remove("AfterTask"); local["FutureExecutable"] = "run";
        Assert.Contains("FutureExecutable", Assert.Throws<InvalidDataException>(() => MfaConfigurationMapper.Map(local, Global, Schema, new(), "a")).Message);
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public void InactiveSoftwarePathPreservesTasksWithoutLaunchingAndActiveActionsFail(bool inherited)
    {
        var local = new JsonObject { ["TaskItems"] = new JsonArray(Task(1)) };
        var global = Global.DeepClone().AsObject();
        var owner = inherited ? global : local;
        string prefix = inherited ? "Instance.a." : "";
        owner[prefix + "SoftwarePath"] = "D:/Games/Example/Game.exe";
        owner[prefix + "RetryOnDisconnectedWin32"] = false;
        string before = owner.ToJsonString();
        var mapped = MfaConfigurationMapper.Map(local, global, Schema, new(), "a");
        Assert.Single(mapped.TaskOccurrences);
        Assert.False(mapped.HostLaunchRequired);
        Assert.Empty(mapped.HostLaunchConfiguration);
        Assert.Equal(before, owner.ToJsonString());
        owner[prefix + "BeforeTask"] = "StartupSoftware";
        Assert.Contains("BeforeTask", Assert.Throws<InvalidDataException>(() =>
            MfaConfigurationMapper.Map(local, global, Schema, new(), "a")).Message);
        owner.Remove(prefix + "BeforeTask");
        owner[prefix + "RetryOnDisconnectedWin32"] = true;
        Assert.Contains("RetryOnDisconnectedWin32", Assert.Throws<InvalidDataException>(() =>
            MfaConfigurationMapper.Map(local, global, Schema, new(), "a")).Message);
    }

    [Fact]
    public void MfaSourceReaderUsesSelectedGlobalConfigurationAndPreservesSourceBytes()
    {
        string root = Path.Combine(Path.GetTempPath(), "nxp-mfa-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(Path.Combine(root, "config", "instances"));
        try
        {
            File.WriteAllText(Path.Combine(root, "interface.json"), """
                {"interface_version":2,"name":"PI","controller":[{"name":"PC","type":"Win32"}],
                "resource":[{"name":"R","path":"resource"}],"task":[{"name":"T","entry":"Entry"}]}
                """);
            File.WriteAllText(Path.Combine(root, "appsettings.json"), "{\"DefaultConfig\":\"saved\"}");
            File.WriteAllText(Path.Combine(root, "config", "mfa_saved.json"), "{\"CurrentControllerName\":\"PC\",\"Resource\":\"R\"}");
            File.WriteAllText(Path.Combine(root, "config", "config.json"), "{\"CurrentControllerName\":\"OtherAccount\"}");
            string file = Path.Combine(root, "config", "instances", "a.json");
            File.WriteAllText(file, "{\"TaskItems\":[{\"name\":\"T\",\"entry\":\"Entry\",\"default_check\":true}]}\r\n");
            byte[] before = File.ReadAllBytes(file);
            var compiler = new ProjectCompiler(root, "interface.json");
            var mapped = ConfigurationSources.ReadMfa(compiler, new() { PackageRoot = root }, "config/instances/a.json", "a");
            Assert.Equal("PC", mapped.Controller);
            Assert.Contains("config/mfa_saved.json", mapped.SourceBinding!.SourceFiles);
            Assert.DoesNotContain("config/config.json", mapped.SourceBinding.SourceFiles);
            Assert.Equal(before, File.ReadAllBytes(file));
            File.AppendAllText(file, " ");
            Assert.Throws<InvalidDataException>(() => compiler.VerifyReadSnapshot());
        }
        finally { Directory.Delete(root, true); }
    }
}
