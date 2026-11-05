using System.Text.Json.Nodes;

namespace NexusPipeline.Extensions.MaaFramework;

internal sealed class MaaEditorSchema
{
    private readonly HashSet<string> translations = new(StringComparer.Ordinal);
    private int omitted;
    internal int Omitted => omitted;
    internal JsonObject Build(JsonObject declaration, string clientKind = "mxu")
    {
        var result = Copy(declaration, "interface_version", "name", "label", "title", "icon", "version", "description", "welcome", "contact", "license", "github");
        foreach (var field in new[] { "controller", "resource", "task", "group", "setting", "pretask" })
            result[field] = new JsonArray(MaaJson.Objects(declaration[field], field == "pretask").Select(item => (JsonNode)Item(item, field)).ToArray());
        result["global_option"] = Strings(declaration["global_option"]);
        var options = new JsonObject();
        foreach (var pair in MaaJson.Object(declaration["option"] ?? new JsonObject())) options.Add(pair.Key, Option(MaaJson.Object(pair.Value), clientKind));
        result["option"] = options;
        result["preset"] = new JsonArray(MaaJson.Objects(declaration["preset"]).Select(item => {
            var preset = Copy(item, "name", "label", "description", "icon");
            preset["task"] = new JsonArray(MaaJson.Objects(item["task"]).Select(row => {
                var task = Copy(row, "name", "enabled"); task["option"] = Selections(MaaImportRules.Data(row["option"]), declaration);
                return (JsonNode)task;
            }).ToArray()); return (JsonNode)preset;
        }).ToArray());
        return result;
    }
    internal JsonObject Translate(JsonObject source)
    {
        var result = new JsonObject();
        foreach (var key in translations.Order(StringComparer.Ordinal))
            if (source[key] is JsonValue value && value.TryGetValue<string>(out var text)) result.Add(key, text);
        omitted += source.Count - result.Count; return result;
    }
    private JsonObject Item(JsonObject source, string kind)
    {
        var value = Copy(source, "name", "label", "description", "desc", "doc", "icon", "entry", "type", "default_check", "repeatable", "repeat_count",
            "default_expand", "display_short_side", "display_long_side", "display_expand", "display_raw", "permission_required");
        foreach (var key in new[] { "controller", "resource", "option", "group" }) if (source[key] is not null) value[key] = Strings(source[key]);
        if (kind == "resource") value["path"] = Strings(source["path"]);
        if (kind == "controller")
        {
            value["attach_resource_path"] = Strings(source["attach_resource_path"]);
            foreach (var key in new[] { "win32", "macos", "linux", "gamepad" })
                if (source[key] is JsonObject methods) value[key] = Copy(methods, "class_regex", "window_regex", "title_regex", "mouse", "keyboard", "input", "screencap", "gamepad_type", "pipewire_source", "use_win32_vk_code");
        }
        return value;
    }
    private JsonObject Option(JsonObject source, string clientKind)
    {
        var value = Copy(source, "type", "label", "description", "icon", "min_count", "max_count");
        var names = MaaJson.Objects(source["cases"]).Select(item => MaaJson.Required(item, "name")).ToHashSet(StringComparer.Ordinal);
        var selection = MaaOptionDefaults.Selection(source, clientKind);
        if (selection is JsonValue chosen && chosen.TryGetValue<string>(out var name) && names.Contains(name)) value["default_case"] = name;
        else if (selection is JsonArray selected && selected.All(item => item is JsonValue scalar && scalar.TryGetValue<string>(out var key) && names.Contains(key)))
            value["default_case"] = selected.DeepClone();
        foreach (var key in new[] { "controller", "resource" }) if (source[key] is not null) value[key] = Strings(source[key]);
        value["cases"] = new JsonArray(MaaJson.Objects(source["cases"]).Select(item => {
            var choice = Copy(item, "name", "label", "description", "icon"); choice["option"] = Strings(item["option"]); return (JsonNode)choice;
        }).ToArray());
        foreach (var key in new[] { "inputs", "hotkeys" })
            value[key] = new JsonArray(MaaJson.Objects(source[key]).Select(item => {
                var field = Copy(item, "name", "label", "description", "pipeline_type", "verify", "pattern_msg", "password");
                if (!MaaJson.Boolean(item, "password") && item["default"] is JsonValue initial && initial.TryGetValue<string>(out _)) field["default"] = initial.DeepClone();
                return (JsonNode)field;
            }).ToArray());
        return value;
    }
    internal static JsonObject Selections(JsonObject supplied, JsonObject declaration)
    {
        var result = new JsonObject(); var options = MaaJson.Object(declaration["option"] ?? new JsonObject());
        foreach (var pair in supplied)
        {
            if (options[pair.Key] is not JsonObject definition) continue;
            var type = MaaJson.Text(definition, "type", "select"); var cases = MaaJson.Objects(definition["cases"]).Select(item => MaaJson.Required(item, "name")).ToHashSet(StringComparer.Ordinal);
            if (type is "input" or "hotkey")
            {
                var fields = new JsonObject();
                if (pair.Value is JsonObject saved)
                    foreach (var input in MaaJson.Objects(definition[type == "hotkey" ? "hotkeys" : "inputs"]))
                    {
                        var key = MaaJson.Required(input, "name");
                        if (!MaaJson.Boolean(input, "password") && saved[key] is JsonValue scalar && scalar.TryGetValue<string>(out var text))
                            fields[key] = text;
                        else if (MaaJson.Boolean(input, "password") && saved[key] is JsonObject)
                            fields[key] = MaaProtectedInput.Binding(MaaProtectedInput.ReadBinding(saved[key]));
                    }
                result[pair.Key] = fields;
            }
            else if (type == "checkbox" && pair.Value is JsonArray array && array.All(item => item is JsonValue value && value.TryGetValue<string>(out var name) && cases.Contains(name)))
                result[pair.Key] = array.DeepClone();
            else if (pair.Value is JsonValue value && value.TryGetValue<string>(out var name) && cases.Contains(name)) result[pair.Key] = name;
        }
        return result;
    }
    private JsonObject Copy(JsonObject source, params string[] fields)
    {
        var result = new JsonObject();
        foreach (var field in fields)
        {
            var node = source[field];
            var accepted = field is "default_check" or "repeatable" or "default_expand" or "display_expand" or "display_raw" or "permission_required" or "password" or "use_win32_vk_code" or "enabled"
                ? node is JsonValue flag && flag.TryGetValue<bool>(out _)
                : field is "interface_version" or "repeat_count" or "min_count" or "max_count" or "display_short_side" or "display_long_side"
                    ? node is JsonValue number && number.TryGetValue<double>(out var finite) && double.IsFinite(finite)
                    : node is JsonValue text && text.TryGetValue<string>(out _) || node is JsonArray array && array.All(item => item is JsonValue scalar && scalar.TryGetValue<string>(out _));
            if (accepted)
            { result[field] = node!.DeepClone(); if (field is "label" or "title" or "description" or "desc" or "doc" or "welcome" or "pattern_msg") Capture(node); }
        }
        omitted += source.Count - result.Count; return result;
    }
    private void Capture(JsonNode? node)
    {
        if (node is JsonValue value && value.TryGetValue<string>(out var text) && text.StartsWith('$') && text.Length > 1) translations.Add(text[1..]);
        else if (node is JsonArray array) foreach (var item in array) Capture(item);
    }
    private static JsonArray Strings(JsonNode? value) => new(MaaJson.Strings(value).Select(item => (JsonNode?)JsonValue.Create(item)).ToArray());
}
