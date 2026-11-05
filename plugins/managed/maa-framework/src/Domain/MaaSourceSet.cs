using System.Security.Cryptography;
using System.Text;
using System.Text.Json.Nodes;

namespace NexusPipeline.Extensions.MaaFramework;

internal sealed record MaaSourceInput(string Path, ReadOnlyMemory<byte> Content, string Sha256, string Identity);
internal sealed record MaaSourceProof(string Path, string Sha256, string Identity, int Bytes);
internal sealed class MaaSourceSet
{
    private readonly Dictionary<string, MaaSourceInput> files = new(StringComparer.OrdinalIgnoreCase);
    private readonly Dictionary<string, MaaSourceProof> used = new(StringComparer.OrdinalIgnoreCase);
    private readonly string[] paths;
    private readonly string observationFingerprint;
    private readonly MaaConfigBinding[] bindings;
    private MaaSourceSet(MaaSourceSet source) { files = source.files; paths = source.paths; observationFingerprint = source.observationFingerprint; bindings = source.bindings; }
    internal MaaSourceSet Fork() => new(this);
    internal MaaSourceSet(IReadOnlyList<MaaSourceInput> inputs, IReadOnlyList<string>? knownPaths = null, string observationFingerprint = "", IReadOnlyList<MaaConfigBinding>? configurationBindings = null)
    {
        if (inputs.Count is < 1 or > 128 || inputs.Sum(input => (long)input.Content.Length) > 32 * 1024 * 1024)
            throw new MaaInputFailure("maa_source_budget");
        foreach (var input in inputs)
        {
            var path = Normalize(input.Path); var captured = input.Content.ToArray();
            if (captured.Length is < 1 or > 8 * 1024 * 1024 || string.IsNullOrWhiteSpace(input.Identity) || input.Identity.Length > 2048 || input.Identity.Any(char.IsControl) ||
                input.Sha256.Length != 64 || input.Sha256.Any(character => !char.IsAsciiHexDigitLower(character)) ||
                Convert.ToHexStringLower(SHA256.HashData(captured)) != input.Sha256 || files.ContainsKey(path))
                throw new MaaInputFailure("maa_source_identity_invalid");
            files.Add(path, input with { Path = path, Content = captured });
        }
        paths = (knownPaths ?? files.Keys.ToArray()).Select(Normalize).Order(StringComparer.Ordinal).ToArray();
        if (paths.Length > 4096 || paths.Distinct(StringComparer.OrdinalIgnoreCase).Count() != paths.Length ||
            files.Keys.Any(path => !paths.Contains(path, StringComparer.Ordinal)) ||
            observationFingerprint.Length != 0 && (observationFingerprint.Length != 64 || observationFingerprint.Any(character => !char.IsAsciiHexDigitLower(character))))
            throw new MaaInputFailure("maa_source_listing_invalid");
        this.observationFingerprint = observationFingerprint;
        bindings = (configurationBindings ?? []).Select(binding => binding with { }).OrderBy(binding => binding.Path, StringComparer.Ordinal).ToArray();
        if (bindings.Length > 128 || bindings.Select(binding => binding.Path).Distinct(StringComparer.OrdinalIgnoreCase).Count() != bindings.Length ||
            bindings.Any(binding => !files.TryGetValue(binding.Path, out var input) || input.Sha256 != binding.SourceSha256 ||
                binding.Revision is < 1 or > 9007199254740991 || binding.ContractRevision is < 1 or > 9007199254740991 ||
                string.IsNullOrWhiteSpace(binding.ResourceId) || binding.ResourceId.Length > 120 || binding.ResourceId.Any(char.IsControl) ||
                !Digest(binding.ContractSha256) || !Digest(binding.SnapshotSha256))) throw new MaaInputFailure("maa_configuration_binding_invalid");
        foreach (var binding in bindings) if (binding.RelativePath.Length > 0) Normalize(binding.RelativePath);
    }
    internal string[] Paths => paths.ToArray();
    internal MaaSourceProof[] SnapshotProofs => files.Values.OrderBy(file => file.Path, StringComparer.Ordinal)
        .Select(file => new MaaSourceProof(file.Path, file.Sha256, file.Identity, file.Content.Length)).ToArray();
    internal string SnapshotFingerprint => Convert.ToHexStringLower(SHA256.HashData(System.Text.Json.JsonSerializer.SerializeToUtf8Bytes(
        new { Files = SnapshotProofs, Paths = paths, ObservationFingerprint = observationFingerprint, ConfigurationBindings = bindings })));
    internal MaaConfigBinding[] ConfigurationBindings => bindings.Select(binding => binding with { }).ToArray();
    internal bool Contains(string path) => paths.Contains(Normalize(path), StringComparer.OrdinalIgnoreCase);
    internal JsonObject Read(string path)
    {
        path = Normalize(path);
        if (!files.TryGetValue(path, out var file)) throw new MaaInputFailure("maa_source_missing:" + path);
        used[path] = new(file.Path, file.Sha256, file.Identity, file.Content.Length);
        return MaaJson.Read(file.Content);
    }
    internal MaaSourceProof[] Proofs => used.Values.OrderBy(proof => proof.Path, StringComparer.Ordinal).ToArray();
    internal string Fingerprint => Hash(Proofs);
    internal static string Hash(IEnumerable<MaaSourceProof> proofs) => Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(string.Join("\n",
        proofs.OrderBy(proof => proof.Path, StringComparer.Ordinal).Select(proof => proof.Path + "\n" + proof.Sha256 + "\n" + proof.Identity)))));
    internal static string Normalize(string path)
    {
        if (string.IsNullOrWhiteSpace(path) || path.Length > 1024 || path.Contains('\\') || path.Contains(':') || path.StartsWith('/') ||
            path.Any(char.IsControl) || path.Split('/').Any(part => part is "" or "." or ".." || part.EndsWith(' ') || part.EndsWith('.')))
            throw new MaaInputFailure("maa_relative_path_invalid");
        return path;
    }
    internal static string Relative(string basis, string path)
    { Normalize(path); var split = Normalize(basis).LastIndexOf('/'); return split < 0 ? path : Normalize(basis[..(split + 1)] + path); }
    private static bool Digest(string value) => value is { Length: 64 } && value.All(char.IsAsciiHexDigitLower);
}
