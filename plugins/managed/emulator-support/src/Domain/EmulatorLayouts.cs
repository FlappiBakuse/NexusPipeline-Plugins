namespace NexusPipeline.Extensions.EmulatorSupport;

internal static class EmulatorLayouts
{
    internal static readonly IReadOnlyList<EmulatorLayout> All = [
        new(EmulatorVendor.LdPlayer, "雷电模拟器", ["ldplayer", "leidian"],
            ["ldconsole.exe", "dnconsole.exe", "LDPlayer9/ldconsole.exe", "LDPlayer9/dnconsole.exe", "LDPlayer/LDPlayer9/ldconsole.exe", "LDPlayer/LDPlayer9/dnconsole.exe"],
            ["adb.exe", "LDPlayer9/adb.exe", "LDPlayer/adb.exe"], [], [], ["dnplayer.exe", "LdVBoxHeadless.exe"]),
        new(EmulatorVendor.Nox, "夜神模拟器", ["nox"], ["NoxConsole.exe", "bin/NoxConsole.exe", "Nox/bin/NoxConsole.exe"],
            ["nox_adb.exe", "bin/nox_adb.exe"], ["BignoxVMS"], ["Nox/BignoxVMS"], ["Nox.exe", "NoxVMHandle.exe"]),
        new(EmulatorVendor.BlueStacks, "BlueStacks", ["bluestacks"], ["HD-Player.exe", "BlueStacks_nxt/HD-Player.exe", "BlueStacks/HD-Player.exe"],
            ["HD-Adb.exe", "bin/HD-Adb.exe"], ["bluestacks.conf"], ["BlueStacks_nxt/bluestacks.conf", "BlueStacks/bluestacks.conf"], ["HD-Player.exe"])
    ];
}
