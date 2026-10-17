using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;

namespace NexusPipeline.Plugin.MaaFrameworkDriver;

public sealed partial class ProjectCompiler
{
    private CompiledProgram[] Programs(JsonNode? declaration, bool agent, DriverProfile profile)
    {
        var list = new List<CompiledProgram>();
        IEnumerable<(JsonObject Entry, TaskOccurrence? Occurrence)> programs = Objects(declaration).Select(entry => (entry, (TaskOccurrence?)null));
        if (!agent && ConfigurationImporter.IsMxu(profile))
            programs = profile.TaskOccurrences.Where(item => item.Enabled
                && item.PiTaskName.StartsWith(ConfigurationImporter.MxuPretaskPrefix, StringComparison.Ordinal))
                .Select(item => (Objects(declaration).SingleOrDefault(entry => ConfigurationImporter.PretaskName(entry) == item.PiTaskName)
                    ?? throw Error("pretask." + item.PiTaskName, "unknown reference"), (TaskOccurrence?)item));
        foreach (var (entry, occurrence) in programs)
        {
            if (!agent && !Active(entry, profile)) continue;
            if (agent && (profile.AgentEmbedded ?? entry["embedded"]?.GetValue<bool>() ?? false))
                throw Error("agent.embedded", "maa.runtime.embedded_agent_unsupported: the GUI in-process Python registration requires its own runtime; select an upstream external Agent configuration and complete Python environment");
            string declared = Required(entry, agent ? "child_exec" : "exec");
            string executable = ResolveExecutable(declared);
            var arguments = Strings(entry[agent ? "child_args" : "args"]).ToList();
            if (Regex.IsMatch(Path.GetFileNameWithoutExtension(executable), "^python(?:w|[0-9.]*)?$", RegexOptions.IgnoreCase))
            {
                int scriptIndex = PythonEntryIndex(arguments);
                arguments[scriptIndex] = Scope(_directory, arguments[scriptIndex]);
            }
            else if (Path.GetFileNameWithoutExtension(executable).Equals("uv", StringComparison.OrdinalIgnoreCase))
            {
                if (arguments.Count < 3 || arguments[0] != "run" || arguments[1] != "python"
                    || !File.Exists(Scope(_directory, "uv.lock")) || !File.Exists(Scope(_directory, ".venv/Scripts/python.exe")))
                    throw Error("exec", "maa.runtime.incomplete_distribution: uv requires a locked local environment and explicit Python entry");
                int scriptIndex = 2 + PythonEntryIndex(arguments.Skip(2).ToArray());
                arguments[scriptIndex] = Scope(_directory, arguments[scriptIndex]);
            }
            JsonObject? generatedOptions = null;
            if (!agent && Strings(entry["option"]).Length > 0)
            {
                var effective = new JsonObject();
                ApplyOptions(Strings(entry["option"]), profile, occurrence?.Options ?? profile.Options, new(), effective, new());
                generatedOptions = effective;
            }
            long timeout = entry["timeout"]?.GetValue<long>() ?? 10000;
            if (timeout is < 1 or > 120000 && !(agent && timeout == -1))
                throw Error(agent ? "agent.timeout" : "pretask.timeout", "outside 1..120000 milliseconds (Agent also permits -1)");
            list.Add(new(Text(entry, "name", Path.GetFileName(executable)), executable, arguments.ToArray(),
                agent ? Text(entry, "identifier") : null, timeout, generatedOptions));
        }
        return list.ToArray();
    }

    private void ApplyOptions(IEnumerable<string> keys, DriverProfile profile, JsonObject supplied,
        JsonObject pipeline, JsonObject effective, HashSet<string> visiting)
    {
        foreach (string key in keys)
        {
            if (profile.SourceBinding?.SourceSchemaVersion == "mfa-flat-instance" && !supplied.ContainsKey(key)) continue;
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
                    MergePipeline(pipeline, item["pipeline_override"] as JsonObject, profile.SourceBinding?.SourceKind == "cfa");
                    if (profile.SourceBinding?.SourceKind != "cfa")
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
                MergePipeline(pipeline, Substitute(option["pipeline_override"], fields)?.AsObject(), profile.SourceBinding?.SourceKind == "cfa");
            }
            else throw Error("option." + key + ".type", "unsupported " + type);
            visiting.Remove(key);
        }
    }

    public static void MergePipeline(JsonObject target, JsonObject? source, bool deep = false)
    {
        if (source is null) return;
        foreach (var node in source)
        {
            if (node.Value is not JsonObject fields) throw Error("pipeline_override." + node.Key, "node object required");
            if (target[node.Key] is not JsonObject existing) target[node.Key] = existing = new JsonObject();
            foreach (var field in fields)
                if (deep && field.Value is JsonObject next && existing[field.Key] is JsonObject previous) MergeObject(previous, next);
                else existing[field.Key] = field.Value?.DeepClone();
        }
        static void MergeObject(JsonObject target, JsonObject source)
        {
            foreach (var pair in source)
                if (pair.Value is JsonObject next && target[pair.Key] is JsonObject previous) MergeObject(previous, next);
                else target[pair.Key] = pair.Value?.DeepClone();
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
}
