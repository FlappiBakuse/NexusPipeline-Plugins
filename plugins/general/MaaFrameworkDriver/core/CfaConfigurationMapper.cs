using System.Text.Json.Nodes;

namespace NexusPipeline.Plugin.MaaFrameworkDriver;

public static class CfaConfigurationMapper
{
    public static DriverProfile Read(ProjectCompiler compiler, DriverProfile target, string instanceId)
    {
        if (instanceId.Length is < 1 or > 128 || !instanceId.All(c => char.IsAsciiLetterOrDigit(c) || c is '_' or '-'))
            throw new InvalidDataException("import.cfa.instance_identity");
        const string mainPath = "config/multi_config.json";
        string sourcePath = "config/configs/" + instanceId + ".json";
        var main = compiler.ReadScopedFile(mainPath);
        if (main["config_list"] is not JsonArray ids || !ids.Any(id => id?.GetValue<string>() == instanceId))
            throw new InvalidDataException("import.cfa.instance_removed");
        var source = compiler.ReadScopedFile(sourcePath);
        if (source["item_id"]?.GetValue<string>() != instanceId) throw new InvalidDataException("import.cfa.instance_identity");
        string bundle = Required(source, "bundle");
        string bundleRoot = compiler.Scope(target.PackageRoot, main["bundle"]?[bundle]?["path"]?.GetValue<string>()
            ?? throw new InvalidDataException("import.cfa.bundle_missing"));
        string piDirectory = Path.GetDirectoryName(compiler.Scope(target.PackageRoot, target.InterfacePath))!;
        if (!bundleRoot.TrimEnd('\\', '/').Equals(piDirectory.TrimEnd('\\', '/'), StringComparison.OrdinalIgnoreCase))
            throw new InvalidDataException("import.cfa.bundle_selection_required");
        var schema = compiler.Inspect();
        var tasks = source["tasks"]?.AsArray().Select(t => t?.AsObject() ?? throw new InvalidDataException("import.cfa.task_shape")).ToArray()
            ?? throw new InvalidDataException("import.cfa.tasks_missing");
        JsonObject Base(string id) => tasks.SingleOrDefault(t => t["item_id"]?.GetValue<string>() == id)?["task_option"]?.AsObject()
            ?? throw new InvalidDataException("import.cfa.base_task_missing: " + id);
        var controller = Base("Controller"); var resource = Base("Resource");
        string controllerName = controller["controller_type"] is JsonObject value ? Required(value, "value") : Required(controller, "controller_type");
        string resourceName = Required(resource, "resource");
        var definition = schema["controller"]!.AsArray().OfType<JsonObject>().SingleOrDefault(c => c["name"]?.GetValue<string>() == controllerName)
            ?? throw new InvalidDataException("import.cfa.controller_removed");
        var device = controller[controllerName]?.AsObject() ?? new JsonObject();
        string type = Required(definition, "type");
        var methods = new JsonObject();
        if (type == "Win32")
        {
            foreach (var (sourceKey, field) in new[] { ("win32_screencap_methods", "screencap"), ("mouse_input_methods", "mouse"), ("keyboard_input_methods", "keyboard") })
                if (device[sourceKey] is { } method) methods[field] = ControllerConfiguration.Normalize(field, method);
            string program = device["program_path"]?.GetValue<string>() ?? target.WindowExecutable;
            if (program.Length != 0 && !Path.IsPathFullyQualified(program)) program = compiler.Scope(bundleRoot, program);
            int wait = device["wait_time"]?.GetValue<int>() ?? 0;
            bool launch = !string.IsNullOrWhiteSpace(device["program_path"]?.GetValue<string>());
            if (launch && wait is < 1 or > 1200) throw new InvalidDataException("import.cfa.wait_time_unsupported");
            if (launch && (!File.Exists(program) || !program.EndsWith(".exe", StringComparison.OrdinalIgnoreCase)))
                throw new InvalidDataException("import.host_launch_executable_required");
            target = target with { WindowExecutable = program, WindowSelection = program.Length == 0 ? target.WindowSelection : "executable",
                ControllerConfiguration = methods, HostLaunchRequired = launch,
                HostLaunchConfiguration = launch ? new JsonObject { ["launchGame"] = true, ["gameMode"] = "pc",
                    ["gameExe"] = program, ["gameArgs"] = device["program_params"]?.GetValue<string>() ?? "",
                    ["gameWaitSeconds"] = wait } : new() };
        }
        else if (type == "Adb")
        {
            // Saved method overrides need an explicit mapping; silently discarding them can change device input.
            if (device["input_methods"] is not null || device["screencap_methods"] is not null)
                throw new InvalidDataException("import.cfa.adb_method_override_unsupported");
            string adb = device["adb_path"]?.GetValue<string>() ?? "";
            if (adb.Length != 0 && !Path.IsPathFullyQualified(adb)) adb = compiler.Scope(bundleRoot, adb);
            target = target with { AdbPath = adb, AdbSerial = device["address"]?.GetValue<string>() ?? "" };
        }
        else throw new InvalidDataException("import.cfa.controller_unsupported");
        target = target with { AgentEmbedded = controller["agent_embedded"]?.GetValue<bool>() };
        var entries = new List<TaskOccurrence>();
        foreach (var task in tasks)
        {
            string id = Required(task, "item_id");
            bool enabled = task["is_checked"]?.GetValue<bool>() ?? throw new InvalidDataException("import.cfa.checked_required");
            var options = task["task_option"]?.AsObject() ?? new JsonObject();
            if (id is "Controller" or "Resource" or "Setting") continue;
            if (id is "PreTask" or "Post-Action")
            {
                if (enabled && options.Count != 0) throw new InvalidDataException("import.cfa.base_action_unsupported: " + id);
                continue;
            }
            if (task["task_source"]?.GetValue<string>() is { } kind && kind != "resource" || task["builtin_key"]?.GetValue<string>() is { Length: > 0 })
                throw new InvalidDataException("import.cfa.builtin_action_unsupported");
            if (options["_speedrun_config"] is { } speedrun)
            {
                // CFA persists inactive scheduling metadata on ordinary tasks as well.
                if (speedrun is not JsonObject config || config["enabled"] is not JsonValue active
                    || !active.TryGetValue<bool>(out bool isActive) || isActive)
                    throw new InvalidDataException("import.cfa.speedrun_unsupported");
                options = options.DeepClone().AsObject();
                options.Remove("_speedrun_config");
            }
            string name = Required(task, "name");
            entries.Add(new() { OccurrenceId = ProfileMigration.Identity("cfa", instanceId, id), SourceTaskId = id,
                PiTaskName = name, Order = entries.Count, Enabled = enabled, Options = Options(options, schema) });
        }
        ProfileMigration.Validate(entries.ToArray());
        if (!entries.Any(t => t.Enabled)) throw new InvalidDataException("import.task_selection_empty_or_removed");
        var global = resource["setting_options"]?.AsObject() ?? new();
        var controllerOptions = controller["controller_options"]?.AsObject() ?? new();
        string[] declaredControllerOptions = definition["option"] is JsonArray declared
            ? declared.Select(value => value!.GetValue<string>()).ToArray() : [];
        var selectedControllerOptions = new JsonObject(controllerOptions
            .Where(pair => declaredControllerOptions.Contains(pair.Key, StringComparer.Ordinal))
            .Select(pair => new KeyValuePair<string, JsonNode?>(pair.Key, pair.Value?.DeepClone())));
        var mapped = target with { SchemaVersion = 3, Controller = controllerName, Resource = resourceName,
            SelectedTasks = [], TaskOptions = new(), TaskOccurrences = entries.ToArray(), Options = Options(global, schema),
            ResourceOptions = Options(resource["resource_options"]?.AsObject() ?? new(), schema),
            ControllerOptions = Options(selectedControllerOptions, schema), AuthorizedFingerprint = "" };
        return ConfigurationSources.Bind(compiler, mapped, "cfa", "cfa-config-4", instanceId, [sourcePath, mainPath]);
    }

