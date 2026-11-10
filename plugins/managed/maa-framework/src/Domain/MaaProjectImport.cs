using System.Text.Json.Nodes;

namespace NexusPipeline.Extensions.MaaFramework;

internal sealed class MaaProjectImport(MaaSourceSet sources, MaaPiProject project, MaaCompilationPolicy? policy = null)
{
    private readonly MaaCompilationPolicy rules = policy ?? new();
    internal MaaImportedProfile Import(MaaImportSelection selection)
        => new MaaProjectImport(sources.Fork(), project, rules).ImportCore(selection);
    private MaaImportedProfile ImportCore(MaaImportSelection selection)
    {
        MaaImportRules.Instance(selection.InstanceId); _ = MaaSourceSet.Normalize(selection.Path);
        var profile = selection.Kind switch {
            "mxu" => Mxu(selection), "maapicli" => Cli(selection),
            "mfa" => new MaaMfaImport(sources, project, rules).Import(selection),
            "cfa" => new MaaCfaImport(sources, project, rules).Import(selection),
            _ => throw new MaaInputFailure("maa_source_kind_unsupported") };
        if (profile.Tasks.Length + profile.Pretasks.Length > 4096) throw new MaaInputFailure("maa_occurrence_budget");
        MaaImportRules.Unique(profile.Tasks.Concat(profile.Pretasks).Select(task => task.Id));
        var proofs = project.Sources.Concat(profile.Sources).GroupBy(proof => proof.Path, StringComparer.OrdinalIgnoreCase).Select(group => {
            if (group.Select(proof => (proof.Sha256, proof.Identity)).Distinct().Count() != 1) throw new MaaInputFailure("maa_import_source_changed");
            return group.First();
        }).OrderBy(proof => proof.Path, StringComparer.Ordinal).ToArray();
        return profile with { PiFingerprint = project.CompilationFingerprint, Sources = proofs, SourceFingerprint = MaaSourceSet.Hash(proofs) };
    }
    private MaaImportedProfile Mxu(MaaImportSelection selection)
    {
        var source = sources.Read(selection.Path);
        if (MaaJson.Required(source, "version") != "1.0") throw new MaaInputFailure("maa_mxu_schema_unsupported");
        var matches = MaaJson.Objects(source["instances"]).Where(item => MaaJson.Required(item, "id") == selection.InstanceId).ToArray();
        if (matches.Length != 1) throw new MaaInputFailure("maa_explicit_instance_required");
        var instance = matches[0]; var controller = MaaJson.Required(instance, "controllerName"); var resource = MaaJson.Required(instance, "resourceName");
        var instanceIndex = Array.IndexOf(MaaJson.Objects(source["instances"]), instance);
        MaaImportRules.Selection(project, controller, resource, rules);
        var tasks = new List<MaaTaskOccurrence>(); var pretasks = new List<MaaTaskOccurrence>();
        var savedRows = MaaJson.Objects(instance["tasks"]);
        for (var sourceIndex = 0; sourceIndex < savedRows.Length; sourceIndex++)
        {
            var saved = savedRows[sourceIndex];
            var name = MaaJson.Required(saved, "taskName"); var enabled = MaaJson.Boolean(saved, "enabled"); var id = MaaJson.Required(saved, "id");
            if (saved["enabledByController"] is JsonObject cache && cache[controller] is not null && cache[controller]!.GetValue<bool>() != enabled)
                throw new MaaInputFailure("maa_mxu_enabled_cache_conflict");
            var isPretask = name.StartsWith("__MXU_PRETASK__", StringComparison.Ordinal);
            var definition = isPretask ? MaaJson.Objects(project.Declaration["pretask"], true).SingleOrDefault(item => "__MXU_PRETASK__" + MaaJson.Required(item, "name") == name)
                ?? throw new MaaInputFailure("maa_pretask_unmapped") : MaaImportRules.Definition(project, name, enabled, rules);
            var known = isPretask || MaaImportRules.HasDefinition(project, definition);
            var pointer = "/instances/" + MaaImportRules.Position(instanceIndex) + "/tasks/" + MaaImportRules.Position(sourceIndex);
            var row = new MaaTaskOccurrence(MaaImportRules.Identity("mxu", selection.InstanceId, id), id, name,
                isPretask ? "" : MaaJson.Text(definition, "entry"), isPretask ? pretasks.Count : tasks.Count, enabled, 1,
                MxuOptions(saved["optionValues"], enabled || known), new(), isPretask ? "technical" : "business")
                { Origin = new("local", selection.Path, pointer, pointer, sourceIndex), DefinitionKnown = known };
            (isPretask ? pretasks : tasks).Add(row);
        }
        MaaImportRules.Unique(tasks.Concat(pretasks).Select(task => task.SourceId));
        var connection = MaaImportRules.Data(instance["savedDevice"]);
        var actions = instance["preActions"] is not null ? MaaJson.Objects(instance["preActions"]) : MaaJson.Objects(instance["preAction"], true);
        var active = actions.Where(action => MaaJson.Boolean(action, "enabled")).ToArray();
        if (active.Length > 0)
        {
            if (active.Length != 1 || MaaJson.Boolean(active[0], "useCmd") || MaaJson.Boolean(active[0], "waitForExit") ||
                !MaaJson.Boolean(active[0], "skipIfRunning") || MaaJson.Required(project.Select("controller", controller), "type") != "Win32")
                rules.Block("maa_mxu_external_action_unsupported");
            var program = MaaJson.Required(active[0], "program");
            if (!Path.IsPathFullyQualified(program) || !program.EndsWith(".exe", StringComparison.OrdinalIgnoreCase)) throw new MaaInputFailure("maa_launch_executable_identity_required");
            if (rules.Diagnostics.Length == 0) connection["hostLaunch"] = new JsonObject { ["executable"] = program, ["arguments"] = MaaJson.Text(active[0], "args"), ["skipIfRunning"] = true };
        }
        return Profile(selection, source, controller, resource, tasks.ToArray(), pretasks.ToArray(), MxuOptions(source["globalOptionValues"]), new(), new(), connection);
    }
    private MaaImportedProfile Cli(MaaImportSelection selection)
    {
        var source = sources.Read(selection.Path); var controller = MaaJson.Required(MaaJson.Object(source["controller"]), "name");
        var resource = MaaJson.Required(source, "resource"); MaaImportRules.Selection(project, controller, resource, rules);
        var tasks = MaaJson.Objects(source["task"]).Select((saved, index) => {
            var name = MaaJson.Required(saved, "name"); var definition = MaaImportRules.Definition(project, name, true, rules);
            return new MaaTaskOccurrence(MaaImportRules.Identity("maapicli", selection.InstanceId, index.ToString(System.Globalization.CultureInfo.InvariantCulture)),
                index.ToString(System.Globalization.CultureInfo.InvariantCulture), name, MaaJson.Text(definition, "entry"), index, true, 1, CliOptions(saved["option"]), new())
                { Origin = new("local", selection.Path, "/task/" + MaaImportRules.Position(index), "/task/" + MaaImportRules.Position(index), index), DefinitionKnown = MaaImportRules.HasDefinition(project, definition) };
        }).ToArray();
        var connection = new JsonObject();
        foreach (var field in new[] { "adb", "win32" }) if (source[field] is not null) connection[field] = source[field]!.DeepClone();
        return Profile(selection, source, controller, resource, tasks, [], CliOptions(source["global_option"]), CliOptions(source["resource_option"]), CliOptions(source["controller_option"]), connection);
    }
    private JsonObject MxuOptions(JsonNode? source, bool relevant = true)
    {
        var result = new JsonObject();
        foreach (var (key, node) in source is null ? new JsonObject() : MaaJson.Object(source))
        {
            var item = MaaJson.Object(node);
            if (item["encryptedValues"] is JsonObject encrypted && encrypted.Count > 0) throw new MaaInputFailure("maa_password_reentry_required");
            if (!project.Options.ContainsKey(key)) { if (relevant) rules.Block("maa_saved_option_unmapped:" + key); continue; }
            var definition = MaaJson.Object(project.Options[key]); var type = MaaJson.Text(definition, "type", "select");
            if (MaaJson.Required(item, "type") != type) throw new MaaInputFailure("maa_mxu_option_type_mismatch");
            result[key] = type is "input" or "hotkey" ? MaaSavedOptions.Inputs(definition, item["values"]) : type == "switch" ? MaaSavedOptions.Switch(definition, MaaJson.Boolean(item, "value")) :
                (type == "checkbox" ? item["caseNames"] : item["caseName"])?.DeepClone() ?? throw new MaaInputFailure("maa_mxu_option_value_missing");
        }
        return result;
    }
    private JsonObject CliOptions(JsonNode? source)
    {
        var result = new JsonObject();
        foreach (var item in MaaJson.Objects(source))
        {
            var name = MaaJson.Required(item, "name"); if (!project.Options.ContainsKey(name) || result.ContainsKey(name)) throw new MaaInputFailure("maa_saved_option_unmapped:" + name);
            var type = MaaJson.Text(MaaJson.Object(project.Options[name]), "type", "select");
            result[name] = type is "input" or "hotkey" ? MaaSavedOptions.Inputs(MaaJson.Object(project.Options[name]), item["inputs"]) :
                type == "checkbox" ? item["values"]?.DeepClone() ?? new JsonArray() : item["value"]?.DeepClone() ?? throw new MaaInputFailure("maa_cli_option_value_missing");
        }
        return result;
    }
    internal MaaImportedProfile Profile(MaaImportSelection selection, JsonObject source, string controller, string resource, MaaTaskOccurrence[] tasks,
        MaaTaskOccurrence[] pretasks, JsonObject global, JsonObject resourceOptions, JsonObject controlOptions, JsonObject connection) =>
        new(selection.Kind, selection.InstanceId, controller, resource, tasks, pretasks, global, resourceOptions, controlOptions, connection,
            MaaJson.Clone(source), sources.Proofs, sources.Fingerprint);
}
