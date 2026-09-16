using System.Diagnostics;
using NexusPipeline.Plugin.Abstractions;
using NexusPipeline.Plugin.EmulatorSupport;
using Xunit;

namespace NexusPipeline.Plugin.EmulatorSupport.Tests;

public sealed class EmulatorSupportTests
{
    [Fact]
    public void ParseLdList2_MapsCandidatePortsAndCanonicalProcessId()
    {
        IReadOnlyList<LdPlayerInstance> instances = EmulatorVendorSupport.ParseLdList2(
            "0,LDPlayer,0,0,1,2456,3100\n1,LDPlayer-1,0,0,0,-1,0");

        Assert.Equal(2, instances.Count);
        Assert.Equal("0", instances[0].Index);
        Assert.Equal(2456, instances[0].ProcessId);
        Assert.Null(instances[1].ProcessId);
        Assert.Equal(new[] { 5554, 5555 }, EmulatorVendorSupport.CandidateLdAdbPorts("0"));
    }

    [Fact]
    public void ParseNoxConsoleListSeparatesVmIdentityAndControlSelector()
    {
        IReadOnlyList<NoxInstance> numeric = EmulatorVendorSupport.ParseNoxConsoleList("0,Android7,started");
        IReadOnlyList<NoxInstance> named = EmulatorVendorSupport.ParseNoxConsoleList(
            "nox,NoxPlayer,2032678,1704928,3567547,7456");

        Assert.Equal("Android7", Assert.Single(numeric).Identity);
        Assert.Equal(0, numeric[0].NumericIndex);
        Assert.True(EmulatorVendorSupport.IsNoxInstanceMatch(numeric[0], "Android7", 0, null));
        Assert.Equal("nox", Assert.Single(named).Identity);
        Assert.Equal("NoxPlayer", named[0].ControlName);
        Assert.True(EmulatorVendorSupport.IsNoxInstanceMatch(named[0], "nox", null, "NoxPlayer"));
        Assert.False(EmulatorVendorSupport.IsNoxInstanceMatch(named[0], "NoxPlayer", null, "NoxPlayer"));
        Assert.True(EmulatorVendorSupport.HasExactProcessId(7456, named[0].ProcessId));
        Assert.False(EmulatorVendorSupport.HasExactProcessId(9000, named[0].ProcessId));
    }

    [Fact]
    public void NoxVboxPortMappingUsesPathIdentityAndForwardedHostPorts()
    {
        IReadOnlyList<int> ports = EmulatorVendorSupport.ParseNoxVboxAdbPorts(
            "<Forwarding name=\"adb\" proto=\"1\" hostport=\"62023\" guestport=\"5555\"/>\n"
            + "<Forwarding host port=\"62024\" guestport=\"5556\"/>");

        Assert.Equal(new[] { 62023, 62024 }, ports);
        Assert.True(EmulatorVendorSupport.IsInstanceIdentityMatch(
            "C:\\Nox\\BignoxVMS\\nox\\nox.vbox",
            "nox"));
        Assert.False(EmulatorVendorSupport.IsInstanceIdentityMatch(
            "C:\\Nox\\BignoxVMS\\NoxPlayer2\\NoxPlayer2.vbox",
            "NoxPlayer"));
    }

    [Fact]
    public void ParseBlueStacksConfigPrefersStatusPortAndPreservesAmbiguousInstances()
    {
        IReadOnlyList<BlueStacksInstance> instances = EmulatorVendorSupport.ParseBlueStacksConfig(
            "bst.instance.Pie64.adb_port=\"5555\"\n"
            + "bst.instance.Pie64.status.adb_port=\"5557\"\n"
            + "bst.instance.Nougat32.status.adb_port=\"5557\"");

        Assert.Equal(2, instances.Count);
        Assert.Equal(2, instances.Count(instance => instance.AdbPort == 5557));
        Assert.Contains(instances, instance => instance.Id == "Pie64" && instance.AdbPort == 5557);
        Assert.Contains(instances, instance => instance.Id == "Nougat32" && instance.AdbPort == 5557);
    }

    [Fact]
    public void VendorTargetCarriesFrozenInstanceIdentityAndDriverDisplayName()
    {
        var target = new EmulatorTarget(
            EmulatorKind.LdPlayer,
            "127.0.0.1:5554",
            VendorControlPath: "ldconsole.exe",
            VendorInstanceId: "0",
            VendorAdbExecutable: "adb.exe",
            VendorProcessId: 1200,
            VendorInstallRoot: "C:\\LDPlayer");
        var driver = new LdPlayerEmulatorDriver(target);

        Assert.Equal("0", target.VendorInstanceId);
        Assert.Equal(1200, target.VendorProcessId);
        Assert.Equal("adb.exe", target.VendorAdbExecutable);
        Assert.Equal("雷电模拟器", driver.DisplayName);
    }

