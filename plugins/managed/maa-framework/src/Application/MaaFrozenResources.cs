using System.Security.Cryptography;
using NexusPipeline.Extensibility.Protocol;

namespace NexusPipeline.Extensions.MaaFramework;

internal sealed class MaaFrozenResources : IDisposable
{
    private readonly MaaInputLease held = new();
    private readonly Action requireWorkspace;
    private readonly List<string> directories = [];
    private readonly Dictionary<string, string> created = new(StringComparer.OrdinalIgnoreCase);
    private readonly Dictionary<string, (long Bytes, string Sha256)> files = new(StringComparer.OrdinalIgnoreCase);
    private long totalBytes;
    private int totalEntries;
    internal IReadOnlyList<string> Directories => directories.ToArray();
    internal string ProjectRoot { get; }
    private MaaFrozenResources(Action requireWorkspace, string root) { this.requireWorkspace = requireWorkspace; ProjectRoot = Path.Combine(root, "project"); }

    internal static async Task<MaaFrozenResources> CreateAsync(IMaaResourceSource source, string fingerprint,
        IReadOnlyList<string> resourcePaths, string root, Action requireWorkspace, CancellationToken cancellation, bool programInputs = false)
    {
        if (resourcePaths.Count is < 1 or > 8 || resourcePaths.Distinct(StringComparer.OrdinalIgnoreCase).Count() != resourcePaths.Count)
            throw Invalid();
        requireWorkspace(); MaaNativePath.Capture(root, true);
        var result = new MaaFrozenResources(requireWorkspace, root);
        try
        {
            result.held.Directory(root);
            result.held.Create(result.ProjectRoot); result.created.Add(result.ProjectRoot, result.ProjectRoot);
            var manifest = await source.ManifestAsync(cancellation).ConfigureAwait(false);
            if (manifest.Kind != "manifest" || manifest.Fingerprint != fingerprint || manifest.Trees is null ||
                manifest.Trees.Count != resourcePaths.Count + (programInputs ? 1 : 0) ||
                manifest.Trees.Select(tree => tree.Name).Distinct(StringComparer.Ordinal).Count() != manifest.Trees.Count)
                throw Invalid();
            for (var index = 0; index < resourcePaths.Count; index++)
            {
                var tree = manifest.Trees.SingleOrDefault(tree => tree.Path == resourcePaths[index]) ?? throw Invalid();
                if (tree.Name != "resource-" + index.ToString(System.Globalization.CultureInfo.InvariantCulture) || tree.EntryCount is < 1 or > 32768)
                    throw Invalid();
                Relative(resourcePaths[index]);
                var destination = Path.Combine(result.ProjectRoot, resourcePaths[index].Replace('/', Path.DirectorySeparatorChar));
                await result.TreeAsync(source, fingerprint, tree, destination, cancellation).ConfigureAwait(false);
                result.directories.Add(destination);
            }
            if (programInputs)
            {
                var tree = manifest.Trees.SingleOrDefault(tree => tree.Name == "program-input") ?? throw Invalid();
                if (tree.Path != "" || tree.EntryCount is < 1 or > 32768) throw Invalid();
                await result.TreeAsync(source, fingerprint, tree, result.ProjectRoot, cancellation).ConfigureAwait(false);
            }
            result.RequireCurrent(); return result;
        }
        catch { result.Dispose(); throw; }
    }

