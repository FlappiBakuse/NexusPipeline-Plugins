using System.Text.Json.Nodes;
using Xunit;

namespace NexusPipeline.Plugin.MaaFrameworkDriver.Tests;

public sealed class MfaConfigurationTests
{
    [Fact]
    public async Task NativeRecipePlanningUsesOfficialIdentityAndPreservesUnknownInstallBytes()
    {
        string root = Path.Combine(Path.GetTempPath(), "nxp-native-plan-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(root);
        try
        {
            File.WriteAllText(Path.Combine(root, "interface.json"), """
                {"interface_version":2,"name":"MaaEnd","version":"2.32.0","controller":[{"name":"PC","type":"Win32"}],
                "resource":[{"name":"R","path":"resource"}],"task":[{"name":"T","entry":"Entry"}]}
                """);
            var original = new DriverProfile { SchemaVersion = 3, PackageRoot = root, ProfileId = "owned" };
            var bound = NativeDependencies.Bind(original, "MaaEnd", "2.32.0", default);
            Assert.Equal("5.14.2", bound.NativeVersion); Assert.Equal("", original.NativeDirectory);
            var dependency = Assert.IsType<NativeDependencyLock>(bound.DependencyLock);
            Assert.Equal(398872082, dependency.Native.ReleaseId); Assert.Equal(597456451, dependency.Native.AssetId);
            Assert.Equal("e279163bcdcab7c87ebe5a9dd157c47e169c78742dbdcc30d095de55ab0eaa9c", dependency.Native.Sha256);
            Assert.All(dependency.Native.Files, file => Assert.Equal(file.Path, Path.GetFileName(file.Path)));
            Assert.False(Directory.Exists(Path.Combine(root, ".nexus")));
            Assert.Contains("project_recipe_required", Assert.Throws<InvalidDataException>(() => NativeDependencies.Bind(original, "Unknown", "1", default)).Message);
            string target = Path.Combine(root, bound.NativeDirectory.Replace('/', Path.DirectorySeparatorChar));
            Directory.CreateDirectory(target);
            string unknown = Path.Combine(target, "user-data.bin"); byte[] bytes = [0, 255, 1, 254]; File.WriteAllBytes(unknown, bytes);
            var error = await Assert.ThrowsAsync<InvalidDataException>(async () => await NativeDependencies.InstallAsync(bound, "owned", default));
            Assert.Contains("unknown_or_incomplete_target", error.Message); Assert.Equal(bytes, File.ReadAllBytes(unknown));
            Directory.CreateDirectory(Path.Combine(root, "maafw")); File.WriteAllText(Path.Combine(root, "maafw", "MaaFramework.dll"), "unknown bytes; never loaded");
            Assert.Contains("unsupported_version", Assert.Throws<InvalidDataException>(() => NativeDependencies.Bind(original, "MaaEnd", "2.32.0", default)).Message);
        }
        finally { Directory.Delete(root, true); }
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
    private static JsonObject Task(int index, int repeat = 1) => new() { ["name"] = "T", ["entry"] = "Entry",
        ["default_check"] = true, ["repeat_count"] = repeat,
        ["option"] = new JsonArray(new JsonObject { ["name"] = "Choice", ["index"] = index }) };

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
            Assert.Throws<InvalidDataException>(() => SourceDiscovery.Discover(root));
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
