using System.Text.Json.Nodes;

namespace NexusPipeline.Plugin.MaaFrameworkDriver;

public static class MfaConfigurationMapper
{
    public static JsonNode? Inherit(JsonObject instance, JsonObject global, string instanceId, string key)
    {
        foreach (var (owner, name) in new[] { (instance, key), (global, "Instance." + instanceId + "." + key),
            (global, "Instance.default." + key), (global, key) })
            if (owner.TryGetPropertyValue(name, out var value) && value is not null) return value.DeepClone();
        return null;
    }

    public static DriverProfile Map(JsonObject instance, JsonObject global, JsonObject schema, DriverProfile target, string instanceId)
    {
        if (string.IsNullOrWhiteSpace(instanceId)) throw Error("instanceId", "required");
        string[] mappedFields = ["CurrentControllerName", "CurrentController", "Resource", "TaskItems", "CurrentTasks", "InstancePresetKey",
            "GlobalOptionItems", "ResourceOptionItems", "ControllerOptionItems", "AdbDevice", "BeforeTask", "AfterTask", "Prescript", "Post-script",
            "Win32ControlScreenCapType", "Win32ControlMouseType", "Win32ControlKeyboardType", "SoftwarePath", "RetryOnDisconnectedWin32",
            "DesktopWindowClassName", "DesktopWindowName", "AgentTcpMode"];
        string[] presentationFields = ["EnableEdit", "AutoMinimize", "AutoHide", "IncludeInGlobalStart", "InstanceName", "InstanceIcon",
            "EnableToastNotification", "CurrentLanguage", "LangIndex", "ThemeIndex", "BaseTheme", "ShouldMinimizeToTray"];
        foreach (string key in instance.Select(pair => pair.Key).Concat(global.Select(pair => pair.Key)
            .Where(key => key.StartsWith("Instance." + instanceId + ".", StringComparison.Ordinal) || key.StartsWith("Instance.default.", StringComparison.Ordinal))
            .Select(key => key.StartsWith("Instance.default.", StringComparison.Ordinal) ? key["Instance.default.".Length..] : key[("Instance." + instanceId + ".").Length..])))
            if (!mappedFields.Contains(key, StringComparer.Ordinal) && !presentationFields.Contains(key, StringComparer.Ordinal)
                && !key.StartsWith("UI.", StringComparison.Ordinal)) throw Error(key, "unsupported instance field");
        JsonNode? Get(string key) => Inherit(instance, global, instanceId, key);
        var windowHints = new JsonObject();
        foreach (string key in new[] { "DesktopWindowClassName", "DesktopWindowName" })
            if (Get(key) is { } hint)
            {
                if (hint is not JsonValue value || !value.TryGetValue<string>(out string? text) || text.Length > 512)
                    throw Error(key, "bounded string required");
                windowHints[key] = text;
            }
        bool? agentTcpMode = null;
        if (Get("AgentTcpMode") is { } transport)
        {
            if (transport is not JsonValue value || !value.TryGetValue<bool>(out bool enabled))
                throw Error("AgentTcpMode", "boolean required");
            agentTcpMode = enabled;
        }
        string controller = Get("CurrentControllerName")?.GetValue<string>() ?? throw Error("CurrentControllerName", "required");
        string resource = Get("Resource")?.GetValue<string>() ?? throw Error("Resource", "required");
        var controllerDefinition = Items(schema["controller"]).SingleOrDefault(item => Text(item, "name") == controller)
            ?? throw Error("CurrentControllerName", "removed");
        if (Get("CurrentController") is { } selectedType)
        {
            string typeValue = selectedType is JsonValue scalar && scalar.TryGetValue<string>(out string? text) ? text : selectedType.ToJsonString();
            string expectedType = Text(controllerDefinition, "type");
            if (!(expectedType == "Win32" && typeValue is "1" or "Win32" || expectedType == "Adb" && typeValue is "2" or "Adb"))
                throw Error("CurrentController", "selected controller type mismatch");
        }
        if (!Items(schema["resource"]).Any(item => Text(item, "name") == resource)) throw Error("Resource", "removed");
        var controllerConfiguration = new JsonObject();
        foreach (var (key, field) in new[] { ("Win32ControlScreenCapType", "screencap"), ("Win32ControlMouseType", "mouse"),
            ("Win32ControlKeyboardType", "keyboard") })
            if (Get(key) is { } method)
            {
                if (Text(controllerDefinition, "type") != "Win32") throw Error(key, "selected controller is not Win32");
                controllerConfiguration[field] = ControllerConfiguration.Normalize(field, method);
            }
        foreach (string key in new[] { "Prescript", "Post-script" })
            if (Get(key) is JsonValue script && script.TryGetValue<string>(out var text) && !string.IsNullOrWhiteSpace(text))
                throw Error(key, "unsupported executable action");
        foreach (string key in new[] { "BeforeTask", "AfterTask" })
            if (Get(key) is { } action && action.GetValue<string>() != "None")
                throw Error(key, "unsupported action: " + action.GetValue<string>());
        // MFA keeps the launch path even when startup and disconnected retries are disabled.
        if (Get("SoftwarePath") is { } softwarePath
            && (softwarePath is not JsonValue pathValue || !pathValue.TryGetValue<string>(out _)))
            throw Error("SoftwarePath", "string required");
        if (Get("RetryOnDisconnectedWin32")?.GetValue<bool>() == true)
            throw Error("RetryOnDisconnectedWin32", "unsupported executable action");

        JsonObject options = new(), resourceOptions = new(), controllerOptions = new();
        MapOptions(Get("GlobalOptionItems"), schema, options, "GlobalOptionItems");
        MapOptions(Get("ResourceOptionItems")?[resource], schema, resourceOptions, "ResourceOptionItems." + resource);
        MapOptions(Get("ControllerOptionItems")?[controller], schema, controllerOptions, "ControllerOptionItems." + controller);
        var definitions = Items(schema["task"]).ToDictionary(item => Text(item, "name"), StringComparer.Ordinal);
        var saved = Items(Get("TaskItems")).ToList();
        var history = Strings(Get("CurrentTasks")).ToHashSet(StringComparer.Ordinal);
        string preset = Get("InstancePresetKey")?.GetValue<string>() ?? "";
        HashSet<string>? presetNames = null;
        if (preset.Length > 0)
        {
            var selected = Items(schema["preset"]).SingleOrDefault(item => Text(item, "name") == preset)
                ?? throw Error("InstancePresetKey", "removed");
            presetNames = Items(selected["task"]).Select(item => Text(item, "name")).ToHashSet(StringComparer.Ordinal);
        }
        foreach (var definition in definitions.Values)
        {
            string name = Text(definition, "name"), entry = Text(definition, "entry");
            if (saved.Any(item => Text(item, "name") == name && Text(item, "entry") == entry)
                || history.Contains(name + "<|||>" + entry) || presetNames is not null && !presetNames.Contains(name)) continue;
            var added = definition.DeepClone().AsObject();
            added.Remove("option");
            saved.Add(added);
        }
        var entries = new List<TaskOccurrence>();
        foreach (var task in saved)
        {
            string name = Text(task, "name"), entry = Text(task, "entry");
            bool guiAction = !definitions.TryGetValue(name, out var definition) && GuiWaitActions.Supports(entry);
            if (!guiAction && (definition is null || Text(definition, "entry") != entry))
                throw Error("TaskItems." + name, "task or special action is not supported by the current PI");
            Known(task, "TaskItems." + name, "name", "label", "display_name_override", "remark", "entry", "default_check",
                "description", "icon", "resource", "controller", "group", "doc", "desc", "repeatable", "repeat_count", "advanced", "option", "pipeline_override");
            if (Items(task["advanced"]).Any()) throw Error("TaskItems." + name + ".advanced", "PI v2 option mapping required");
            var values = new JsonObject(); MapOptions(task["option"], schema, values, "TaskItems." + name + ".option");
            var pipeline = task["pipeline_override"]?.DeepClone().AsObject() ?? new();
            if (guiAction)
            {
                GuiWaitActions.Validate(entry, pipeline);
                if (values.Count != 0) throw Error("TaskItems." + name + ".option", "unsupported special action options");
            }
            bool duplicate = saved.Count(item => Text(item, "name") == name && Text(item, "entry") == entry) > 1;
            string sourceIdentity = ProfileMigration.Identity("mfa", instanceId, name, entry,
                duplicate ? ProfileMigration.Canonical(values) + ProfileMigration.Canonical(pipeline) : "unique");
            var prior = target.TaskOccurrences.SingleOrDefault(item => item.SourceTaskId == sourceIdentity);
            if (duplicate && prior is null && target.TaskOccurrences.Count(item => item.PiTaskName == name) > 1)
                throw Error("TaskItems." + name, "ambiguous occurrence changed; select the source again");
            int repeat = task["repeat_count"]?.GetValue<int>() ?? 1;
            if (repeat != 1 && (guiAction || definition!["repeatable"]?.GetValue<bool>() != true))
                throw Error("TaskItems." + name + ".repeat_count", "task is not repeatable");
            entries.Add(new() { OccurrenceId = prior?.OccurrenceId ?? sourceIdentity, SourceTaskId = sourceIdentity,
                PiTaskName = name, GuiAction = guiAction ? entry : "", Order = entries.Count, Enabled = task["default_check"]?.GetValue<bool>() ?? false,
                RepeatCount = repeat, Options = values, PipelineOverride = pipeline });
        }
        ProfileMigration.Validate(entries.ToArray());
        if (Text(controllerDefinition, "type") == "Adb" && Get("AdbDevice") is JsonObject adb)
            target = target with { AdbPath = Text(adb, "AdbPath"), AdbSerial = Text(adb, "AdbSerial") };
        return target with { SchemaVersion = 3, Controller = controller, Resource = resource, SelectedTasks = [], TaskOptions = new(),
            TaskOccurrences = entries.ToArray(), Options = options, ResourceOptions = resourceOptions, ControllerOptions = controllerOptions,
            ControllerConfiguration = controllerConfiguration,
            // GUI labels and transport preferences do not replace Host's verified process identity or session-owned Agent transport.
            AuthorizedFingerprint = "", ImportProvenance = new() { ["sourceKind"] = "mfa", ["sourceInstanceId"] = instanceId,
                ["savedWindowHints"] = windowHints, ["guiAgentTcpMode"] = agentTcpMode,
                ["mapperVersion"] = 1, ["sourceModified"] = false, ["importedAt"] = DateTimeOffset.UtcNow.ToString("O") } };
    }

