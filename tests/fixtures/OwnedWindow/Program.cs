using System.Diagnostics;
using System.Text.Json;

internal static class Program
{
    [STAThread]
    private static void Main(string[] args)
    {
        if (args.Length != 2 || !Path.IsPathFullyQualified(args[0]) || File.Exists(args[0]))
            throw new ArgumentException("New absolute identity file and unique title required");
        ApplicationConfiguration.Initialize();
        using var form = new Form { Text = args[1], ClientSize = new Size(320, 240), BackColor = Color.CornflowerBlue };
        form.Shown += (_, _) =>
        {
            using var process = Process.GetCurrentProcess();
            File.WriteAllText(args[0], JsonSerializer.Serialize(new { handle = (long)form.Handle, pid = process.Id,
                executable = process.MainModule!.FileName, startedAtUtc = process.StartTime.ToUniversalTime() }));
        };
        using var timer = new System.Windows.Forms.Timer { Interval = 100 };
        timer.Tick += (_, _) => { if (File.Exists(args[0] + ".stop")) form.Close(); };
        timer.Start(); Application.Run(form);
    }
}
