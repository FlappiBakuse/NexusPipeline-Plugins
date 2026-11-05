using System.Text.Json.Nodes;

namespace NexusPipeline.Extensions.MaaFramework;

internal static class MaaPiMerge
{
    internal static void Apply(JsonObject target, JsonObject imported, string client)
    {
        var fields = client == "maapicli" ? new[] { "task", "preset", "group" } :
            client == "mfa" ? ["controller", "resource", "task", "preset", "group", "setting", "pretask", "global_option"] :
            ["task", "preset", "group", "setting", "pretask", "global_option"];
        foreach (var field in fields)
        {
            if (imported[field] is null) continue;
            var existing = List(target[field], field); var additions = List(imported[field], field);
            foreach (var addition in additions)
            {
                var index = field == "global_option" ? existing.ToList().FindIndex(prior => JsonNode.DeepEquals(prior, addition)) :
                    field is "group" || client == "mfa" && field is "controller" or "resource" or "task" or "preset" ?
                        existing.ToList().FindIndex(prior => MaaJson.Required(MaaJson.Object(prior), "name") == MaaJson.Required(MaaJson.Object(addition), "name")) : -1;
                if (index < 0) existing.Add(addition?.DeepClone());
                else if (client == "mfa" && field != "global_option")
                {
                    if (field == "task") Patch(MaaJson.Object(existing[index]), MaaJson.Object(addition), false);
                    else existing[index] = addition?.DeepClone();
                }
            }
            target[field] = existing;
        }
        if (imported["option"] is not null)
        {
            var options = MaaImportRules.Data(target["option"]);
            foreach (var (key, value) in MaaJson.Object(imported["option"]))
                if (client == "maapicli" && options.ContainsKey(key)) continue;
                else if (options[key] is JsonObject before && value is JsonObject after && client is "mfa" or "cfa")
                { if (client == "mfa") Patch(before, after, true); else Deep(before, after); }
                else options[key] = value?.DeepClone();
            target["option"] = options;
        }
    }
    private static JsonArray List(JsonNode? node, string field) => node is null ? new() : field == "pretask" && node is JsonObject single ?
        new(single.DeepClone()) : node is JsonArray array ? (JsonArray)array.DeepClone() : throw new MaaInputFailure("maa_declaration_shape:" + field);
    private static void Patch(JsonObject target, JsonObject source, bool option)
    {
        var strings = option ? new[] { "label", "description", "icon" } : ["label", "display_name_override", "remark", "entry", "description", "icon"];
        var nullable = option ? new[] { "cases", "inputs", "hotkeys", "pipeline_override", "controller", "resource" } :
            ["default_check", "resource", "controller", "group", "doc", "repeatable", "repeat_count", "advanced", "option", "pipeline_override"];
        foreach (var key in strings)
            if (source[key] is JsonValue text && text.TryGetValue<string>(out var value) && value.Length > 0) target[key] = value;
        foreach (var key in nullable) if (source[key] is not null) target[key] = source[key]!.DeepClone();
        if (option && source["default_case"] is { } selected && MaaJson.Strings(selected).Length > 0) target["default_case"] = selected.DeepClone();
    }
    private static void Deep(JsonObject target, JsonObject source)
    {
        foreach (var (key, value) in source)
            if (value is JsonObject next && target[key] is JsonObject previous) Deep(previous, next);
            else target[key] = value?.DeepClone();
    }
}
