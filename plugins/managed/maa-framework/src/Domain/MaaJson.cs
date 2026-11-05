using System.Text.Json;
using System.Text.Json.Nodes;

namespace NexusPipeline.Extensions.MaaFramework;

internal class MaaInputFailure(string code) : Exception(code)
{ internal string Code { get; } = code; }
internal static class MaaJson
{
    internal static JsonObject Read(ReadOnlyMemory<byte> bytes)
    {
        if (bytes.Span.StartsWith(new byte[] { 239, 187, 191 })) bytes = bytes[3..];
        var options = new JsonDocumentOptions { CommentHandling = JsonCommentHandling.Skip, AllowTrailingCommas = true, MaxDepth = 64 };
        using var document = JsonDocument.Parse(bytes, options);
        Unique(document.RootElement);
        return JsonNode.Parse(document.RootElement.GetRawText(), documentOptions: options) as JsonObject ?? throw new MaaInputFailure("maa_object_required");
    }
    internal static void Unique(JsonElement value)
    {
        if (value.ValueKind == JsonValueKind.Object)
        {
            var names = new HashSet<string>(StringComparer.Ordinal);
            foreach (var property in value.EnumerateObject())
            { if (!names.Add(property.Name)) throw new MaaInputFailure("maa_duplicate_field"); Unique(property.Value); }
        }
        else if (value.ValueKind == JsonValueKind.Array) foreach (var item in value.EnumerateArray()) Unique(item);
    }
    internal static string Text(JsonObject value, string key, string fallback = "") => value[key] is null ? fallback :
        value[key] is JsonValue scalar && scalar.TryGetValue<string>(out var text) ? text : throw new MaaInputFailure("maa_string_required:" + key);
    internal static string Required(JsonObject value, string key)
    { var result = Text(value, key); return result.Length is > 0 and <= 4096 && !string.IsNullOrWhiteSpace(result) && !result.Any(char.IsControl) ? result : throw new MaaInputFailure("maa_identity_required:" + key); }
    internal static JsonObject Object(JsonNode? node) => node as JsonObject ?? throw new MaaInputFailure("maa_object_required");
    internal static JsonObject[] Objects(JsonNode? node, bool singleton = false) => node is null ? [] : singleton && node is JsonObject single ? [single] :
        node is JsonArray array ? array.Select(Object).ToArray() : throw new MaaInputFailure("maa_array_required");
    internal static string[] Strings(JsonNode? node) => node is null ? [] : node is JsonValue scalar && scalar.TryGetValue<string>(out var text) ? [text] :
        node is JsonArray array ? array.Select(item => item is JsonValue value && value.TryGetValue<string>(out var name) ? name : throw new MaaInputFailure("maa_string_array_required")).ToArray() :
        throw new MaaInputFailure("maa_string_array_required");
    internal static bool Boolean(JsonObject value, string key, bool fallback = false) => value[key] is null ? fallback :
        value[key] is JsonValue scalar && scalar.TryGetValue<bool>(out var boolean) ? boolean : throw new MaaInputFailure("maa_boolean_required:" + key);
    internal static JsonObject Clone(JsonObject value) => (JsonObject)value.DeepClone();
}
