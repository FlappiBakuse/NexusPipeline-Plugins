using System.Diagnostics;
using System.IO.Pipes;
using System.Text.Json;
using System.Text.Json.Nodes;
using NexusPipeline.Plugin.Abstractions;
using Xunit;

namespace NexusPipeline.Plugin.MaaFrameworkDriver.Tests;

public sealed class NativeContractTests
{
    [Theory]
    [InlineData(false, "success", "Win32")]
    [InlineData(true, "success", "Win32")]
    [InlineData(true, "failure", "Win32")]
    [InlineData(true, "cancel", "Win32")]
    [InlineData(true, "secret", "Win32")]
    [InlineData(true, "pretask_failure", "Win32")]
    [InlineData(true, "pretask_timeout", "Win32")]
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
        string root = Path.Combine(Path.GetTempPath(), "nxp-native-contract-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(root);
        await File.WriteAllTextAsync(Path.Combine(root, ".nxp-native-fixture"), "owned-native-contract");
        Process? window = null;
        Process? worker = null;
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
                pi["pretask"] = new JsonObject { ["exec"] = "fixture-agent/NexusPipeline.MaaTestAgent.exe", ["args"] = new JsonArray("--pretask"), ["option"] = new JsonArray("Mode") };
                if (scenario == "pretask_timeout") pi["pretask"]!["timeout"] = 100;
                pi["option"] = new JsonObject { ["Mode"] = new JsonObject { ["cases"] = new JsonArray(new JsonObject { ["name"] = "fixture" }) } };
                await File.WriteAllTextAsync(Path.Combine(root, "interface.json"), pi.ToJsonString());
                await File.WriteAllTextAsync(Path.Combine(root, "resource", "pipeline", "sanity.json"),
                    "{\"Sanity\":{\"recognition\":\"DirectHit\",\"action\":\"Custom\",\"custom_action\":\"FixtureAction\",\"post_delay\":0}}");
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
            window = Process.Start(new ProcessStartInfo(windowExe) { UseShellExecute = false, CreateNoWindow = true,
                RedirectStandardOutput = true, RedirectStandardInput = true, WorkingDirectory = root })!;
            string? handle = await window.StandardOutput.ReadLineAsync().WaitAsync(TimeSpan.FromSeconds(10));
            var profile = new DriverProfile { ProfileId = "native", Revision = "1", PackageRoot = root,
                Controller = "PC", Resource = "Fixture", NativeDirectory = "native", NativeVersion = "v" + expectedVersion,
                WindowHandle = long.Parse(handle!), WindowProcessId = window.Id, WindowExecutable = windowExe, WindowStartedAtUtc = window.StartTime.ToUniversalTime(),
                SelectedTasks = ["Sanity"], AdbPath = controllerType == "Adb" ? adbExe : "", AdbSerial = "nxp-owned-fixture" };
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
            bool pretaskFailure = scenario.StartsWith("pretask_", StringComparison.Ordinal);
            bool setupFailure = pretaskFailure || scenario is "native_version" or "window_mismatch";
            var compiled = new ProjectCompiler(root, "interface.json").Compile(profile);
            var bootstrap = new PluginWorkerBootstrap("nxp-test-e-" + Guid.NewGuid().ToString("N"), "nxp-test-c-" + Guid.NewGuid().ToString("N"),
                Convert.ToHexString(System.Security.Cryptography.RandomNumberGenerator.GetBytes(32)), "execution", "record", 1, Guid.NewGuid().ToString("N"),
                new JsonObject { ["profile"] = JsonSerializer.SerializeToNode(profile), ["compiled"] = JsonSerializer.SerializeToNode(compiled) });
            using var events = new NamedPipeServerStream(bootstrap.EventPipe, PipeDirection.In, 1, PipeTransmissionMode.Byte, PipeOptions.Asynchronous | PipeOptions.CurrentUserOnly);
            using var control = new NamedPipeServerStream(bootstrap.ControlPipe, PipeDirection.Out, 1, PipeTransmissionMode.Byte, PipeOptions.Asynchronous | PipeOptions.CurrentUserOnly);
            var workerInfo = new ProcessStartInfo(Path.Combine(workerRoot, "NexusPipeline.MaaWorker.exe"))
            { UseShellExecute = false, CreateNoWindow = true, RedirectStandardInput = true, RedirectStandardOutput = true,
                RedirectStandardError = true, WorkingDirectory = root };
            workerInfo.Environment["NXP_MAA_FIXTURE"] = "owned-native-contract";
            workerInfo.Environment["NXP_MAA_FIXTURE_ROOT"] = root;
            workerInfo.Environment["NXP_MAA_FIXTURE_SCENARIO"] = scenario;
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
                if (scenario == "cancel" && fact.Kind == "task_event" && fact.Payload["status"]?.GetValue<string>() == "running")
                    await PluginWorkerProtocol.WriteAsync(control, new(1, bootstrap.ExecutionId, bootstrap.RecordId, 1,
                        bootstrap.SessionId, "host_to_worker", 2, "cancel", new()), deadline.Token);
                if (fact.Kind is "completed" or "fault") break;
            }
            await worker.WaitForExitAsync(deadline.Token);
            int expectedExit = scenario == "cancel" ? 2 : scenario == "failure" || setupFailure ? 1 : 0;
            Assert.True(worker.ExitCode == expectedExit, "worker exit=" + worker.ExitCode + "\n" + await stderr + "\n" + await stdout
                + "\n" + JsonSerializer.Serialize(facts));
            Assert.DoesNotContain("fixture-private-echo", await stdout);
            Assert.DoesNotContain("fixture-private-echo", await stderr);
            Assert.DoesNotContain("fixture-private-echo", JsonSerializer.Serialize(facts));
            if (!setupFailure) Assert.Contains(facts, item => item.Kind == "ready" && item.Payload["nativeVersion"]!.GetValue<string>().TrimStart('v') == expectedVersion);
            else Assert.DoesNotContain(facts, item => item.Kind is "ready" or "task_event");
            if (scenario != "cancel" && !setupFailure)
                Assert.Contains(facts, item => item.Kind == "task_event" && item.Payload["taskId"]!.GetValue<string>() == "Sanity"
                    && item.Payload["status"]!.GetValue<string>() == (scenario == "failure" ? "failed" : "succeeded")
                    && item.Payload["nativeTaskId"] is not null);
            else if (scenario == "cancel")
            {
                Assert.Contains(facts, item => item.Kind == "cancel_ack");
                Assert.DoesNotContain(facts, item => item.Kind == "task_event" && item.Payload["status"]?.GetValue<string>() == "succeeded");
            }
            Assert.Equal(expectedExit == 0 ? "completed" : "fault", facts[^1].Kind);
            if (standardAgent)
            {
                if (scenario != "cancel" && !pretaskFailure) Assert.True(File.Exists(Path.Combine(root, "agent-action-ran.marker")));
                var pretask = JsonNode.Parse(await File.ReadAllTextAsync(Path.Combine(root, "pretask-evidence.json")))!;
                Assert.True(pretask["cwdMatches"]!.GetValue<bool>());
                Assert.Equal(2, pretask["argumentCount"]!.GetValue<int>());
                Assert.Equal("fixture", pretask["options"]!["Mode"]!.GetValue<string>());
                if (!pretaskFailure)
                {
                    var agent = JsonNode.Parse(await File.ReadAllTextAsync(Path.Combine(root, "agent-evidence.json")))!;
                    Assert.True(agent["cwdMatches"]!.GetValue<bool>());
                    Assert.True(agent["hasIdentifier"]!.GetValue<bool>());
                    Assert.Equal("v2.10.2", agent["piVersion"]!.GetValue<string>());
                    Assert.Equal("0", await File.ReadAllTextAsync(Path.Combine(root, "agent-exited.marker")));
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
            string? adbCommands = File.Exists(Path.Combine(root, "adb-commands.jsonl"))
                ? await File.ReadAllTextAsync(Path.Combine(root, "adb-commands.jsonl")) : null;
            string evidence = JsonSerializer.Serialize(new { passed, standardAgent, scenario, controllerType, expectedVersion, milliseconds = stopwatch.ElapsedMilliseconds, facts, adbCommands }, new JsonSerializerOptions { WriteIndented = true });
            await File.WriteAllTextAsync(Path.Combine(root, "native-contract-evidence.json"), evidence);
            if (Environment.GetEnvironmentVariable("NEXUS_MAA_REPORT_ROOT") is { Length: > 0 } reports)
            {
                Directory.CreateDirectory(reports);
                await File.WriteAllTextAsync(Path.Combine(reports, "native-" + controllerType.ToLowerInvariant() + "-" + scenario + "-" + (standardAgent ? "agent-" : "plain-") + Guid.NewGuid().ToString("N") + ".json"), evidence);
            }
            // Failed native runs retain their owned directory and raw evidence for diagnosis.
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
