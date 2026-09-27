using System.Text.Json;

namespace NexusPipeline.Plugin.MaaFrameworkDriver;

internal sealed class SessionWorkspace
{
    internal string DirectoryPath { get; }
    private readonly string _marker;
    private readonly string _identity;

    internal SessionWorkspace(string sessionId)
    {
        string parent = Path.GetFullPath(AppContext.BaseDirectory);
        for (string? current = parent; current is not null; current = Path.GetDirectoryName(current))
            if ((File.GetAttributes(current) & FileAttributes.ReparsePoint) != 0)
                throw new NativeStartupException("session_path_link");
        DirectoryPath = Path.Combine(parent, ".nxp-maa-session-" + sessionId);
        if (Directory.Exists(DirectoryPath) || File.Exists(DirectoryPath))
            throw new NativeStartupException("session_path_exists");
        Directory.CreateDirectory(DirectoryPath);
        _marker = Path.Combine(DirectoryPath, ".nxp-owned-session.json");
        _identity = JsonSerializer.Serialize(new { owner = "NexusPipeline.MaaWorker", sessionId, pid = Environment.ProcessId });
        using (var stream = new FileStream(_marker, FileMode.CreateNew, FileAccess.Write, FileShare.None))
        using (var writer = new StreamWriter(stream)) writer.Write(_identity);
        // ZeroMQ creates its internal AF_UNIX signaler through the CRT temporary
        // directory independently of Maa's public Agent endpoint directory.
        Environment.SetEnvironmentVariable("TEMP", DirectoryPath);
        Environment.SetEnvironmentVariable("TMP", DirectoryPath);
    }

    internal void Complete()
    {
        if (!File.Exists(_marker) || File.ReadAllText(_marker) != _identity
            || (File.GetAttributes(DirectoryPath) & FileAttributes.ReparsePoint) != 0)
            throw new InvalidDataException("worker.session_ownership_changed");
        var pending = new Stack<string>(); pending.Push(DirectoryPath);
        while (pending.TryPop(out string? directory))
            foreach (string entry in Directory.EnumerateFileSystemEntries(directory))
            {
                var attributes = File.GetAttributes(entry);
                if ((attributes & FileAttributes.ReparsePoint) != 0)
                    throw new InvalidDataException("worker.session_cleanup_link");
                if ((attributes & FileAttributes.Directory) != 0) pending.Push(entry);
            }
        Directory.Delete(DirectoryPath, true);
    }

    internal void RetainFailure(string code, string phase)
    {
        if (!File.Exists(_marker) || File.ReadAllText(_marker) != _identity
            || (File.GetAttributes(DirectoryPath) & FileAttributes.ReparsePoint) != 0) return;
        using var stream = new FileStream(Path.Combine(DirectoryPath, "failure.json"), FileMode.CreateNew, FileAccess.Write, FileShare.None);
        JsonSerializer.Serialize(stream, new { code, phase, stoppedAtUtc = DateTimeOffset.UtcNow });
    }
}
