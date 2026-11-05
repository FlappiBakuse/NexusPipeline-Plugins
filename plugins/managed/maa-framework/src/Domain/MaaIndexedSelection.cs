using System.Collections.ObjectModel;
using System.Globalization;
using System.Security.Cryptography;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace NexusPipeline.Extensions.MaaFramework;

internal sealed record MaaIndexedTarget(string OccurrenceId, int Index, string NativeName, string Entry,
    string RowSha256, bool InitialEnabled);
internal sealed record MaaIndexedEdit(string OccurrenceId, object[] Selector, bool Expected, bool Value);

internal sealed class MaaIndexedSelection
{
    internal string ResourceId { get; }
    internal long Revision { get; }
    internal string SourceSha256 { get; }
    internal string SourceFingerprint { get; }
    internal ReadOnlyCollection<MaaIndexedTarget> Targets { get; }
    private MaaIndexedSelection(string resourceId, long revision, string sha, string fingerprint, MaaIndexedTarget[] targets)
    { ResourceId = resourceId; Revision = revision; SourceSha256 = sha; SourceFingerprint = fingerprint; Targets = Array.AsReadOnly(targets); }
    internal static MaaIndexedSelection Capture(MaaImportedProfile profile, string resourceId, long revision,
        string sourcePath, ReadOnlyMemory<byte> source)
    {
        if (profile.Kind != "mfa" || profile.SourceSchema != "mfa-instance-2.16" ||
            sourcePath != "config/instances/" + profile.InstanceId + ".json" || revision is < 1 or > 9007199254740991 ||
            string.IsNullOrWhiteSpace(resourceId) || resourceId.Length > 120 || resourceId.Any(char.IsControl) ||
            profile.SourceFingerprint != MaaSourceSet.Hash(profile.Sources)) throw new MaaInputFailure("maa_index_source_unbound");
        var sha = Hash(source.Span); var proof = profile.Sources.SingleOrDefault(item => item.Path == sourcePath);
        var document = MaaJson.Read(source);
        if (proof?.Sha256 != sha || !JsonNode.DeepEquals(profile.SourceSnapshot["instance"], document))
            throw new MaaInputFailure("maa_index_source_unbound");
        if (document["TaskItems"] is not JsonArray rows || rows.Count != profile.Tasks.Length)
            throw new MaaInputFailure("maa_index_materialization_required");
        var targets = new List<MaaIndexedTarget>();
        for (var index = 0; index < rows.Count; index++)
        {
            var row = MaaJson.Object(rows[index]); var occurrence = profile.Tasks[index];
            var position = index.ToString(CultureInfo.InvariantCulture);
            if (occurrence.SourceId != position || occurrence.Order != index ||
                occurrence.Id != MaaImportRules.Identity("mfa", profile.InstanceId, position) ||
                occurrence.Entry != MaaJson.Required(row, "entry")) throw new MaaInputFailure("maa_index_identity_changed");
            if (row["default_check"] is not JsonValue enabled || !enabled.TryGetValue<bool>(out var value))
                throw new MaaInputFailure("maa_index_explicit_flag_required");
            if (value != occurrence.Enabled) throw new MaaInputFailure("maa_index_identity_changed");
            targets.Add(new(occurrence.Id, index, MaaJson.Required(row, "name"), occurrence.Entry,
                Hash(JsonSerializer.SerializeToUtf8Bytes(row)), value));
        }
        MaaImportRules.Unique(targets.Select(item => item.OccurrenceId));
        return new(resourceId, revision, sha, profile.SourceFingerprint, targets.ToArray());
    }
    internal MaaIndexedEdit[] Select(ReadOnlyMemory<byte> currentSource, IReadOnlyList<string> authorized, IReadOnlyList<string> selected)
    {
        if (Hash(currentSource.Span) != SourceSha256) throw new MaaInputFailure("maa_index_source_changed");
        if (authorized.Count is < 1 or > 256 || selected.Count > 256 || authorized.Distinct(StringComparer.Ordinal).Count() != authorized.Count ||
            selected.Distinct(StringComparer.Ordinal).Count() != selected.Count || selected.Any(id => !authorized.Contains(id, StringComparer.Ordinal)) ||
            authorized.Any(id => !Targets.Any(target => target.OccurrenceId == id))) throw new MaaInputFailure("maa_index_selection_invalid");
        var rows = MaaJson.Objects(MaaJson.Read(currentSource)["TaskItems"]);
        if (rows.Length != Targets.Count) throw new MaaInputFailure("maa_index_source_changed");
        foreach (var target in Targets)
            if (Hash(JsonSerializer.SerializeToUtf8Bytes(rows[target.Index])) != target.RowSha256)
                throw new MaaInputFailure("maa_index_identity_changed");
        return Targets.Where(target => authorized.Contains(target.OccurrenceId, StringComparer.Ordinal)).Select(target =>
            new MaaIndexedEdit(target.OccurrenceId, ["TaskItems", target.Index, "default_check"], target.InitialEnabled,
                selected.Contains(target.OccurrenceId, StringComparer.Ordinal))).ToArray();
    }
    private static string Hash(ReadOnlySpan<byte> bytes) => Convert.ToHexStringLower(SHA256.HashData(bytes));
}
