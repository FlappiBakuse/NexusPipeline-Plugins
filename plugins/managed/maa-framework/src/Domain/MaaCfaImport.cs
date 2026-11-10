using System.Text.Json.Nodes;

namespace NexusPipeline.Extensions.MaaFramework;

internal sealed class MaaCfaImport(MaaSourceSet sources, MaaPiProject project, MaaCompilationPolicy? policy = null)
{
    private readonly MaaCompilationPolicy rules = policy ?? new();
    internal MaaImportedProfile Import(MaaImportSelection selection)
    {
        if (selection.Path != "config/configs/" + selection.InstanceId + ".json") throw new MaaInputFailure("maa_cfa_instance_path_mismatch");
        var main = sources.Read("config/multi_config.json");
        if (!MaaJson.Strings(main["config_list"]).Contains(selection.InstanceId, StringComparer.Ordinal)) throw new MaaInputFailure("maa_cfa_instance_removed");
        var source = sources.Read(selection.Path);
        if (MaaJson.Required(source, "item_id") != selection.InstanceId) throw new MaaInputFailure("maa_cfa_instance_mismatch");
        var bundle = MaaJson.Required(source, "bundle"); var declaration = MaaJson.Object(MaaJson.Object(main["bundle"])[bundle]);
        var bundlePath = MaaJson.Required(declaration, "path");
        while (bundlePath.StartsWith("./", StringComparison.Ordinal)) bundlePath = bundlePath[2..];
        bundlePath = bundlePath == "." ? "" : MaaSourceSet.Normalize(bundlePath);
        var directory = project.InterfacePath.Contains('/') ? project.InterfacePath[..project.InterfacePath.LastIndexOf('/')] : "";
        if (!directory.Equals(bundlePath, StringComparison.OrdinalIgnoreCase)) throw new MaaInputFailure("maa_cfa_bundle_selection_required");
        var rows = MaaJson.Objects(source["tasks"]); MaaImportRules.Unique(rows.Select(row => MaaJson.Required(row, "item_id")));
        JsonObject Base(string key) => MaaJson.Object(rows.SingleOrDefault(row => MaaJson.Required(row, "item_id") == key)?["task_option"]);
        var controller = Base("Controller"); var resource = Base("Resource");
        var name = controller["controller_type"] is JsonObject wrapper ? MaaJson.Required(wrapper, "value") : MaaJson.Required(controller, "controller_type");
        var resourceName = MaaJson.Required(resource, "resource"); MaaImportRules.Selection(project, name, resourceName, rules);
        if (MaaJson.Boolean(controller, "agent_embedded")) rules.Block("maa_cfa_embedded_agent_unsupported");
        var connection = MaaImportRules.Data(controller[name]); var type = MaaJson.Required(project.Select("controller", name), "type");
        if (controller["agent_embedded"] is not null) connection["agentEmbedded"] = MaaJson.Boolean(controller, "agent_embedded");
        if (type == "Adb" && (connection["input_methods"] is not null || connection["screencap_methods"] is not null))
            rules.Block("maa_cfa_adb_methods_unmapped");
        var tasks = new List<MaaTaskOccurrence>();
        for (var sourceIndex = 0; sourceIndex < rows.Length; sourceIndex++)
        {
            var row = rows[sourceIndex];
            var id = MaaJson.Required(row, "item_id"); var enabled = MaaJson.Boolean(row, "is_checked"); var options = MaaImportRules.Data(row["task_option"]);
            if (id is "Controller" or "Resource" or "Setting") continue;
            if (id is "PreTask" or "Post-Action")
            { if (enabled && options.Count > 0) rules.Block("maa_cfa_external_action_unsupported"); continue; }
            if (MaaJson.Text(row, "task_source", "resource") != "resource" || MaaJson.Text(row, "builtin_key").Length > 0)
                rules.Block("maa_cfa_builtin_action_unsupported");
            if (options["_speedrun_config"] is not null)
            { if (MaaJson.Boolean(MaaJson.Object(options["_speedrun_config"]), "enabled", true)) rules.Block("maa_cfa_schedule_unsupported"); options.Remove("_speedrun_config"); }
            var taskName = MaaJson.Required(row, "name"); var definition = MaaImportRules.Definition(project, taskName, enabled, rules);
            tasks.Add(new(MaaImportRules.Identity("cfa", selection.InstanceId, id), id, taskName, MaaJson.Text(definition, "entry"), tasks.Count,
                enabled, 1, Values(options), new()) { Origin = new("local", selection.Path, "/tasks/" + MaaImportRules.Position(sourceIndex), "/tasks/" + MaaImportRules.Position(sourceIndex), sourceIndex),
                    DefinitionKnown = MaaImportRules.HasDefinition(project, definition) });
        }
        var allowedController = MaaJson.Strings(project.Select("controller", name)["option"]);
        var savedController = controller["controller_options"] as JsonObject ?? new();
        var selectedController = new JsonObject(savedController.Where(pair => allowedController.Contains(pair.Key, StringComparer.Ordinal))
            .Select(pair => KeyValuePair.Create(pair.Key, pair.Value?.DeepClone())));
        return new(selection.Kind, selection.InstanceId, name, resourceName, tasks.ToArray(), [], Values(MaaImportRules.Data(resource["setting_options"])),
            Values(MaaImportRules.Data(resource["resource_options"])), Values(selectedController), connection, MaaJson.Clone(source), sources.Proofs, sources.Fingerprint);
    }
    private JsonObject Values(JsonObject saved)
    {
        var result = new JsonObject();
        void Add(string name, JsonNode? node, int depth)
        {
            if (depth > 32) throw new MaaInputFailure("maa_cfa_option_depth");
            if (node is JsonObject hidden && MaaJson.Boolean(hidden, "hidden")) return;
            var marker = name.IndexOf("_child_", StringComparison.Ordinal);
            if (marker >= 0)
            {
                var suffix = name[(marker + 7)..]; var first = suffix.IndexOf('_'); var last = suffix.LastIndexOf('_');
                if (first < 0 || last <= first) throw new MaaInputFailure("maa_cfa_child_identity_invalid"); name = suffix[(first + 1)..last];
            }
            var definition = project.Options[name] as JsonObject ?? throw new MaaInputFailure("maa_saved_option_unmapped:" + name);
            var value = node is JsonObject wrapper && wrapper.ContainsKey("value") ? wrapper["value"] : node;
            if (MaaJson.Text(definition, "type", "select") is "input" or "hotkey")
            {
                var text = MaaImportRules.Data(value);
                foreach (var pair in text.ToArray())
                    if (pair.Value is JsonValue scalar && !scalar.TryGetValue<string>(out _))
                        text[pair.Key] = scalar.TryGetValue<bool>(out var boolean) ? boolean ? "True" : "False" : scalar.ToJsonString();
                value = MaaSavedOptions.Inputs(definition, text);
            }
            if (result.ContainsKey(name) && !JsonNode.DeepEquals(result[name], value)) throw new MaaInputFailure("maa_cfa_option_conflict");
            result[name] = value?.DeepClone();
            if (node is not JsonObject payload) return;
            var branches = MaaImportRules.Data(payload["branches"]);
            foreach (var (key, child) in payload["children"] as JsonObject ?? new()) if (!branches.ContainsKey(key)) branches[key] = child?.DeepClone();
            foreach (var (key, child) in branches)
                if (child is JsonObject group && !new[] { "value", "hidden", "branches", "children" }.Any(group.ContainsKey))
                { foreach (var pair in group) Add(pair.Key, pair.Value, depth + 1); }
                else Add(key, child, depth + 1);
        }
        foreach (var (name, node) in saved) Add(name, node, 0); return result;
    }
}
