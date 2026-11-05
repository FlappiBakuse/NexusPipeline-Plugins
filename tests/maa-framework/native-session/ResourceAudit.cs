using System.Security.Cryptography;
using System.Text.Json;
using System.Text.Json.Nodes;
using NexusPipeline.Extensions.MaaFramework;

internal static class ResourceAudit
{
    internal static void Run(string manifest, string report)
    {
        var projects = new JsonArray();
        foreach (var project in JsonNode.Parse(File.ReadAllBytes(manifest))!["projects"]!.AsArray().Select(item => item!.AsObject()))
        {
            var root = project["root"]!.GetValue<string>();
            var inventory = JsonNode.Parse(File.ReadAllBytes(Path.Combine(Directory.GetParent(root)!.FullName, "inventory.json")))!["files"]!.AsObject();
            var trees = new JsonArray();
            foreach (var tree in project["trees"]!.AsArray().Select(item => item!.AsObject()).DistinctBy(item => item["relativePath"]!.GetValue<string>()))
            {
                var relativeRoot = tree["relativePath"]!.GetValue<string>(); var pipeline = Path.Combine(root, relativeRoot, "pipeline");
                var findings = new JsonArray(); var files = 0;
                if (Directory.Exists(pipeline))
                    foreach (var path in Directory.EnumerateFiles(pipeline, "*", SearchOption.AllDirectories).Order())
                    {
                        var extension = Path.GetExtension(path);
                        if (!extension.Equals(".json", StringComparison.OrdinalIgnoreCase) && !extension.Equals(".jsonc", StringComparison.OrdinalIgnoreCase)) continue;
                        _ = MaaNativePath.Capture(path, false); var bytes = File.ReadAllBytes(path);
                        var relative = Path.GetRelativePath(root, path).Replace('\\', '/');
                        if (inventory[relative]?.GetValue<string>() != Convert.ToHexStringLower(SHA256.HashData(bytes))) throw new IOException("audit_inventory_changed");
                        files++; Find(MaaJson.Read(bytes), "", relative, findings);
                    }
                var blocked = findings.Count > 0;
                string optionalGuard;
                try { MaaPipelineGuard.CheckResources([Path.Combine(root, relativeRoot)], () => { }, true); optionalGuard = "PASS_RAW_POLICY_ONLY"; }
                catch (Exception failure) { optionalGuard = failure.Message; }
                trees.Add(new JsonObject { ["path"] = relativeRoot, ["pipelineFiles"] = files, ["resourceLoadBlocked"] = blocked,
                    ["optionalOutputGuard"] = optionalGuard,
                    ["impact"] = blocked ? "Every selection loading this full tree is rejected before native load, including tasks not statically reaching the flagged node" :
                        "No Command/Screencap found; this is not a target/Agent/execution readiness proof", ["findings"] = findings });
            }
            projects.Add(new JsonObject { ["project"] = project["project"]!.DeepClone(), ["sourceRoot"] = root, ["trees"] = trees });
        }
        var output = new JsonObject { ["qualification"] = "Read-only locked pipeline inventory; no native corpus execution or complete dynamic reachability claim",
            ["projects"] = projects };
        File.WriteAllText(report, output.ToJsonString(new JsonSerializerOptions { WriteIndented = true }) + "\n");
    }
    private static void Find(JsonNode? value, string pointer, string path, JsonArray output)
    {
        if (value is JsonObject node)
        {
            var action = node["action"]; var type = action is JsonObject item ? item["type"] : action;
            if (type is JsonValue scalar && scalar.TryGetValue<string>(out var name) && name is "Command" or "Screencap")
                output.Add(new JsonObject { ["file"] = path, ["pointer"] = pointer, ["action"] = name });
            foreach (var pair in node) Find(pair.Value, pointer + "/" + pair.Key.Replace("~", "~0").Replace("/", "~1"), path, output);
        }
        else if (value is JsonArray array)
            for (var index = 0; index < array.Count; index++) Find(array[index], pointer + "/" + index, path, output);
    }
}
