using System.Text.Json.Nodes;

namespace NexusPipeline.Extensions.MaaFramework;

internal static class MaaSavedOptions
{
    internal static JsonObject Inputs(JsonObject definition, JsonNode? values)
    {
        var source = values is null ? new JsonObject() : MaaJson.Object(values); var result = new JsonObject();
        var fields = MaaJson.Objects(definition[MaaJson.Text(definition, "type") == "hotkey" ? "hotkeys" : "inputs"]);
        var names = fields.Select(field => MaaJson.Required(field, "name")).ToArray();
        if (source.Any(pair => !names.Contains(pair.Key, StringComparer.Ordinal))) throw new MaaInputFailure("maa_saved_input_unmapped");
        foreach (var field in fields)
        {
            var name = MaaJson.Required(field, "name"); if (source[name] is null) continue;
            var text = source[name]!.GetValue<string>();
            if (MaaJson.Boolean(field, "password"))
            { if (text.Length > 0) throw new MaaInputFailure("maa_password_reentry_required"); continue; }
            result[name] = text;
        }
        return result;
    }
    internal static JsonNode Switch(JsonObject definition, bool enabled)
    {
        var accepted = enabled ? new[] { "Yes", "yes", "Y", "y", "True", "true" } : ["No", "no", "N", "n", "False", "false"];
        var names = MaaJson.Objects(definition["cases"]).Select(choice => MaaJson.Required(choice, "name")).Where(name => accepted.Contains(name, StringComparer.Ordinal)).ToArray();
        return names.Length == 1 ? JsonValue.Create(names[0])! : throw new MaaInputFailure("maa_switch_case_ambiguous");
    }
    internal static JsonObject Mfa(JsonNode? node, MaaPiProject project, string controller, string resource)
    {
        var result = new JsonObject();
        void Read(IEnumerable<JsonObject> source, int depth)
        {
            if (depth > 32) throw new MaaInputFailure("maa_saved_option_depth");
            foreach (var item in source)
            {
                var name = MaaJson.Required(item, "name"); var definition = project.Options[name] as JsonObject ?? throw new MaaInputFailure("maa_saved_option_unmapped:" + name);
                if (result.ContainsKey(name)) continue;
                var controllers = MaaJson.Strings(definition["controller"]); var resources = MaaJson.Strings(definition["resource"]);
                if (controllers.Length > 0 && !controllers.Contains(controller, StringComparer.Ordinal) ||
                    resources.Length > 0 && !resources.Contains(resource, StringComparer.Ordinal)) continue;
                var type = MaaJson.Text(definition, "type", "select");
                if (type is "input" or "hotkey") result[name] = Inputs(definition, item["data"]);
                else if (type == "checkbox") result[name] = item["selected_cases"]?.DeepClone() ?? new JsonArray();
                else
                {
                    var cases = MaaJson.Objects(definition["cases"]); var index = item["index"]?.GetValue<int>() ?? -1;
                    if (index == -1) index = Array.FindIndex(cases, choice => MaaJson.Text(choice, "name") == MaaJson.Text(definition, "default_case"));
                    if (index == -1) index = 0;
                    if (index < 0 || index >= cases.Length) throw new MaaInputFailure("maa_saved_case_index");
                    result[name] = MaaJson.Required(cases[index], "name");
                }
                if (type is "input" or "hotkey") continue;
                var selected = type == "checkbox" ? MaaJson.Strings(result[name]) : [result[name]!.GetValue<string>()];
                foreach (var choice in MaaJson.Objects(definition["cases"]).Where(choice => selected.Contains(MaaJson.Required(choice, "name"), StringComparer.Ordinal)))
                {
                    var children = MaaJson.Strings(choice["option"]);
                    Read(MaaJson.Objects(item["sub_options"]).Where(child => children.Contains(MaaJson.Required(child, "name"), StringComparer.Ordinal)), depth + 1);
                }
            }
        }
        Read(MaaJson.Objects(node), 0); return result;
    }
}
