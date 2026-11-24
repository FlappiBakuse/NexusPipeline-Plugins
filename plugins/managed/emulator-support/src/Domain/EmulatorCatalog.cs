namespace NexusPipeline.Extensions.EmulatorSupport;

internal static class EmulatorVendors
{
    // Captured installation identities include this spelling; saved selections use lowercase.
    internal const string LdPlayer = "LdPlayer";
    internal const string Nox = "Nox";
    internal const string BlueStacks = "BlueStacks";
    internal static readonly string[] All = [LdPlayer, Nox, BlueStacks];
    internal static int EvidenceCode(string vendor) => vendor switch
    {
        LdPlayer => 0, Nox => 1, BlueStacks => 2,
        _ => throw new EmulatorFailure("emulator_installation_identity_invalid")
    };
}

internal static class EmulatorLayouts
{
    internal static readonly IReadOnlyList<EmulatorLayout> All = [
        new(EmulatorVendors.LdPlayer, "雷电模拟器", ["ldplayer", "leidian"],
            ["ldconsole.exe", "dnconsole.exe", "LDPlayer9/ldconsole.exe", "LDPlayer9/dnconsole.exe", "LDPlayer/LDPlayer9/ldconsole.exe", "LDPlayer/LDPlayer9/dnconsole.exe"],
            ["adb.exe", "LDPlayer9/adb.exe", "LDPlayer/adb.exe"], [], [], ["dnplayer.exe", "LdVBoxHeadless.exe"]) { EnumerationArguments = ["list2"] },
        new(EmulatorVendors.Nox, "夜神模拟器", ["nox"], ["NoxConsole.exe", "bin/NoxConsole.exe", "Nox/bin/NoxConsole.exe"],
            ["nox_adb.exe", "bin/nox_adb.exe"], ["BignoxVMS"], ["Nox/BignoxVMS"], ["Nox.exe", "NoxVMHandle.exe"]) { EnumerationArguments = ["list"], ControlParentDirectories = ["bin"], ConfigurationExtensions = [".vbox"] },
        new(EmulatorVendors.BlueStacks, "BlueStacks", ["bluestacks"], ["HD-Player.exe", "BlueStacks_nxt/HD-Player.exe", "BlueStacks/HD-Player.exe"],
            ["HD-Adb.exe", "bin/HD-Adb.exe"], ["bluestacks.conf"], ["BlueStacks_nxt/bluestacks.conf", "BlueStacks/bluestacks.conf"], ["HD-Player.exe"])
    ];
}
