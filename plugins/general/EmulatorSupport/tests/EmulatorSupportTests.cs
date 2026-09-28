using NexusPipeline.Plugin.Abstractions;
using NexusPipeline.Plugin.EmulatorSupport;
using NexusPipeline.Plugin.TestKit;
using Xunit;

namespace NexusPipeline.Plugin.EmulatorSupport.Tests;

public sealed class EmulatorSupportTests
{
    [Fact]
    public async Task Lifecycle_RegistersExactlyOneProviderAndRemovesItOnStop()
    {
        var context = new FakePluginHostContext("EmulatorSupport");
        await using PluginLifecycleHarness harness = await PluginLifecycleHarness.StartAsync(new EntryPoint(), context);
        Assert.Single(context.EmulatorSupport.Providers);

        await harness.StopAsync();
        await harness.StopAsync();
        Assert.Empty(context.EmulatorSupport.Providers);
    }

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
        Assert.True(EmulatorVendorSupport.IsNoxInstanceMatch(numeric[0], "Android7", 0, null));
        Assert.Equal("NoxPlayer", Assert.Single(named).ControlName);
        Assert.True(EmulatorVendorSupport.IsNoxInstanceMatch(named[0], "nox", null, "NoxPlayer"));
        Assert.False(EmulatorVendorSupport.IsNoxInstanceMatch(named[0], "NoxPlayer", null, "NoxPlayer"));
        Assert.True(EmulatorVendorSupport.HasExactProcessId(7456, named[0].ProcessId));
    }

    [Fact]
    public void VendorParsersUsePathIdentityAndPreferStatusPort()
    {
        Assert.Equal(new[] { 62023, 62024 }, EmulatorVendorSupport.ParseNoxVboxAdbPorts(
            "<Forwarding name=\"adb\" proto=\"1\" hostport=\"62023\" guestport=\"5555\"/>\n"
            + "<Forwarding host port=\"62024\" guestport=\"5556\"/>"));
        Assert.True(EmulatorVendorSupport.IsInstanceIdentityMatch("C:\\Nox\\BignoxVMS\\nox\\nox.vbox", "nox"));
        Assert.False(EmulatorVendorSupport.IsInstanceIdentityMatch("C:\\Nox\\BignoxVMS\\NoxPlayer2\\NoxPlayer2.vbox", "NoxPlayer"));

        IReadOnlyList<BlueStacksInstance> instances = EmulatorVendorSupport.ParseBlueStacksConfig(
            "bst.instance.Pie64.adb_port=\"5555\"\n"
            + "bst.instance.Pie64.status.adb_port=\"5557\"\n"
            + "bst.instance.Nougat32.status.adb_port=\"5557\"");
        Assert.Equal(2, instances.Count);
        Assert.Contains(instances, instance => instance.Id == "Pie64" && instance.AdbPort == 5557);
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

        Assert.Equal("0", target.VendorInstanceId);
        Assert.Equal(1200, target.VendorProcessId);
        Assert.Equal("adb.exe", target.VendorAdbExecutable);
        Assert.Equal("雷电模拟器", new LdPlayerEmulatorDriver(target).DisplayName);
    }
}
