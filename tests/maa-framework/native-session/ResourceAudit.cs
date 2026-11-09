using System.Security.Cryptography;
using System.Text.Json;
using System.Text.Json.Nodes;
using NexusPipeline.Extensions.MaaFramework;

internal static class ResourceAudit
{
    internal static void Run(string manifest, string report)
    {
        var manifestBytes = File.ReadAllBytes(manifest); var projects = new JsonArray();
        foreach (var project in JsonNode.Parse(manifestBytes)!["projects"]!.AsArray().Select(item => item!.AsObject()))
        {
            var root = MaaNativePath.Capture(project["root"]!.GetValue<string>(), true);
            var inventoryBytes = File.ReadAllBytes(Path.Combine(Directory.GetParent(root)!.FullName, "inventory.json"));
            var inventory = JsonNode.Parse(inventoryBytes)!["files"]!.AsObject();
            var trees = new JsonArray();
            foreach (var tree in project["trees"]!.AsArray().Select(item => item!.AsObject()).DistinctBy(item => item["relativePath"]!.GetValue<string>()))
            {
                var relativeRoot = tree["relativePath"]!.GetValue<string>();
                var directory = Path.GetFullPath(Path.Combine(root, relativeRoot));
                var relativeTree = Path.GetRelativePath(root, directory).Replace('\\', '/');
                if (relativeTree == ".." || relativeTree.StartsWith("../", StringComparison.Ordinal) || Path.IsPathRooted(relativeTree))
                    throw new IOException("audit_tree_path_escape");
                _ = MaaNativePath.Capture(directory, true);
                var prefix = relativeTree == "." ? "" : relativeTree + "/";
                var expected = inventory.Where(item => item.Key.StartsWith(prefix, StringComparison.Ordinal) && IsPolicyFile(item.Key[prefix.Length..]))
                    .ToDictionary(item => item.Key, item => item.Value!.GetValue<string>(), StringComparer.Ordinal);
                var pipelineFiles = 0; var policyFiles = expected.Count;
                var walk = new EnumerationOptions { RecurseSubdirectories = true, AttributesToSkip = FileAttributes.ReparsePoint, IgnoreInaccessible = false };
                foreach (var path in Directory.EnumerateFiles(directory, "*", walk).Order(StringComparer.Ordinal))
                {
                    var relative = Path.GetRelativePath(root, path).Replace('\\', '/');
                    var fromTree = relative[prefix.Length..];
                    if (!IsPolicyFile(fromTree)) continue;
                    var bytes = File.ReadAllBytes(MaaNativePath.Capture(path, false));
                    if (!expected.Remove(relative, out var digest) || digest != Hash(bytes)) throw new IOException("audit_inventory_changed:" + relative);
                    if (IsPipeline(fromTree)) pipelineFiles++;
                }
                if (expected.Count > 0) throw new IOException("audit_inventory_missing:" + expected.Keys.Order(StringComparer.Ordinal).First());
                var strictGuard = Guard(directory, false);
                trees.Add(new JsonObject { ["path"] = relativeRoot, ["pipelineFiles"] = pipelineFiles, ["policyFiles"] = policyFiles,
                    ["resourceLoadBlocked"] = strictGuard != "PASS_RAW_POLICY_ONLY", ["strictGuard"] = strictGuard,
                    ["optionalOutputGuard"] = Guard(directory, true) });
            }
            if (trees.Count == 0) throw new IOException("audit_no_trees");
            projects.Add(new JsonObject { ["project"] = project["project"]!.DeepClone(), ["sourceRoot"] = root,
                ["inventorySha256"] = Hash(inventoryBytes), ["trees"] = trees });
        }
        if (projects.Count == 0) throw new IOException("audit_no_projects");
        var output = new JsonObject { ["qualification"] = "Read-only locked resource policy",
            ["manifestSha256"] = Hash(manifestBytes), ["projects"] = projects };
        File.WriteAllText(report, output.ToJsonString(new JsonSerializerOptions { WriteIndented = true }) + "\n");
    }
    private static string Hash(byte[] bytes) => Convert.ToHexStringLower(SHA256.HashData(bytes));
    private static bool IsPipeline(string path) => path.StartsWith("pipeline/", StringComparison.OrdinalIgnoreCase);
    private static bool IsPolicyFile(string path) => path is "default_pipeline.json" or "default_pipeline.jsonc" ||
        IsPipeline(path) && (path.EndsWith(".json", StringComparison.OrdinalIgnoreCase) || path.EndsWith(".jsonc", StringComparison.OrdinalIgnoreCase));
    private static string Guard(string directory, bool outputScope)
    {
        try { MaaPipelineGuard.CheckResources([directory], () => { }, outputScope); return "PASS_RAW_POLICY_ONLY"; }
        catch (Exception error) when (error is IOException or MaaInputFailure) { return error.Message; }
    }
}
