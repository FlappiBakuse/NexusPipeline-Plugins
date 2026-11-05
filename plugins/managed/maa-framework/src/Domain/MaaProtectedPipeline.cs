using System.Text.Json.Nodes;

namespace NexusPipeline.Extensions.MaaFramework;

internal static class MaaProtectedPipeline
{
    internal static JsonObject Resolve(JsonObject pipeline, Func<string, string> read)
        => MaaJson.Object(Visit(pipeline, read, 0));

    private static JsonNode? Visit(JsonNode? node, Func<string, string> read, int depth)
    {
        if (depth > 64) throw new MaaInputFailure("maa_protected_input_depth");
        if (MaaProtectedInput.IsDeferred(node))
        {
            var value = MaaJson.Object(node!["$maaProtected"]);
            if (value.Count != 5) throw Invalid();
            var text = read(MaaJson.Required(value, "key"));
            if (text.Length > 4096) throw new MaaInputFailure("maa_input_too_large");
            MaaInputValues.Verify(text, MaaJson.Text(value, "verify"));
            if (value["part"] is null) return MaaInputValues.Convert(text, MaaJson.Required(value, "type"));
            var codes = MaaInputValues.KeyCodes(text, MaaJson.Required(value, "controller"));
            var part = MaaJson.Required(value, "part");
            if (part == "raw-hotkey") return JsonValue.Create(text);
            if (part == "primary") return JsonValue.Create(codes[^1]);
            if (part.Length == 9 && part.StartsWith("modifier", StringComparison.Ordinal) && part[8] is >= '1' and <= '4' && part[8] - '0' < codes.Length)
                return JsonValue.Create(codes[part[8] - '1']);
            throw new MaaInputFailure("maa_hotkey_modifier_missing");
        }
        if (node is JsonObject expression && expression.Count == 1 && expression["$maaExpansion"] is JsonObject expansion)
        {
            if (expansion.Count != 2) throw Invalid();
            var values = MaaJson.Object(expansion["values"]).ToDictionary(pair => pair.Key,
                pair => Visit(pair.Value, read, depth + 1) ?? throw Invalid(), StringComparer.Ordinal);
            return MaaPipeline.Expand(JsonValue.Create(MaaJson.Text(expansion, "text")), values);
        }
        if (node is JsonObject record) return new JsonObject(record.Select(pair => KeyValuePair.Create(pair.Key, Visit(pair.Value, read, depth + 1))));
        if (node is JsonArray array) return new JsonArray(array.Select(item => Visit(item, read, depth + 1)).ToArray());
        return node?.DeepClone();
    }

    private static MaaInputFailure Invalid() => new("maa_protected_pipeline_invalid");
}