    private async Task TreeAsync(IMaaResourceSource source, string fingerprint, ExecutionProjectResponseTreesItem tree,
        string destination, CancellationToken cancellation)
    {
        totalEntries = checked(totalEntries + (int)tree.EntryCount);
        if (totalEntries > 32768) throw Invalid();
        var entries = new Dictionary<string, ExecutionProjectResponseEntriesItem>(StringComparer.OrdinalIgnoreCase);
        for (long position = 0; position < tree.EntryCount;)
        {
            RequireCurrent(); cancellation.ThrowIfCancellationRequested();
            var page = await source.TreeAsync(tree.Name, position, cancellation).ConfigureAwait(false);
            if (page.Kind != "tree" || page.Fingerprint != fingerprint || page.Index != position || page.Entries is not { Count: > 0 and <= 16 } ||
                page.Entries.Count != Math.Min(16, tree.EntryCount - position)) throw Invalid();
            foreach (var item in page.Entries)
            {
                if (!entries.TryAdd(item.Path, item)) throw Invalid();
                if (item.Path.Length != 0) Relative(item.Path);
                if (item.Kind == "directory" ? item.SizeBytes != 0 || item.Sha256 is not null :
                    item.Kind != "file" || item.SizeBytes is < 0 or > 1073741824 || !Digest(item.Sha256)) throw Invalid();
            }
            position += page.Entries.Count;
        }
        if (!entries.TryGetValue("", out var root) || root.Kind != "directory") throw Invalid();
        foreach (var item in entries.Values.Where(item => item.Path.Length > 0))
        {
            var slash = item.Path.LastIndexOf('/'); var parent = slash < 0 ? "" : item.Path[..slash];
            if (!entries.TryGetValue(parent, out var ancestor) || ancestor.Kind != "directory" || ancestor.Path != parent) throw Invalid();
        }
        Directory(destination);
        foreach (var item in entries.Values.Where(item => item.Path.Length > 0).OrderBy(item => item.Path.Count(character => character == '/')).ThenBy(item => item.Path, StringComparer.Ordinal))
        {
            RequireCurrent(); cancellation.ThrowIfCancellationRequested();
            var path = Path.Combine(destination, item.Path.Replace('/', Path.DirectorySeparatorChar));
            if (item.Kind == "directory") Directory(path);
            else if (files.TryGetValue(path, out var previous))
            {
                if (previous.Bytes != item.SizeBytes || previous.Sha256 != item.Sha256) throw Invalid();
            }
            else
            {
                totalBytes = checked(totalBytes + item.SizeBytes); if (totalBytes > 1073741824) throw Invalid();
                await FileAsync(source, fingerprint, tree.Name, item, path, cancellation).ConfigureAwait(false);
                files.Add(path, (item.SizeBytes, item.Sha256!));
            }
        }
    }

    private void Directory(string path)
    {
        if (!path.Equals(ProjectRoot, StringComparison.OrdinalIgnoreCase) && !path.StartsWith(ProjectRoot + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase))
            throw Invalid();
        if (created.TryGetValue(path, out var original))
        { if (original != path) throw Invalid(); return; }
        var parent = Path.GetDirectoryName(path)!;
        Directory(parent); held.Create(path); created.Add(path, path);
    }

    private async Task FileAsync(IMaaResourceSource source, string fingerprint, string tree,
        ExecutionProjectResponseEntriesItem entry, string destination, CancellationToken cancellation)
    {
        using (var hash = IncrementalHash.CreateHash(HashAlgorithmName.SHA256))
        await using (var output = new FileStream(destination, FileMode.CreateNew, FileAccess.Write, FileShare.None, 131072, true))
        {
            for (long offset = 0; offset < entry.SizeBytes;)
            {
                RequireCurrent(); cancellation.ThrowIfCancellationRequested();
                var maximum = checked((int)Math.Min(131072, entry.SizeBytes - offset));
                var response = await source.FileAsync(tree, entry.Path, offset, maximum, cancellation).ConfigureAwait(false);
                if (response.Kind != "file" || response.Fingerprint != fingerprint || response.Offset != offset ||
                    response.SizeBytes != entry.SizeBytes || response.Sha256 != entry.Sha256 || response.ContentBase64 is null) throw Invalid();
                var bytes = Convert.FromBase64String(response.ContentBase64);
                if (bytes.Length != maximum) throw Invalid();
                hash.AppendData(bytes); await output.WriteAsync(bytes, cancellation).ConfigureAwait(false); offset += bytes.Length;
            }
            if (Convert.ToHexStringLower(hash.GetHashAndReset()) != entry.Sha256) throw Invalid();
            await output.FlushAsync(cancellation).ConfigureAwait(false);
        }
        held.File(destination, entry.SizeBytes, entry.Sha256!);
    }

    private static void Relative(string path)
    {
        MaaSourceSet.Normalize(path);
        foreach (var part in path.Split('/'))
        {
            var stem = part.Split('.')[0].ToUpperInvariant();
            if (part.Length > 255 || part.Any(character => "<>\"|?*".Contains(character)) ||
                stem is "CON" or "PRN" or "AUX" or "NUL" || stem.Length == 4 && stem[3] is >= '1' and <= '9' && stem[..3] is "COM" or "LPT") throw Invalid();
        }
    }
    private static bool Digest(string? value) => value is { Length: 64 } && value.All(char.IsAsciiHexDigitLower);
    internal void RequireCurrent() { requireWorkspace(); held.RequireCurrent(); }
    internal (long Bytes, string Sha256) File(string relative)
    {
        RequireCurrent(); Relative(relative);
        var path = Path.Combine(ProjectRoot, relative.Replace('/', Path.DirectorySeparatorChar));
        return files.TryGetValue(path, out var value) ? value : throw Invalid();
    }
    public void Dispose() => held.Dispose();
    private static IOException Invalid() => new("maa_resource_input_unbound");
}
