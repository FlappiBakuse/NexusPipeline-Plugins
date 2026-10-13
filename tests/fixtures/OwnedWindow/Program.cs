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
            File.WriteAllText(args[0] + ".pending", JsonSerializer.Serialize(new { handle = (long)form.Handle, pid = process.Id,
                executable = process.MainModule!.FileName, startedAtUtc = process.StartTime.ToUniversalTime() }));
            File.Move(args[0] + ".pending", args[0]);
        };
        form.FormClosed += (_, _) => File.WriteAllText(args[0] + ".exited", "closed");
        using var timer = new System.Windows.Forms.Timer { Interval = 100 };
        timer.Tick += (_, _) => { if (File.Exists(args[0] + ".stop")) form.Close(); };
        timer.Start(); Application.Run(form);
    }
}