    private static JsonObject Options(JsonObject source, JsonObject schema)
    {
        var result = new JsonObject();
        void Visit(string name, JsonNode? node, int depth)
        {
            if (depth > 32) throw new InvalidDataException("import.cfa.option_depth");
            if (node is JsonObject hidden && hidden["hidden"]?.GetValue<bool>() == true) return;
            int legacy = name.IndexOf("_child_", StringComparison.Ordinal);
            if (legacy >= 0)
            {
                string suffix = name[(legacy + 7)..]; int first = suffix.IndexOf('_'), last = suffix.LastIndexOf('_');
                if (first < 0 || last <= first) throw new InvalidDataException("import.cfa.child_identity");
                name = suffix[(first + 1)..last];
            }
            var definition = schema["option"]?[name]?.AsObject() ?? throw new InvalidDataException("import.cfa.option_unknown: " + name);
            JsonNode? value = node is JsonObject wrapper && wrapper.ContainsKey("value") ? wrapper["value"] : node;
            if (definition["type"]?.GetValue<string>() == "input" && value is JsonObject inputValues)
            {
                value = inputValues.DeepClone();
                foreach (var input in inputValues)
                    if (input.Value is JsonValue scalar && !scalar.TryGetValue<string>(out _))
                        value[input.Key] = scalar.TryGetValue<bool>(out bool boolean) ? (boolean ? "True" : "False") : scalar.ToJsonString();
            }
            if (definition["inputs"] is JsonArray inputs && inputs.OfType<JsonObject>().Any(i => i["password"]?.GetValue<bool>() == true
                && value?[Required(i, "name")] is { } secret && secret.ToJsonString() != "\"\""))
                throw new InvalidDataException("import.password_requires_protected_reentry");
            if (result.ContainsKey(name) && !JsonNode.DeepEquals(result[name], value)) throw new InvalidDataException("import.cfa.option_conflict");
            result[name] = value?.DeepClone();
            if (node is not JsonObject payload) return;
            var branches = payload["branches"]?.DeepClone().AsObject() ?? new JsonObject();
            foreach (var pair in payload["children"]?.AsObject() ?? new JsonObject())
                if (!branches.ContainsKey(pair.Key)) branches[pair.Key] = pair.Value?.DeepClone();
            foreach (var pair in branches)
            {
                if (pair.Value is JsonObject group && !new[] { "value", "hidden", "branches", "children" }.Any(group.ContainsKey))
                    foreach (var child in group) Visit(child.Key, child.Value, depth + 1);
                else Visit(pair.Key, pair.Value, depth + 1);
            }
        }
        foreach (var pair in source) Visit(pair.Key, pair.Value, 0);
        return result;
    }

    private static string Required(JsonObject value, string name) => value[name]?.GetValue<string>() is { Length: > 0 } text
        ? text : throw new InvalidDataException("import.cfa.required: " + name);
}
