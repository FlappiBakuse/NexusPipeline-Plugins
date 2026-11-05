using System.Text.Json;
using System.Text.Json.Nodes;
using NexusPipeline.Extensibility.Compilation;

namespace NexusPipeline.Extensions.MaaFramework;

internal sealed class MaaSelectedFiles(ISelectedSource source, CancellationToken cancellation)
{
    private readonly Dictionary<string, SourceDirectory> directories = new(StringComparer.Ordinal);
    private readonly Dictionary<string, MaaSourceInput> files = new(StringComparer.Ordinal);
    private readonly HashSet<string> missing = new(StringComparer.Ordinal);
    private int entries;
    private long bytes;
    private MaaConfigMounts? configurations;
    private readonly HashSet<string> configured = new(StringComparer.Ordinal);
    internal List<string> ResourceTrees { get; } = [];
    internal List<string> ProgramPaths { get; } = [];
    internal void BindConfigurations(string instance) => configurations = new(source, instance);
    internal void RequireConfiguration(string path)
    { (configurations ?? throw new MaaInputFailure("maa_saved_configuration_required")).Require(path); configured.Add(path); }
    internal async ValueTask<SourceDirectory> ListAsync(string path)
    {
        cancellation.ThrowIfCancellationRequested(); configurations?.RequireCurrent(); if (path.Length != 0) MaaSourceSet.Normalize(path);
        if (directories.TryGetValue(path, out var previous)) return previous;
        if (directories.Count >= 128) throw new MaaInputFailure("maa_directory_budget");
        var value = await source.ListAsync(path, cancellation).ConfigureAwait(false);
        configurations?.RequireCurrent();
        if (value is null || value.Entries is null || !value.Exists && value.Entries.Count != 0 || entries + value.Entries.Count > 4096)
            throw new MaaInputFailure("maa_directory_invalid");
        var names = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var entry in value.Entries)
        {
            if (entry is null || !Enum.IsDefined(entry.Kind) || entry.Name.Contains('/') || !names.Add(entry.Name) ||
                string.IsNullOrWhiteSpace(entry.Identity) || entry.Identity.Length > 2048 || entry.Identity.Any(char.IsControl))
                throw new MaaInputFailure("maa_directory_invalid");
            MaaSourceSet.Normalize(Join(path, entry.Name));
        }
        value = new(value.Exists, value.Entries.OrderBy(entry => entry.Name, StringComparer.Ordinal).ToArray());
        entries += value.Entries.Count; directories.Add(path, value); return value;
    }
    internal async ValueTask<JsonObject?> ReadAsync(string path, bool required = false)
    {
        MaaSourceSet.Normalize(path); cancellation.ThrowIfCancellationRequested(); configurations?.RequireCurrent();
        if (files.TryGetValue(path, out var previous)) return MaaJson.Read(previous.Content);
        if (missing.Contains(path)) return required ? throw new MaaInputFailure("maa_source_missing:" + path) : null;
        var slash = path.LastIndexOf('/'); var parent = slash < 0 ? "" : path[..slash]; var name = path[(slash + 1)..];
        var listing = await ListAsync(parent).ConfigureAwait(false);
        var entry = listing.Entries.SingleOrDefault(entry => entry.Name.Equals(name, StringComparison.OrdinalIgnoreCase));
        if (entry is not null && (entry.Name != name || entry.Kind != SourceEntryKind.File)) throw new MaaInputFailure("maa_source_alias_invalid");
        var file = await source.ReadAsync(path, cancellation).ConfigureAwait(false);
        configurations?.RequireCurrent();
        if (file is null)
        {
            if (entry is not null || missing.Count >= 128) throw new MaaInputFailure("maa_source_observation_changed");
            missing.Add(path); return required ? throw new MaaInputFailure("maa_source_missing:" + path) : null;
        }
        if (entry is null || file.Path != path || file.Identity != entry.Identity || files.Count >= 128 ||
            file.Content.Length is < 1 or > 8 * 1024 * 1024 || bytes + file.Content.Length > 32 * 1024 * 1024)
            throw new MaaInputFailure("maa_source_observation_changed");
        var input = new MaaSourceInput(path, file.Content.ToArray(), file.Sha256, file.Identity);
        _ = new MaaSourceSet([input]); files.Add(path, input); bytes += input.Content.Length;
        return MaaJson.Read(input.Content);
    }
    internal string[] Paths => directories.SelectMany(pair => pair.Value.Entries.Where(entry => entry.Kind == SourceEntryKind.File)
        .Select(entry => Join(pair.Key, entry.Name))).Order(StringComparer.Ordinal).ToArray();
    internal byte[] Observations()
    {
        configurations?.RequireCurrent();
        return MaaCompilationBundle.Serialize(new {
        kind = "maa-selected-source-observations", version = 1,
        directories = directories.OrderBy(pair => pair.Key, StringComparer.Ordinal).Select(pair => new { path = pair.Key, pair.Value.Exists, pair.Value.Entries }).ToArray(),
        absentFiles = missing.Order(StringComparer.Ordinal).ToArray(), configurations = configurations?.Metadata ?? [],
        resourceTrees = ResourceTrees.ToArray(), programPaths = ProgramPaths.ToArray(), resourceArchiveRequired = true }, 4 * 1024 * 1024);
    }
    internal MaaSourceSet Snapshot() => new(files.Values.ToArray(), Paths, MaaCompilationBundle.Hash(Observations()),
        configured.Where(path => files.ContainsKey(path)).Select(path => configurations!.Bind(path, files[path].Sha256)).ToArray());
    internal static string Join(string parent, string name) => parent.Length == 0 ? name : parent + "/" + name;
}
