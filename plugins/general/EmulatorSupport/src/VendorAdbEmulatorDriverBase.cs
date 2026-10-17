using System.Diagnostics;
using System.Text.RegularExpressions;
using Microsoft.Win32;
using NexusPipeline.Plugin.Abstractions;

namespace NexusPipeline.Plugin.EmulatorSupport;

/// <summary>各厂商共用 ADB 操作；目标已检测冻结后，生命周期内始终使用同一 bundled adb。</summary>
internal abstract class VendorAdbEmulatorDriverBase : IPluginEmulatorDriver
{
    protected readonly EmulatorTarget Target;

    protected VendorAdbEmulatorDriverBase(EmulatorTarget target)
    {
        Target = target;
    }

    public abstract EmulatorKind Kind { get; }

    public string DisplayName => Kind switch
    {
        EmulatorKind.LdPlayer => "雷电模拟器",
        EmulatorKind.Nox => "夜神模拟器",
        EmulatorKind.BlueStacks => "BlueStacks",
        _ => "模拟器扩展",
    };

    protected string? AdbExecutable => Target.VendorAdbExecutable;

    public abstract Task<PluginEmulatorCommandResult> EnsureReadyAsync(CancellationToken token, int timeoutSeconds);

    public async Task<PluginEmulatorCommandResult> StartAppAsync(IReadOnlyList<string> startArgs, CancellationToken token, int timeoutSeconds)
    {
        if (string.IsNullOrWhiteSpace(AdbExecutable)) return PluginEmulatorCommandResult.Failure("未找到厂商 bundled adb 可执行文件");
        var shellArgs = new List<string> { "am", "start" };
        shellArgs.AddRange(startArgs);
        (bool ok, string output) = await EmulatorSupport.AdbShellAsync(
            AdbExecutable,
            Target.Endpoint,
            shellArgs.ToArray(),
            timeoutSeconds,
            token).ConfigureAwait(false);
        return ok && !EmulatorSupport.AmStartFailed(output)
            ? PluginEmulatorCommandResult.Success(output)
            : PluginEmulatorCommandResult.Failure(output);
    }

    public Task<string?> GetForegroundPackageAsync(CancellationToken token, int timeoutSeconds)
    {
        return string.IsNullOrWhiteSpace(AdbExecutable)
            ? Task.FromResult<string?>(null)
            : EmulatorSupport.GetForegroundPackageAsync(AdbExecutable, Target.Endpoint, token, timeoutSeconds);
    }

    public async Task<PluginEmulatorBinaryResult> CaptureScreenAsync(CancellationToken token, int timeoutSeconds)
    {
        if (string.IsNullOrWhiteSpace(AdbExecutable)) return PluginEmulatorBinaryResult.Failure("未找到厂商 bundled adb 可执行文件");
        PluginEmulatorBinaryResult result = await EmulatorSupport.RunBinaryCommandAsync(
            AdbExecutable,
            new[] { "-s", Target.Endpoint, "exec-out", "screencap", "-p" },
            timeoutSeconds,
            token).ConfigureAwait(false);
        return result.Ok && EmulatorSupport.IsPng(result.Data)
            ? result
            : PluginEmulatorBinaryResult.Failure(result.Error.Length > 0 ? result.Error : "厂商 ADB 未返回有效 PNG 截图");
    }

    public async Task<PluginEmulatorCommandResult> StopAppAsync(string? packageName, CancellationToken token, int timeoutSeconds)
    {
        if (string.IsNullOrWhiteSpace(packageName)) return PluginEmulatorCommandResult.Success("未配置目标包名，跳过应用关闭");
        if (packageName is "com.android.systemui" or "com.android.launcher" or "app.lawnchair" or "com.mumu.launcher")
        {
            return PluginEmulatorCommandResult.Success($"目标包名为系统桌面（{packageName}），跳过应用关闭");
        }
        if (string.IsNullOrWhiteSpace(AdbExecutable)) return PluginEmulatorCommandResult.Failure("未找到厂商 bundled adb 可执行文件");
        (bool ok, string output) = await EmulatorSupport.AdbShellAsync(
            AdbExecutable,
            Target.Endpoint,
            new[] { "am", "force-stop", packageName },
            timeoutSeconds,
            token).ConfigureAwait(false);
        return ok ? PluginEmulatorCommandResult.Success(output) : PluginEmulatorCommandResult.Failure(output);
    }

    public abstract Task<PluginEmulatorCommandResult> ShutdownAsync(CancellationToken token, int timeoutSeconds);

    protected async Task<(bool Ok, string Message)> ShutdownViaAdbAsync(CancellationToken token)
    {
        if (string.IsNullOrWhiteSpace(AdbExecutable)) return (false, "未找到厂商 bundled adb 可执行文件");
        (bool ok, string output) = await EmulatorSupport.AdbShellAsync(
            AdbExecutable,
            Target.Endpoint,
            new[] { "reboot", "-p" },
            30,
            token).ConfigureAwait(false);
        if (!ok) return (false, $"adb shell reboot -p 失败：{output.Trim()}");
        return await EmulatorSupport.WaitEmulatorOfflineAsync(AdbExecutable, Target.Endpoint, token).ConfigureAwait(false)
            ? (true, "已通过厂商 bundled adb shell reboot -p 关闭模拟器")
            : (false, "已执行 adb shell reboot -p，但等待超时仍未确认模拟器离线");
    }

    protected static bool LooksAlreadyRunning(string output)
    {
        return output.Contains("already", StringComparison.OrdinalIgnoreCase)
            || output.Contains("running", StringComparison.OrdinalIgnoreCase)
            || output.Contains("started", StringComparison.OrdinalIgnoreCase);
    }
}
