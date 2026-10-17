using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;

namespace NexusPipeline.Plugin.MaaFrameworkDriver;

/// <summary>Read-only PI v2 compiler; the same effective plan feeds preview and the worker.</summary>
public sealed partial class ProjectCompiler
{
    public string Root => _root;
    private readonly string _root;
    private readonly string _directory;
    private readonly HashSet<string> _stack = new(StringComparer.OrdinalIgnoreCase);
    private long _bytes;
    private int _files;
    private readonly JsonObject _pi;
    private readonly JsonObject _translations;
    private CancellationToken _token;
    public long BytesRead { get; private set; }
    public int FilesHashed { get; private set; }
    public int FilesParsed { get; private set; }
    public long ParsedBytes { get; private set; }
    public int EntriesEnumerated { get; private set; }
    private JsonObject _authorizationManifest = new();
    private readonly Dictionary<string, string> _readFiles = new(StringComparer.OrdinalIgnoreCase);
    private readonly Dictionary<string, string> _readIdentities = new(StringComparer.OrdinalIgnoreCase);
    private readonly string _rootIdentity;
    public IReadOnlyDictionary<string, string> ReadFiles => _readFiles;
    public string[] DeclaredExecutables => Objects(_pi["agent"]).Select(entry => Required(entry, "child_exec"))
        .Concat(Objects(_pi["pretask"]).Select(entry => Required(entry, "exec"))).ToArray();

    public ProjectCompiler(string packageRoot, string interfacePath, string language = "zh_cn", CancellationToken cancellationToken = default)
    {
        _token = cancellationToken;
        _token.ThrowIfCancellationRequested();
        _root = Path.GetFullPath(packageRoot).TrimEnd('\\', '/');
        string file = Scope(_root, interfacePath);
        _rootIdentity = DirectoryIdentity.Read(_root);
        _directory = Path.GetDirectoryName(file)!;
        _pi = Load(file);
        if (_pi["interface_version"]?.GetValue<int>() != 2) throw Error("interface_version", "PI v2 required");
        Required(_pi, "name");
        _translations = _pi["languages"]?[language] is JsonValue translation
            ? Read(Scope(_directory, translation.GetValue<string>())) : new();
        foreach (string field in new[] { "controller", "resource", "task", "group", "preset", "setting" }) ValidateNames(field);
        ValidateReferences();
        // Inspect itself must never return a plaintext password supplied as a project default.
        foreach (var definition in _pi["option"] as JsonObject ?? new JsonObject())
            foreach (var input in Objects(definition.Value?["inputs"]))
                if (input["password"]?.GetValue<bool>() == true && !string.IsNullOrEmpty(Text(input, "default")))
                    throw Error("option." + definition.Key, "password default forbidden");
    }

    public JsonObject Inspect() => new()
    {
        ["projectName"] = Required(_pi, "name"), ["projectVersion"] = Text(_pi, "version"),
        ["controller"] = Display(PublicDeclaration(_pi["controller"])), ["resource"] = Display(PublicDeclaration(_pi["resource"])),
        ["task"] = Display(PublicDeclaration(_pi["task"])), ["option"] = Display(PublicDeclaration(_pi["option"])),
        ["group"] = Display(_pi["group"]), ["preset"] = Display(_pi["preset"]),
        ["setting"] = Display(_pi["setting"]), ["global_option"] = _pi["global_option"]?.DeepClone(),
        ["pretask"] = Display(_pi["pretask"]), ["agent"] = Display(_pi["agent"]),
        ["capabilities"] = new JsonObject { ["interfaceVersion"] = 2, ["piSemanticVersion"] = "2.10.2",
            ["controllers"] = new JsonArray("Win32", "Adb"), ["telemetry"] = "disabled" },
    };

    private static JsonNode? PublicDeclaration(JsonNode? node) => node switch
    {
        JsonObject obj => new JsonObject(obj.Where(pair => pair.Key != "pipeline_override")
            .Select(pair => new KeyValuePair<string, JsonNode?>(pair.Key, PublicDeclaration(pair.Value)))),
        JsonArray array => new JsonArray(array.Select(PublicDeclaration).ToArray()),
        _ => node?.DeepClone(),
    };

    public CompiledProject Compile(DriverProfile profile, CancellationToken cancellationToken = default)
    {
        profile = ProfileMigration.Upgrade(profile);
        var semantic = CompileSemantics(profile, cancellationToken);
        if (semantic.ResourcePaths.Any(path => !Directory.Exists(path))) throw Error("resource.path", "directory missing");
        var pretasks = Programs(_pi["pretask"], false, profile);
        var agents = Programs(_pi["agent"], true, profile);
        var fingerprint = ExecutionFingerprint(profile, semantic.Controller, semantic.Resource, semantic.ResourcePaths, pretasks, agents);
        return new(Required(_pi, "name"), Text(_pi, "version"), _directory,
            Display(semantic.Controller)!.AsObject(), Display(semantic.Resource)!.AsObject(), semantic.ResourcePaths,
            semantic.BaseResourceCount, semantic.ResourceHashes, semantic.Tasks, pretasks, agents, fingerprint, semantic.PublicSchema, 2, _authorizationManifest);
    }
}
