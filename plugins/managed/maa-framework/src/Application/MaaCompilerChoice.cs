using System.Text.Json;
using System.Text.Json.Nodes;

namespace NexusPipeline.Extensions.MaaFramework;

internal sealed record MaaCompilerChoice(string? InterfacePath, string ClientKind, string Language, MaaImportSelection? Source)
{
    public JsonObject? Profile { get; init; }
    public string? Preset { get; init; }
    public MaaRuntimeSelection? Runtime { get; init; }
    internal static MaaCompilerChoice Read(JsonElement selection, bool compile)
    {
        var node = MaaJson.Read(JsonSerializer.SerializeToUtf8Bytes(selection));
        if (node.Any(pair => pair.Key is not ("InterfacePath" or "ClientKind" or "Language" or "Source" or "Profile" or "Preset" or "Runtime")))
            throw new MaaInputFailure("maa_compiler_selection_unknown");
        MaaImportSelection? source = null;
        if (node["Source"] is not null)
        {
            var item = MaaJson.Object(node["Source"]);
            if (item.Count != 3 || item.Any(pair => pair.Key is not ("Kind" or "Path" or "InstanceId"))) throw new MaaInputFailure("maa_compiler_selection_unknown");
            source = new(MaaJson.Required(item, "Kind"), MaaJson.Required(item, "Path"), MaaJson.Required(item, "InstanceId"));
            MaaSourceSet.Normalize(source.Path); MaaImportRules.Instance(source.InstanceId);
            if (source.Kind is not ("mxu" or "mfa" or "cfa" or "maapicli")) throw new MaaInputFailure("maa_source_kind_unsupported");
        }
        var path = node["InterfacePath"] is null ? null : MaaJson.Required(node, "InterfacePath");
        if (path is not null) MaaSourceSet.Normalize(path);
        var client = MaaJson.Text(node, "ClientKind", source?.Kind ?? "project");
        if (client is not ("project" or "mxu" or "mfa" or "cfa" or "maapicli")) throw new MaaInputFailure("maa_client_kind_unknown");
        var language = MaaJson.Text(node, "Language", "zh_cn");
        if (language.Length is < 1 or > 128 || language.Any(char.IsControl) || compile && (path is null || source is null || client != source.Kind))
            throw new MaaInputFailure("maa_compiler_selection_required");
        var preset = node["Preset"] is null ? null : MaaJson.Required(node, "Preset");
        if (preset is { Length: > 512 }) throw new MaaInputFailure("maa_preset_invalid");
        return new(path, client, language, source) { Preset = preset, Runtime = MaaRuntimeSelection.Read(node["Runtime"]),
            Profile = node.TryGetPropertyValue("Profile", out var draft) ? MaaJson.Clone(MaaJson.Object(draft)) : null };
    }
}
