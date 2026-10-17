using System.Diagnostics;
using System.Text.RegularExpressions;
using Microsoft.Win32;
using NexusPipeline.Plugin.Abstractions;

namespace NexusPipeline.Plugin.EmulatorSupport;

internal sealed class NoxEmulatorDriver : VendorAdbEmulatorDriverBase
{
    private static readonly string[] ProcessNames = { "NoxConsole", "Nox", "NoxVMHandle" };

    public NoxEmulatorDriver(EmulatorTarget target) : base(target)
    {
        if (target.Kind != EmulatorKind.Nox
            || string.IsNullOrWhiteSpace(target.VendorControlPath)
            || string.IsNullOrWhiteSpace(target.VendorInstanceId)
            || (target.VendorInstanceIndex is null && string.IsNullOrWhiteSpace(target.VendorControlName)))
        {
            throw new ArgumentException("Nox driver 需要绑定完整 vendor target。", nameof(target));
        }
    }

    public override EmulatorKind Kind => EmulatorKind.Nox;

    public override async Task<PluginEmulatorCommandResult> EnsureReadyAsync(CancellationToken token, int timeoutSeconds)
    {
        PluginEmulatorCommandResult launch = await EmulatorVendorSupport.StartControlAsync(
            Target.VendorControlPath!,
            new[] { "launch", NoxSelectorArgument() },
            token,
            timeoutSeconds).ConfigureAwait(false);
        if (!launch.Ok && !LooksAlreadyRunning(launch.Output)) return launch;
        if (string.IsNullOrWhiteSpace(AdbExecutable)) return PluginEmulatorCommandResult.Failure("未找到 Nox bundled nox_adb.exe");
        (bool ok, string output) = await EmulatorSupport.AdbConnectAsync(AdbExecutable, Target.Endpoint, token, timeoutSeconds).ConfigureAwait(false);
        return ok ? PluginEmulatorCommandResult.Success(output) : PluginEmulatorCommandResult.Failure(output);
    }

    public override async Task<PluginEmulatorCommandResult> ShutdownAsync(CancellationToken token, int timeoutSeconds)
    {
        PluginEmulatorCommandResult quit = await EmulatorVendorSupport.StartControlAsync(
            Target.VendorControlPath!,
            new[] { "quit", NoxSelectorArgument() },
            token,
            timeoutSeconds).ConfigureAwait(false);
        if (quit.Ok && await WaitOffline(token).ConfigureAwait(false))
        {
            return PluginEmulatorCommandResult.Success($"已通过 Nox 关闭实例 {Target.VendorInstanceId}");
        }

        (bool adbOk, string adbMessage) = await ShutdownViaAdbAsync(token).ConfigureAwait(false);
        if (adbOk) return PluginEmulatorCommandResult.Success(adbMessage);

        if (await TryKillReconfirmedProcessAsync(token, timeoutSeconds).ConfigureAwait(false)
            && await WaitOffline(token).ConfigureAwait(false))
        {
            return PluginEmulatorCommandResult.Success($"已按重新确认的 Nox 实例 PID 关闭实例 {Target.VendorInstanceId}");
        }
        return PluginEmulatorCommandResult.Failure($"Nox 关闭未确认：quit={quit.Output.Trim()}；adb={adbMessage}");
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
            new[] { "list" },
            timeoutSeconds,
            token).ConfigureAwait(false);
        if (!ok) return false;
        NoxInstance[] matches = EmulatorVendorSupport.ParseNoxConsoleList(output)
            .Where(item => EmulatorVendorSupport.IsNoxInstanceMatch(
                item,
                Target.VendorInstanceId!,
                Target.VendorInstanceIndex,
                Target.VendorControlName))
            .ToArray();
        if (matches.Length != 1
            || !EmulatorVendorSupport.HasExactProcessId(Target.VendorProcessId, matches[0].ProcessId))
        {
            return false;
        }
        return EmulatorVendorSupport.TryKillMappedProcess(matches[0].ProcessId, ProcessNames, "Nox");
    }

    private string NoxSelectorArgument()
    {
        if (Target.VendorInstanceIndex is int numericIndex)
        {
            return $"-index:{numericIndex}";
        }
        if (!string.IsNullOrWhiteSpace(Target.VendorControlName))
        {
            return $"-name:{Target.VendorControlName}";
        }
        throw new InvalidOperationException("Nox target 缺少可用的实例选择器。");
    }
}
