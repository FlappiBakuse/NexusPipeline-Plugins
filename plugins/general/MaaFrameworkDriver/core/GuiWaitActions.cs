using System.Text.Json.Nodes;

namespace NexusPipeline.Plugin.MaaFrameworkDriver;

public static class GuiWaitActions
{
    public static bool Supports(string name) => name is "TimedWaitAction" or "CountdownAction";

    public static JsonObject Validate(string name, JsonObject pipeline)
    {
        if (!Supports(name) || pipeline.Count != 1 || pipeline[name] is not JsonObject node
            || node.Count != 3 || node["action"]?.GetValue<string>() != "Custom"
            || node["custom_action"]?.GetValue<string>() != name || node["custom_action_param"] is not JsonObject parameters)
            throw new InvalidDataException("import.mfa.TaskItems.specialAction: unsupported pipeline shape");
        string[] keys = name == "CountdownAction" ? ["seconds"] : ["hour", "minute"];
        if (parameters.Count != keys.Length || parameters.Any(pair => !keys.Contains(pair.Key, StringComparer.Ordinal)))
            throw new InvalidDataException("import.mfa.TaskItems.specialAction: unsupported parameters");
        foreach (string key in keys)
            if (parameters[key] is not JsonValue value || !value.TryGetValue<int>(out int number)
                || number < 0 || number > (key == "seconds" ? 86400 : key == "hour" ? 23 : 59))
                throw new InvalidDataException("import.mfa.TaskItems.specialAction." + key + ": out of range");
        return parameters.DeepClone().AsObject();
    }

    public static TimeSpan Remaining(string name, JsonObject parameters, DateTime now)
    {
        if (name == "CountdownAction") return TimeSpan.FromSeconds(parameters["seconds"]!.GetValue<int>());
        if (name != "TimedWaitAction") throw new InvalidDataException("import.mfa.TaskItems.specialAction: unsupported action");
        DateTime target = now.Date.AddHours(parameters["hour"]!.GetValue<int>()).AddMinutes(parameters["minute"]!.GetValue<int>());
        if (target <= now) target = target.AddDays(1);
        return target - now;
    }
}
