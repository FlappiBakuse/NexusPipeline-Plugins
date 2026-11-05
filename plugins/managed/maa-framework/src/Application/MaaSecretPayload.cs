using System.Security.Cryptography;

namespace NexusPipeline.Extensions.MaaFramework;

internal delegate void MaaSecretBytes(ReadOnlySpan<byte> bytes);

internal sealed class MaaSecretPayload : IDisposable
{
    private readonly object gate = new();
    private byte[]? bytes;
    internal MaaSecretPayload(byte[] bytes) => this.bytes = bytes;

    internal void Use(MaaSecretBytes action)
    {
        lock (gate)
        {
            ObjectDisposedException.ThrowIf(bytes is null, this);
            action(bytes);
        }
    }

    public void Dispose()
    {
        lock (gate)
        {
            if (bytes is not { } previous) return;
            bytes = null; CryptographicOperations.ZeroMemory(previous);
        }
    }
    public override string ToString() => "[protected-json]";
}
