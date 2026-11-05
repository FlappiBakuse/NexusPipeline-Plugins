using System.Runtime.InteropServices;
using System.Security.Cryptography;

namespace NexusPipeline.Extensions.MaaFramework;

internal sealed class MaaTaskPayload : IDisposable
{
    private byte[]? bytes;

    internal MaaTaskPayload(ReadOnlySpan<byte> content)
    {
        if (content.Length is < 2 or > 32 * 1024 * 1024 || content.Contains((byte)0))
            throw new IOException("maa_task_payload_invalid");
        bytes = new byte[content.Length + 1];
        content.CopyTo(bytes);
    }

    internal long Post(MaaNative native, nint tasker, string entry, bool outputScope)
    {
        var content = bytes ?? throw new ObjectDisposedException(nameof(MaaTaskPayload));
        MaaPipelineGuard.CheckRoot(MaaJson.Read(content.AsMemory(0, content.Length - 1)), outputScope);
        var held = GCHandle.Alloc(content, GCHandleType.Pinned);
        try { return native.PostBytes(tasker, entry, held.AddrOfPinnedObject()); }
        finally { held.Free(); }
    }

    public void Dispose()
    {
        var previous = Interlocked.Exchange(ref bytes, null);
        if (previous is not null) CryptographicOperations.ZeroMemory(previous);
    }
}
