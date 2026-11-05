using System.Text.Json.Nodes;

namespace NexusPipeline.Extensions.MaaFramework;

internal sealed record MaaPiProject(string InterfacePath, JsonObject Declaration, JsonObject Translations,
    MaaSourceProof[] Sources, string SourceFingerprint, string ClientKind = "project")
{
    internal string CompilationFingerprint => Convert.ToHexStringLower(System.Security.Cryptography.SHA256.HashData(
        System.Text.Encoding.UTF8.GetBytes("nexus.maa.pi/1\n" + ClientKind + "\n" + SourceFingerprint + "\n" + Declaration.ToJsonString())));
    internal JsonObject[] Tasks => MaaJson.Objects(Declaration["task"]);
    internal JsonObject Options => Declaration["option"] as JsonObject ?? new();
    internal string Label(JsonObject item)
    {
        var label = MaaJson.Text(item, "label", MaaJson.Text(item, "name"));
        return label.StartsWith('$') && Translations[label[1..]] is JsonValue value && value.TryGetValue<string>(out var translated) ? translated : label;
    }
    internal JsonObject Select(string field, string name) => MaaJson.Objects(Declaration[field]).SingleOrDefault(item => MaaJson.Required(item, "name") == name)
        ?? throw new MaaInputFailure("maa_selection_missing:" + field);
}
internal sealed class MaaPiCompiler(MaaSourceSet sources, string clientKind = "project")
{
    private readonly HashSet<string> stack = new(StringComparer.OrdinalIgnoreCase);
    private MaaSourceSet reader = sources.Fork();
    private CancellationToken cancellation;
    private string root = "";
    internal MaaPiProject Compile(string interfacePath, string language = "zh_cn", CancellationToken cancellationToken = default)
    {
        cancellation = cancellationToken; cancellation.ThrowIfCancellationRequested();
        if (clientKind is not ("project" or "mxu" or "mfa" or "cfa" or "maapicli")) throw new MaaInputFailure("maa_client_kind_unknown");
        reader = sources.Fork(); root = MaaSourceSet.Normalize(interfacePath); var declaration = Load(root, 0);
        MaaProtectedInput.RequireOrdinary(declaration);
        if (clientKind == "cfa" && MaaJson.Strings(declaration["global_option"]) is { Length: > 0 } global)
        {
            var settings = declaration["setting"] is null ? new JsonArray() : (JsonArray)declaration["setting"]!.DeepClone();
            settings.Insert(0, new JsonObject { ["name"] = "global_option", ["label"] = "Global Option", ["option"] = new JsonArray(global.Select(name => (JsonNode?)JsonValue.Create(name)).ToArray()), ["default_expand"] = true });
            declaration["setting"] = settings; declaration.Remove("global_option");
        }
        if (declaration["interface_version"]?.GetValue<int>() != 2) throw new MaaInputFailure("maa_pi_v2_required");
        _ = MaaJson.Required(declaration, "name");
        foreach (var field in new[] { "controller", "resource", "task", "preset", "group", "setting" }) ValidateNames(declaration, field);
        var translations = new JsonObject();
        if (declaration["languages"] is JsonObject languages && languages[language] is JsonValue path && path.TryGetValue<string>(out var relative))
            translations = reader.Read(MaaSourceSet.Relative(root, relative));
        MaaPiValidation.Validate(declaration);
        return new(root, declaration, translations, reader.Proofs, reader.Fingerprint, clientKind);
    }
    private JsonObject Load(string path, int depth)
    {
        cancellation.ThrowIfCancellationRequested();
        if (depth > 32 || !stack.Add(path)) throw new MaaInputFailure("maa_import_cycle_or_depth");
        try
        {
            var document = reader.Read(path);
            foreach (var import in MaaJson.Strings(document["import"]))
                MaaPiMerge.Apply(document, Load(MaaSourceSet.Relative(root, import), depth + 1), clientKind);
            return document;
        }
        finally { stack.Remove(path); }
    }
    private static void ValidateNames(JsonObject declaration, string field)
    {
        var names = MaaJson.Objects(declaration[field]).Select(item => MaaJson.Required(item, "name")).ToArray();
        if (names.Length != names.Distinct(StringComparer.Ordinal).Count()) throw new MaaInputFailure("maa_ambiguous_name:" + field);
    }
}
