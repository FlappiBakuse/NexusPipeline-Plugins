using System.Diagnostics;
using System.Text.RegularExpressions;
using Microsoft.Win32;
using NexusPipeline.Plugin.Abstractions;

namespace NexusPipeline.Plugin.EmulatorSupport;

internal static partial class EmulatorVendorSupport
{
    internal static bool IsInstanceIdentityMatch(string path, string identity)
    {
        string[] segments = path
            .Replace('\\', '/')
            .Split('/', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        int configRoot = Array.FindIndex(segments, segment => segment.Equals("BignoxVMS", StringComparison.OrdinalIgnoreCase));
        IReadOnlyList<string> identitySegments = configRoot >= 0 ? segments[(configRoot + 1)..] : segments;
        return PathHasIdentity(identitySegments, identity);
    }

    internal static bool IsNoxInstanceMatch(
        NoxInstance instance,
        string identity,
        int? numericIndex,
        string? controlName)
    {
        if (!string.Equals(instance.Identity, identity, StringComparison.OrdinalIgnoreCase))
        {
            return false;
        }
        if (numericIndex is int expectedIndex)
        {
            return instance.NumericIndex == expectedIndex;
        }
        return instance.NumericIndex is null
            && !string.IsNullOrWhiteSpace(controlName)
            && string.Equals(instance.ControlName, controlName, StringComparison.OrdinalIgnoreCase);
    }

    internal static bool HasExactProcessId(int? expected, int? observed)
    {
        return expected is int expectedPid && expectedPid > 0 && observed == expectedPid;
    }

    internal static async Task<bool> ConfirmAdbEndpointAsync(
        string adb,
        string endpoint,
        CancellationToken token,
        int timeoutSeconds)
    {
        (bool ok, string output) = await EmulatorSupport.RunCommandAsync(
            adb,
            new[] { "-s", endpoint, "shell", "echo", "nexus-probe" },
            Math.Max(1, Math.Min(10, timeoutSeconds)),
            token).ConfigureAwait(false);
        return ok && !EmulatorSupport.IsOfflineProbeFailure(output);
    }

    internal static bool TryKillMappedProcess(
        int? processId,
        IReadOnlyCollection<string> expectedNames,
        string display)
    {
        return processId is int pid
            && EmulatorSupport.TryKillExactProcess(pid, expectedNames, display);
    }

    internal static async Task<PluginEmulatorCommandResult> StartControlAsync(
        string controlPath,
        IReadOnlyList<string> args,
        CancellationToken token,
        int timeoutSeconds)
    {
        (bool ok, string output) = await EmulatorSupport.RunCommandAsync(
            controlPath,
            args,
            timeoutSeconds,
            token).ConfigureAwait(false);
        return ok ? PluginEmulatorCommandResult.Success(output) : PluginEmulatorCommandResult.Failure(output);
    }

    internal static Process? StartDetachedControl(string controlPath, IReadOnlyList<string> args)
    {
        try
        {
            var psi = new ProcessStartInfo(controlPath)
            {
                UseShellExecute = false,
                CreateNoWindow = true,
            };
            foreach (string arg in args) psi.ArgumentList.Add(arg);
            return Process.Start(psi);
        }
        catch
        {
            return null;
        }
    }
}
