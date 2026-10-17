using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;

namespace NexusPipeline.Plugin.MaaFrameworkDriver;

public sealed partial class ProjectCompiler
{
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
            "mirrorchyan_rid", "mirrorchyan_multiplatform", "github", "url", "version", "contact", "license", "welcome",
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

        }
        foreach (var item in Objects(pi["resource"])) Known(item, source + ".resource." + Required(item, "name"),
            "name", "label", "description", "icon", "path", "controller", "option", "hash");
        foreach (var item in Objects(pi["task"])) Known(item, source + ".task." + Required(item, "name"),
            "name", "label", "entry", "default_check", "description", "doc", "desc", "icon", "group", "resource",
            "controller", "pipeline_override", "option", "repeatable", "repeat_count");
        foreach (var item in Objects(pi["group"])) Known(item, source + ".group", "name", "label", "description", "icon", "default_expand");
        foreach (var item in Objects(pi["setting"])) Known(item, source + ".setting", "name", "label", "description", "icon", "option", "default_expand");
        foreach (var item in Objects(pi["pretask"])) Known(item, source + ".pretask", "name", "label", "description", "icon",
            "resource", "controller", "exec", "args", "option", "timeout");
        foreach (var item in Objects(pi["agent"]))
        {
            Known(item, source + ".agent", "child_exec", "child_args", "identifier", "timeout", "embedded");
            if (item["embedded"] is { } embedded && (embedded is not JsonValue flag || !flag.TryGetValue<bool>(out _)))
                throw Error(source + ".agent.embedded", "boolean required");
        }
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
        foreach (var occurrence in profile.TaskOccurrences)
        {
            if (ConfigurationImporter.IsMxu(profile) && occurrence.PiTaskName.StartsWith(ConfigurationImporter.MxuPretaskPrefix, StringComparison.Ordinal))
            {
                if (!Objects(_pi["pretask"]).Any(item => ConfigurationImporter.PretaskName(item) == occurrence.PiTaskName)
                    || occurrence.GuiAction.Length != 0 || occurrence.RepeatCount != 1 || occurrence.PipelineOverride.Count != 0)
                    throw Error("pretask." + occurrence.PiTaskName, "unknown reference or unsupported task override");
            }
            else if (occurrence.GuiAction.Length == 0) Find("task", occurrence.PiTaskName);
            else
            {
                GuiWaitActions.Validate(occurrence.GuiAction, occurrence.PipelineOverride);
                if (occurrence.Options.Count != 0) throw Error("taskOccurrences.options", "unsupported special action options");
            }
            Validate(occurrence.Options, "taskOccurrences." + occurrence.OccurrenceId + ".options");
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
