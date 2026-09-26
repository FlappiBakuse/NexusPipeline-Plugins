using System.Runtime.InteropServices;
using System.Text.RegularExpressions;

namespace NexusPipeline.MaaTestWindow;

internal static class Program
{
    [STAThread]
    private static void Main(string[] args)
    {
        if (args.Length == 3 && args[0] == "--lock-journal")
        {
            string target = Path.GetFullPath(args[1]), owner = Path.GetFullPath(args[2]);
            string runtime = Path.GetDirectoryName(Path.GetDirectoryName(owner))!;
            if (!File.Exists(Path.Combine(owner, ".nxp-maa-project-owned")) || !Console.IsInputRedirected
                || !target.StartsWith(Path.Combine(runtime, "data") + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase)
                || Path.GetFileName(target) != ".session") throw new IOException("unowned journal fixture");
            DateTime deadline = DateTime.UtcNow.AddSeconds(30);
            while (!File.Exists(target) && DateTime.UtcNow < deadline) Thread.Sleep(10);
            using var locked = new FileStream(target, FileMode.Open, FileAccess.Read, FileShare.Read);
            File.WriteAllText(Path.Combine(owner, "lock-ready.marker"), "owned journal lock");
            Console.In.ReadLineAsync().WaitAsync(TimeSpan.FromSeconds(90)).GetAwaiter().GetResult();
            return;
        }
        if (args.Length == 2 && args[0] == "--native-version")
        {
            string native = Path.GetFullPath(args[1]);
            bool owned = false;
            for (string? parent = native; parent is not null; parent = Path.GetDirectoryName(parent))
            {
                if ((File.GetAttributes(parent) & FileAttributes.ReparsePoint) != 0) throw new IOException("linked native fixture");
                owned |= File.Exists(Path.Combine(parent, ".nxp-project-test-owned"));
            }
            if (!owned || !SetDefaultDllDirectories(0x800 | 0x400) || AddDllDirectory(native) == 0)
                throw new IOException("unowned native fixture");
            nint library = NativeLibrary.Load(Path.Combine(native, "MaaFramework.dll"));
            try
            {
                var version = Marshal.GetDelegateForFunctionPointer<VersionFunction>(NativeLibrary.GetExport(library, "MaaVersion"));
                string value = Marshal.PtrToStringUTF8(version()) ?? throw new InvalidDataException("empty version");
                if (!Regex.IsMatch(value, "^v?[0-9]+\\.[0-9]+\\.[0-9]+(?:[-+][A-Za-z0-9.-]+)?$")) throw new InvalidDataException("invalid version");
                Console.WriteLine(value);
            }
            finally { NativeLibrary.Free(library); }
            return;
        }
        string? lifetime = args.Length is 2 or 3 && args[0] == "--owned-lifetime" ? Path.GetFullPath(args[1]) : null;
        if (lifetime is not null && (!File.Exists(Path.Combine(lifetime, ".nxp-maa-project-owned"))
            || (File.GetAttributes(lifetime) & FileAttributes.ReparsePoint) != 0)) throw new IOException("unowned window fixture");
        if (lifetime is null && !Console.IsInputRedirected) return;
        ApplicationConfiguration.Initialize();
        using var form = new Form { Text = "NexusPipeline owned native fixture", Width = 400, Height = 300,
            ShowInTaskbar = false, StartPosition = FormStartPosition.Manual, Location = new Point(20, 20) };
        form.Controls.Add(new Label { Text = "Native contract fixture — no game or account", Dock = DockStyle.Fill });
        using var companion = new Form { Text = "Owned companion window, not the PI controller", ShowInTaskbar = false,
            Width = 220, Height = 100, StartPosition = FormStartPosition.Manual, Location = new Point(440, 20) };
        form.Shown += (_, _) =>
        {
            if (args.LastOrDefault() == "--companion-window") companion.Show();
            Console.WriteLine(form.Handle.ToInt64());
            Console.Out.Flush();
            if (lifetime is not null)
            {
                using var current = System.Diagnostics.Process.GetCurrentProcess();
                File.WriteAllText(Path.Combine(lifetime, "window-identity.json"), System.Text.Json.JsonSerializer.Serialize(new {
                    pid = current.Id, handle = form.Handle.ToInt64(), startedAtUtc = current.StartTime.ToUniversalTime().ToString("O") }));
            }
            _ = Task.Run(async () =>
            {
                if (lifetime is null) await Console.In.ReadLineAsync();
                else
                {
                    DateTime deadline = DateTime.UtcNow.AddMinutes(2);
                    while (!File.Exists(Path.Combine(lifetime, "stop-window")) && DateTime.UtcNow < deadline) await Task.Delay(50);
                }
                form.BeginInvoke(() => form.Close());
            });
        };
        Application.Run(form);
    }

    [UnmanagedFunctionPointer(CallingConvention.Cdecl)] private delegate nint VersionFunction();
    [DllImport("kernel32.dll", SetLastError = true)] private static extern bool SetDefaultDllDirectories(uint flags);
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)] private static extern nint AddDllDirectory(string path);
}
