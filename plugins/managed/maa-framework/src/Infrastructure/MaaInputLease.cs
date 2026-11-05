using System.Runtime.InteropServices;
using System.Security.Cryptography;
using Microsoft.Win32.SafeHandles;

namespace NexusPipeline.Extensions.MaaFramework;

internal sealed class MaaInputLease : IDisposable
{
    private readonly List<IDisposable> held = [];
    private bool disposed;
    internal void Create(string path)
    {
        RequireCurrent();
        if (!CreateDirectory(MaaNativePath.Vendor(path), 0)) throw new IOException("maa_input_directory_exists");
        Directory(path);
    }
    internal void Directory(string path)
    {
        RequireCurrent(); MaaNativePath.Capture(path, true);
        var handle = OpenDirectory(MaaNativePath.Vendor(path), 0x80, 3, 0, 3, 0x02200000, 0);
        if (handle.IsInvalid) { handle.Dispose(); throw new IOException("maa_directory_lease_unavailable"); }
        held.Add(handle);
    }
    internal void File(string path, long size, string sha)
    {
        RequireCurrent(); MaaNativePath.Capture(path, false);
        var stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.Read);
        try
        {
            if (stream.Length != size || Convert.ToHexStringLower(SHA256.HashData(stream)) != sha)
                throw new IOException("maa_frozen_file_changed");
            held.Add(stream);
        }
        catch { stream.Dispose(); throw; }
    }
    internal void RequireCurrent() => ObjectDisposedException.ThrowIf(disposed, this);
    public void Dispose()
    {
        if (disposed) return; disposed = true;
        for (var index = held.Count - 1; index >= 0; index--) held[index].Dispose();
        held.Clear();
    }
    [DllImport("kernel32.dll", EntryPoint = "CreateFileW", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern SafeFileHandle OpenDirectory(string path, uint access, uint share, nint security, uint disposition, uint flags, nint template);
    [DllImport("kernel32.dll", EntryPoint = "CreateDirectoryW", CharSet = CharSet.Unicode, SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)] private static extern bool CreateDirectory(string path, nint security);
}
