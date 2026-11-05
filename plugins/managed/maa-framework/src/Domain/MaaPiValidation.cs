using System.Text.Json.Nodes;

namespace NexusPipeline.Extensions.MaaFramework;

internal static class MaaPiValidation
{
    internal static void Validate(JsonObject declaration)
    {
        var options = declaration["option"] as JsonObject ?? new();
        if (declaration["option"] is not null && declaration["option"] is not JsonObject) throw new MaaInputFailure("maa_option_shape");
        var controllers = MaaJson.Objects(declaration["controller"]); var resources = MaaJson.Objects(declaration["resource"]);
        if (controllers.Length == 0 || resources.Length == 0) throw new MaaInputFailure("maa_controller_resource_required");
        foreach (var controller in controllers)
            if (MaaJson.Required(controller, "type") is not ("Win32" or "Adb" or "PlayCover" or "MacOS" or "Linux" or "Gamepad"))
                throw new MaaInputFailure("maa_controller_type_unknown");
        foreach (var field in new[] { "task", "controller", "resource", "setting" })
            foreach (var item in MaaJson.Objects(declaration[field]))
            { References(item["option"], options); Constraints(item, controllers, resources); }
        foreach (var pretask in MaaJson.Objects(declaration["pretask"], true)) References(pretask["option"], options);
        References(declaration["global_option"], options);
        foreach (var (key, value) in options)
        {
            if (string.IsNullOrWhiteSpace(key)) throw new MaaInputFailure("maa_option_identity");
            var option = MaaJson.Object(value); var type = MaaJson.Text(option, "type", "select");
            if (type is not ("select" or "switch" or "checkbox" or "input" or "hotkey")) throw new MaaInputFailure("maa_option_type_unknown");
            Constraints(option, controllers, resources);
            var cases = MaaJson.Objects(option["cases"]);
            if (cases.Select(item => MaaJson.Required(item, "name")).Distinct(StringComparer.Ordinal).Count() != cases.Length)
                throw new MaaInputFailure("maa_option_case_ambiguous");
            foreach (var choice in cases) References(choice["option"], options);
            foreach (var input in MaaJson.Objects(option[type == "hotkey" ? "hotkeys" : "inputs"]))
                if (MaaJson.Boolean(input, "password") && MaaJson.Text(input, "default").Length != 0) throw new MaaInputFailure("maa_password_default_forbidden");
        }
        var heights = new Dictionary<string, int>(StringComparer.Ordinal);
        foreach (var key in options.Select(pair => pair.Key)) Visit(key, options, new(StringComparer.Ordinal), heights, 0);
        foreach (var task in MaaJson.Objects(declaration["task"])) _ = MaaJson.Required(task, "entry");
    }
    private static int Visit(string key, JsonObject options, HashSet<string> stack, Dictionary<string, int> heights, int depth)
    {
        if (depth > 32 || !stack.Add(key)) throw new MaaInputFailure("maa_option_cycle_or_depth");
        if (heights.TryGetValue(key, out var cached))
        { stack.Remove(key); return depth + cached <= 32 ? cached : throw new MaaInputFailure("maa_option_cycle_or_depth"); }
        var height = 0;
        foreach (var choice in MaaJson.Objects(MaaJson.Object(options[key])["cases"]))
            foreach (var child in MaaJson.Strings(choice["option"])) height = Math.Max(height, 1 + Visit(child, options, stack, heights, depth + 1));
        stack.Remove(key); heights[key] = height; return height;
    }
    private static void References(JsonNode? node, JsonObject options)
    { foreach (var name in MaaJson.Strings(node)) if (!options.ContainsKey(name)) throw new MaaInputFailure("maa_option_reference_missing:" + name); }
    private static void Constraints(JsonObject item, JsonObject[] controllers, JsonObject[] resources)
    {
        if (MaaJson.Strings(item["controller"]).Any(name => !controllers.Any(controller => MaaJson.Required(controller, "name") == name)) ||
            MaaJson.Strings(item["resource"]).Any(name => !resources.Any(resource => MaaJson.Required(resource, "name") == name)))
            throw new MaaInputFailure("maa_constraint_reference_missing");
    }
}
