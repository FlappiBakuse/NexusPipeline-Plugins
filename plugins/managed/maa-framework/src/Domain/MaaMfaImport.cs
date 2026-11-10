using System.Text.Json.Nodes;

namespace NexusPipeline.Extensions.MaaFramework;

internal sealed class MaaMfaImport(MaaSourceSet sources, MaaPiProject project, MaaCompilationPolicy? policy = null)
{
    private readonly MaaCompilationPolicy rules = policy ?? new();
    internal MaaImportedProfile Import(MaaImportSelection selection)
    {
        var settings = sources.Read("appsettings.json"); var separate = selection.Path == "config/instances/" + selection.InstanceId + ".json";
        if (!separate && selection.Path.StartsWith("config/instances/", StringComparison.OrdinalIgnoreCase)) throw new MaaInputFailure("maa_mfa_instance_path_mismatch");
        var selected = MaaJson.Text(settings, separate ? "DefaultConfig" : "Instance." + selection.InstanceId + ".Config", MaaJson.Text(settings, "DefaultConfig", "Default"));
        if (selected.Length is < 1 or > 128 || selected.Any(character => character is '/' or '\\' or ':' || char.IsControl(character))) throw new MaaInputFailure("maa_mfa_config_invalid");
        var globalPath = selected == "Default" ? "config/config.json" : "config/mfa_" + selected + ".json";
        var resolved = selected;
        if (!sources.Contains(globalPath)) { globalPath = "config/config.json"; resolved = "Default"; }
        if (!separate && !selection.Path.Equals(globalPath, StringComparison.OrdinalIgnoreCase)) throw new MaaInputFailure("maa_mfa_profile_path_mismatch");
        var global = sources.Read(globalPath); var instance = separate ? sources.Read(selection.Path) : new JsonObject();
        JsonNode? Get(string key) => Inherit(instance, global, selection.InstanceId, key);
        var controller = Get("CurrentControllerName")?.GetValue<string>() ?? "";
        if (controller.Length == 0)
        {
            var type = Get("CurrentController")?.ToString() ?? "Adb"; type = type switch { "1" => "Win32", "2" => "Adb", _ => type };
            var matches = MaaJson.Objects(project.Declaration["controller"]).Where(item => MaaJson.Text(item, "type") == type).ToArray();
            controller = matches.Length == 1 ? MaaJson.Required(matches[0], "name") : throw new MaaInputFailure("maa_mfa_controller_ambiguous");
        }
        var resource = Get("Resource")?.GetValue<string>() ?? MaaJson.Required(MaaJson.Objects(project.Declaration["resource"]).First(), "name");
        MaaImportRules.Selection(project, controller, resource, rules);
        foreach (var key in new[] { "BeforeTask", "AfterTask" })
            if (Get(key) is { } action && action.GetValue<string>() != "None") rules.Block("maa_mfa_external_action_unsupported:" + key);
        foreach (var key in new[] { "Prescript", "Post-script" })
            if (Get(key) is { } script && !string.IsNullOrWhiteSpace(script.GetValue<string>())) rules.Block("maa_mfa_external_action_unsupported:" + key);
        if (Get("RetryOnDisconnectedWin32")?.GetValue<bool>() == true) rules.Block("maa_mfa_external_action_unsupported");
        var saved = MaaJson.Objects(Get("TaskItems")).Select(MaaJson.Clone).ToList();
        var savedCount = saved.Count;
        var history = MaaJson.Strings(Get("CurrentTasks")).Select(NormalizeHistory).ToHashSet(StringComparer.Ordinal);
        var preset = Get("InstancePresetKey")?.GetValue<string>() ?? "";
        HashSet<string>? presetTasks = preset.Length == 0 ? null : MaaJson.Objects(project.Select("preset", preset)["task"]).Select(item => MaaJson.Required(item, "name")).ToHashSet(StringComparer.Ordinal);
        foreach (var definition in project.Tasks)
        {
            var name = MaaJson.Required(definition, "name"); var entry = MaaJson.Required(definition, "entry");
            if (saved.Any(item => MaaJson.Text(item, "entry") == entry && (MaaJson.Text(item, "name") == name ||
                    project.Tasks.Count(task => MaaJson.Text(task, "entry") == entry) == 1)) ||
                history.Contains(name + "<|||>" + entry) || presetTasks is not null && !presetTasks.Contains(name)) continue;
            var added = MaaJson.Clone(definition); added.Remove("option"); saved.Add(added);
        }
        var tasks = saved.Select((item, index) => Row(item, index, selection.InstanceId, controller, resource,
            Origin(instance, global, selection, globalPath, index, savedCount))).ToArray();
        var connection = new JsonObject();
        foreach (var key in new[] { "AdbDevice", "Win32ClassName", "Win32WindowName", "AgentTcpMode", "SoftwarePath", "CurrentController" })
            if (Get(key) is { } value) connection[key] = value.DeepClone();
        return new(selection.Kind, selection.InstanceId, controller, resource, tasks, [], MaaSavedOptions.Mfa(Get("GlobalOptionItems"), project, controller, resource),
            MaaSavedOptions.Mfa(Get("ResourceOptionItems")?[resource], project, controller, resource), MaaSavedOptions.Mfa(Get("ControllerOptionItems")?[controller], project, controller, resource),
            connection, new() { ["instance"] = instance.DeepClone(), ["global"] = global.DeepClone(), ["settings"] = settings.DeepClone() }, sources.Proofs, sources.Fingerprint,
            separate ? "mfa-instance-2.16" : "mfa-flat") { Inheritance = new(globalPath, selected, resolved) };
    }
    private MaaTaskOccurrence Row(JsonObject item, int index, string instance, string controller, string resource, MaaRowOrigin origin)
    {
        var enabled = MaaJson.Boolean(item, "default_check"); var name = MaaJson.Required(item, "name"); var entry = MaaJson.Required(item, "entry");
        if (MaaWaitPolicy.Supports(entry))
        {
            var pipeline = MaaImportRules.Data(item["pipeline_override"]); _ = MaaWaitPolicy.Parameters(entry, pipeline);
            if (MaaJson.Objects(item["option"]).Length != 0 || (item["repeat_count"]?.GetValue<int>() ?? 1) != 1) throw new MaaInputFailure("maa_wait_options_unsupported");
            return new(MaaImportRules.Identity("mfa", instance, index.ToString(System.Globalization.CultureInfo.InvariantCulture)),
                index.ToString(System.Globalization.CultureInfo.InvariantCulture), name, entry, index, enabled, 1, new(), pipeline, "technical") { Origin = origin };
        }
        var definitions = project.Tasks.Where(task => MaaJson.Text(task, "entry") == entry).ToArray();
        var definition = definitions.Length == 1 ? definitions[0] : MaaImportRules.Definition(project, name, enabled, rules);
        var known = MaaImportRules.HasDefinition(project, definition);
        if (known && MaaJson.Text(definition, "entry") != entry && enabled) throw new MaaInputFailure("maa_mfa_entry_changed");
        if (MaaJson.Objects(item["advanced"]).Length > 0) rules.Block("maa_mfa_advanced_unmapped");
        return new(MaaImportRules.Identity("mfa", instance, index.ToString(System.Globalization.CultureInfo.InvariantCulture)), index.ToString(System.Globalization.CultureInfo.InvariantCulture),
            MaaJson.Required(definition, "name"), entry, index, enabled, MaaImportRules.Repeat(item, definition), MaaSavedOptions.Mfa(item["option"], project, controller, resource), MaaImportRules.Data(item["pipeline_override"]))
            { Origin = origin, DefinitionKnown = known };
    }
    private static MaaRowOrigin Origin(JsonObject instance, JsonObject global, MaaImportSelection selection, string globalPath, int index, int savedCount)
    {
        if (index >= savedCount) return new("default", null, null, null, null);
        var position = index.ToString(System.Globalization.CultureInfo.InvariantCulture);
        if (instance["TaskItems"] is not null) return new("local", selection.Path, "/TaskItems/" + position, "/instance/TaskItems/" + position, index);
        var key = new[] { "Instance." + selection.InstanceId + ".TaskItems", selection.InstanceId == "default" ? "" : "Instance.default.TaskItems", "TaskItems" }
            .First(name => name.Length > 0 && global[name] is not null);
        var pointer = "/" + MaaImportRules.Escape(key) + "/" + position;
        return new("inherited", globalPath, pointer, "/global" + pointer, index);
    }
    internal static JsonNode? Inherit(JsonObject instance, JsonObject global, string id, string key)
    {
        if (instance[key] is { } local) return local.DeepClone();
        foreach (var name in new[] { "Instance." + id + "." + key, id == "default" ? "" : "Instance.default." + key, key })
            if (name.Length > 0 && global[name] is { } value) return value.DeepClone();
        return null;
    }
    private static string NormalizeHistory(string key)
    { var split = key.IndexOf(':'); return key.Contains("<|||>", StringComparison.Ordinal) || split < 0 ? key : key[..split] + "<|||>" + key[(split + 1)..]; }
}
