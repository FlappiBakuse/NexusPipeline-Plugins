using System.Text.Json.Nodes;

namespace NexusPipeline.Extensions.MaaFramework;

internal sealed record MaaRuntimeSelection(string? NativeDirectory, IReadOnlyDictionary<string, string> Executables, string[] Directories)
{
    internal static MaaRuntimeSelection? Read(JsonNode? node)
    {
        if (node is null) return null;
        var value = MaaJson.Object(node);
        if (value.Any(pair => pair.Key is not ("NativeDirectory" or "Executables" or "Directories")))
            throw new MaaInputFailure("maa_runtime_selection_unknown");
        var directory = value["NativeDirectory"] is null ? null : MaaSourceSet.Normalize(MaaJson.Required(value, "NativeDirectory"));
        var paths = MaaJson.Strings(value["Directories"]).Select(MaaSourceSet.Normalize).ToArray();
        var executables = new Dictionary<string, string>(StringComparer.Ordinal);
        foreach (var entry in value["Executables"] is null ? new JsonObject() : MaaJson.Object(value["Executables"]))
        {
            if (entry.Key.Length is < 1 or > 4096 || entry.Key.Any(char.IsControl) || entry.Value is not JsonValue scalar ||
                !scalar.TryGetValue<string>(out var path)) throw new MaaInputFailure("maa_program_binding_invalid");
            executables.Add(entry.Key, MaaSourceSet.Normalize(path));
        }
        if (paths.Length > 32 || paths.Distinct(StringComparer.OrdinalIgnoreCase).Count() != paths.Length || executables.Count > 32)
            throw new MaaInputFailure("maa_runtime_selection_budget");
        return new(directory, executables, paths);
    }
}
