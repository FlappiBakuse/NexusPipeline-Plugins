using System.Text;
using System.Text.Json.Nodes;

namespace NexusPipeline.Extensions.MaaFramework;

internal static class MaaPipeline
{
    internal static void Apply(JsonObject destination, JsonNode? source, bool deep, bool protectedExpansion = false)
    {
        if (source is null) return;
        if (!protectedExpansion) MaaProtectedInput.RequireOrdinary(source);
        foreach (var (name, node) in MaaJson.Object(source))
        {
            var fields = MaaJson.Object(node);
            if (destination[name] is not JsonObject target) destination[name] = target = new();
            foreach (var (field, value) in fields)
                if (deep && target[field] is JsonObject previous && value is JsonObject next) Merge(previous, next);
                else target[field] = value?.DeepClone();
        }
    }
    private static void Merge(JsonObject target, JsonObject source)
    {
        foreach (var (key, value) in source)
            if (target[key] is JsonObject previous && value is JsonObject next) Merge(previous, next);
            else target[key] = value?.DeepClone();
    }
    internal static JsonNode? Expand(JsonNode? template, IReadOnlyDictionary<string, JsonNode> values)
    {
        if (template is JsonObject record) return new JsonObject(record.Select(pair => KeyValuePair.Create(pair.Key, Expand(pair.Value, values))));
        if (template is JsonArray array) return new JsonArray(array.Select(value => Expand(value, values)).ToArray());
        if (template is not JsonValue scalar || !scalar.TryGetValue<string>(out var text)) return template?.DeepClone();
        if (values.Any(pair => MaaProtectedInput.IsDeferred(pair.Value) && Contains(text, pair.Key)))
        {
            var used = new JsonObject();
            foreach (var (key, value) in values.Where(pair => Contains(text, pair.Key))) used[key] = value.DeepClone();
            foreach (var (key, value) in used)
                if (text == "{" + key + "}" || text == Suffix(key)) return value!.DeepClone();
            return new JsonObject { ["$maaExpansion"] = new JsonObject { ["text"] = text, ["values"] = used } };
        }
        var tokens = values.OrderByDescending(pair => pair.Key.Length)
            .SelectMany(pair => new[] { (Text: "{" + pair.Key + "}", Value: pair.Value), (Text: Suffix(pair.Key), Value: pair.Value) }).ToArray();
        foreach (var token in tokens)
            if (text == token.Text) return token.Value.DeepClone();
        var result = new StringBuilder();
        // Agent expressions and regular expressions own braces outside the declared inputs; inserted values are literal.
        for (var offset = 0; offset < text.Length;)
        {
            var token = tokens.FirstOrDefault(candidate => text.AsSpan(offset).StartsWith(candidate.Text, StringComparison.Ordinal));
            if (token.Text is null) { result.Append(text[offset++]); continue; }
            result.Append(token.Value is JsonValue field && field.TryGetValue<string>(out var literal) ? literal : token.Value.ToJsonString());
            offset += token.Text.Length;
        }
        return JsonValue.Create(result.ToString());
    }
    private static string Suffix(string key)
    {
        var dot = key.IndexOf('.');
        return dot < 0 ? "{" + key + "}" : "{" + key[..dot] + "}" + key[dot..];
    }
    private static bool Contains(string text, string key) => text.Contains("{" + key + "}", StringComparison.Ordinal) ||
        text.Contains(Suffix(key), StringComparison.Ordinal);
}
