using System.Text.Json.Nodes;

namespace NexusPipeline.Extensions.MaaFramework;

internal static class MaaScreencapPolicy
{
    internal static void Name(string name)
    {
        if (name.Length is < 1 or > 120 || name is "." or ".." || name.EndsWith('.') || name.EndsWith(' ') ||
            name.Any(character => char.IsControl(character) || "<>:\"/\\|?*".Contains(character))) throw new IOException("maa_screencap_node_unsafe");
    }
    internal static void Parameters(JsonObject node)
    {
        var action = node["action"] as JsonObject;
        var parameters = action?["param"] as JsonObject ?? action ?? node;
        foreach (var value in new[] { node, parameters })
        {
            if (value.TryGetPropertyValue("filename", out var filename) && !Text(filename, "")) throw new IOException("maa_screencap_filename_rejected");
            if (value.TryGetPropertyValue("format", out var format) && !Text(format, "png")) throw new IOException("maa_screencap_format_rejected");
            if (value.TryGetPropertyValue("quality", out var quality) && (quality is not JsonValue scalar || !scalar.TryGetValue<int>(out var number) || number != 100))
                throw new IOException("maa_screencap_quality_rejected");
        }
    }
    private static bool Text(JsonNode? value, string expected) => value is JsonValue scalar && scalar.TryGetValue<string>(out var text) && text == expected;
}
