using System.Diagnostics;
using System.Text.RegularExpressions;
using Microsoft.Win32;
using NexusPipeline.Plugin.Abstractions;

namespace NexusPipeline.Plugin.EmulatorSupport;

internal static class EmulatorVendorDetector
{
    internal static async Task<VendorProbeResult> ProbeAsync(
        EmulatorVendor vendor,
        string endpoint,
        int port,
        CancellationToken token,
        int timeoutSeconds)
    {
        EmulatorVendorPaths? paths = EmulatorVendorSupport.ResolvePaths(vendor);
        if (paths is null)
        {
            return VendorProbeResult.NotApplicable();
        }
        return vendor switch
        {
            EmulatorVendor.LdPlayer => await ProbeLdAsync(paths, endpoint, port, token, timeoutSeconds).ConfigureAwait(false),
            EmulatorVendor.Nox => await ProbeNoxAsync(paths, endpoint, port, token, timeoutSeconds).ConfigureAwait(false),
            EmulatorVendor.BlueStacks => await ProbeBlueStacksAsync(paths, endpoint, port, token, timeoutSeconds).ConfigureAwait(false),
            _ => VendorProbeResult.NotApplicable(),
        };
    }

    private static async Task<VendorProbeResult> ProbeLdAsync(
        EmulatorVendorPaths paths,
        string endpoint,
        int port,
        CancellationToken token,
        int timeoutSeconds)
    {
        (bool ok, string output) = await EmulatorSupport.RunCommandAsync(
            paths.ControlPath,
            new[] { "list2" },
            timeoutSeconds,
            token).ConfigureAwait(false);
        if (!ok)
        {
            return VendorProbeResult.ErrorResult($"LDPlayer list2 失败：{output.Trim()}");
        }
        IReadOnlyList<LdPlayerInstance> instances = EmulatorVendorSupport.ParseLdList2(output);
        if (instances.Count == 0 && !string.IsNullOrWhiteSpace(output))
        {
            return VendorProbeResult.ErrorResult("LDPlayer list2 输出无法解析实例清单");
        }
        LdPlayerInstance[] matches = instances
            .Where(instance => EmulatorVendorSupport.CandidateLdAdbPorts(instance.Index).Contains(port))
            .ToArray();
        if (matches.Length == 0) return VendorProbeResult.NotApplicable();
        if (matches.Length > 1) return VendorProbeResult.ErrorResult("LDPlayer 端点同时匹配多个实例索引");
        if (paths.AdbPath is null) return VendorProbeResult.ErrorResult("已识别 LDPlayer 实例，但未找到其 bundled adb.exe");
        if (!await EmulatorVendorSupport.ConfirmAdbEndpointAsync(paths.AdbPath, endpoint, token, timeoutSeconds).ConfigureAwait(false))
        {
            return VendorProbeResult.ErrorResult("LDPlayer 实例索引与 ADB 端点的映射无法确认");
        }
        LdPlayerInstance instance = matches[0];
        return VendorProbeResult.Match(new EmulatorTarget(
            EmulatorKind.LdPlayer,
            endpoint,
            VendorControlPath: paths.ControlPath,
            VendorInstanceId: instance.Index,
            VendorAdbExecutable: paths.AdbPath,
            VendorProcessId: instance.ProcessId,
            VendorInstallRoot: paths.InstallRoot));
    }

