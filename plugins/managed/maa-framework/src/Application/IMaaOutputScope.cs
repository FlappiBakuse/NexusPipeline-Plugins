namespace NexusPipeline.Extensions.MaaFramework;

internal interface IMaaOutputScope : IAsyncDisposable
{
    string Root { get; }
    // This borrow does not grant freshness from a path; its producer holds actual worker/input/output identities.
    void RequireCurrent();
    ValueTask<MaaOutputSnapshot> FreezeAsync(CancellationToken cancellation);
}

internal sealed record MaaOutputFile(string Name, long SizeBytes, string Sha256);
internal sealed record MaaOutputSnapshot(IReadOnlyList<MaaOutputFile> Files, long TotalBytes, bool MayOverwrite,
    bool NativeWritersDrained, bool ProcessFamilyStopped);
internal sealed record MaaNativeAction(string Node, string Action, bool Success, string DetailJson);
