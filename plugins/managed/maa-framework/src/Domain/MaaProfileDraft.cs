using System.Text.Json.Nodes;

namespace NexusPipeline.Extensions.MaaFramework;

internal static class MaaProfileDraft
{
    internal static MaaImportedProfile Apply(MaaPiProject project, MaaImportedProfile saved, JsonObject draft, MaaCompilationPolicy policy)
    {
        Members(draft, "Controller", "Resource", "Tasks", "Pretasks", "GlobalOptions", "ResourceOptions", "ControllerOptions");
        var controller = Text(draft, "Controller", saved.Controller);
        var resource = Text(draft, "Resource", saved.Resource);
        MaaImportRules.Selection(project, controller, resource, policy);
        var tasks = Rows(project, saved.Tasks, draft, "Tasks", "business", policy);
        var pretasks = Rows(project, saved.Pretasks, draft, "Pretasks", "technical", policy);
        if (tasks.Length + pretasks.Length > 4096) throw new MaaInputFailure("maa_occurrence_budget");
        MaaImportRules.Unique(tasks.Select(row => row.Id).Concat(pretasks.Select(row => row.Id)));
        return saved with
        {
            Controller = controller, Resource = resource, Tasks = tasks, Pretasks = pretasks,
            GlobalOptions = Options(project, saved.GlobalOptions, draft, "GlobalOptions", policy),
            ResourceOptions = Options(project, saved.ResourceOptions, draft, "ResourceOptions", policy, "ResourceOptions/" + resource),
            ControllerOptions = Options(project, saved.ControllerOptions, draft, "ControllerOptions", policy, "ControllerOptions/" + controller)
        };
    }

    private static MaaTaskOccurrence[] Rows(MaaPiProject project, MaaTaskOccurrence[] saved, JsonObject draft, string key,
        string role, MaaCompilationPolicy policy)
    {
        if (!draft.TryGetPropertyValue(key, out var node)) return saved;
        if (node is not JsonArray items || items.Count > 4096) throw Invalid();
        var rows = new List<MaaTaskOccurrence>();
        for (var index = 0; index < items.Count; index++)
        {
            var item = MaaJson.Object(items[index]);
            Members(item, "Id", "SourceId", "Name", "Order", "Enabled", "RepeatCount", "Options", "Pipeline");
            var id = MaaJson.Required(item, "Id");
            if (!Guid.TryParseExact(id, "D", out var parsed) || parsed == Guid.Empty || parsed.ToString("D") != id) throw Invalid();
            var original = saved.SingleOrDefault(row => row.Id == id);
            var name = Text(item, "Name", original?.Name ?? "");
            if (name.Length is < 1 or > 512 || original is not null && original.Name != name) throw Invalid();
            var enabled = MaaJson.Boolean(item, "Enabled", original?.Enabled ?? true);
            var definition = role == "business" ? MaaImportRules.Definition(project, name, enabled, policy) :
                MaaJson.Objects(project.Declaration["pretask"], true).SingleOrDefault(row => "__MXU_PRETASK__" + MaaJson.Text(row, "name") == name)
                    ?? throw new MaaInputFailure("maa_pretask_unmapped");
            var sourceId = original?.SourceId ?? "nexus-profile:" + id;
            if (item.TryGetPropertyValue("SourceId", out var supplied) && supplied?.GetValue<string>() != sourceId) throw Invalid();
            var order = Integer(item, "Order", index, 0, 100000);
            var repeat = Integer(item, "RepeatCount", original?.RepeatCount ?? 1, 1, 100);
            if (repeat > 1 && !MaaJson.Boolean(definition, "repeatable")) throw new MaaInputFailure("maa_repeat_invalid");
            var options = original is null ? new JsonObject() : MaaJson.Clone(original.Options);
            options = Options(project, options, item, "Options", policy, id);
            var pipeline = item.TryGetPropertyValue("Pipeline", out var edits) ? MaaImportRules.Data(edits) :
                original is null ? new JsonObject() : MaaJson.Clone(original.Pipeline);
            var entry = original?.Entry ?? (role == "business" ? MaaJson.Text(definition, "entry") : "");
            rows.Add(new(id, sourceId, name, entry, order, enabled, repeat, options, pipeline, original?.Role ?? role)
                { Origin = original?.Origin, DefinitionKnown = role != "business" || MaaImportRules.HasDefinition(project, definition) });
        }
        MaaImportRules.Unique(rows.Select(row => row.Id));
        if (rows.Select(row => row.Order).Distinct().Count() != rows.Count) throw Invalid();
        return rows.OrderBy(row => row.Order).ToArray();
    }

    private static JsonObject Options(MaaPiProject project, JsonObject saved, JsonObject draft, string key, MaaCompilationPolicy policy, string? scope = null)
    {
        if (!draft.TryGetPropertyValue(key, out var node)) return MaaJson.Clone(saved);
        if (node is not JsonObject edits || edits.Count > 4096) throw Invalid();
        var definitions = MaaJson.Object(project.Declaration["option"] ?? new JsonObject());
        var result = MaaJson.Clone(saved);
        foreach (var (name, value) in edits)
        {
            if (definitions[name] is not JsonObject definition) throw new MaaInputFailure("maa_option_unknown:" + name);
            if (MaaJson.Text(definition, "type", "select") is "input" or "hotkey")
            {
                if (value is not JsonObject fields) throw Invalid();
                var merged = result[name] is JsonObject prior ? MaaJson.Clone(prior) : new JsonObject();
                var inputs = MaaJson.Objects(definition[MaaJson.Text(definition, "type") == "hotkey" ? "hotkeys" : "inputs"]);
                foreach (var (field, content) in fields)
                {
                    var input = inputs.SingleOrDefault(item => MaaJson.Text(item, "name") == field) ?? throw Invalid();
                    if (MaaJson.Boolean(input, "password") && !JsonNode.DeepEquals(merged[field], content))
                    {
                        var binding = MaaProtectedInput.ReadBinding(content);
                        if (binding != MaaProtectedInput.Key(project.CompilationFingerprint + "/" + (scope ?? key), name, field))
                            policy.Block("maa_password_binding_changed", "semantic");
                    }
                    merged[field] = content?.DeepClone();
                }
                result[name] = merged;
            }
            else result[name] = value?.DeepClone();
        }
        return result;
    }
    private static string Text(JsonObject value, string key, string fallback) => value.ContainsKey(key) ? MaaJson.Required(value, key) : fallback;
    private static int Integer(JsonObject value, string key, int fallback, int minimum, int maximum)
    {
        if (!value.TryGetPropertyValue(key, out var node)) return fallback;
        return node is JsonValue number && number.TryGetValue<int>(out var result) && result >= minimum && result <= maximum ? result : throw Invalid();
    }
    private static void Members(JsonObject value, params string[] names)
    {
        if (value.Any(pair => !names.Contains(pair.Key, StringComparer.Ordinal))) throw Invalid();
    }
    private static MaaInputFailure Invalid() => new("maa_profile_draft_invalid");
}
