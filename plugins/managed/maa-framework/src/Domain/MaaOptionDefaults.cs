using System.Text.Json.Nodes;

namespace NexusPipeline.Extensions.MaaFramework;

internal static class MaaOptionDefaults
{
    internal static JsonNode? Selection(JsonObject definition, string clientKind)
    {
        var type = MaaJson.Text(definition, "type", "select");
        if (type is "input" or "hotkey") return null;
        var cases = MaaJson.Objects(definition["cases"]);
        if (type == "checkbox") return definition["default_case"]?.DeepClone() ?? new JsonArray();
        var chosen = definition["default_case"]?.DeepClone();
        if (chosen is null || clientKind == "mfa" && !cases.Any(item => MaaJson.Required(item, "name") == chosen.GetValue<string>()))
            return JsonValue.Create(cases.Length == 0 ? "" : MaaJson.Required(cases[0], "name"));
        return chosen;
    }
}