    private static void MapOptions(JsonNode? source, JsonObject schema, JsonObject destination, string field, int depth = 0)
    {
        if (depth > 16) throw Error(field, "option nesting limit");
        foreach (var item in Items(source))
        {
            Known(item, field, "name", "index", "selected_cases", "data", "sub_options");
            string name = Text(item, "name");
            var definition = schema["option"]?[name]?.AsObject() ?? throw Error(field + "." + name, "unknown option");
            if (destination.ContainsKey(name)) throw Error(field + "." + name, "duplicate option");
            string type = Text(definition, "type", "select");
            JsonNode value;
            if (type is "select" or "switch")
            {
                var cases = Items(definition["cases"]).ToArray();
                int index = item["index"]?.GetValue<int>() ?? Array.FindIndex(cases,
                    choice => Text(choice, "name") == definition["default_case"]?.GetValue<string>());
                if (index == -1) index = 0;
                if (index < 0 || index >= cases.Length) throw Error(field + "." + name + ".index", "out of range");
                value = JsonValue.Create(Text(cases[index], "name"))!;
            }
            else if (type == "checkbox")
            {
                string[] chosen = Strings(item["selected_cases"]);
                var known = Items(definition["cases"]).Select(choice => Text(choice, "name")).ToHashSet(StringComparer.Ordinal);
                if (chosen.Distinct(StringComparer.Ordinal).Count() != chosen.Length || chosen.Any(choice => !known.Contains(choice)))
                    throw Error(field + "." + name + ".selected_cases", "unknown or duplicate case");
                value = new JsonArray(chosen.Select(choice => (JsonNode?)JsonValue.Create(choice)).ToArray());
            }
            else if (type is "input" or "hotkey")
            {
                var data = item["data"]?.AsObject() ?? new();
                var inputs = Items(definition[type == "input" ? "inputs" : "hotkeys"]).ToArray();
                foreach (var pair in data)
                {
                    var input = inputs.SingleOrDefault(candidate => Text(candidate, "name") == pair.Key)
                        ?? throw Error(field + "." + name + ".data." + pair.Key, "unknown input");
                    if (input["password"]?.GetValue<bool>() == true && pair.Value?.GetValue<string>() is { Length: > 0 })
                        throw Error(field + "." + name + ".data." + pair.Key, "protected reentry required");
                }
                value = data.DeepClone();
            }
            else throw Error(field + "." + name, "unsupported option type");
            destination[name] = value;
            MapOptions(item["sub_options"], schema, destination, field + "." + name + ".sub_options", depth + 1);
        }
    }

    private static IEnumerable<JsonObject> Items(JsonNode? node) => node switch {
        null => [], JsonArray array => array.Select(item => item is JsonObject obj ? obj
            : item is JsonValue scalar && scalar.TryGetValue<string>(out var name) ? new JsonObject { ["name"] = name, ["index"] = 0 }
            : throw Error("array", "object or option name required")), _ => throw Error("array", "required") };
    private static string[] Strings(JsonNode? node) => node switch {
        null => [], JsonValue value => [value.GetValue<string>()], JsonArray array => array.Select(item => item!.GetValue<string>()).ToArray(),
        _ => throw Error("array", "strings required") };
    private static string Text(JsonObject obj, string key, string fallback = "") => obj[key]?.GetValue<string>() ?? fallback;
    private static void Known(JsonObject obj, string field, params string[] fields)
    { foreach (string key in obj.Select(pair => pair.Key)) if (!fields.Contains(key, StringComparer.Ordinal)) throw Error(field + "." + key, "unknown field"); }
    private static InvalidDataException Error(string field, string detail) => new("import.mfa." + field + ": " + detail);
}
