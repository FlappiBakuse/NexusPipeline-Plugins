using System.Text.Json.Nodes;

namespace NexusPipeline.Extensions.MaaFramework;

internal static class MaaWaitPolicy
{
    internal static bool Supports(string entry) => entry is "CountdownAction" or "TimedWaitAction";
    internal static DateTime Target(JsonObject parameters, DateTime now)
    {
        var target = now.Date.AddHours(parameters["hour"]!.GetValue<int>()).AddMinutes(parameters["minute"]!.GetValue<int>());
        return target <= now ? target.AddDays(1) : target;
    }
    internal static JsonObject Parameters(string entry, JsonObject pipeline)
    {
        if (!Supports(entry) || pipeline.Count != 1 || pipeline[entry] is not JsonObject node || node.Count != 3 ||
            MaaJson.Text(node, "action") != "Custom" || MaaJson.Text(node, "custom_action") != entry)
            throw new MaaInputFailure("maa_wait_shape_unsupported");
        var parameters = MaaJson.Object(node["custom_action_param"]); var keys = entry == "CountdownAction" ? new[] { "seconds" } : ["hour", "minute"];
        if (parameters.Count != keys.Length || parameters.Any(pair => !keys.Contains(pair.Key, StringComparer.Ordinal))) throw new MaaInputFailure("maa_wait_parameters_unsupported");
        foreach (var key in keys)
            if (parameters[key] is not JsonValue value || !value.TryGetValue<int>(out var number) || number < 0 ||
                number > (key == "seconds" ? 86400 : key == "hour" ? 23 : 59)) throw new MaaInputFailure("maa_wait_value_invalid");
        return MaaJson.Clone(parameters);
    }
}
