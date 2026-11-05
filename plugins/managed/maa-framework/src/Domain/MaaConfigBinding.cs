namespace NexusPipeline.Extensions.MaaFramework;

internal sealed record MaaConfigBinding(string Path, string ResourceId, long Revision, string SourceSha256,
    string RelativePath, long ContractRevision, string ContractSha256, string SnapshotSha256);
