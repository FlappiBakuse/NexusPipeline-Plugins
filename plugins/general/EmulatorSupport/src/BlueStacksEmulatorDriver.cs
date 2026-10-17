using System.Diagnostics;
using System.Text.RegularExpressions;
using Microsoft.Win32;
using NexusPipeline.Plugin.Abstractions;

namespace NexusPipeline.Plugin.EmulatorSupport;

internal sealed class BlueStacksEmulatorDriver : VendorAdbEmulatorDriverBase
{
    private static readonly string[] ProcessNames = { "HD-Player" };

    public BlueStacksEmulatorDriver(EmulatorTarget target) : base(target)
    {
        if (target.Kind != EmulatorKind.BlueStacks || string.IsNullOrWhiteSpace(target.VendorControlPath) || string.IsNullOrWhiteSpace(target.VendorInstanceId))
        {
            throw new ArgumentException("BlueStacks driver 需要绑定完整 vendor target。", nameof(target));
        }
    }

    public override EmulatorKind Kind => EmulatorKind.BlueStacks;

    public override async Task<PluginEmulatorCommandResult> EnsureReadyAsync(CancellationToken token, int timeoutSeconds)
    {
        if (string.IsNullOrWhiteSpace(AdbExecutable)) return PluginEmulatorCommandResult.Failure("未找到 BlueStacks bundled HD-Adb.exe");
        if (EmulatorSupport.IsCommandFile(Target.VendorControlPath!))
        {
            PluginEmulatorCommandResult stubResult = await EmulatorVendorSupport.StartControlAsync(
                Target.VendorControlPath!,
                new[] { "--instance", Target.VendorInstanceId! },
                token,
                timeoutSeconds).ConfigureAwait(false);
            if (!stubResult.Ok && !LooksAlreadyRunning(stubResult.Output)) return stubResult;
        }
        else
        {
        Process? control = EmulatorVendorSupport.StartDetachedControl(
            Target.VendorControlPath!,
            new[] { "--instance", Target.VendorInstanceId! });
        if (control is null) return PluginEmulatorCommandResult.Failure("HD-Player.exe --instance 启动失败");
        using (control)
        {
            try
            {
                await Task.Delay(250, token).ConfigureAwait(false);
                if (control.HasExited && control.ExitCode != 0)
                {
                    return PluginEmulatorCommandResult.Failure($"HD-Player.exe --instance 返回码 {control.ExitCode}");
                }
            }
            catch (InvalidOperationException)
            {
                // 进程已被宿主接管并退出，若退出码不可读交给 ADB 连通性确认。
            }
        }
        }
        (bool ok, string output) = await EmulatorSupport.AdbConnectAsync(AdbExecutable, Target.Endpoint, token, timeoutSeconds).ConfigureAwait(false);
        return ok ? PluginEmulatorCommandResult.Success(output) : PluginEmulatorCommandResult.Failure(output);
    }

    public override async Task<PluginEmulatorCommandResult> ShutdownAsync(CancellationToken token, int timeoutSeconds)
    {
        (bool adbOk, string adbMessage) = await ShutdownViaAdbAsync(token).ConfigureAwait(false);
        if (adbOk) return PluginEmulatorCommandResult.Success(adbMessage);

        // BlueStacks 配置通常无法安全提供单实例 PID；没有配置证明时明确失败，绝不按名称清理全部 HD-Player。
        if (Target.VendorProcessId is int pid
            && EmulatorVendorSupport.TryKillMappedProcess(pid, ProcessNames, "BlueStacks")
            && await WaitOffline(token).ConfigureAwait(false))
        {
            return PluginEmulatorCommandResult.Success($"已按配置重新确认的 BlueStacks 实例 PID 关闭实例 {Target.VendorInstanceId}");
        }
        return PluginEmulatorCommandResult.Failure($"BlueStacks 关闭未确认：{adbMessage}；未取得可安全复核的单实例 PID");
    }

    private async Task<bool> WaitOffline(CancellationToken token)
    {
        return !string.IsNullOrWhiteSpace(AdbExecutable)
            && await EmulatorSupport.WaitEmulatorOfflineAsync(AdbExecutable, Target.Endpoint, token).ConfigureAwait(false);
    }
}
