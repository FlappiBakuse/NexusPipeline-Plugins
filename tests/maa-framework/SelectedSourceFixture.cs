using System.Text.Json.Nodes;
using NexusPipeline.Extensibility.Compilation;
using NexusPipeline.Extensions.MaaFramework;

internal sealed class SelectedSourceFixture : ISelectedSource
{
    internal readonly Dictionary<string, MaaSourceInput> Files = new(StringComparer.Ordinal);
    internal readonly HashSet<string> Directories = new(StringComparer.Ordinal) { "" };
    internal readonly List<string> Reads = [];
    internal readonly List<string> Lists = [];
    internal readonly List<SourceConfiguration> Mounts = [];
    public IReadOnlyList<SourceConfiguration> Configurations => Mounts.ToArray();
    internal Func<string, SourceFile, SourceFile>? ChangeFile;
    internal Func<string, SourceDirectory, SourceDirectory>? ChangeDirectory;
    internal static SelectedSourceFixture Create(bool large = false)
    {
        var result = new SelectedSourceFixture(); var pi = CompilerFixture.Interface();
        if (large) pi["description"] = new string('x', 530000);
        result.Add(CompilerFixture.Input("assets/interface.json", pi.ToJsonString()));
        result.Add(CompilerFixture.Input("mxu.json", CompilerFixture.Mxu().ToJsonString()));
        result.Add(CompilerFixture.Input("assets/resource/pipeline/unread.json", "{}"));
        result.Add(CompilerFixture.Input("assets/resource/image/unread.png", "not-an-image"));
        result.Add(CompilerFixture.Input("native/unread.dll", "not-a-library"));
        result.Mount("mxu.json", SourceEntryKind.File, "one");
        return result;
    }
    internal void Mount(string path, SourceEntryKind kind, string? instance)
    {
        Mounts.Add(new("saved-" + path.Replace('/', '-'), path, 1, 1, new string('a', 64), new string('b', 64), kind, instance is not null, instance));
    }
    internal void Add(MaaSourceInput input)
    {
        Files.Add(input.Path, input); var path = input.Path;
        while (path.LastIndexOf('/') is var slash && slash >= 0) { path = path[..slash]; Directories.Add(path); }
    }
    public async ValueTask<SourceDirectory> ListAsync(string relativeDirectory, CancellationToken cancellationToken)
    {
        await Task.Yield(); cancellationToken.ThrowIfCancellationRequested(); Lists.Add(relativeDirectory);
        var prefix = relativeDirectory.Length == 0 ? "" : relativeDirectory + "/";
        var entries = Directories.Where(path => path.StartsWith(prefix, StringComparison.Ordinal) && path != relativeDirectory &&
            !path[prefix.Length..].Contains('/')).Select(path => new SourceEntry(path[prefix.Length..], SourceEntryKind.Directory, "directory:" + path))
            .Concat(Files.Values.Where(file => file.Path.StartsWith(prefix, StringComparison.Ordinal) && !file.Path[prefix.Length..].Contains('/'))
                .Select(file => new SourceEntry(file.Path[prefix.Length..], SourceEntryKind.File, file.Identity)))
            .OrderBy(entry => entry.Name, StringComparer.Ordinal).ToArray();
        var value = new SourceDirectory(Directories.Contains(relativeDirectory), entries);
        return ChangeDirectory?.Invoke(relativeDirectory, value) ?? value;
    }
    public async ValueTask<SourceFile?> ReadAsync(string relativePath, CancellationToken cancellationToken)
    {
        await Task.Yield(); cancellationToken.ThrowIfCancellationRequested(); Reads.Add(relativePath);
        if (relativePath.Contains("/pipeline/", StringComparison.Ordinal) || relativePath.EndsWith(".png", StringComparison.Ordinal) || relativePath.EndsWith(".dll", StringComparison.Ordinal))
            throw new InvalidOperationException("fixture_forbidden_content_read");
        if (!Files.TryGetValue(relativePath, out var file)) return null;
        var value = new SourceFile(file.Path, file.Sha256, file.Identity, file.Content);
        return ChangeFile?.Invoke(relativePath, value) ?? value;
    }
}
