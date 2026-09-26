using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;

namespace NexusPipeline.Plugin.MaaFrameworkDriver;

internal static class WindowDiscovery
{
    internal static JsonArray Find(JsonObject controller)
    {
        if (!OperatingSystem.IsWindows() || controller["type"]?.GetValue<string>() != "Win32") throw new InvalidDataException("win32 controller required");
        string titlePattern = controller["win32"]?["window_regex"]?.GetValue<string>() ?? ".*";
        string classPattern = controller["win32"]?["class_regex"]?.GetValue<string>() ?? ".*";
        var titleRegex = new Regex(titlePattern, RegexOptions.CultureInvariant, TimeSpan.FromMilliseconds(100));
        var classRegex = new Regex(classPattern, RegexOptions.CultureInvariant, TimeSpan.FromMilliseconds(100));
        var results = new JsonArray();
        Exception? failure = null;
        EnumWindows((handle, _) =>
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
                if (string.IsNullOrEmpty(executable)) return true;
                results.Add(new JsonObject { ["handle"] = handle.ToInt64(), ["pid"] = (int)pid,
                    ["executable"] = executable, ["startedAtUtc"] = process.StartTime.ToUniversalTime().ToString("O"),
                    ["title"] = title.ToString(), ["className"] = cls.ToString() });
            }
            catch (RegexMatchTimeoutException ex) { failure = ex; return false; }
            catch (Exception ex) when (ex is System.ComponentModel.Win32Exception or InvalidOperationException or ArgumentException) { }
            return true;
        }, 0);
        if (failure is not null) throw new InvalidDataException("window filter timeout");
        return results;
    }
    private delegate bool Callback(nint handle, nint parameter);
    [DllImport("user32.dll")] private static extern bool EnumWindows(Callback callback, nint parameter);
    [DllImport("user32.dll")] private static extern bool IsWindowVisible(nint handle);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] private static extern int GetWindowText(nint handle, StringBuilder text, int count);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] private static extern int GetClassName(nint handle, StringBuilder text, int count);
    [DllImport("user32.dll")] private static extern uint GetWindowThreadProcessId(nint handle, out uint pid);
}
