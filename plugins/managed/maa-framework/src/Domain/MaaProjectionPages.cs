using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace NexusPipeline.Extensions.MaaFramework;

internal sealed class MaaProjectionPages
{
    internal const int MaximumPageBytes = 65536;
    internal readonly Dictionary<string, byte[]> Contents = new(StringComparer.Ordinal);
    internal JsonObject Encode(JsonNode? value, int depth = 0)
    {
        if (depth > 64) throw new MaaInputFailure("maa_projection_depth");
        var bytes = JsonSerializer.SerializeToUtf8Bytes(value);
        if (bytes.Length <= 8192) return new() { ["kind"] = "inline", ["value"] = value?.DeepClone() };
        if (value is JsonObject obj)
            return Container("object", obj.Select(pair => (JsonNode)new JsonObject { ["name"] = pair.Key, ["node"] = Encode(pair.Value, depth + 1) }));
        if (value is JsonArray array) return Container("array", array.Select(item => (JsonNode)Encode(item, depth + 1)));
        if (value is JsonValue scalar && scalar.TryGetValue<string>(out var text))
        {
            var pieces = new List<JsonNode>(); var current = new StringBuilder();
            foreach (var rune in text.EnumerateRunes())
            { current.Append(rune.ToString()); if (current.Length >= 1024) { pieces.Add(JsonValue.Create(current.ToString())!); current.Clear(); } }
            if (current.Length > 0) pieces.Add(JsonValue.Create(current.ToString())!);
            return Container("string", pieces);
        }
        throw new MaaInputFailure("maa_projection_scalar_budget");
    }
    private JsonObject Container(string kind, IEnumerable<JsonNode> values)
    {
        var references = new JsonArray(); var page = new JsonArray(); var count = 0; var size = 2;
        void Save()
        {
            if (page.Count == 0) return;
            var bytes = JsonSerializer.SerializeToUtf8Bytes(page); var sha = Hash(bytes);
            if (bytes.Length > MaximumPageBytes) throw new MaaInputFailure("maa_projection_page_budget");
            if (!Contents.ContainsKey(sha)) Contents.Add(sha, bytes);
            if (Contents.Count > 4096 || Contents.Values.Sum(item => (long)item.Length) > 32 * 1024 * 1024)
                throw new MaaInputFailure("maa_projection_pages_budget");
            references.Add(new JsonObject { ["sha256"] = sha, ["bytes"] = bytes.Length, ["count"] = page.Count });
            page = new(); size = 2;
        }
        foreach (var value in values)
        {
            var itemSize = JsonSerializer.SerializeToUtf8Bytes(value).Length;
            if (size + itemSize + 1 > MaximumPageBytes) Save();
            page.Add(value); size += itemSize + 1; count++;
        }
        Save(); return new() { ["kind"] = kind, ["count"] = count, ["pages"] = references };
    }
    private static string Hash(byte[] bytes) => Convert.ToHexStringLower(SHA256.HashData(bytes));
}
