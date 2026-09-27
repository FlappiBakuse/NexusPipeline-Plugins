using System.Diagnostics;
using System.IO.Pipes;
using System.Text.Json;
using System.Text.Json.Nodes;
using NexusPipeline.Plugin.Abstractions;
using Xunit;

namespace NexusPipeline.Plugin.MaaFrameworkDriver.Tests;

public sealed class NativeContractTests
{
    [Fact]
    [Trait("Category", "Native")]
    public Task StandardAgentAtFixedDiagnosticPath() =>
        OfficialNativeControllerRunsOnlyInAuthenticatedWorker(true, "success", "Win32");

    [Fact]
    [Trait("Category", "Native")]
    public async Task AgentCancellationAndFailureAllowFreshSessions()
    {
        foreach (string scenario in new[] { "cancel", "success", "success", "failure", "success" })
            await OfficialNativeControllerRunsOnlyInAuthenticatedWorker(true, scenario, "Win32");
    }

    [Theory]
    [InlineData(false, "success", "Win32")]
    [InlineData(true, "success", "Win32")]
    [InlineData(true, "failure", "Win32")]
    [InlineData(true, "cancel", "Win32")]
    [InlineData(true, "secret", "Win32")]
    [InlineData(true, "argv", "Win32")]
    [InlineData(false, "rediscover", "Win32")]
    [InlineData(true, "pretask_window", "Win32")]
    [InlineData(false, "ambiguous", "Win32")]
    [InlineData(false, "host_window", "Win32")]
    [InlineData(false, "host_lifetime_mismatch", "Win32")]
    [InlineData(false, "cancel_window", "Win32")]
    [InlineData(false, "workspace_collision", "Win32")]
    [InlineData(false, "compiled_schema", "Win32")]
    [InlineData(true, "pretask_failure", "Win32")]
    [InlineData(true, "pretask_timeout", "Win32")]
    [InlineData(true, "pretask_no_option", "Win32")]
    [InlineData(true, "pretask_sequence", "Win32")]
    [InlineData(false, "callback_storm", "Win32")]
    [InlineData(true, "callback_storm_cancel", "Win32")]
    [InlineData(false, "workspace_link", "Win32")]
    [InlineData(true, "agent_unresponsive", "Win32")]
    [InlineData(true, "agent_disconnect", "Win32")]
    [InlineData(false, "native_version", "Win32")]
    [InlineData(false, "window_mismatch", "Win32")]
    [InlineData(false, "expand", "Adb")]
    [InlineData(false, "success", "Adb")]
    [InlineData(true, "success", "Adb")]
    [InlineData(false, "stella_runtime", "Win32")]
    [InlineData(true, "stella_runtime", "Win32")]
    [InlineData(true, "stella_runtime", "Adb")]
    [Trait("Category", "Native")]
    public async Task OfficialNativeControllerRunsOnlyInAuthenticatedWorker(bool standardAgent, string scenario, string controllerType)
    {
        string nativeSource = Environment.GetEnvironmentVariable("NEXUS_MAA_NATIVE_ROOT")
            ?? throw new InvalidOperationException("NEXUS_MAA_NATIVE_ROOT required: pinned official x64 native assets");
        string expectedVersion = "5.14.0";
        if (scenario == "stella_runtime")
        {
            string projects = Environment.GetEnvironmentVariable("NEXUS_MAA_OFFICIAL_PROJECTS")
                ?? throw new InvalidOperationException("Pinned official projects required");
            Assert.True(File.Exists(Path.Combine(projects, ".nxp-project-test-owned")));
            var stella = JsonNode.Parse(await File.ReadAllTextAsync(Path.Combine(projects, "inputs.json")))!.AsArray()
                .OfType<JsonObject>().Single(item => item["name"]!.GetValue<string>() == "MaaStellaSora");
            nativeSource = Path.Combine(stella["root"]!.GetValue<string>(), stella["nativeDirectory"]!.GetValue<string>());
            expectedVersion = "5.13.0";
        }
        string workerRoot = Environment.GetEnvironmentVariable("NEXUS_MAA_WORKER_ROOT")
            ?? throw new InvalidOperationException("NEXUS_MAA_WORKER_ROOT required: built worker from this source");
        string plugin = FindPlugin();
        string configuration = AppContext.BaseDirectory.Split(Path.DirectorySeparatorChar)
            .Last(part => part is "Debug" or "Release");
        string fixtureBase = Environment.GetEnvironmentVariable("NEXUS_MAA_FIXTURE_ROOT") ?? Path.GetTempPath();
        if (!Path.IsPathFullyQualified(fixtureBase) || !Directory.Exists(fixtureBase)
            || (File.GetAttributes(fixtureBase) & FileAttributes.ReparsePoint) != 0)
            throw new InvalidDataException("native fixture root must be an existing absolute ordinary directory");
        if (Environment.GetEnvironmentVariable("NEXUS_MAA_FIXTURE_ROOT") is not null
            && !File.Exists(Path.Combine(fixtureBase, ".nxp-native-fixture-root")))
            throw new InvalidDataException("native fixture root ownership missing");
        string caseId = Environment.GetEnvironmentVariable("NEXUS_MAA_CASE_ID") ?? Guid.NewGuid().ToString("N");
        if (caseId.Length is < 1 or > 64 || caseId.Any(c => !char.IsAsciiLetterOrDigit(c) && c is not '-' and not '_'))
            throw new InvalidDataException("native case identity invalid");
        string root = Path.Combine(fixtureBase, "nxp-native-contract-" + caseId);
        if (Directory.Exists(root)) throw new InvalidDataException("native case directory already exists");
        Directory.CreateDirectory(root);
        await File.WriteAllTextAsync(Path.Combine(root, ".nxp-native-fixture"), "owned-native-contract");
        Process? window = null;
        Process? worker = null;
        Process? otherWindow = null;
        bool passed = false;
        var facts = new List<PluginWorkerEnvelope>();
        var stopwatch = Stopwatch.StartNew();
        try
        {
            Copy(Path.Combine(plugin, "tests", "fixtures", "standard-pi"), root);
            Copy(nativeSource, Path.Combine(root, "native"));
            if (standardAgent)
            {
                Copy(Path.Combine(plugin, "tests", "NativeAgent", "bin", configuration, "net8.0-windows", "win-x64"), Path.Combine(root, "fixture-agent"));
                var pi = JsonNode.Parse(await File.ReadAllTextAsync(Path.Combine(root, "interface.json")))!.AsObject();
                pi["agent"] = new JsonObject { ["child_exec"] = "fixture-agent/NexusPipeline.MaaTestAgent.exe", ["child_args"] = new JsonArray() };
                if (scenario is "agent_unresponsive" or "agent_disconnect") pi["agent"]!["timeout"] = 500;
                pi["pretask"] = new JsonObject { ["exec"] = "fixture-agent/NexusPipeline.MaaTestAgent.exe", ["args"] = new JsonArray("--pretask"), ["option"] = new JsonArray("Mode") };
                if (scenario == "pretask_timeout") pi["pretask"]!["timeout"] = 100;
                if (scenario == "argv")
                {
                    pi["agent"]!["child_args"] = new JsonArray("{literal}", " { \"key\" : \"secret:literal\" } ", "secret:literal", "", "中文", "a\"b");
                    pi["pretask"]!["args"] = new JsonArray("--pretask", "{literal}", " { \"key\" : \"secret:literal\" } ", "secret:literal", "", "中文", "a\"b");
                }
                pi["option"] = new JsonObject { ["Mode"] = new JsonObject { ["cases"] = new JsonArray(new JsonObject { ["name"] = "fixture" }) } };
                if (scenario == "pretask_no_option") pi["pretask"]!.AsObject().Remove("option");
                if (scenario == "pretask_sequence")
                {
                    var other = pi["controller"]![0]!.DeepClone().AsObject();
                    other["name"] = "Other";
                    pi["controller"]!.AsArray().Add(other);
                    JsonObject Step(string label, string controller) => new() { ["exec"] = "fixture-agent/NexusPipeline.MaaTestAgent.exe",
                        ["args"] = new JsonArray("--pretask", label), ["option"] = new JsonArray("Mode"), ["controller"] = new JsonArray(controller) };
                    pi["pretask"] = new JsonArray(Step("main-first", "PC"), Step("filtered-out", "Other"));
                    pi["import"] = new JsonArray("extra.json");
                    await File.WriteAllTextAsync(Path.Combine(root, "extra.json"), new JsonObject { ["pretask"] = new JsonArray(Step("import-first", "PC"), Step("import-second", "PC")) }.ToJsonString());
                }
                await File.WriteAllTextAsync(Path.Combine(root, "interface.json"), pi.ToJsonString());
                await File.WriteAllTextAsync(Path.Combine(root, "resource", "pipeline", "sanity.json"),
                    "{\"Sanity\":{\"recognition\":\"DirectHit\",\"action\":\"Custom\",\"custom_action\":\"FixtureAction\",\"post_delay\":0}}");
            }
            if (scenario.StartsWith("callback_storm", StringComparison.Ordinal))
            {
                var pipeline = new JsonObject();
                for (int i = 0; i < 64; i++)
                {
                    string node = i == 0 ? "Sanity" : "Noise" + i;
                    pipeline[node] = new JsonObject { ["recognition"] = "DirectHit", ["action"] = "DoNothing", ["post_delay"] = 0,
                        ["next"] = i == 63 ? new JsonArray() : new JsonArray("Noise" + (i + 1)) };
                }
                await File.WriteAllTextAsync(Path.Combine(root, "resource", "pipeline", "sanity.json"), pipeline.ToJsonString());
            }
            string adbExe = Path.Combine(plugin, "tests", "NativeAdb", "bin", configuration, "net8.0-windows", "NexusPipeline.MaaTestAdb.exe");
            if (controllerType == "Adb")
            {
                var pi = JsonNode.Parse(await File.ReadAllTextAsync(Path.Combine(root, "interface.json")))!.AsObject();
                pi["controller"]![0]!["type"] = "Adb";
                pi["controller"]![0]!.AsObject().Remove("win32");
                await File.WriteAllTextAsync(Path.Combine(root, "interface.json"), pi.ToJsonString());
                if (!standardAgent)
                    await File.WriteAllTextAsync(Path.Combine(root, "resource", "pipeline", "sanity.json"),
                        "{\"Sanity\":{\"recognition\":\"DirectHit\",\"action\":\"ClickKey\",\"key\":66,\"post_delay\":0}}");
            }
            string windowExe = Path.Combine(plugin, "tests", "NativeWindow", "bin", configuration, "net8.0-windows", "NexusPipeline.MaaTestWindow.exe");
            async Task<(Process Process, string Handle)> OpenWindow()
            {
                var opened = Process.Start(new ProcessStartInfo(windowExe) { UseShellExecute = false, CreateNoWindow = true,
                    RedirectStandardOutput = true, RedirectStandardInput = true, WorkingDirectory = root })!;
                return (opened, (await opened.StandardOutput.ReadLineAsync().WaitAsync(TimeSpan.FromSeconds(10)))!);
            }
            string handle = "0";
            if (scenario is not ("pretask_window" or "cancel_window")) (window, handle) = await OpenWindow();
            var profile = new DriverProfile { ProfileId = "native", Revision = "1", PackageRoot = root,
                Controller = "PC", Resource = "Fixture", NativeDirectory = "native", NativeVersion = "v" + expectedVersion,
                WindowHandle = long.Parse(handle), WindowProcessId = window?.Id ?? 0, WindowExecutable = windowExe, WindowStartedAtUtc = window?.StartTime.ToUniversalTime(),
                SelectedTasks = ["Sanity"], AdbPath = controllerType == "Adb" ? adbExe : "", AdbSerial = "nxp-owned-fixture" };
            if (scenario is "rediscover" or "pretask_window" or "ambiguous" or "host_window" or "host_lifetime_mismatch" or "cancel_window")
                profile = profile with { SchemaVersion = 2, WindowSelection = "executable", WindowWaitMilliseconds = 1500 };
            if (scenario == "rediscover")
            {
                await window!.StandardInput.WriteLineAsync("close"); window.StandardInput.Close(); await window.WaitForExitAsync(); window.Dispose();
                (window, _) = await OpenWindow();
                Assert.NotEqual(profile.WindowProcessId, window.Id);
            }
            if (scenario is "ambiguous" or "host_window") (otherWindow, _) = await OpenWindow();
            if (scenario == "pretask_window") await File.WriteAllTextAsync(Path.Combine(root, ".nxp-maa-project-owned"), "owned-native-contract");
            if (scenario == "native_version") profile = profile with { NativeVersion = "v5.13.0" };
            if (scenario == "window_mismatch")
            {
                var pi = JsonNode.Parse(await File.ReadAllTextAsync(Path.Combine(root, "interface.json")))!;
                pi["controller"]![0]!["win32"]!["window_regex"] = "^foreign-window-that-does-not-exist$";
                await File.WriteAllTextAsync(Path.Combine(root, "interface.json"), pi.ToJsonString());
            }
            if (scenario == "expand")
            {
                var pi = JsonNode.Parse(await File.ReadAllTextAsync(Path.Combine(root, "interface.json")))!;
                pi["controller"]![0]!.AsObject().Remove("display_raw");
                pi["controller"]![0]!["display_expand"] = new JsonArray(800, 600);
                await File.WriteAllTextAsync(Path.Combine(root, "interface.json"), pi.ToJsonString());
            }
            bool pretaskFailure = scenario is "pretask_failure" or "pretask_timeout";
            bool agentFailure = scenario is "agent_unresponsive" or "agent_disconnect";
            bool setupFailure = pretaskFailure || agentFailure || scenario is "native_version" or "window_mismatch" or "ambiguous" or "host_lifetime_mismatch" or "cancel_window" or "workspace_collision" or "workspace_link" or "compiled_schema";
            var compiled = new ProjectCompiler(root, "interface.json").Compile(profile);
            if (scenario == "compiled_schema") compiled = compiled with { SchemaVersion = 1 };
            var bootstrap = new PluginWorkerBootstrap("nxp-test-e-" + Guid.NewGuid().ToString("N"), "nxp-test-c-" + Guid.NewGuid().ToString("N"),
                Convert.ToHexString(System.Security.Cryptography.RandomNumberGenerator.GetBytes(32)), "execution", "record", 1, Guid.NewGuid().ToString("N"),
                new JsonObject { ["profile"] = JsonSerializer.SerializeToNode(profile), ["compiled"] = JsonSerializer.SerializeToNode(compiled) });
            string sessionDirectory = Path.Combine(workerRoot, ".nxp-maa-session-" + bootstrap.SessionId);
            if (scenario == "workspace_collision")
            {
                Directory.CreateDirectory(sessionDirectory);
                await File.WriteAllTextAsync(Path.Combine(sessionDirectory, "unknown.txt"), "foreign existing bytes must remain");
            }
            if (scenario is "host_window" or "host_lifetime_mismatch")
                bootstrap.Input["hostLaunchTarget"] = JsonSerializer.SerializeToNode(new PluginProviderLaunchTarget("win32", windowExe,
                    window!.Id, long.Parse(handle), scenario == "host_window" ? window.StartTime.ToUniversalTime() : window.StartTime.ToUniversalTime().AddSeconds(-1)));
            using var events = new NamedPipeServerStream(bootstrap.EventPipe, PipeDirection.In, 1, PipeTransmissionMode.Byte, PipeOptions.Asynchronous | PipeOptions.CurrentUserOnly);
            using var control = new NamedPipeServerStream(bootstrap.ControlPipe, PipeDirection.Out, 1, PipeTransmissionMode.Byte, PipeOptions.Asynchronous | PipeOptions.CurrentUserOnly);
            string launchRoot = workerRoot;
            if (scenario == "workspace_link")
            {
                launchRoot = Path.Combine(root, "linked-worker");
                using var link = Process.Start(new ProcessStartInfo(Environment.GetEnvironmentVariable("ComSpec")!)
                { UseShellExecute = false, CreateNoWindow = true, Arguments = $"/d /c mklink /J \"{launchRoot}\" \"{workerRoot}\"" })!;
                await link.WaitForExitAsync(); Assert.Equal(0, link.ExitCode);
            }
            var workerInfo = new ProcessStartInfo(Path.Combine(launchRoot, "NexusPipeline.MaaWorker.exe"))
            { UseShellExecute = false, CreateNoWindow = true, RedirectStandardInput = true, RedirectStandardOutput = true,
                RedirectStandardError = true, WorkingDirectory = root };
            workerInfo.Environment["NXP_MAA_FIXTURE"] = "owned-native-contract";
            workerInfo.Environment["NXP_MAA_FIXTURE_ROOT"] = root;
            workerInfo.Environment["NXP_MAA_FIXTURE_SCENARIO"] = scenario;
            workerInfo.Environment["NXP_MAA_WINDOW_FIXTURE"] = windowExe;
            foreach (string variable in new[] { "TEMP", "TMP" })
                if (Environment.GetEnvironmentVariable("NEXUS_MAA_CHILD_" + variable) is { } value)
                    workerInfo.Environment[variable] = value;
            worker = Process.Start(workerInfo)!;
            Task<string> stderr = worker.StandardError.ReadToEndAsync();
            Task<string> stdout = worker.StandardOutput.ReadToEndAsync();
            await worker.StandardInput.WriteLineAsync(JsonSerializer.Serialize(bootstrap, PluginWorkerProtocol.Json));
            worker.StandardInput.Close();
            using var deadline = new CancellationTokenSource(TimeSpan.FromSeconds(30));
            await Task.WhenAll(events.WaitForConnectionAsync(deadline.Token), control.WaitForConnectionAsync(deadline.Token));
            var hello = await PluginWorkerProtocol.ReadAsync(events, deadline.Token);
            PluginWorkerProtocol.Validate(hello, bootstrap, "worker_to_host", 1);
            Assert.Equal(bootstrap.Nonce, hello.Payload["nonce"]!.GetValue<string>());
            await PluginWorkerProtocol.WriteAsync(control, new(1, bootstrap.ExecutionId, bootstrap.RecordId, 1, bootstrap.SessionId, "host_to_worker", 1, "start", new()), deadline.Token);
            while (true)
            {
                var fact = await PluginWorkerProtocol.ReadAsync(events, deadline.Token);
                PluginWorkerProtocol.Validate(fact, bootstrap, "worker_to_host", facts.Count + 2);
                facts.Add(fact);
                if (scenario is "cancel" or "callback_storm_cancel" && fact.Kind == "task_event" && fact.Payload["status"]?.GetValue<string>() == "running")
                    await PluginWorkerProtocol.WriteAsync(control, new(1, bootstrap.ExecutionId, bootstrap.RecordId, 1,
                        bootstrap.SessionId, "host_to_worker", 2, "cancel", new()), deadline.Token);
                if (scenario == "cancel_window" && fact.Kind == "progress" && fact.Payload["code"]?.GetValue<string>() == "controller.resolve.enter")
                    await PluginWorkerProtocol.WriteAsync(control, new(1, bootstrap.ExecutionId, bootstrap.RecordId, 1,
                        bootstrap.SessionId, "host_to_worker", 2, "cancel", new()), deadline.Token);
                if (fact.Kind is "completed" or "fault") break;
            }
            await worker.WaitForExitAsync(deadline.Token);
            bool taskCancelled = scenario is "cancel" or "callback_storm_cancel";
            int expectedExit = taskCancelled || scenario == "cancel_window" ? 2 : scenario == "failure" || setupFailure ? 1 : 0;
            Assert.True(worker.ExitCode == expectedExit, "worker exit=" + worker.ExitCode + "\n" + await stderr + "\n" + await stdout
                + "\n" + JsonSerializer.Serialize(facts));
            Assert.DoesNotContain("fixture-private-echo", await stdout);
            Assert.DoesNotContain("fixture-private-echo", await stderr);
            Assert.DoesNotContain("fixture-private-echo", JsonSerializer.Serialize(facts));
            if (!setupFailure) Assert.Contains(facts, item => item.Kind == "ready" && item.Payload["nativeVersion"]!.GetValue<string>().TrimStart('v') == expectedVersion);
            else if (scenario != "agent_disconnect") Assert.DoesNotContain(facts, item => item.Kind is "ready" or "task_event");
            if (agentFailure) Assert.DoesNotContain(facts, item => item.Kind == "task_event");
            if (!taskCancelled && !setupFailure)
                Assert.Contains(facts, item => item.Kind == "task_event" && item.Payload["taskId"]!.GetValue<string>() == "Sanity"
                    && item.Payload["status"]!.GetValue<string>() == (scenario == "failure" ? "failed" : "succeeded")
                    && item.Payload["nativeTaskId"] is not null);
            else if (taskCancelled)
            {
                Assert.Contains(facts, item => item.Kind == "cancel_ack");
                Assert.DoesNotContain(facts, item => item.Kind == "task_event" && item.Payload["status"]?.GetValue<string>() == "succeeded");
            }
            Assert.Equal(expectedExit == 0 ? "completed" : "fault", facts[^1].Kind);
            if (scenario == "workspace_collision")
            {
                Assert.Equal("worker.session_path_exists", facts[^1].Payload["code"]!.GetValue<string>());
                Assert.Equal("session.workspace.create", facts[^1].Payload["phase"]!.GetValue<string>());
                Assert.Equal("foreign existing bytes must remain", await File.ReadAllTextAsync(Path.Combine(sessionDirectory, "unknown.txt")));
                Assert.False(File.Exists(Path.Combine(sessionDirectory, ".nxp-owned-session.json")));
            }
            else if (scenario == "workspace_link")
            {
                Assert.Equal("worker.session_path_link", facts[^1].Payload["code"]!.GetValue<string>());
                Assert.Equal("session.workspace.create", facts[^1].Payload["phase"]!.GetValue<string>());
                Assert.False(Directory.Exists(sessionDirectory));
            }
            else Assert.Contains(facts, item => item.Kind == "progress" && item.Payload["code"]?.GetValue<string>() == "session.cleanup.exit");
            if (scenario == "compiled_schema")
                Assert.Equal("worker.compiled_schema", facts[^1].Payload["code"]!.GetValue<string>());
            if (expectedExit is 0 or 2) Assert.False(Directory.Exists(sessionDirectory));
            else if (scenario is not ("workspace_collision" or "workspace_link"))
            {
                Assert.True(File.Exists(Path.Combine(sessionDirectory, ".nxp-owned-session.json")));
                Assert.True(File.Exists(Path.Combine(sessionDirectory, "failure.json")));
            }
            if (standardAgent)
            {
                if (!taskCancelled && !pretaskFailure && !agentFailure && scenario != "callback_storm_cancel") Assert.True(File.Exists(Path.Combine(root, "agent-action-ran.marker")));
                var pretask = JsonNode.Parse(await File.ReadAllTextAsync(Path.Combine(root, "pretask-evidence.json")))!;
                Assert.True(pretask["cwdMatches"]!.GetValue<bool>());
                Assert.Equal(scenario == "argv" ? 8 : scenario == "pretask_no_option" ? 1 : scenario == "pretask_sequence" ? 3 : 2, pretask["argumentCount"]!.GetValue<int>());
                if (scenario == "pretask_no_option")
                {
                    Assert.Null(pretask["options"]);
                    Assert.Equal(new[] { "--pretask" }, pretask["rawArguments"]!.Deserialize<string[]>());
                }
                else Assert.Equal("fixture", pretask["options"]!["Mode"]!.GetValue<string>());
                if (scenario == "pretask_sequence")
                {
                    var order = File.ReadAllLines(Path.Combine(root, "pretask-order.jsonl")).Select(line => JsonNode.Parse(line)!["label"]!.GetValue<string>()).ToArray();
                    Assert.Equal(new[] { "main-first", "import-first", "import-second" }, order);
                    int controller = facts.FindIndex(item => item.Payload["code"]?.GetValue<string>() == "controller.create.enter");
                    Assert.Equal(3, facts.Take(controller).Count(item => item.Payload["code"]?.GetValue<string>() == "pretask.process.exit"));
                }
                if (!pretaskFailure)
                {
                    var agent = JsonNode.Parse(await File.ReadAllTextAsync(Path.Combine(root, "agent-evidence.json")))!;
                    Assert.True(agent["cwdMatches"]!.GetValue<bool>());
                    Assert.True(agent["hasIdentifier"]!.GetValue<bool>());
                    if (scenario == "argv")
                    {
                        string[] raw = ["{literal}", " { \"key\" : \"secret:literal\" } ", "secret:literal", "", "中文", "a\"b"];
                        Assert.Equal(raw, agent["rawArguments"]!.Deserialize<string[]>());
                        Assert.Equal(new[] { "--pretask" }.Concat(raw), pretask["rawArguments"]!.Deserialize<string[]>());
                    }
                    Assert.Equal("v2.10.2", agent["piVersion"]!.GetValue<string>());
                    if (agentFailure)
                    {
                        string code = facts[^1].Payload["code"]!.GetValue<string>();
                        if (scenario == "agent_disconnect") Assert.Contains(code, new[] { "worker.agent_disconnected", "worker.agent_connection_failed" });
                        else Assert.Equal("worker.agent_connection_failed", code);
                        Assert.Equal(code == "worker.agent_disconnected" ? "agent.health" : "agent.connect", facts[^1].Payload["phase"]!.GetValue<string>());
                        Assert.Equal(code == "worker.agent_disconnected", facts.Any(item => item.Kind == "ready"));
                        Assert.False(File.Exists(Path.Combine(root, "agent-action-ran.marker")));
                        try
                        {
                            using var stopped = Process.GetProcessById(agent["pid"]!.GetValue<int>());
                            Assert.True(stopped.HasExited || stopped.StartTime.ToUniversalTime().ToString("O") != agent["startedUtc"]!.GetValue<string>());
                        }
                        catch (ArgumentException) { }
                    }
                    else Assert.Equal("0", await File.ReadAllTextAsync(Path.Combine(root, "agent-exited.marker")));
                }
                else
                {
                    Assert.False(File.Exists(Path.Combine(root, "agent-evidence.json")));
                    try
                    {
                        using var stopped = Process.GetProcessById(pretask["pid"]!.GetValue<int>());
                        Assert.True(stopped.HasExited || stopped.StartTime.ToUniversalTime().ToString("O") != pretask["startedUtc"]!.GetValue<string>());
                    }
                    catch (ArgumentException) { }
                }
            }
            if (scenario == "callback_storm")
            {
                var summary = Assert.Single(facts, item => item.Payload["code"]?.GetValue<string>() == "native.callbacks.summary");
                Assert.True(summary.Payload["received"]!.GetValue<long>() > 256);
                Assert.True(summary.Payload["published"]!.GetValue<long>() < summary.Payload["received"]!.GetValue<long>());
                Assert.True(facts.Count < 100);
            }
            if (controllerType == "Adb")
            {
                string commands = await File.ReadAllTextAsync(Path.Combine(root, "adb-commands.jsonl"));
                Assert.Contains("devices", commands); Assert.Contains("screencap", commands);
                if (!standardAgent) Assert.Contains("keyevent", commands);
            }
            passed = true;
        }
        finally
        {
            // Both Process objects are freshly created in this test, never taken from a PID file.
            if (worker is { HasExited: false }) { worker.Kill(entireProcessTree: true); await worker.WaitForExitAsync(); }
            worker?.Dispose();
            if (window is { HasExited: false })
            {
                await window.StandardInput.WriteLineAsync("close"); window.StandardInput.Close();
                try { await window.WaitForExitAsync().WaitAsync(TimeSpan.FromSeconds(5)); }
                catch (TimeoutException) { window.Kill(); await window.WaitForExitAsync(); }
            }
            window?.Dispose();
            if (otherWindow is { HasExited: false }) { await otherWindow.StandardInput.WriteLineAsync("close"); otherWindow.StandardInput.Close(); await otherWindow.WaitForExitAsync(); }
            otherWindow?.Dispose();
            if (scenario == "pretask_window" && File.Exists(Path.Combine(root, "window-identity.json")))
            {
                var owned = JsonNode.Parse(await File.ReadAllTextAsync(Path.Combine(root, "window-identity.json")))!;
                try
                {
                    using var created = Process.GetProcessById(owned["pid"]!.GetValue<int>());
                    string expectedImage = Path.Combine(plugin, "tests", "NativeWindow", "bin", configuration, "net8.0-windows", "NexusPipeline.MaaTestWindow.exe");
                    if (created.StartTime.ToUniversalTime().ToString("O") != owned["startedAtUtc"]!.GetValue<string>()
                        || !string.Equals(created.MainModule?.FileName, expectedImage, StringComparison.OrdinalIgnoreCase))
                        throw new InvalidDataException("pretask fixture process ownership changed");
                    await File.WriteAllTextAsync(Path.Combine(root, "stop-window"), "owned test finished");
                    await created.WaitForExitAsync().WaitAsync(TimeSpan.FromSeconds(5));
                }
                catch (ArgumentException) { }
            }
            string? adbCommands = File.Exists(Path.Combine(root, "adb-commands.jsonl"))
                ? await File.ReadAllTextAsync(Path.Combine(root, "adb-commands.jsonl")) : null;
            string evidence = JsonSerializer.Serialize(new { passed, standardAgent, scenario, controllerType, expectedVersion,
                fixtureRoot = root, processTemp = worker?.StartInfo.Environment["TEMP"], processTmp = worker?.StartInfo.Environment["TMP"],
                milliseconds = stopwatch.ElapsedMilliseconds, facts, adbCommands }, new JsonSerializerOptions { WriteIndented = true });
            await File.WriteAllTextAsync(Path.Combine(root, "native-contract-evidence.json"), evidence);
            if (Environment.GetEnvironmentVariable("NEXUS_MAA_REPORT_ROOT") is { Length: > 0 } reports)
            {
                Directory.CreateDirectory(reports);
                await File.WriteAllTextAsync(Path.Combine(reports, "native-" + controllerType.ToLowerInvariant() + "-" + scenario + "-" + (standardAgent ? "agent-" : "plain-") + Guid.NewGuid().ToString("N") + ".json"), evidence);
            }
            // Failed native runs retain their owned directory and raw evidence for diagnosis.
            if (scenario == "workspace_link" && Directory.Exists(Path.Combine(root, "linked-worker"))) Directory.Delete(Path.Combine(root, "linked-worker"));
            if (passed) Directory.Delete(root, true);
        }
    }

    private static string FindPlugin()
    {
        for (string? path = AppContext.BaseDirectory; path is not null; path = Path.GetDirectoryName(path))
            if (File.Exists(Path.Combine(path, "plugin.json")) && Directory.Exists(Path.Combine(path, "core"))) return path;
        throw new InvalidOperationException("plugin source root missing");
    }
    private static void Copy(string source, string target)
    {
        Directory.CreateDirectory(target);
        foreach (string file in Directory.EnumerateFiles(source, "*", SearchOption.AllDirectories))
        {
            string path = Path.Combine(target, Path.GetRelativePath(source, file));
            Directory.CreateDirectory(Path.GetDirectoryName(path)!); File.Copy(file, path);
        }
    }
}
