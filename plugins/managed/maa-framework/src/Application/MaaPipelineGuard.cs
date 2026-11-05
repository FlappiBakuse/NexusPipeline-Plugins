using System.Text.Json.Nodes;

namespace NexusPipeline.Extensions.MaaFramework;

internal static class MaaPipelineGuard
{
    internal static void Check(JsonNode? value, bool outputScope = false)
    {
        if (value is JsonObject item)
        {
            if (item["action"] is { } action)
            {
                var type = action is JsonObject detail ? detail["type"] : action;
                if (type is JsonValue scalar && scalar.TryGetValue<string>(out var name))
                {
                    if (name == "Command" || name == "Screencap" && !outputScope) throw new IOException("maa_native_action_requires_host_owner:" + name);
                    if (name == "Screencap") MaaScreencapPolicy.Parameters(item);
                }
            }
            foreach (var property in item) Check(property.Value, outputScope);
        }
        else if (value is JsonArray array) foreach (var child in array) Check(child, outputScope);
    }
    internal static void CheckRoot(JsonObject value, bool outputScope)
    {
        if (outputScope)
            foreach (var row in value)
            {
                if (row.Value is not JsonObject node) continue;
                var action = node["action"]; var type = action is JsonObject detail ? detail["type"] : action;
                var inherited = type is null || type is JsonValue scalar && scalar.TryGetValue<string>(out var name) && name is "Default" or "Screencap";
                if (inherited) { MaaScreencapPolicy.Name(row.Key); MaaScreencapPolicy.Parameters(node); }
            }
        Check(value, outputScope);
    }
    internal static void CheckResources(IReadOnlyList<string> resources, Action requireCurrent, bool outputScope = false)
    {
        var count = 0; long bytes = 0;
        foreach (var resource in resources)
        {
            var pending = new Stack<string>(); pending.Push(resource);
            while (pending.Count > 0)
            {
                var directory = MaaNativePath.Capture(pending.Pop(), true);
                foreach (var entry in Directory.EnumerateFileSystemEntries(directory))
                {
                    requireCurrent(); if (++count > 32768) throw new IOException("maa_pipeline_entry_budget");
                    var attributes = File.GetAttributes(entry);
                    if ((attributes & FileAttributes.ReparsePoint) != 0) throw new IOException("maa_input_reparse_point");
                    if ((attributes & FileAttributes.Directory) != 0) { pending.Push(entry); continue; }
                    var relative = Path.GetRelativePath(resource, entry).Replace('\\', '/');
                    var pipeline = relative.StartsWith("pipeline/", StringComparison.OrdinalIgnoreCase);
                    var defaults = relative is "default_pipeline.json" or "default_pipeline.jsonc";
                    if (!defaults && (!pipeline || !Path.GetExtension(entry).Equals(".json", StringComparison.OrdinalIgnoreCase) &&
                        !Path.GetExtension(entry).Equals(".jsonc", StringComparison.OrdinalIgnoreCase))) continue;
                    using var input = new FileStream(entry, FileMode.Open, FileAccess.Read, FileShare.Read);
                    bytes += input.Length;
                    if (input.Length > 32 * 1024 * 1024 || bytes > 32 * 1024 * 1024) throw new IOException("maa_pipeline_bytes_budget");
                    using var buffer = new MemoryStream(); input.CopyTo(buffer); CheckRoot(MaaJson.Read(buffer.ToArray()), outputScope);
                }
            }
        }
    }
}
