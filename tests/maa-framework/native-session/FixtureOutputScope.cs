using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text.RegularExpressions;
using Microsoft.Win32.SafeHandles;
using NexusPipeline.Extensions.MaaFramework;

internal sealed class FixtureOutputScope : IMaaOutputScope
{
    private readonly List<DirectoryPin> directories = [];
    private readonly List<FileStream> inputs = [], frozen = [];
    private readonly long maximumBytes;
    private MaaOutputSnapshot? snapshot;
    internal bool Disposed, FreezeCalled;
    public string Root { get; }
    internal FixtureOutputScope(string root, FixtureInputs source, long maximumBytes)
    {
        Root = MaaNativePath.Capture(root, true); this.maximumBytes = maximumBytes;
        var nonce = Environment.GetEnvironmentVariable("NEXUS_TEST_OUTPUT_PROOF") ?? throw new IOException("fixture_fresh_proof_missing");
        var proof = Path.Combine(Root, ".fresh-proof");
        if (File.ReadAllText(proof) != nonce || Directory.EnumerateFileSystemEntries(Root).Count() != 1) throw new IOException("fixture_output_not_fresh");
        foreach (var path in source.ReadOnlyPaths)
        {
            if (path.StartsWith(Root + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase)) throw new IOException("fixture_output_overlaps_input");
            inputs.Add(new(path, FileMode.Open, FileAccess.Read, FileShare.Read));
        }
        var leaf = new DirectoryInfo(Root);
        for (DirectoryInfo? item = leaf; item is not null; item = item.Parent) directories.Add(new(item.FullName));
        Directory.CreateDirectory(Path.Combine(Root, "screencap")); directories.Add(new(Path.Combine(Root, "screencap")));
        RequireCurrent();
    }
    public void RequireCurrent()
    {
        ObjectDisposedException.ThrowIf(Disposed, this);
        foreach (var pin in directories) pin.RequireCurrent();
        foreach (var file in inputs) if (file.SafeFileHandle.IsClosed) throw new IOException("fixture_input_lease_closed");
    }
    public ValueTask<MaaOutputSnapshot> FreezeAsync(CancellationToken cancellation)
    {
        cancellation.ThrowIfCancellationRequested(); RequireCurrent(); FreezeCalled = true;
        if (snapshot is not null) return ValueTask.FromResult(snapshot);
        if (Directory.EnumerateFileSystemEntries(Root).Any(path => Path.GetFileName(path) is not ("screencap" or ".fresh-proof")))
            throw new IOException("fixture_output_unknown_member");
        var result = new List<MaaOutputFile>(); long total = 0;
        foreach (var path in Directory.EnumerateFileSystemEntries(Path.Combine(Root, "screencap")).Order())
        {
            cancellation.ThrowIfCancellationRequested();
            if ((File.GetAttributes(path) & (FileAttributes.Directory | FileAttributes.ReparsePoint)) != 0) throw new IOException("fixture_output_link_or_directory");
            var name = Path.GetFileName(path);
            if (!Regex.IsMatch(name, @"^\d{4}\.\d{2}\.\d{2}-\d{2}\.\d{2}\.\d{2}\.\d{1,3}_[A-Za-z0-9_-]+\.png$")) throw new IOException("fixture_output_name_invalid");
            var file = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.Read); frozen.Add(file);
            total += file.Length;
            if (result.Count >= 16 || file.Length is < 33 or > 8388608 || total > maximumBytes) throw new IOException("maa_output_quota_exceeded");
            var header = new byte[8]; file.ReadExactly(header);
            if (!header.AsSpan().SequenceEqual(new byte[] { 137, 80, 78, 71, 13, 10, 26, 10 })) throw new IOException("fixture_output_not_png");
            file.Position = 0; result.Add(new(name, file.Length, Convert.ToHexStringLower(SHA256.HashData(file)))); file.Position = 0;
        }
        RequireCurrent(); snapshot = new(result.ToArray(), total, true, true, false);
        return ValueTask.FromResult(snapshot);
    }
    public ValueTask DisposeAsync()
    {
        if (!Disposed)
        {
            Disposed = true; foreach (var file in frozen.Concat(inputs)) file.Dispose();
            foreach (var directory in directories.AsEnumerable().Reverse()) directory.Dispose();
        }
        return ValueTask.CompletedTask;
    }
    private sealed class DirectoryPin : IDisposable
    {
        private readonly string path;
        private readonly SafeFileHandle handle;
        private readonly Identity identity;
        internal DirectoryPin(string path)
        {
            this.path = MaaNativePath.Capture(path, true); handle = Open(this.path);
            if (!GetFileInformationByHandle(handle, out identity)) throw new IOException("fixture_directory_identity_failed");
        }
        internal void RequireCurrent()
        {
            _ = MaaNativePath.Capture(path, true); using var current = Open(path);
            if (!GetFileInformationByHandle(current, out var value) || identity.Volume != value.Volume || identity.High != value.High || identity.Low != value.Low)
                throw new IOException("fixture_directory_identity_changed");
        }
        private static SafeFileHandle Open(string path)
        {
            var result = CreateFileW(path, 0x80, FileShare.Read | FileShare.Write, 0, FileMode.Open, 0x02000000, 0);
            if (result.IsInvalid) throw new IOException("fixture_directory_pin_failed:" + Marshal.GetLastWin32Error());
            return result;
        }
        public void Dispose() => handle.Dispose();
        [StructLayout(LayoutKind.Sequential)] internal struct Identity
        {
            public uint Attributes; public System.Runtime.InteropServices.ComTypes.FILETIME Created, Accessed, Written;
            public uint Volume, SizeHigh, SizeLow, Links, High, Low;
        }
        [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)] private static extern SafeFileHandle CreateFileW(string name, uint access, FileShare share, nint security, FileMode mode, uint flags, nint template);
        [DllImport("kernel32.dll", SetLastError = true)] [return: MarshalAs(UnmanagedType.Bool)] private static extern bool GetFileInformationByHandle(SafeFileHandle handle, out Identity identity);
    }
}
