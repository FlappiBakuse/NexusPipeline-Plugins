using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using NexusPipeline.Plugin.Abstractions;

namespace NexusPipeline.Plugin.MaaFrameworkDriver;

internal static class WindowDiscovery
{
    internal static async Task<DriverProfile> ResolveAsync(DriverProfile profile, JsonObject controller,
        PluginProviderLaunchTarget? hostTarget, CancellationToken token)
    {
        if (profile.WindowSelection == "exact_process" && hostTarget is null) return profile;
        if (!Path.IsPathFullyQualified(profile.WindowExecutable))
            throw new NativeStartupException("window_executable_required");
        if (hostTarget is not null && (hostTarget.Kind != "win32" || hostTarget.ProcessId <= 0
            || hostTarget.StartedAtUtc is null || !Path.GetFullPath(hostTarget.Identity).Equals(
                Path.GetFullPath(profile.WindowExecutable), StringComparison.OrdinalIgnoreCase)))
            throw new NativeStartupException("window_host_identity_mismatch");
        long started = Stopwatch.GetTimestamp();
        while (true)
        {
            token.ThrowIfCancellationRequested();
            var candidates = Find(controller).OfType<JsonObject>().Where(window =>
                window["executable"]!.GetValue<string>().Equals(profile.WindowExecutable, StringComparison.OrdinalIgnoreCase)
                && (hostTarget is null || window["pid"]!.GetValue<int>() == hostTarget.ProcessId
                    && DateTime.Parse(window["startedAtUtc"]!.GetValue<string>(), System.Globalization.CultureInfo.InvariantCulture,
                        System.Globalization.DateTimeStyles.RoundtripKind) == hostTarget.StartedAtUtc)).ToArray();
            if (candidates.Length > 1) throw new NativeStartupException("window_ambiguous");
            if (candidates.Length == 1)
            {
                var selected = candidates[0];
                return profile with { WindowHandle = selected["handle"]!.GetValue<long>(),
                    WindowProcessId = selected["pid"]!.GetValue<int>(),
                    WindowStartedAtUtc = DateTime.Parse(selected["startedAtUtc"]!.GetValue<string>(),
                        System.Globalization.CultureInfo.InvariantCulture, System.Globalization.DateTimeStyles.RoundtripKind) };
            }
            if (Stopwatch.GetElapsedTime(started).TotalMilliseconds >= profile.WindowWaitMilliseconds)
                throw new NativeStartupException("window_not_found");
            await Task.Delay(100, token);
        }
    }

    internal static JsonArray Find(JsonObject controller)
    {
        if (!OperatingSystem.IsWindows() || controller["type"]?.GetValue<string>() != "Win32") throw new InvalidDataException("win32 controller required");
        string titlePattern = controller["win32"]?["window_regex"]?.GetValue<string>() ?? ".*";
        string classPattern = controller["win32"]?["class_regex"]?.GetValue<string>() ?? ".*";
        var titleRegex = new Regex(titlePattern, RegexOptions.CultureInvariant, TimeSpan.FromMilliseconds(100));
        var classRegex = new Regex(classPattern, RegexOptions.CultureInvariant, TimeSpan.FromMilliseconds(100));
        var results = new JsonArray();
        Exception? failure = null;
        bool complete = EnumWindows((handle, _) =>
        {
            if (results.Count >= 256) return false;
            try
            {
                var title = new StringBuilder(512); var cls = new StringBuilder(256);
                GetWindowText(handle, title, title.Capacity); GetClassName(handle, cls, cls.Capacity);
                if (!IsWindowVisible(handle) || !titleRegex.IsMatch(title.ToString()) || !classRegex.IsMatch(cls.ToString())) return true;
                GetWindowThreadProcessId(handle, out uint pid);
                using var process = Process.GetProcessById((int)pid);
                string? executable = process.MainModule?.FileName;
                if (string.IsNullOrEmpty(executable)) { failure = new InvalidDataException("window identity unavailable"); return false; }
                results.Add(new JsonObject { ["handle"] = handle.ToInt64(), ["pid"] = (int)pid,
                    ["executable"] = executable, ["startedAtUtc"] = process.StartTime.ToUniversalTime().ToString("O"),
                    ["title"] = title.ToString(), ["className"] = cls.ToString() });
            }
            catch (RegexMatchTimeoutException ex) { failure = ex; return false; }
            catch (Exception ex) when (ex is System.ComponentModel.Win32Exception or InvalidOperationException or ArgumentException)
            { failure = new InvalidDataException("window identity unavailable", ex); return false; }
            return true;
        }, 0);
        if (failure is not null) throw new InvalidDataException("window observation unavailable", failure);
        if (results.Count >= 256) throw new InvalidDataException("window candidate limit");
        if (!complete) throw new InvalidDataException("window observation incomplete");
        return results;
    }
    private delegate bool Callback(nint handle, nint parameter);
    [DllImport("user32.dll")] private static extern bool EnumWindows(Callback callback, nint parameter);
    [DllImport("user32.dll")] private static extern bool IsWindowVisible(nint handle);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] private static extern int GetWindowText(nint handle, StringBuilder text, int count);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] private static extern int GetClassName(nint handle, StringBuilder text, int count);
    [DllImport("user32.dll")] private static extern uint GetWindowThreadProcessId(nint handle, out uint pid);
}
