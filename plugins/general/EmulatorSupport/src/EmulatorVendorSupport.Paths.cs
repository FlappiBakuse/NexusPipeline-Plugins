using System.Diagnostics;
using System.Text.RegularExpressions;
using Microsoft.Win32;
using NexusPipeline.Plugin.Abstractions;

namespace NexusPipeline.Plugin.EmulatorSupport;

internal static partial class EmulatorVendorSupport
{
    internal static string? ResolveVendorAdb(EmulatorVendor vendor, EmulatorVendorPaths paths)
    {
        string? testAdb = Environment.GetEnvironmentVariable("NEXUS_ADB_EXE");
        if (!string.IsNullOrWhiteSpace(testAdb) && File.Exists(testAdb))
        {
            return testAdb;
        }

        foreach (string root in CandidateRoots(paths))
        {
            foreach (string relative in BundledAdbCandidates(vendor))
            {
                string candidate = Path.Combine(root, relative);
                if (File.Exists(candidate)) return candidate;
            }
        }
        return null;
    }

    internal static EmulatorVendorPaths? ResolvePaths(EmulatorVendor vendor)
    {
        string? control = ResolveTestHook(vendor);
        string? installRoot = null;
        if (control is null)
        {
            control = FindRunningControl(vendor);
        }
        if (control is null)
        {
            foreach (string root in RegistryInstallRoots(vendor))
            {
                string? candidate = FindControlInRoot(vendor, root);
                if (candidate is not null)
                {
                    control = candidate;
                    installRoot = root;
                    break;
                }
            }
        }
        if (control is null)
        {
            foreach (string root in ProgramFileRoots())
            {
                string? candidate = FindControlInRoot(vendor, root);
                if (candidate is not null)
                {
                    control = candidate;
                    installRoot = root;
                    break;
                }
            }
        }
        if (control is null)
        {
            return null;
        }

        installRoot ??= FindInstallRoot(control);
        string? configPath = ResolveConfigPath(vendor, installRoot, control);
        string? configRoot = ResolveConfigRoot(vendor, installRoot, control);
        EmulatorVendorPaths pathSet = new(
            control,
            installRoot,
            AdbPath: null,
            configPath,
            configRoot);
        return pathSet with { AdbPath = ResolveVendorAdb(vendor, pathSet) };
    }

    internal static IReadOnlyList<string> FindNoxVboxFiles(string? configRoot)
    {
        if (string.IsNullOrWhiteSpace(configRoot) || !Directory.Exists(configRoot))
        {
            return Array.Empty<string>();
        }
        try
        {
            return Directory.EnumerateFiles(configRoot, "*.vbox", SearchOption.AllDirectories)
                .OrderBy(path => path, StringComparer.OrdinalIgnoreCase)
                .ToArray();
        }
        catch
        {
            return Array.Empty<string>();
        }
    }

    private static string? ResolveTestHook(EmulatorVendor vendor)
    {
        string? path = vendor switch
        {
            EmulatorVendor.LdPlayer => Environment.GetEnvironmentVariable("NEXUS_LD_CONSOLE_EXE"),
            EmulatorVendor.Nox => Environment.GetEnvironmentVariable("NEXUS_NOX_CONSOLE_EXE"),
            EmulatorVendor.BlueStacks => Environment.GetEnvironmentVariable("NEXUS_BLUESTACKS_PLAYER_EXE"),
            _ => null,
        };
        return !string.IsNullOrWhiteSpace(path) && File.Exists(path) ? path : null;
    }

    private static string? FindRunningControl(EmulatorVendor vendor)
    {
        string[] names = vendor switch
        {
            EmulatorVendor.LdPlayer => new[] { "ldconsole.exe", "dnconsole.exe" },
            EmulatorVendor.Nox => new[] { "NoxConsole.exe" },
            EmulatorVendor.BlueStacks => new[] { "HD-Player.exe" },
            _ => Array.Empty<string>(),
        };
        foreach (string name in names)
        {
            try
            {
                foreach (Process process in Process.GetProcessesByName(Path.GetFileNameWithoutExtension(name)))
                {
                    using (process)
                    {
                        try
                        {
                            string? path = process.MainModule?.FileName;
                            if (!string.IsNullOrWhiteSpace(path) && File.Exists(path)) return path;
                        }
                        catch
                        {
                            // 受限权限进程跳过，继续检查其他候选。
                        }
                    }
                }
            }
            catch
            {
                // 进程枚举失败按未发现处理，后续走注册表和 Program Files。
            }
        }
        return null;
    }