    [Fact]
    public async Task RunCommandBoundsDrainWhenDescendantKeepsPipeOpen()
    {
        if (!OperatingSystem.IsWindows()) return;
        string system = Environment.GetFolderPath(Environment.SpecialFolder.System);
        string pingSource = Path.Combine(system, "PING.EXE");
        if (!File.Exists(pingSource)) return;
        string childProcessName = $"nxp{Guid.NewGuid():N}";
        string childExecutable = Path.Combine(AppContext.BaseDirectory, $"{childProcessName}.exe");
        string releaseSignalPath = Path.Combine(Path.GetTempPath(), $"{childProcessName}.ready");
        File.Copy(pingSource, childExecutable);
        string script = CreateCommandFile(
            $"@echo off\r\n"
            + ":wait_for_release\r\n"
            + $"if not exist \"{releaseSignalPath}\" goto wait_for_release\r\n"
            + $"start \"\" /b \"{childExecutable}\" -t 127.0.0.1\r\n"
            + "exit /b 0\r\n");
        Task<(bool Ok, string Output)>? command = null;
        int? descendantProcessId = null;
        try
        {
            command = EmulatorSupport.RunCommandAsync(
                script,
                Array.Empty<string>(),
                timeoutSeconds: 2,
                CancellationToken.None);
            File.WriteAllText(releaseSignalPath, string.Empty);
            descendantProcessId = await WaitForProcessAsync(childProcessName, TimeSpan.FromSeconds(1));
            (bool ok, string output) = await command;

            Assert.False(ok);
            Assert.Contains("超时", output);
            Assert.True(descendantProcessId.HasValue, "descendant test process should have started before pipe-drain timeout");
            Assert.True(await WaitUntilExitedAsync(descendantProcessId.Value, TimeSpan.FromSeconds(3)), "timed out process tree should be terminated");
        }
        finally
        {
            if (command is not null && !command.IsCompleted)
            {
                try { await command.WaitAsync(TimeSpan.FromSeconds(3)); } catch { }
            }
            var cleanupProcessIds = new List<int>();
            foreach (Process process in Process.GetProcessesByName(childProcessName))
            {
                using (process)
                {
                    try
                    {
                        if (process.HasExited) continue;
                        cleanupProcessIds.Add(process.Id);
                        process.Kill(entireProcessTree: true);
                    }
                    catch (InvalidOperationException) { }
                }
            }
            foreach (int processId in cleanupProcessIds)
            {
                await WaitUntilExitedAsync(processId, TimeSpan.FromSeconds(3));
            }
            TryDeleteFile(releaseSignalPath);
            TryDeleteFile(childExecutable);
            TryDeleteFile(script);
        }
    }

    [Fact]
    public async Task RunBinaryCommandBoundsWaitWhenStdoutClosesBeforeProcessExit()
    {
        if (!OperatingSystem.IsWindows()) return;
        string system = Environment.GetFolderPath(Environment.SpecialFolder.System);
        string powershell = Path.Combine(system, "WindowsPowerShell", "v1.0", "powershell.exe");
        if (!File.Exists(powershell)) return;

        PluginEmulatorBinaryResult result = await EmulatorSupport.RunBinaryCommandAsync(
            powershell,
            new[]
            {
                "-NoProfile",
                "-NonInteractive",
                "-Command",
                "[Console]::OpenStandardOutput().Dispose(); Start-Sleep -Seconds 10",
            },
            timeoutSeconds: 1,
            CancellationToken.None);

        Assert.False(result.Ok);
        Assert.Contains("超时", result.Error);
    }

    [Fact]
    public async Task RunCommandCancellationTerminatesTheOwnedProcessTree()
    {
        if (!OperatingSystem.IsWindows()) return;
        string script = CreateCommandFile("@echo off\r\nping 127.0.0.1 -n 15 > nul\r\n");
        using var cancellation = new CancellationTokenSource(TimeSpan.FromMilliseconds(150));
        try
        {
            await Assert.ThrowsAnyAsync<OperationCanceledException>(() => EmulatorSupport.RunCommandAsync(
                script,
                Array.Empty<string>(),
                timeoutSeconds: 20,
                cancellation.Token));
        }
        finally
        {
            File.Delete(script);
        }
    }

    private static string CreateCommandFile(string contents)
    {
        string path = Path.Combine(Path.GetTempPath(), $"nxp-emulator-{Guid.NewGuid():N}.cmd");
        File.WriteAllText(path, contents);
        return path;
    }

    private static async Task<bool> WaitUntilExitedAsync(int processId, TimeSpan timeout)
    {
        DateTime deadline = DateTime.UtcNow + timeout;
        while (DateTime.UtcNow < deadline)
        {
            try
            {
                using Process process = Process.GetProcessById(processId);
                if (process.HasExited) return true;
            }
            catch (ArgumentException)
            {
                return true;
            }
            await Task.Delay(50);
        }
        return false;
    }

    private static async Task<int?> WaitForProcessAsync(string processName, TimeSpan timeout)
    {
        DateTime deadline = DateTime.UtcNow + timeout;
        while (DateTime.UtcNow < deadline)
        {
            foreach (Process process in Process.GetProcessesByName(processName))
            {
                using (process)
                {
                    try
                    {
                        if (!process.HasExited) return process.Id;
                    }
                    catch (InvalidOperationException) { }
                }
            }
            await Task.Delay(25);
        }
        return null;
    }

    private static void TryDeleteFile(string path)
    {
        try { File.Delete(path); }
        catch (IOException) { }
        catch (UnauthorizedAccessException) { }
    }
}
