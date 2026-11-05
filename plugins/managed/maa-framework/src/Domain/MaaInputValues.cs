using System.Globalization;
using System.Text.Json.Nodes;

namespace NexusPipeline.Extensions.MaaFramework;

internal static class MaaInputValues
{
    internal static Dictionary<string, JsonNode> Read(JsonObject option, JsonObject supplied, string controller, bool raw = false)
    {
        var hotkey = MaaJson.Text(option, "type") == "hotkey"; var definitions = MaaJson.Objects(option[hotkey ? "hotkeys" : "inputs"]);
        if (supplied.Any(pair => !definitions.Any(field => MaaJson.Required(field, "name") == pair.Key))) throw new MaaInputFailure("maa_saved_input_unmapped");
        var result = new Dictionary<string, JsonNode>(StringComparer.Ordinal);
        foreach (var field in definitions)
        {
            var name = MaaJson.Required(field, "name");
            if (MaaJson.Boolean(field, "password"))
            {
                if (MaaJson.Text(field, "default").Length > 0) throw new MaaInputFailure("maa_password_reentry_required");
                if (supplied[name] is null) throw new MaaBusinessFailure("maa_password_binding_required");
                var key = MaaProtectedInput.ReadBinding(supplied[name]);
                if (MaaJson.Text(field, "pipeline_type", "string") is not ("string" or "int" or "bool"))
                    throw new MaaInputFailure("maa_input_conversion_failed");
                MaaInputPattern.Declare(MaaJson.Text(field, "verify"));
                result.Add(name, MaaProtectedInput.Deferred(key, field, controller, hotkey ? raw ? "raw-hotkey" : "primary" : null, raw));
                if (hotkey && !raw)
                {
                    result.Add(name + ".primary", MaaProtectedInput.Deferred(key, field, controller, "primary"));
                    for (var index = 1; index <= 4; index++) result.Add(name + ".modifier" + index,
                        MaaProtectedInput.Deferred(key, field, controller, "modifier" + index));
                }
                continue;
            }
            var text = supplied[name]?.GetValue<string>() ?? MaaJson.Text(field, "default");
            if (text.Length > 4096) throw new MaaInputFailure("maa_input_too_large");
            Verify(text, MaaJson.Text(field, "verify"));
            if (raw)
            {
                if (hotkey) _ = KeyCodes(text, controller);
                result.Add(name, JsonValue.Create(text)!); continue;
            }
            if (!hotkey) result.Add(name, Convert(text, MaaJson.Text(field, "pipeline_type", "string")));
            else
            {
                var codes = KeyCodes(text, controller); result.Add(name, JsonValue.Create(codes[^1])!); result.Add(name + ".primary", JsonValue.Create(codes[^1])!);
                for (var index = 0; index < codes.Length - 1; index++) result.Add(name + ".modifier" + (index + 1), JsonValue.Create(codes[index])!);
            }
        }
        return result;
    }
    internal static JsonNode Convert(string text, string type) => type switch {
        "string" => JsonValue.Create(text)!, "int" when long.TryParse(text, NumberStyles.Integer, CultureInfo.InvariantCulture, out var number) => JsonValue.Create(number)!,
        "bool" when bool.TryParse(text, out var boolean) => JsonValue.Create(boolean)!, _ => throw new MaaInputFailure("maa_input_conversion_failed") };
    internal static void Verify(string text, string expression) => MaaInputPattern.Verify(text, expression);
    internal static int[] KeyCodes(string text, string controller)
    {
        var keys = text.Split('+', StringSplitOptions.TrimEntries); var windows = controller == "Win32";
        if (keys.Length is < 1 or > 5 || keys.Distinct(StringComparer.OrdinalIgnoreCase).Count() != keys.Length ||
            keys.Take(keys.Length - 1).Any(key => key.ToUpperInvariant() is not ("CTRL" or "SHIFT" or "ALT" or "WIN"))) throw new MaaInputFailure("maa_hotkey_invalid");
        return keys.Select(key => {
            var name = key.ToUpperInvariant();
            if (name.Length == 1 && char.IsAsciiLetter(name[0])) return windows ? name[0] : name[0] - 'A' + 29;
            if (name.Length == 1 && char.IsAsciiDigit(name[0])) return windows ? name[0] : name[0] - '0' + 7;
            if (name.StartsWith('F') && int.TryParse(name[1..], out var number) && number is >= 1 and <= 12) return windows ? 111 + number : 130 + number;
            return (name, windows) switch { ("CTRL", true) => 17, ("CTRL", false) => 113, ("SHIFT", true) => 16, ("SHIFT", false) => 59,
                ("ALT", true) => 18, ("ALT", false) => 57, ("WIN", true) => 91, ("ENTER", true) => 13, ("ENTER", false) => 66,
                ("SPACE", true) => 32, ("SPACE", false) => 62, ("ESC", true) => 27, ("ESC", false) => 111, _ => throw new MaaInputFailure("maa_hotkey_key_unsupported") };
        }).ToArray();
    }
}
