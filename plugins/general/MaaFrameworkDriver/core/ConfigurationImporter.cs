using System.Text.Json.Nodes;

namespace NexusPipeline.Plugin.MaaFrameworkDriver;

/// <summary>Read-only, explicit mappings; no GUI synchronization or fallback task selection.</summary>
public static class ConfigurationImporter
{
    public static JsonObject Instances(JsonObject source) => new()
    { ["instances"] = new JsonArray((source["instances"]?.AsArray() ?? throw new InvalidDataException("import.mxu_instances_required"))
        .OfType<JsonObject>().Select(item => (JsonNode?)new JsonObject { ["id"] = item["id"]?.DeepClone(), ["name"] = item["name"]?.DeepClone() }).ToArray()) };

    public static DriverProfile Map(string kind, JsonObject source, JsonObject schema, DriverProfile target, string instanceId = "")
    {
        JsonObject options = new(), resourceOptions = new(), controllerOptions = new(), taskOptions = new(); var tasks = new List<string>();
        string controller, resource;
        if (kind == "mxu")
        {
            Known(source, ["version", "instances", "settings", "customAccents", "globalOptionValues", "recentlyClosed",
                "interfaceTaskSnapshot", "newTaskNames", "lastActiveInstanceId", "presetInitialized"]);
            if (source["version"]?.GetValue<string>() != "1.0") throw new InvalidDataException("import.unsupported_mxu_version");
            var matches = source["instances"]?.AsArray().OfType<JsonObject>().Where(item => item["id"]?.GetValue<string>() == instanceId).ToArray() ?? [];
            if (matches.Length != 1) throw new InvalidDataException("import.explicit_instance_required");
            var instance = matches[0];
            Known(instance, ["id", "name", "controllerId", "resourceId", "controllerName", "resourceName", "tasks",
                "savedDevice", "schedulePolicies", "preActions", "preAction"]);
            controller = Required(instance, "controllerName"); resource = Required(instance, "resourceName");
            if (instance["savedDevice"] is JsonObject device)
            {
                Known(device, ["adbDeviceName", "adbDeviceAddress", "windowName", "wlrSocketPath", "playcoverAddress", "connectedProgramPath"]);
                target = target with { WindowExecutable = device["connectedProgramPath"]?.GetValue<string>() ?? target.WindowExecutable,
                    AdbSerial = device["adbDeviceAddress"]?.GetValue<string>() ?? target.AdbSerial };
            }
            JsonObject[] actions = instance["preActions"] is JsonArray array
                ? array.Select(value => value?.AsObject() ?? throw new InvalidDataException("import.action_shape")).ToArray()
                : instance["preAction"] is JsonObject legacy ? [legacy] : [];
            target = MapHostLaunch(actions, schema, controller, target);
            if (source["globalOptionValues"] is JsonObject global) MapMxuOptions(global, schema, options);
            foreach (var task in instance["tasks"]?.AsArray().OfType<JsonObject>() ?? [])
            {
                Known(task, ["id", "taskName", "enabled", "enabledByController", "optionValues", "expanded", "collapsedOptions", "customName"]);
                string name = Required(task, "taskName"); bool enabled = task["enabled"]?.GetValue<bool>() ?? throw new InvalidDataException("import.task_enabled_required");
                if (!enabled) continue;
                if (task["enabledByController"] is JsonObject cache && cache[controller] is JsonValue cached && cached.GetValue<bool>() != enabled)
                    throw new InvalidDataException("import.controller_enabled_cache_conflict");
                tasks.Add(name); var values = new JsonObject();
                if (task["optionValues"] is JsonObject configured) MapMxuOptions(configured, schema, values);
                taskOptions[name] = values;
            }
        }
        else if (kind == "maapicli-v5.14.0")
        {
            Known(source, ["controller", "resource", "task", "adb", "win32", "macos", "playcover", "gamepad", "lnx", "global_option", "resource_option", "controller_option"]);
            controller = Required(source["controller"]!.AsObject(), "name"); resource = Required(source, "resource");
            foreach (var (layer, destination) in new[] { ("global_option", options), ("resource_option", resourceOptions), ("controller_option", controllerOptions) })
                foreach (var configured in source[layer]?.AsArray().OfType<JsonObject>() ?? []) MapCliOption(configured, schema, destination);
            foreach (var task in source["task"]?.AsArray().OfType<JsonObject>() ?? [])
            {
                Known(task, ["name", "option"]); string name = Required(task, "name"); tasks.Add(name); var values = new JsonObject();
                foreach (var configured in task["option"]?.AsArray().OfType<JsonObject>() ?? []) MapCliOption(configured, schema, values);
                taskOptions[name] = values;
            }
            if (source["adb"] is JsonObject adb) target = target with { AdbPath = adb["adb_path"]?.GetValue<string>() ?? "", AdbSerial = adb["address"]?.GetValue<string>() ?? "" };
        }
        else throw new InvalidDataException("import.unsupported_source_schema");
        if (!schema["controller"]!.AsArray().OfType<JsonObject>().Any(item => item["name"]!.GetValue<string>() == controller)
            || !schema["resource"]!.AsArray().OfType<JsonObject>().Any(item => item["name"]!.GetValue<string>() == resource))
            throw new InvalidDataException("import.controller_or_resource_removed");
        if (tasks.Count == 0 || tasks.Distinct(StringComparer.Ordinal).Count() != tasks.Count
            || tasks.Any(name => !schema["task"]!.AsArray().OfType<JsonObject>().Any(item => item["name"]!.GetValue<string>() == name)))
            throw new InvalidDataException("import.task_selection_empty_duplicate_or_removed");
        return target with { Controller = controller, Resource = resource, SelectedTasks = tasks.ToArray(), Options = options,
            ResourceOptions = resourceOptions, ControllerOptions = controllerOptions,
            TaskOptions = taskOptions, AuthorizedFingerprint = "", ImportProvenance = new JsonObject {
                ["sourceKind"] = kind, ["sourceSchemaVersion"] = source["version"]?.DeepClone(),
                ["importedAt"] = DateTimeOffset.UtcNow.ToString("O"), ["sync"] = "none", ["sourceModified"] = false } };
    }