    private static IEnumerable<string> RegistryInstallRoots(EmulatorVendor vendor)
    {
        if (!OperatingSystem.IsWindows())
        {
            return Array.Empty<string>();
        }

        var locations = new List<string>();
        string[] keywords = vendor switch
        {
            EmulatorVendor.LdPlayer => new[] { "ldplayer", "leidian" },
            EmulatorVendor.Nox => new[] { "nox" },
            EmulatorVendor.BlueStacks => new[] { "bluestacks" },
            _ => Array.Empty<string>(),
        };
        foreach (RegistryHive hive in new[] { RegistryHive.LocalMachine, RegistryHive.CurrentUser })
        {
            foreach (RegistryView view in new[] { RegistryView.Registry64, RegistryView.Registry32 })
            {
                try
                {
                    using RegistryKey baseKey = RegistryKey.OpenBaseKey(hive, view);
                    using RegistryKey? root = baseKey.OpenSubKey(@"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall");
                    if (root is null) continue;
                    foreach (string subName in root.GetSubKeyNames())
                    {
                        using RegistryKey? subKey = root.OpenSubKey(subName);
                        string display = $"{subName} {subKey?.GetValue("DisplayName")}";
                        if (!keywords.Any(keyword => display.Contains(keyword, StringComparison.OrdinalIgnoreCase))) continue;
                        string? location = subKey?.GetValue("InstallLocation") as string;
                        if (!string.IsNullOrWhiteSpace(location) && Directory.Exists(location)) locations.Add(location);
                    }
                }
                catch
                {
                    // 注册表视图可能不存在或无权限，继续尝试其他视图。
                }
            }
        }
        return locations.Distinct(StringComparer.OrdinalIgnoreCase);
    }

    private static IEnumerable<string> ProgramFileRoots()
    {
        return new[]
        {
            Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles),
            Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86),
        }.Where(path => !string.IsNullOrWhiteSpace(path)).Distinct(StringComparer.OrdinalIgnoreCase);
    }

    private static string? FindControlInRoot(EmulatorVendor vendor, string root)
    {
        foreach (string relative in ControlCandidates(vendor))
        {
            string candidate = Path.Combine(root, relative);
            if (File.Exists(candidate)) return candidate;
        }
        return null;
    }

    private static IEnumerable<string> ControlCandidates(EmulatorVendor vendor)
    {
        return vendor switch
        {
            EmulatorVendor.LdPlayer => new[]
            {
                @"LDPlayer\LDPlayer9\ldconsole.exe",
                @"LDPlayer\LDPlayer9\dnconsole.exe",
                @"LDPlayer9\ldconsole.exe",
                @"LDPlayer9\dnconsole.exe",
            },
            EmulatorVendor.Nox => new[]
            {
                @"Nox\bin\NoxConsole.exe",
                @"Nox\NoxConsole.exe",
            },
            EmulatorVendor.BlueStacks => new[]
            {
                @"BlueStacks_nxt\HD-Player.exe",
                @"BlueStacks\HD-Player.exe",
            },
            _ => Array.Empty<string>(),
        };
    }

    private static IEnumerable<string> BundledAdbCandidates(EmulatorVendor vendor)
    {
        return vendor switch
        {
            EmulatorVendor.LdPlayer => new[] { "adb.exe", @"LDPlayer9\adb.exe", @"LDPlayer\adb.exe" },
            EmulatorVendor.Nox => new[] { @"bin\nox_adb.exe", "nox_adb.exe" },
            EmulatorVendor.BlueStacks => new[] { "HD-Adb.exe", @"bin\HD-Adb.exe" },
            _ => Array.Empty<string>(),
        };
    }

    private static IEnumerable<string> CandidateRoots(EmulatorVendorPaths paths)
    {
        var roots = new List<string>();
        if (!string.IsNullOrWhiteSpace(paths.InstallRoot)) roots.Add(paths.InstallRoot);
        string? controlDir = Path.GetDirectoryName(paths.ControlPath);
        for (int i = 0; i < 3 && !string.IsNullOrWhiteSpace(controlDir); i++)
        {
            roots.Add(controlDir);
            controlDir = Path.GetDirectoryName(controlDir);
        }
        return roots.Where(Directory.Exists).Distinct(StringComparer.OrdinalIgnoreCase);
    }

    private static string? FindInstallRoot(string control)
    {
        string? directory = Path.GetDirectoryName(control);
        return directory is null ? null : Directory.Exists(directory) ? directory : null;
    }

    private static string? ResolveConfigPath(EmulatorVendor vendor, string? installRoot, string control)
    {
        if (vendor == EmulatorVendor.BlueStacks)
        {
            string? hook = Environment.GetEnvironmentVariable("NEXUS_BLUESTACKS_CONF");
            if (!string.IsNullOrWhiteSpace(hook) && File.Exists(hook)) return hook;
            foreach (string root in CandidateRoots(new EmulatorVendorPaths(control, installRoot, null, null, null)))
            {
                string candidate = Path.Combine(root, "bluestacks.conf");
                if (File.Exists(candidate)) return candidate;
            }
            string common = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData), "BlueStacks_nxt", "bluestacks.conf");
            return File.Exists(common) ? common : null;
        }
        return null;
    }

    private static string? ResolveConfigRoot(EmulatorVendor vendor, string? installRoot, string control)
    {
        if (vendor != EmulatorVendor.Nox) return null;
        foreach (string root in CandidateRoots(new EmulatorVendorPaths(control, installRoot, null, null, null)))
        {
            string candidate = Path.Combine(root, "BignoxVMS");
            if (Directory.Exists(candidate)) return candidate;
        }
        string common = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData), "Nox", "BignoxVMS");
        return Directory.Exists(common) ? common : null;
    }
}