    private static async Task<VendorProbeResult> ProbeNoxAsync(
        EmulatorVendorPaths paths,
        string endpoint,
        int port,
        CancellationToken token,
        int timeoutSeconds)
    {
        (bool ok, string output) = await EmulatorSupport.RunCommandAsync(
            paths.ControlPath,
            new[] { "list" },
            timeoutSeconds,
            token).ConfigureAwait(false);
        if (!ok)
        {
            return VendorProbeResult.ErrorResult($"NoxConsole list 失败：{output.Trim()}");
        }
        IReadOnlyList<NoxInstance> instances = EmulatorVendorSupport.ParseNoxConsoleList(output);
        if (instances.Count == 0 && !string.IsNullOrWhiteSpace(output))
        {
            return VendorProbeResult.ErrorResult("NoxConsole list 输出无法解析实例清单");
        }
        if (instances.Count == 0) return VendorProbeResult.NotApplicable();
        IReadOnlyList<string> files = EmulatorVendorSupport.FindNoxVboxFiles(paths.ConfigRoot);
        if (files.Count == 0)
        {
            return VendorProbeResult.ErrorResult("Nox 实例存在，但未找到可解析的 BignoxVMS .vbox 映射");
        }

        var matches = new List<(NoxInstance Instance, string File)>();
        bool sawConfig = false;
        bool sawEndpoint = false;
        foreach (string file in files)
        {
            string content;
            try
            {
                content = await File.ReadAllTextAsync(file, token).ConfigureAwait(false);
            }
            catch (Exception ex)
            {
                return VendorProbeResult.ErrorResult($"Nox 配置读取失败：{ex.Message}");
            }
            IReadOnlyList<int> ports = EmulatorVendorSupport.ParseNoxVboxAdbPorts(content);
            if (ports.Count > 0) sawConfig = true;
            if (!ports.Contains(port)) continue;
            sawEndpoint = true;
            NoxInstance[] identityMatches = instances
                .Where(instance => EmulatorVendorSupport.IsInstanceIdentityMatch(file, instance.Identity))
                .ToArray();
            if (identityMatches.Length == 0)
            {
                identityMatches = instances
                    .Where(instance => instance.ControlName is not null
                        && EmulatorVendorSupport.IsInstanceIdentityMatch(file, instance.ControlName))
                    .ToArray();
            }
            if (identityMatches.Length == 1) matches.Add((identityMatches[0], file));
            else if (identityMatches.Length > 1) return VendorProbeResult.ErrorResult("Nox 配置文件无法唯一对应实例身份");
        }
        if (matches.Count == 0)
        {
            if (!sawConfig) return VendorProbeResult.ErrorResult("Nox BignoxVMS 配置未包含可解析的 ADB 端口");
            return sawEndpoint
                ? VendorProbeResult.ErrorResult("Nox ADB 端点已出现在配置中，但无法唯一对应实例身份")
                : VendorProbeResult.NotApplicable();
        }
        if (matches.Count > 1) return VendorProbeResult.ErrorResult("Nox ADB 端点同时匹配多个实例");
        if (paths.AdbPath is null) return VendorProbeResult.ErrorResult("已识别 Nox 实例，但未找到其 bundled nox_adb.exe");
        if (!await EmulatorVendorSupport.ConfirmAdbEndpointAsync(paths.AdbPath, endpoint, token, timeoutSeconds).ConfigureAwait(false))
        {
            return VendorProbeResult.ErrorResult("Nox 实例身份与 ADB 端点的映射无法确认");
        }
        NoxInstance instance = matches[0].Instance;
        return VendorProbeResult.Match(new EmulatorTarget(
            EmulatorKind.Nox,
            endpoint,
            VendorControlPath: paths.ControlPath,
            VendorInstanceId: instance.Identity,
            VendorAdbExecutable: paths.AdbPath,
            VendorProcessId: instance.ProcessId,
            VendorInstallRoot: paths.InstallRoot,
            VendorControlName: instance.ControlName,
            VendorInstanceIndex: instance.NumericIndex));
    }

    private static async Task<VendorProbeResult> ProbeBlueStacksAsync(
        EmulatorVendorPaths paths,
        string endpoint,
        int port,
        CancellationToken token,
        int timeoutSeconds)
    {
        if (paths.ConfigPath is null) return VendorProbeResult.ErrorResult("已识别 BlueStacks 控制程序，但未找到 bluestacks.conf");
        string config;
        try
        {
            config = await File.ReadAllTextAsync(paths.ConfigPath, token).ConfigureAwait(false);
        }
        catch (Exception ex)
        {
            return VendorProbeResult.ErrorResult($"BlueStacks 配置读取失败：{ex.Message}");
        }
        IReadOnlyList<BlueStacksInstance> instances = EmulatorVendorSupport.ParseBlueStacksConfig(config);
        if (instances.Count == 0) return VendorProbeResult.ErrorResult("BlueStacks 配置未包含可解析的实例 ADB 端口");
        BlueStacksInstance[] matches = instances.Where(instance => instance.AdbPort == port).ToArray();
        if (matches.Length == 0) return VendorProbeResult.NotApplicable();
        if (matches.Length > 1) return VendorProbeResult.ErrorResult("BlueStacks ADB 端点同时匹配多个实例");
        if (paths.AdbPath is null) return VendorProbeResult.ErrorResult("已识别 BlueStacks 实例，但未找到其 bundled HD-Adb.exe");
        if (!await EmulatorVendorSupport.ConfirmAdbEndpointAsync(paths.AdbPath, endpoint, token, timeoutSeconds).ConfigureAwait(false))
        {
            return VendorProbeResult.ErrorResult("BlueStacks 实例与 ADB 端点的映射无法确认");
        }
        return VendorProbeResult.Match(new EmulatorTarget(
            EmulatorKind.BlueStacks,
            endpoint,
            VendorControlPath: paths.ControlPath,
            VendorInstanceId: matches[0].Id,
            VendorAdbExecutable: paths.AdbPath,
            VendorInstallRoot: paths.InstallRoot));
    }
}