    private static void MapMxuOptions(JsonObject configured, JsonObject schema, JsonObject target)
    {
        foreach (var item in configured)
        {
            var definition = Definition(schema, item.Key); var value = item.Value?.AsObject() ?? throw new InvalidDataException("import.option_shape");
            string type = Required(value, "type");
            if (type != (definition["type"]?.GetValue<string>() ?? "select")) throw new InvalidDataException("import.option_type_mismatch");
            Known(value, ["type", "caseName", "caseNames", "value", "values"]);
            target[item.Key] = type switch {
                "select" => value["caseName"]?.DeepClone() ?? throw new InvalidDataException("import.case_required"),
                "checkbox" => value["caseNames"]?.DeepClone() ?? throw new InvalidDataException("import.cases_required"),
                "switch" => FindSwitchCase(definition, value["value"]?.GetValue<bool>() ?? throw new InvalidDataException("import.switch_required")),
                "input" or "hotkey" => SanitizeInputs(definition, value["values"]?.AsObject() ?? new()),
                _ => throw new InvalidDataException("import.unsupported_option_type") };
        }
    }
    private static void MapCliOption(JsonObject configured, JsonObject schema, JsonObject target)
    {
        Known(configured, ["name", "value", "values", "inputs"]);
        string name = Required(configured, "name"); var definition = Definition(schema, name);
        target[name] = (definition["type"]?.GetValue<string>() ?? "select") switch {
            "select" or "switch" => configured["value"]?.DeepClone() ?? throw new InvalidDataException("import.case_required"),
            "checkbox" => configured["values"]?.DeepClone() ?? new JsonArray(),
            "input" or "hotkey" => SanitizeInputs(definition, configured["inputs"]?.AsObject() ?? new()),
            _ => throw new InvalidDataException("import.unsupported_cli_option") };
    }
    private static DriverProfile MapHostLaunch(JsonObject[] actions, JsonObject schema, string controller, DriverProfile target)
    {
        foreach (var action in actions)
            Known(action, ["id", "customName", "enabled", "program", "args", "waitForExit", "skipIfRunning", "useCmd"]);
        var active = actions.Where(action => action["enabled"]?.GetValue<bool>() == true).ToArray();
        if (active.Length == 0) return target with { HostLaunchRequired = false, HostLaunchConfiguration = new() };
        // Host's existing PC launch owns readiness and already-running semantics.
        // Waiting writers/shell commands need an explicitly reviewed Host hook, not a fake native task.
        if (active.Length != 1 || active[0]["waitForExit"]?.GetValue<bool>() != false
            || active[0]["skipIfRunning"]?.GetValue<bool>() != true
            || active[0]["useCmd"]?.GetValue<bool>() == true
            || !schema["controller"]!.AsArray().OfType<JsonObject>().Any(item => item["name"]?.GetValue<string>() == controller
                && item["type"]?.GetValue<string>() == "Win32"))
            throw new InvalidDataException("import.preactions_require_explicit_host_hook: only one non-shell, non-waiting PC launch with skipIfRunning maps directly");
        string program = Required(active[0], "program");
        if (!Path.IsPathFullyQualified(program) || !File.Exists(program) || !program.EndsWith(".exe", StringComparison.OrdinalIgnoreCase))
            throw new InvalidDataException("import.host_launch_executable_required");
        return target with { WindowExecutable = Path.GetFullPath(program), WindowHandle = 0, WindowProcessId = 0, WindowStartedAtUtc = null,
            HostLaunchRequired = true, HostLaunchConfiguration = new JsonObject {
                ["launchGame"] = true, ["gameMode"] = "pc", ["gameExe"] = Path.GetFullPath(program),
                ["gameArgs"] = active[0]["args"]?.GetValue<string>() ?? "", ["gameWaitSeconds"] = 30 } };
    }
    private static JsonObject SanitizeInputs(JsonObject definition, JsonObject values)
    {
        var result = new JsonObject();
        foreach (var input in (definition["inputs"] ?? definition["hotkeys"])!.AsArray().OfType<JsonObject>())
        {
            string name = Required(input, "name");
            if (input["password"]?.GetValue<bool>() == true && values[name] is not null)
            {
                if (values[name]!.GetValue<string>().Length > 0)
                    throw new InvalidDataException("import.password_requires_protected_reentry");
                continue;
            }
            if (values[name] is not null) result[name] = values[name]!.DeepClone();
        }
        var known = (definition["inputs"] ?? definition["hotkeys"])!.AsArray().OfType<JsonObject>().Select(input => Required(input, "name"));
        if (values.Any(pair => !known.Contains(pair.Key, StringComparer.Ordinal))) throw new InvalidDataException("import.unknown_input_field");
        return result;
    }
    private static JsonNode FindSwitchCase(JsonObject definition, bool value)
    {
        var names = definition["cases"]!.AsArray().OfType<JsonObject>().Select(item => Required(item, "name"));
        string[] accepted = value ? ["Yes", "yes", "Y", "y", "True", "true"] : ["No", "no", "N", "n", "False", "false"];
        string[] matches = names.Where(accepted.Contains).ToArray();
        if (matches.Length != 1) throw new InvalidDataException("import.ambiguous_switch_case");
        return JsonValue.Create(matches[0])!;
    }
    private static JsonObject Definition(JsonObject schema, string name) => schema["option"]?[name]?.AsObject()
        ?? throw new InvalidDataException("import.unknown_execution_option");
    private static string Required(JsonObject value, string key) => value[key]?.GetValue<string>() is { Length: > 0 } text ? text : throw new InvalidDataException("import.required_" + key);
    private static void Known(JsonObject value, string[] known)
    { if (value.Any(pair => !known.Contains(pair.Key, StringComparer.Ordinal))) throw new InvalidDataException("import.unknown_execution_field"); }
}
