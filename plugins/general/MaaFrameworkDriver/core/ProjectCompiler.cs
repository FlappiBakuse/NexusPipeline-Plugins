using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;

namespace NexusPipeline.Plugin.MaaFrameworkDriver;

/// <summary>Read-only PI v2 compiler; the same effective plan feeds preview and the worker.</summary>
public sealed class ProjectCompiler
{
    private readonly string _root;
    private readonly string _directory;
    private readonly HashSet<string> _stack = new(StringComparer.OrdinalIgnoreCase);
    private long _bytes;
    private int _files;
    private readonly JsonObject _pi;
    private readonly JsonObject _translations;

    public ProjectCompiler(string packageRoot, string interfacePath, string language = "zh_cn")
    {
        _root = Path.GetFullPath(packageRoot).TrimEnd('\\', '/');
        string file = Scope(_root, interfacePath);
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

    public CompiledProject Compile(DriverProfile profile)
    {
        if (profile.SchemaVersion != 1 || Path.GetFullPath(profile.PackageRoot).TrimEnd('\\', '/') != _root)
            throw Error("profile", "root or schema mismatch");
        var controller = Find("controller", profile.Controller);
        var resource = Find("resource", profile.Resource);
        ValidateConfiguredOptions(profile);
        string type = Required(controller, "type");
        if (type is not ("Win32" or "Adb")) throw Error("controller.type", "unsupported " + type);
        string[] displayFields = ["display_raw", "display_short_side", "display_long_side", "display_expand"];
        if (displayFields.Count(controller.ContainsKey) > 1) throw Error("controller.display", "mutually exclusive fields");
        foreach (string side in new[] { "display_short_side", "display_long_side" })
            if (controller[side] is not null && controller[side]!.GetValue<int>() is not (>= 1 and <= 16384))
                throw Error("controller." + side, "out of range");
        if (controller.ContainsKey("display_expand")
            && (controller["display_expand"] is not JsonArray expand || expand.Count != 2
                || expand.Any(value => value is not JsonValue scalar || !scalar.TryGetValue<int>(out int dimension) || dimension is not (>= 1 and <= 16384))))
            throw Error("controller.display_expand", "two positive dimensions required");
        if (!Active(resource, profile)) throw Error("resource.controller", "selected controller excluded");
        string[] paths = Strings(resource["path"]).Select(path => Scope(_directory, path)).ToArray();
        if (paths.Length == 0) throw Error("resource.path", "empty");
        int baseCount = paths.Length;
        paths = paths.Concat(Strings(controller["attach_resource_path"]).Concat(profile.AttachResourcePaths)
            .Select(path => Scope(_directory, path))).ToArray();
        if (paths.Any(path => !Directory.Exists(path))) throw Error("resource.path", "directory missing");
        var tasks = new List<CompiledTask>();
        if (profile.SelectedTasks.Distinct(StringComparer.Ordinal).Count() != profile.SelectedTasks.Length)
            throw Error("selectedTasks", "duplicate identity");
        foreach (string name in profile.SelectedTasks)
        {
            var task = Find("task", name);
            if (!Active(task, profile)) throw Error("task." + name, "not applicable to selected controller/resource");
            var pipeline = task["pipeline_override"]?.DeepClone().AsObject() ?? new();
            foreach (var (declaration, configured) in new (JsonNode?, JsonObject?)[]
            {
                (_pi["global_option"], null), (resource["option"], profile.ResourceOptions),
                (controller["option"], profile.ControllerOptions), (task["option"], profile.TaskOptions[name] as JsonObject)
            })
            {
                JsonObject values = profile.Options.DeepClone().AsObject();
                if (configured is not null)
                    foreach (var pair in configured) values[pair.Key] = pair.Value?.DeepClone();
                ApplyOptions(Strings(declaration), profile, values, pipeline, new(), new HashSet<string>(StringComparer.Ordinal));
            }
            tasks.Add(new(name, Label(task), Required(task, "entry"), pipeline));
        }
        var pretasks = Programs(_pi["pretask"], false, profile);
        var agents = Programs(_pi["agent"], true, profile);
        var fingerprint = ExecutionFingerprint(profile, controller, resource, paths, pretasks, agents);
        return new(Required(_pi, "name"), Text(_pi, "version"), _directory,
            Display(controller)!.AsObject(), Display(resource)!.AsObject(), paths, baseCount,
            Strings(resource["hash"]), tasks.ToArray(), pretasks, agents, fingerprint, Inspect());
    }

    public DriverProfile ApplyPreset(DriverProfile profile, string presetName)
    {
        var preset = Find("preset", presetName);
        var selected = new List<string>(); var options = profile.TaskOptions.DeepClone().AsObject();
        foreach (JsonObject task in Objects(preset["task"]))
        {
            string name = Required(task, "name"); Find("task", name);
            if (task["enabled"]?.GetValue<bool>() != false) selected.Add(name);
            if (task["option"] is JsonObject values) options[name] = values.DeepClone();
        }
        return profile with { SelectedTasks = selected.ToArray(), TaskOptions = options };
    }

    private CompiledProgram[] Programs(JsonNode? declaration, bool agent, DriverProfile profile)
    {
        var list = new List<CompiledProgram>();
        foreach (var entry in Objects(declaration))
        {
            if (!agent && !Active(entry, profile)) continue;
            string executable = ResolveExecutable(Required(entry, agent ? "child_exec" : "exec"));
            var arguments = Strings(entry[agent ? "child_args" : "args"]).ToList();
            if (!agent && Strings(entry["option"]).Length > 0)
            {
                var effective = new JsonObject();
                ApplyOptions(Strings(entry["option"]), profile, profile.Options, new(), effective, new());
                arguments.Add(effective.ToJsonString(new JsonSerializerOptions { WriteIndented = false }));
            }
            long timeout = entry["timeout"]?.GetValue<long>() ?? 10000;
            if (timeout is < 1 or > 120000 && !(agent && timeout == -1))
                throw Error(agent ? "agent.timeout" : "pretask.timeout", "outside 1..120000 milliseconds (Agent also permits -1)");
            list.Add(new(Text(entry, "name", Path.GetFileName(executable)), executable, arguments.ToArray(),
                agent ? Text(entry, "identifier") : null, timeout));
        }
        return list.ToArray();
    }

    private void ApplyOptions(IEnumerable<string> keys, DriverProfile profile, JsonObject supplied,
        JsonObject pipeline, JsonObject effective, HashSet<string> visiting)
    {
        foreach (string key in keys)
        {
            var option = _pi["option"]?[key] as JsonObject ?? throw Error("option." + key, "unknown reference");
            if (!Active(option, profile)) continue;
            if (!visiting.Add(key) || visiting.Count > 32) throw Error("option." + key, "cycle/depth");
            string type = Text(option, "type", "select");
            JsonNode? chosen = supplied[key]?.DeepClone() ?? option["default_case"]?.DeepClone();
            if (type is "select" or "switch" or "checkbox")
            {
                var cases = Objects(option["cases"]).ToArray();
                string[] names = type == "checkbox" ? Strings(chosen) : [chosen?.GetValue<string>() ?? Required(cases.FirstOrDefault() ?? new(), "name")];
                if (names.Distinct(StringComparer.Ordinal).Count() != names.Length
                    || names.Any(name => !cases.Any(item => Text(item, "name") == name))) throw Error("option." + key, "invalid case");
                if (type == "checkbox" && (names.Length < (option["min_count"]?.GetValue<int>() ?? 0)
                    || names.Length > (option["max_count"]?.GetValue<int>() ?? cases.Length))) throw Error("option." + key, "selection count");
                effective[key] = type == "checkbox" ? JsonSerializer.SerializeToNode(names) : JsonValue.Create(names[0]);
                foreach (var item in cases.Where(item => names.Contains(Text(item, "name"), StringComparer.Ordinal)))
                {
                    MergePipeline(pipeline, item["pipeline_override"] as JsonObject);
                    ApplyOptions(Strings(item["option"]), profile, supplied, pipeline, effective, visiting);
                }
            }
            else if (type is "input" or "hotkey")
            {
                if (chosen is not null && chosen is not JsonObject) throw Error("option." + key, "named values object required");
                var raw = chosen as JsonObject ?? new JsonObject();
                var declaredFields = Objects(option[type == "input" ? "inputs" : "hotkeys"])
                    .Select(field => Required(field, "name")).ToHashSet(StringComparer.Ordinal);
                foreach (string field in raw.Select(pair => pair.Key))
                    if (!declaredFields.Contains(field)) throw Error("option." + key + "." + field, "unknown configured field");
                var fields = new Dictionary<string, JsonNode>(StringComparer.Ordinal);
                var saved = new JsonObject();
                foreach (var field in Objects(option[type == "input" ? "inputs" : "hotkeys"]))
                {
                    string name = Required(field, "name");
                    bool secret = field["password"]?.GetValue<bool>() == true;
                    if (secret && !string.IsNullOrEmpty(Text(field, "default"))) throw Error("option." + key + "." + name, "password default forbidden");
                    string value = raw[name]?.GetValue<string>() ?? Text(field, "default");
                    if (secret && !value.StartsWith("secret:", StringComparison.Ordinal)) throw Error("option." + key + "." + name, "protected secret reference required");
                    if (!secret && field["verify"] is JsonValue verify
                        && !Regex.IsMatch(value, verify.GetValue<string>(), RegexOptions.CultureInvariant, TimeSpan.FromMilliseconds(100)))
                        throw Error("option." + key + "." + name, "verify failed");
                    saved[name] = value;
                    if (type == "hotkey")
                    {
                        int[] codes = Hotkey(value, Required(Find("controller", profile.Controller), "type"));
                        fields[name] = JsonValue.Create(codes[^1])!;
                        fields[name + ".primary"] = JsonValue.Create(codes[^1])!;
                        for (int i = 0; i < codes.Length - 1; i++) fields[name + ".modifier" + (i + 1)] = JsonValue.Create(codes[i])!;
                    }
                    else fields[name] = secret ? JsonValue.Create(value)! : ConvertInput(value, Text(field, "pipeline_type", "string"));
                }
                effective[key] = saved;
                MergePipeline(pipeline, Substitute(option["pipeline_override"], fields)?.AsObject());
            }
            else throw Error("option." + key + ".type", "unsupported " + type);
            visiting.Remove(key);
        }
    }

    public static void MergePipeline(JsonObject target, JsonObject? source)
    {
        if (source is null) return;
        foreach (var node in source)
        {
            if (node.Value is not JsonObject fields) throw Error("pipeline_override." + node.Key, "node object required");
            if (target[node.Key] is not JsonObject existing) target[node.Key] = existing = new JsonObject();
            foreach (var field in fields) existing[field.Key] = field.Value?.DeepClone();
        }
    }

    private static JsonNode ConvertInput(string value, string type) => type switch
    {
        "string" => JsonValue.Create(value)!,
        "int" when long.TryParse(value, NumberStyles.Integer, CultureInfo.InvariantCulture, out long number) => JsonValue.Create(number)!,
        "bool" when bool.TryParse(value, out bool boolean) => JsonValue.Create(boolean)!,
        _ => throw Error("input.pipeline_type", "conversion failed"),
    };

    private static JsonNode? Substitute(JsonNode? node, Dictionary<string, JsonNode> fields)
    {
        if (node is JsonObject obj) return new JsonObject(obj.Select(pair => new KeyValuePair<string, JsonNode?>(pair.Key, Substitute(pair.Value, fields))));
        if (node is JsonArray array) return new JsonArray(array.Select(item => Substitute(item, fields)).ToArray());
        if (node is not JsonValue value || !value.TryGetValue<string>(out string? text)) return node?.DeepClone();
        foreach (var field in fields.OrderByDescending(pair => pair.Key.Length))
        {
            string token = "{" + field.Key + "}";
            // Both documented primary forms occur in PI v2 projects.
            string suffixToken = field.Key.Contains('.')
                ? "{" + field.Key[..field.Key.IndexOf('.')] + "}" + field.Key[field.Key.IndexOf('.')..] : token;
            if (text == token || text == suffixToken) return field.Value.DeepClone();
            string replacement = field.Value is JsonValue v && v.TryGetValue<string>(out var s) ? s : field.Value.ToJsonString();
            text = text.Replace(suffixToken, replacement, StringComparison.Ordinal).Replace(token, replacement, StringComparison.Ordinal);
        }
        if (Regex.IsMatch(text, "\\{[^{}]+\\}", RegexOptions.CultureInvariant, TimeSpan.FromMilliseconds(100)))
            throw Error("pipeline_override", "unresolved input placeholder");
        return JsonValue.Create(text);
    }

    private static int[] Hotkey(string value, string controller)
    {
        int Code(string key) => (controller, key.ToUpperInvariant()) switch
        {
            ("Win32", "CTRL") => 17, ("Win32", "SHIFT") => 16, ("Win32", "ALT") => 18,
            ("Win32", "WIN") => 91, ("Adb", "CTRL") => 113, ("Adb", "SHIFT") => 59, ("Adb", "ALT") => 57,
            ("Win32", "ENTER") => 13, ("Adb", "ENTER") => 66, ("Win32", "SPACE") => 32, ("Adb", "SPACE") => 62,
            ("Win32", "ESC") => 27, ("Adb", "ESC") => 111,
            _ when key.Length == 1 && char.IsAsciiLetter(key[0]) => controller == "Win32" ? char.ToUpperInvariant(key[0]) : char.ToUpperInvariant(key[0]) - 'A' + 29,
            _ when key.Length == 1 && char.IsAsciiDigit(key[0]) => controller == "Win32" ? key[0] : key[0] - '0' + 7,
            _ when key.StartsWith('F') && int.TryParse(key[1..], out int f) && f is >= 1 and <= 12 => controller == "Win32" ? 111 + f : 130 + f,
            _ => throw Error("hotkey", "unsupported key " + key),
        };
        string[] pieces = value.Split('+', StringSplitOptions.TrimEntries);
        if (pieces.Length is < 1 or > 5 || pieces.Take(pieces.Length - 1).Any(key => key.ToUpperInvariant() is not ("CTRL" or "SHIFT" or "ALT" or "WIN")))
            throw Error("hotkey", "invalid shortcut");
        return pieces.Select(Code).ToArray();
    }

    private JsonObject Load(string file, bool imported = false)
    {
        if (!_stack.Add(file) || _stack.Count > 32) throw Error("import", "cycle/depth");
        var main = Read(file);
        ValidateDeclarations(main, imported, Path.GetRelativePath(_root, file));
        foreach (string import in Strings(main["import"]))
        {
            var child = Load(Scope(_directory, import), true);
            foreach (string field in new[] { "task", "preset", "group", "pretask", "global_option", "setting" })
            {
                var items = (main[field] is null ? [] : field == "pretask" ? Objects(main[field]).Cast<JsonNode>() : main[field]!.AsArray().OfType<JsonNode>()).ToList();
                var additions = child[field] is null ? [] : field == "pretask" ? Objects(child[field]).Cast<JsonNode>() : child[field]!.AsArray().OfType<JsonNode>();
                items.AddRange(additions);
                if (field == "global_option") items = items.DistinctBy(item => item.GetValue<string>()).ToList();
                if (field == "group") items = items.DistinctBy(item => Required(item.AsObject(), "name")).ToList();
                main[field] = new JsonArray(items.Select(item => item.DeepClone()).ToArray());
            }
            if (child["option"] is JsonObject options)
            {
                if (main["option"] is not JsonObject own) main["option"] = own = new JsonObject();
                foreach (var pair in options) own[pair.Key] = pair.Value?.DeepClone();
            }
        }
        _stack.Remove(file); return main;
    }

    // Pinned PI v2.10.2 declarations; unknown execution fields cannot be erased
    // by compiling a smaller, different plan. Pipeline fields belong to Maa itself.
    private static void ValidateDeclarations(JsonObject pi, bool imported, string source)
    {
        static void Known(JsonObject obj, string location, params string[] supported)
        {
            foreach (string key in obj.Select(pair => pair.Key))
                if (!supported.Contains(key, StringComparer.Ordinal))
                    throw Error(location + "." + key, "unsupported declaration");
        }
        if (imported) Known(pi, source, "task", "option", "preset", "group", "pretask", "global_option", "setting", "import");
        else Known(pi, source, "interface_version", "languages", "name", "label", "title", "custom_title", "icon",
            "mirrorchyan_rid", "mirrorchyan_multiplatform", "github", "version", "contact", "license", "welcome",
            "description", "telemetry", "controller", "resource", "group", "pretask", "agent", "task", "option",
            "global_option", "setting", "import", "preset");
        foreach (var item in Objects(pi["controller"]))
        {
            string location = source + ".controller." + Required(item, "name");
            Known(item, location, "name", "label", "description", "icon", "type", "display_short_side", "display_long_side",
                "display_expand", "display_raw", "permission_required", "attach_resource_path", "option", "adb", "win32",
                "macos", "playcover", "gamepad", "linux");
            if (item["win32"] is JsonObject win)
                Known(win, location + ".win32", "class_regex", "window_regex", "screencap", "mouse", "keyboard");
            if (item["adb"] is JsonObject adb && adb.Count > 0)
                throw Error(location + ".adb", "explicit method/config overrides unsupported; PI v2 uses Toolkit detection");
        }
        foreach (var item in Objects(pi["resource"])) Known(item, source + ".resource." + Required(item, "name"),
            "name", "label", "description", "icon", "path", "controller", "option", "hash");
        foreach (var item in Objects(pi["task"])) Known(item, source + ".task." + Required(item, "name"),
            "name", "label", "entry", "default_check", "description", "doc", "desc", "icon", "group", "resource",
            "controller", "pipeline_override", "option");
        foreach (var item in Objects(pi["group"])) Known(item, source + ".group", "name", "label", "description", "icon", "default_expand");
        foreach (var item in Objects(pi["setting"])) Known(item, source + ".setting", "name", "label", "description", "icon", "option", "default_expand");
        foreach (var item in Objects(pi["pretask"])) Known(item, source + ".pretask", "name", "label", "description", "icon",
            "resource", "controller", "exec", "args", "option", "timeout");
        foreach (var item in Objects(pi["agent"])) Known(item, source + ".agent", "child_exec", "child_args", "identifier", "timeout");
        foreach (var item in Objects(pi["preset"]))
        {
            Known(item, source + ".preset", "name", "label", "description", "icon", "task");
            foreach (var task in Objects(item["task"])) Known(task, source + ".preset.task", "name", "enabled", "option");
        }
        foreach (var pair in pi["option"] as JsonObject ?? new())
        {
            var item = pair.Value?.AsObject() ?? throw Error(source + ".option." + pair.Key, "object required");
            string location = source + ".option." + pair.Key;
            Known(item, location, "type", "label", "description", "icon", "controller", "resource", "inputs", "hotkeys",
                "pipeline_override", "cases", "default_case", "min_count", "max_count");
            if (Text(item, "type", "select") is not ("select" or "switch" or "checkbox" or "input" or "hotkey"))
                throw Error(location + ".type", "unsupported " + Text(item, "type"));
            foreach (var choice in Objects(item["cases"])) Known(choice, location + ".cases", "name", "label", "description", "icon", "option", "pipeline_override");
            foreach (var input in Objects(item["inputs"])) Known(input, location + ".inputs", "name", "label", "description", "default", "pipeline_type", "verify", "pattern_msg", "password");
            foreach (var hotkey in Objects(item["hotkeys"])) Known(hotkey, location + ".hotkeys", "name", "label", "description", "default");
        }
    }

    public JsonObject ReadScopedFile(string relative) => Read(Scope(_root, relative));

    private JsonObject Read(string file)
    {
        if (++_files > 128) throw Error("import", "file count");
        long size = new FileInfo(file).Length;
        // MaaEnd v2.30.0 has a 2.2 MB declaration import. Keep an explicit
        // bounded parser budget that includes the locked official projects.
        if (size > 8 * 1024 * 1024 || (_bytes += size) > 32 * 1024 * 1024) throw Error("import", "byte budget");
        byte[] bytes = File.ReadAllBytes(file);
        var options = new JsonDocumentOptions { CommentHandling = JsonCommentHandling.Skip, AllowTrailingCommas = true, MaxDepth = 64 };
        using var document = JsonDocument.Parse(bytes.AsMemory(bytes.AsSpan().StartsWith(new byte[] { 239, 187, 191 }) ? 3 : 0), options);
        CheckDuplicates(document.RootElement);
        return JsonNode.Parse(document.RootElement.GetRawText(), documentOptions: options)?.AsObject() ?? throw Error("interface", "object required");
    }

    private static void CheckDuplicates(JsonElement node)
    {
        if (node.ValueKind == JsonValueKind.Array) foreach (var item in node.EnumerateArray()) CheckDuplicates(item);
        if (node.ValueKind != JsonValueKind.Object) return;
        var names = new HashSet<string>(StringComparer.Ordinal);
        foreach (var item in node.EnumerateObject())
        {
            if (!names.Add(item.Name)) throw Error(item.Name, "duplicate member");
            CheckDuplicates(item.Value);
        }
    }

    public string Scope(string basis, string relative)
    {
        if (relative.StartsWith("{PROJECT_DIR}/", StringComparison.Ordinal) || relative.StartsWith("{PROJECT_DIR}\\", StringComparison.Ordinal))
        {
            basis = _directory;
            relative = relative[14..];
        }
        if (Path.IsPathRooted(relative)) throw Error("path", "absolute declaration");
        string path = Path.GetFullPath(Path.Combine(basis, relative));
        if (!path.Equals(_root, StringComparison.OrdinalIgnoreCase)
            && !path.StartsWith(_root + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase)) throw Error("path", "outside approved root");
        for (string? current = path; current is not null; current = Path.GetDirectoryName(current))
        {
            if (File.Exists(current) || Directory.Exists(current))
                if ((File.GetAttributes(current) & FileAttributes.ReparsePoint) != 0) throw Error("path", "link rejected");
            if (current.Equals(_root, StringComparison.OrdinalIgnoreCase)) break;
        }
        return path;
    }

    private string ResolveExecutable(string declaration)
    {
        if (declaration.Contains('/') || declaration.Contains('\\'))
        {
            string path = Scope(_directory, declaration);
            if (!File.Exists(path) && File.Exists(path + ".exe")) path += ".exe";
            return File.Exists(path) ? path : throw Error("exec", "missing program");
        }
        foreach (string path in (Environment.GetEnvironmentVariable("PATH") ?? "").Split(Path.PathSeparator))
            foreach (string ext in new[] { "", ".exe" })
            {
                string candidate = Path.Combine(path, declaration + ext);
                if (File.Exists(candidate) && Path.GetExtension(candidate).Equals(".exe", StringComparison.OrdinalIgnoreCase)) return Path.GetFullPath(candidate);
            }
        throw Error("exec", "interpreter missing: " + declaration);
    }

    private string ExecutionFingerprint(DriverProfile profile, JsonObject controller, JsonObject resource, string[] resourcePaths,
        CompiledProgram[] pretasks, CompiledProgram[] agents)
    {
        string native = Scope(_root, profile.NativeDirectory);
        var identity = new StringBuilder();
        identity.Append(_root).Append('\n').Append(profile.InterfacePath).Append('\n').Append(profile.NativeVersion);
        identity.Append(profile.HostLaunchRequired).Append(profile.HostLaunchConfiguration.ToJsonString());
        identity.Append(controller["type"]).Append(controller["win32"]?.ToJsonString()).Append(resource["path"]?.ToJsonString());
        // Execution declarations are authorized as code; translated display-only
        // metadata does not invalidate that authorization.
        foreach (string field in new[] { "controller", "resource", "task", "option", "pretask", "agent", "global_option", "preset" })
            identity.Append(field).Append(ExecutionDeclaration(_pi[field])?.ToJsonString());
        if (!Directory.Exists(native)) throw Error("nativeDirectory", "missing");
        var files = Directory.EnumerateFiles(native, "*.dll").Order(StringComparer.OrdinalIgnoreCase).ToList();
        foreach (string path in resourcePaths) files.AddRange(ScopedTree(path));
        foreach (var program in pretasks.Concat(agents))
        {
            files.Add(program.Executable);
            // Hash declarations, not expanded user values or secrets.
            identity.Append(program.Executable).Append(program.Identifier);
            foreach (string arg in program.Arguments.Where(arg => !arg.StartsWith('{')))
            {
                identity.Append(arg);
                if (arg.StartsWith("./", StringComparison.Ordinal) || arg.StartsWith(".\\", StringComparison.Ordinal))
                {
                    string path = Scope(_directory, arg);
                    if (File.Exists(path))
                    {
                        files.Add(path);
                        if (path.EndsWith(".py", StringComparison.OrdinalIgnoreCase))
                            files.AddRange(ScopedTree(Path.GetDirectoryName(path)!).Where(file => file.EndsWith(".py", StringComparison.OrdinalIgnoreCase)));
                    }
                }
            }
        }
        if (!string.IsNullOrWhiteSpace(profile.AdbPath)) files.Add(profile.AdbPath);
        if (!string.IsNullOrWhiteSpace(profile.WindowExecutable)) files.Add(profile.WindowExecutable);
        long totalBytes = 0;
        var unique = files.Distinct(StringComparer.OrdinalIgnoreCase).Order(StringComparer.OrdinalIgnoreCase).ToArray();
        if (unique.Length > 50000) throw Error("fingerprint", "file count limit");
        foreach (string file in unique)
        {
            if (file.StartsWith(_root + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase))
                Scope(_root, Path.GetRelativePath(_root, file));
            else if ((File.GetAttributes(file) & FileAttributes.ReparsePoint) != 0)
                throw Error("exec", "linked interpreter");
            if ((totalBytes += new FileInfo(file).Length) > 4L * 1024 * 1024 * 1024)
                throw Error("fingerprint", "byte limit");
            using var stream = File.OpenRead(file);
            identity.Append(file).Append(Convert.ToHexString(SHA256.HashData(stream)));
        }
        foreach (var declaration in Objects(_pi["agent"]).Concat(Objects(_pi["pretask"])))
            foreach (string key in new[] { "child_exec", "child_args", "identifier", "exec", "args", "option", "controller", "resource" })
                identity.Append(key).Append(declaration[key]?.ToJsonString());
        return Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(identity.ToString()))).ToLowerInvariant();
    }

    private IEnumerable<string> ScopedTree(string directory)
    {
        var pending = new Stack<string>(); pending.Push(directory);
        int entries = 0;
        while (pending.TryPop(out string? current))
            foreach (string path in Directory.EnumerateFileSystemEntries(current).Order(StringComparer.OrdinalIgnoreCase))
            {
                if (++entries > 50000) throw Error("resource", "file count limit");
                Scope(_root, Path.GetRelativePath(_root, path));
                if (Directory.Exists(path)) pending.Push(path);
                else yield return path;
            }
    }

    private static JsonNode? ExecutionDeclaration(JsonNode? node)
    {
        if (node is JsonObject obj) return new JsonObject(obj
            .Where(pair => pair.Key is not ("label" or "description" or "icon" or "doc" or "help"))
            .OrderBy(pair => pair.Key, StringComparer.Ordinal)
            .Select(pair => new KeyValuePair<string, JsonNode?>(pair.Key,
                pair.Key == "pipeline_override" ? pair.Value?.DeepClone() : ExecutionDeclaration(pair.Value))));
        if (node is JsonArray array) return new JsonArray(array.Select(ExecutionDeclaration).ToArray());
        return node?.DeepClone();
    }

    private void ValidateNames(string field)
    {
        var names = new HashSet<string>(StringComparer.Ordinal);
        foreach (var item in Objects(_pi[field])) if (!names.Add(Required(item, "name"))) throw Error(field, "duplicate identity");
    }

    private void ValidateReferences()
    {
        var controllers = Objects(_pi["controller"]).Select(item => Required(item, "name")).ToHashSet(StringComparer.Ordinal);
        var resources = Objects(_pi["resource"]).Select(item => Required(item, "name")).ToHashSet(StringComparer.Ordinal);
        var optionNames = (_pi["option"] as JsonObject ?? new()).Select(pair => pair.Key).ToHashSet(StringComparer.Ordinal);
        foreach (string name in Strings(_pi["global_option"]).Concat(Objects(_pi["setting"]).SelectMany(item => Strings(item["option"]))))
            if (!optionNames.Contains(name)) throw Error("global_option/setting.option." + name, "unknown reference");
        var groupNames = Objects(_pi["group"]).Select(item => Required(item, "name")).ToHashSet(StringComparer.Ordinal);
        foreach (var task in Objects(_pi["task"]))
            foreach (string group in Strings(task["group"]))
                if (!groupNames.Contains(group)) throw Error("task." + Required(task, "name") + ".group." + group, "unknown reference");
        foreach (var item in Objects(_pi["task"]).Concat(Objects(_pi["resource"])).Concat(Objects(_pi["pretask"]))
            .Concat((_pi["option"] as JsonObject ?? new()).Select(pair => pair.Value!.AsObject())))
        {
            if (Strings(item["controller"]).Any(name => !controllers.Contains(name)) || Strings(item["resource"]).Any(name => !resources.Contains(name)))
                throw Error("filter", "unknown controller/resource");
        }
    }

    private void ValidateConfiguredOptions(DriverProfile profile)
    {
        var known = (_pi["option"] as JsonObject ?? new()).Select(pair => pair.Key).ToHashSet(StringComparer.Ordinal);
        void Validate(JsonObject values, string location)
        {
            foreach (string name in values.Select(pair => pair.Key))
                if (!known.Contains(name)) throw Error(location + "." + name, "unknown configured option");
        }
        Validate(profile.Options, "options");
        Validate(profile.ControllerOptions, "controllerOptions");
        Validate(profile.ResourceOptions, "resourceOptions");
        foreach (var pair in profile.TaskOptions)
        {
            Find("task", pair.Key);
            if (pair.Value is not JsonObject values) throw Error("taskOptions." + pair.Key, "object required");
            Validate(values, "taskOptions." + pair.Key);
        }
    }

    private bool Active(JsonObject item, DriverProfile profile) =>
        (!item.ContainsKey("controller") || Strings(item["controller"]).Contains(profile.Controller, StringComparer.Ordinal))
        && (!item.ContainsKey("resource") || Strings(item["resource"]).Contains(profile.Resource, StringComparer.Ordinal));
    private JsonObject Find(string field, string name) => Objects(_pi[field]).SingleOrDefault(item => Text(item, "name") == name) ?? throw Error(field + "." + name, "unknown identity");
    private string Label(JsonObject item) => Display(item["label"], true)?.GetValue<string>() ?? Text(item, "name");
    private JsonNode? Display(JsonNode? node, bool displayText = false)
    {
        if (node is JsonObject obj) return new JsonObject(obj.Select(pair => new KeyValuePair<string, JsonNode?>(pair.Key,
            pair.Key == "pipeline_override" ? pair.Value?.DeepClone()
                : Display(pair.Value, pair.Key is "label" or "description" or "title" or "icon" or "doc" or "desc" or "pattern_msg"))));
        if (node is JsonArray array) return new JsonArray(array.Select(item => Display(item, displayText)).ToArray());
        if (displayText && node is JsonValue value && value.TryGetValue<string>(out string? text) && text.StartsWith('$')) return _translations[text[1..]]?.DeepClone() ?? JsonValue.Create(text);
        return node?.DeepClone();
    }
    private static IEnumerable<JsonObject> Objects(JsonNode? node) => node switch
    {
        null => [], JsonObject obj => [obj], JsonArray array => array.Select(item => item?.AsObject() ?? throw Error("array", "null item")),
        _ => throw Error("array", "object/array required"),
    };
    private static string[] Strings(JsonNode? node) => node switch
    {
        null => [], JsonValue value => [value.GetValue<string>()], JsonArray array => array.Select(item => item?.GetValue<string>() ?? throw Error("array", "null item")).ToArray(),
        _ => throw Error("array", "string array required"),
    };
    private static string Text(JsonObject obj, string key, string fallback = "") => obj[key]?.GetValue<string>() ?? fallback;
    private static string Required(JsonObject obj, string key) => string.IsNullOrWhiteSpace(Text(obj, key)) ? throw Error(key, "required") : Text(obj, key);
    private static InvalidDataException Error(string field, string message) => new(field + ": " + message);
}
