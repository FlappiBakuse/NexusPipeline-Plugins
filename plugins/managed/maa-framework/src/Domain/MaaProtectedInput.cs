using System.Security.Cryptography;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text;

namespace NexusPipeline.Extensions.MaaFramework;

internal static class MaaProtectedInput
{
    internal static string Key(string scope, string option, string input) => "input-" +
        Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(scope + "\0" + option + "\0" + input)));

    internal static JsonObject Binding(string key) => new() { ["$maaSecret"] = RequireKey(key) };

    internal static string ReadBinding(JsonNode? node)
    {
        if (node is not JsonObject value || value.Count != 1 || value["$maaSecret"] is not JsonValue scalar ||
            !scalar.TryGetValue<string>(out var key)) throw new MaaInputFailure("maa_password_binding_required");
        return RequireKey(key);
    }

    internal static void RequireBinding(JsonNode? node, string scope, string option, string input)
    {
        if (ReadBinding(node) != Key(scope, option, input)) throw new MaaInputFailure("maa_password_binding_unbound");
    }

    internal static JsonObject Deferred(string key, JsonObject definition, string controller, string? part = null, bool raw = false) => new()
    {
        ["$maaProtected"] = new JsonObject
        {
            ["key"] = RequireKey(key), ["type"] = raw ? "string" : MaaJson.Text(definition, "pipeline_type", "string"),
            ["verify"] = MaaJson.Text(definition, "verify"), ["controller"] = controller, ["part"] = part
        }
    };

    internal static bool IsDeferred(JsonNode? node) => node is JsonObject value && value.Count == 1 && value.ContainsKey("$maaProtected");

    internal static void RequireOrdinary(JsonNode? node)
    {
        if (node is JsonObject record)
        {
            if (record.Any(pair => pair.Key is "$maaProtected" or "$maaExpansion" or "$maaSecret"))
                throw new MaaInputFailure("maa_protected_marker_reserved");
            foreach (var pair in record) RequireOrdinary(pair.Value);
        }
        else if (node is JsonArray array) foreach (var item in array) RequireOrdinary(item);
    }

    internal static string[] Keys(JsonNode? node)
    {
        var keys = new HashSet<string>(StringComparer.Ordinal);
        void Visit(JsonNode? item, int depth)
        {
            if (depth > 64) throw new MaaInputFailure("maa_protected_input_depth");
            if (IsDeferred(item))
            {
                keys.Add(RequireKey(MaaJson.Required(MaaJson.Object(item!["$maaProtected"]), "key")));
                return;
            }
            if (item is JsonObject record) foreach (var pair in record) Visit(pair.Value, depth + 1);
            else if (item is JsonArray array) foreach (var child in array) Visit(child, depth + 1);
        }
        Visit(node, 0);
        return keys.Order(StringComparer.Ordinal).ToArray();
    }

    private static string RequireKey(string key)
    {
        if (key.Length != 70 || !key.StartsWith("input-", StringComparison.Ordinal) || !key.AsSpan(6).ToArray().All(char.IsAsciiHexDigitLower))
            throw new MaaInputFailure("maa_password_binding_invalid");
        return key;
    }
}
