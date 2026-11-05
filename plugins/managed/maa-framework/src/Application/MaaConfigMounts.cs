using NexusPipeline.Extensibility.Compilation;

namespace NexusPipeline.Extensions.MaaFramework;

internal sealed class MaaConfigMounts
{
    private readonly ISelectedSource source;
    private readonly SourceConfiguration[] captured;
    private readonly string instance;
    internal IReadOnlyList<SourceConfiguration> Metadata => Array.AsReadOnly(captured);
    internal MaaConfigMounts(ISelectedSource source, string instance)
    {
        this.source = source; this.instance = instance; MaaImportRules.Instance(instance);
        captured = Capture(source.Configurations);
    }
    internal void Require(string path)
    {
        MaaSourceSet.Normalize(path); RequireCurrent();
        var matches = captured.Where(item => item.Kind == SourceEntryKind.File ? path == item.Path :
            path.StartsWith(item.Path + "/", StringComparison.Ordinal)).ToArray();
        if (matches.Length != 1 || matches[0].RequiresInstance && matches[0].InstanceKey != instance)
            throw new MaaInputFailure("maa_saved_configuration_required:" + path);
    }
    internal void RequireCurrent()
    {
        if (!captured.SequenceEqual(Capture(source.Configurations))) throw new MaaInputFailure("maa_configuration_mount_changed");
    }
    internal MaaConfigBinding Bind(string path, string sha)
    {
        Require(path);
        var mount = captured.Single(item => item.Kind == SourceEntryKind.File ? path == item.Path : path.StartsWith(item.Path + "/", StringComparison.Ordinal));
        return new(path, mount.ResourceId, mount.Revision, sha, mount.Kind == SourceEntryKind.File ? "" : path[(mount.Path.Length + 1)..],
            mount.ContractRevision, mount.ContractSha256, mount.SnapshotSha256);
    }
    private static SourceConfiguration[] Capture(IReadOnlyList<SourceConfiguration> metadata)
    {
        if (metadata is null || metadata.Count > 256) throw new MaaInputFailure("maa_configuration_metadata_invalid");
        var result = metadata.Select(item =>
        {
            if (item is null || string.IsNullOrWhiteSpace(item.ResourceId) || item.ResourceId.Length > 120 || item.ResourceId.Any(char.IsControl) ||
                item.Revision is < 1 or > 9007199254740991 || item.ContractRevision is < 1 or > 9007199254740991 ||
                !Digest(item.ContractSha256) || !Digest(item.SnapshotSha256) || !Enum.IsDefined(item.Kind) ||
                item.RequiresInstance && string.IsNullOrWhiteSpace(item.InstanceKey) ||
                item.InstanceKey is not null && (item.InstanceKey.Length > 128 || item.InstanceKey.Any(char.IsControl)))
                throw new MaaInputFailure("maa_configuration_metadata_invalid");
            MaaSourceSet.Normalize(item.Path); return item with { };
        }).ToArray();
        if (result.Select(item => item.ResourceId).Distinct(StringComparer.OrdinalIgnoreCase).Count() != result.Length ||
            result.Any(left => result.Any(right => !ReferenceEquals(left, right) &&
                (left.Path.Equals(right.Path, StringComparison.OrdinalIgnoreCase) || left.Path.StartsWith(right.Path + "/", StringComparison.OrdinalIgnoreCase)))))
            throw new MaaInputFailure("maa_configuration_metadata_ambiguous");
        return result;
    }
    private static bool Digest(string value) => value is { Length: 64 } && value.All(char.IsAsciiHexDigitLower);
}
