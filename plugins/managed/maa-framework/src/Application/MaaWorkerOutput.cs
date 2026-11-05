using System.Security.Cryptography;
using System.Text.RegularExpressions;
using NexusPipeline.Extensibility.Execution;

namespace NexusPipeline.Extensions.MaaFramework;

internal sealed class MaaWorkerOutput : IMaaOutputScope
{
    private readonly ExecutionWorkDirectory workspace;
    private readonly MaaInputLease directory = new();
    private readonly List<FileStream> files = [];
    private MaaOutputSnapshot? snapshot;
    private bool disposed;
    public string Root => workspace.OutputDirectory;
    internal MaaWorkerOutput(ExecutionWorkDirectory workspace)
    {
        this.workspace = workspace; workspace.RequireCurrent();
        try { directory.Create(Path.Combine(Root, "screencap")); }
        catch { directory.Dispose(); throw; }
    }
    public void RequireCurrent()
    { ObjectDisposedException.ThrowIf(disposed, this); workspace.RequireHeld(); directory.RequireCurrent(); }
    public ValueTask<MaaOutputSnapshot> FreezeAsync(CancellationToken cancellation)
    {
        cancellation.ThrowIfCancellationRequested(); RequireCurrent();
        if (snapshot is not null) return ValueTask.FromResult(snapshot);
        if (Directory.EnumerateFileSystemEntries(Root).Any(path => Path.GetFileName(path) is not ("logs" or "screencap")) ||
            Directory.EnumerateFileSystemEntries(Path.Combine(Root, "logs")).Any()) throw new IOException("maa_output_unknown_member");
        var result = new List<MaaOutputFile>(); long total = 0;
        foreach (var path in Directory.EnumerateFileSystemEntries(Path.Combine(Root, "screencap")).Order(StringComparer.Ordinal))
        {
            cancellation.ThrowIfCancellationRequested(); RequireCurrent();
            if ((File.GetAttributes(path) & (FileAttributes.Directory | FileAttributes.ReparsePoint)) != 0) throw new IOException("maa_output_link_rejected");
            var name = Path.GetFileName(path);
            var match = Regex.Match(name, @"^\d{4}\.\d{2}\.\d{2}-\d{2}\.\d{2}\.\d{2}\.\d{1,3}_(?<node>.+)\.png$", RegexOptions.CultureInvariant,
                TimeSpan.FromMilliseconds(100));
            if (!match.Success) throw new IOException("maa_output_name_rejected");
            MaaScreencapPolicy.Name(match.Groups["node"].Value);
            var file = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.Read); files.Add(file); total += file.Length;
            if (result.Count >= 128 || file.Length is < 33 or > 8388608 || total > 64L * 1024 * 1024) throw new IOException("maa_output_quota_exceeded");
            var header = new byte[8]; file.ReadExactly(header);
            if (!header.AsSpan().SequenceEqual(new byte[] { 137, 80, 78, 71, 13, 10, 26, 10 })) throw new IOException("maa_output_png_invalid");
            file.Position = 0; result.Add(new(name, file.Length, Convert.ToHexStringLower(SHA256.HashData(file)))); file.Position = 0;
        }
        RequireCurrent(); snapshot = new(result.ToArray(), total, true, true, false);
        return ValueTask.FromResult(snapshot);
    }
    public ValueTask DisposeAsync()
    {
        if (disposed) return ValueTask.CompletedTask; disposed = true;
        foreach (var file in files) file.Dispose(); files.Clear(); directory.Dispose();
        return ValueTask.CompletedTask;
    }
}
