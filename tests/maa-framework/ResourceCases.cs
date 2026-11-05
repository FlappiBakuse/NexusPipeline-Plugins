using System.Security.Cryptography;
using NexusPipeline.Extensibility.Protocol;
using NexusPipeline.Extensions.MaaFramework;

internal static class ResourceCases
{
    internal static void Run(Action<string, Action> run, string output)
    {
        var root = output + ".resources"; Directory.CreateDirectory(root);
        string NewRoot() { var path = Path.Combine(root, Guid.NewGuid().ToString("N")); Directory.CreateDirectory(path); return path; }
        run("resources-materialize-complete-pages-chunks-empty-files-and-hold-original-bytes", () => {
            var source = new Source(); var path = NewRoot();
            using var resources = Read(source, path);
            BundleCases.Assert(source.Pages == 2 && source.Chunks > source.Contents.Count && resources.Directories.Count == 1);
            foreach (var item in source.Contents)
                BundleCases.Assert(File.ReadAllBytes(Path.Combine(resources.Directories[0], item.Key)).AsSpan().SequenceEqual(item.Value));
            Denied(() => File.WriteAllText(Path.Combine(resources.Directories[0], "pipeline/large.json"), "changed"));
            Denied(() => Directory.Move(resources.Directories[0], resources.Directories[0] + ".moved"));
            Denied(() => Read(new Source(), path).Dispose());
            resources.RequireCurrent(); resources.Dispose(); Denied(resources.RequireCurrent);
        });
        foreach (var fault in new[] { "fingerprint", "tree-path", "extra-tree", "tree-name", "count", "page-index", "page-fingerprint",
            "case-alias", "escape", "device-name", "stream", "missing-parent", "root-file", "file-digest", "empty-digest",
            "chunk", "offset", "chunk-fingerprint", "file-length", "budget" })
            run("resources-reject-unbound-" + fault, () => Denied(() => Read(new Source { Fault = fault }, NewRoot()).Dispose()));
        run("resources-stop-workspace-admission-before-further-file-reads", () => {
            var source = new Source(); var count = 0;
            Denied(() => MaaFrozenResources.CreateAsync(source, Source.Fingerprint, ["assets/resource"], NewRoot(),
                () => { if (++count > 5) throw new OperationCanceledException(); }, default).GetAwaiter().GetResult().Dispose());
            BundleCases.Assert(source.Chunks < source.Contents.Count);
        });
    }
    private static MaaFrozenResources Read(Source source, string path) =>
        MaaFrozenResources.CreateAsync(source, Source.Fingerprint, ["assets/resource"], path, () => { }, default).GetAwaiter().GetResult();
    private static void Denied(Action action)
    {
        try { action(); }
        catch (Exception error) when (error is IOException or MaaInputFailure or OperationCanceledException or ObjectDisposedException) { return; }
        throw new InvalidOperationException("resource_rejection_expected");
    }
    private sealed class Source : IMaaResourceSource
    {
        internal const string Fingerprint = "dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd";
        internal string? Fault { get; init; }
        internal int Pages { get; private set; }
        internal int Chunks { get; private set; }
        internal Dictionary<string, byte[]> Contents { get; } = Enumerable.Range(0, 17).ToDictionary(index =>
            "pipeline/file-" + index + ".json", index => new byte[] { (byte)index }, StringComparer.Ordinal);
        internal Source() { Contents.Add("pipeline/large.json", Enumerable.Range(0, 300000).Select(index => (byte)index).ToArray()); Contents.Add("empty", []); }
        private ExecutionProjectResponseEntriesItem[] Entries()
        {
            var entries = new[] { Row("", "directory", 0), Row("pipeline", "directory", 0) }.Concat(Contents.Select(pair =>
                Row(pair.Key, "file", pair.Value.LongLength, Hash(pair.Value)))).ToArray();
            switch (Fault)
            {
                case "case-alias": entries[3] = entries[2] with { Path = entries[2].Path.ToUpperInvariant() }; break;
                case "escape": entries[2] = entries[2] with { Path = "../outside" }; break;
                case "device-name": entries[2] = entries[2] with { Path = "pipeline/CON.json" }; break;
                case "stream": entries[2] = entries[2] with { Path = "pipeline/file:extra" }; break;
                case "missing-parent": entries[2] = entries[2] with { Path = "missing/file" }; break;
                case "root-file": entries[0] = Row("", "file", 0, Hash([])); break;
                case "file-digest": entries[2] = entries[2] with { Sha256 = new string('0', 64) }; break;
                case "empty-digest": entries[^1] = entries[^1] with { Sha256 = new string('0', 64) }; break;
                case "budget": entries[2] = entries[2] with { SizeBytes = 1073741824 }; break;
            }
            return entries;
        }
        public Task<ExecutionProjectResponse> ManifestAsync(CancellationToken cancellation)
        {
            var trees = new[] { new ExecutionProjectResponseTreesItem { Name = Fault == "tree-name" ? "different" : "resource-0",
                Path = Fault == "tree-path" ? "other" : "assets/resource", EntryCount = Entries().Length + (Fault == "count" ? 1 : 0) } };
            return Task.FromResult(Response("manifest") with { Fingerprint = Fault == "fingerprint" ? new string('e', 64) : Fingerprint,
                Trees = Fault == "extra-tree" ? [trees[0], trees[0] with { Name = "resource-1" }] : trees });
        }
        public Task<ExecutionProjectResponse> TreeAsync(string name, long index, CancellationToken cancellation)
        {
            Pages++;
            return Task.FromResult(Response("tree") with { Index = index + (Fault == "page-index" ? 1 : 0),
                Fingerprint = Fault == "page-fingerprint" ? new string('e', 64) : Fingerprint,
                Entries = Entries().Skip(checked((int)index)).Take(16).ToArray() });
        }
        public Task<ExecutionProjectResponse> FileAsync(string name, string path, long offset, int maximum, CancellationToken cancellation)
        {
            Chunks++; var content = Contents[path]; var bytes = content.AsSpan(checked((int)offset), Math.Min(maximum, content.Length - checked((int)offset))).ToArray();
            if (Fault == "chunk" && bytes.Length > 0) bytes[0] ^= 1;
            return Task.FromResult(Response("file") with { Offset = offset + (Fault == "offset" ? 1 : 0), Sha256 = Hash(content),
                SizeBytes = content.LongLength + (Fault == "file-length" ? 1 : 0), ContentBase64 = Convert.ToBase64String(bytes),
                Fingerprint = Fault == "chunk-fingerprint" ? new string('e', 64) : Fingerprint });
        }
        private static ExecutionProjectResponse Response(string kind) => new() { Kind = kind, Fingerprint = Fingerprint, Sequence = 1 };
        private static ExecutionProjectResponseEntriesItem Row(string path, string kind, long bytes, string? sha = null) =>
            new() { Path = path, Kind = kind, SizeBytes = bytes, Sha256 = sha };
        private static string Hash(byte[] bytes) => Convert.ToHexStringLower(SHA256.HashData(bytes));
    }
}
