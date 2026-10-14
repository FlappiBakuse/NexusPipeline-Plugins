using System.Globalization;
using System.Text.Json.Nodes;

namespace NexusPipeline.Plugin.MaaFrameworkDriver;

public static class ControllerConfiguration
{
    private static readonly string[] Inputs = ["Seize", "SendMessage", "PostMessage", "LegacyEvent", "PostThreadMessage",
        "SendMessageWithCursorPos", "PostMessageWithCursorPos", "SendMessageWithWindowPos", "PostMessageWithWindowPos"];
    private static readonly string[] Captures = ["GDI", "FramePool", "DXGI_DesktopDup", "DXGI_DesktopDup_Window", "PrintWindow", "ScreenDC"];

    public static string Normalize(string field, JsonNode value)
    {
        string text = value is JsonValue scalar && scalar.TryGetValue<string>(out var saved) ? saved : value.ToJsonString();
        bool capture = field == "screencap";
        if (!capture && field is not ("mouse" or "keyboard")) throw Error(field);
        string[] names = capture ? Captures : Inputs;
        if (capture && text == "All") return "All";
        if (capture && text == "Foreground") return "DXGI_DesktopDup_Window, ScreenDC";
        if (capture && text == "Background") return "FramePool, PrintWindow";
        if (ulong.TryParse(text, NumberStyles.None, CultureInfo.InvariantCulture, out ulong bits))
        {
            if (capture && bits == ulong.MaxValue) return "All";
            if (bits == 0 || bits >= (1UL << names.Length) || !capture && (bits & (bits - 1)) != 0) throw Error(field);
            return string.Join(", ", names.Where((_, index) => (bits & (1UL << index)) != 0));
        }
        string[] selected = text.Split(',', StringSplitOptions.TrimEntries);
        if (selected.Length == 0 || !capture && selected.Length != 1
            || selected.Distinct(StringComparer.Ordinal).Count() != selected.Length
            || selected.Any(name => !names.Contains(name, StringComparer.Ordinal))) throw Error(field);
        return string.Join(", ", names.Where(selected.Contains));
    }

    public static JsonObject Apply(JsonObject definition, JsonObject configuration)
    {
        var controller = definition.DeepClone().AsObject();
        if (controller["type"]?.GetValue<string>() != "Win32")
        {
            if (configuration.Count != 0) throw Error("type");
            return controller;
        }
        var win = controller["win32"]?.AsObject() ?? new JsonObject();
        foreach (var pair in configuration) win[pair.Key] = Normalize(pair.Key, pair.Value ?? throw Error(pair.Key));
        foreach (string field in new[] { "screencap", "mouse", "keyboard" })
            if (win[field] is { } value) win[field] = Normalize(field, value);
        if (controller["win32"] is null) controller["win32"] = win;
        return controller;
    }

    private static InvalidDataException Error(string field) => new("controllerConfiguration." + field + ": unsupported Win32 method");
}
