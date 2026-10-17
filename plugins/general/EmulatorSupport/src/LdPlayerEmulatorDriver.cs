using System.Diagnostics;
using System.Text.RegularExpressions;
using Microsoft.Win32;
using NexusPipeline.Plugin.Abstractions;

namespace NexusPipeline.Plugin.EmulatorSupport;

internal sealed class LdPlayerEmulatorDriver : VendorAdbEmulatorDriverBase
{
    private static readonly string[] ProcessNames = { "ldconsole", "dnconsole", "dnplayer", "LdVBoxHeadless" };

    public LdPlayerEmulatorDriver(EmulatorTarget target) : base(target)
    {
        if (target.Kind != EmulatorKind.LdPlayer || string.IsNullOrWhiteSpace(target.VendorControlPath) || string.IsNullOrWhiteSpace(target.VendorInstanceId))
        {
            throw new ArgumentException("LDPlayer driver 需要绑定完整 vendor target。", nameof(target));
        }
    }

    public override EmulatorKind Kind => EmulatorKind.LdPlayer;

    public override async Task<PluginEmulatorCommandResult> EnsureReadyAsync(CancellationToken token, int timeoutSeconds)
    {
        PluginEmulatorCommandResult launch = await EmulatorVendorSupport.StartControlAsync(
            Target.VendorControlPath!,
            new[] { "launch", "--index", Target.VendorInstanceId! },
            token,
            timeoutSeconds).ConfigureAwait(false);
        if (!launch.Ok && !LooksAlreadyRunning(launch.Output)) return launch;
        if (string.IsNullOrWhiteSpace(AdbExecutable)) return PluginEmulatorCommandResult.Failure("未找到 LDPlayer bundled adb.exe");
        (bool ok, string output) = await EmulatorSupport.AdbConnectAsync(AdbExecutable, Target.Endpoint, token, timeoutSeconds).ConfigureAwait(false);
        return ok ? PluginEmulatorCommandResult.Success(output) : PluginEmulatorCommandResult.Failure(output);
    }

    public override async Task<PluginEmulatorCommandResult> ShutdownAsync(CancellationToken token, int timeoutSeconds)
    {
        PluginEmulatorCommandResult quit = await EmulatorVendorSupport.StartControlAsync(
            Target.VendorControlPath!,
            new[] { "quit", "--index", Target.VendorInstanceId! },
            token,
            timeoutSeconds).ConfigureAwait(false);
        if (quit.Ok && await WaitOffline(token).ConfigureAwait(false))
        {
            return PluginEmulatorCommandResult.Success($"已通过 LDPlayer 关闭实例 {Target.VendorInstanceId}");
        }

        (bool adbOk, string adbMessage) = await ShutdownViaAdbAsync(token).ConfigureAwait(false);
        if (adbOk) return PluginEmulatorCommandResult.Success(adbMessage);

        if (await TryKillReconfirmedProcessAsync(token, timeoutSeconds).ConfigureAwait(false)
            && await WaitOffline(token).ConfigureAwait(false))
        {
            return PluginEmulatorCommandResult.Success($"已按重新确认的 LDPlayer 实例 PID 关闭实例 {Target.VendorInstanceId}");
        }
        return PluginEmulatorCommandResult.Failure($"LDPlayer 关闭未确认：quit={quit.Output.Trim()}；adb={adbMessage}");
    }

    private async Task<bool> WaitOffline(CancellationToken token)
    {
        return !string.IsNullOrWhiteSpace(AdbExecutable)
            && await EmulatorSupport.WaitEmulatorOfflineAsync(AdbExecutable, Target.Endpoint, token).ConfigureAwait(false);
    }

    private async Task<bool> TryKillReconfirmedProcessAsync(CancellationToken token, int timeoutSeconds)
    {
        (bool ok, string output) = await EmulatorSupport.RunCommandAsync(
            Target.VendorControlPath!,
            new[] { "list2" },
            timeoutSeconds,
            token).ConfigureAwait(false);
        if (!ok) return false;
        LdPlayerInstance[] matches = EmulatorVendorSupport.ParseLdList2(output)
            .Where(item => string.Equals(item.Index, Target.VendorInstanceId, StringComparison.OrdinalIgnoreCase))
            .ToArray();
        if (matches.Length != 1 || Target.VendorProcessId is not int expectedPid || matches[0].ProcessId != expectedPid)
        {
            return false;
        }
        return EmulatorVendorSupport.TryKillMappedProcess(matches[0].ProcessId, ProcessNames, "LDPlayer");
    }
}
