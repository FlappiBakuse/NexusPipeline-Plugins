using System.Text.Json.Nodes;

namespace NexusPipeline.Extensions.MaaFramework;

internal sealed record MaaSourceCandidate(string Id, string Kind, string Path, string InstanceId, string Name);
internal sealed record MaaProjectCandidates(string[] Interfaces, string? SelectedInterface, MaaSourceCandidate[] Sources);
internal static class MaaProjectDiscovery
{
    internal static MaaProjectCandidates Discover(MaaSourceSet sources, string? selectedInterface = null)
    {
        var interfaces = sources.Paths.Where(path => path.Equals("interface.json", StringComparison.OrdinalIgnoreCase) ||
            path.Equals("interface.jsonc", StringComparison.OrdinalIgnoreCase) || path.EndsWith("/interface.json", StringComparison.OrdinalIgnoreCase) ||
            path.EndsWith("/interface.jsonc", StringComparison.OrdinalIgnoreCase)).ToArray();
        if (interfaces.Length == 0) throw new MaaInputFailure("maa_interface_missing");
        if (selectedInterface is not null && !interfaces.Contains(selectedInterface, StringComparer.OrdinalIgnoreCase)) throw new MaaInputFailure("maa_interface_selection_missing");
        var selected = selectedInterface ?? (interfaces.Length == 1 ? interfaces[0] : null);
        var candidates = new List<MaaSourceCandidate>();
        void Add(string kind, string path, string id, string name)
        {
            MaaImportRules.Instance(id);
            if (name.Length > 256 || candidates.Count >= 64) throw new MaaInputFailure("maa_source_candidate_budget");
            if (!sources.Contains(path)) throw new MaaInputFailure("maa_source_instance_missing");
            candidates.Add(new(MaaImportRules.Identity(kind, path, id), kind, path, id, name));
        }
        foreach (var file in sources.Paths.Where(path => path.Equals("mxu.json", StringComparison.OrdinalIgnoreCase) ||
                     path.StartsWith("config/mxu-", StringComparison.OrdinalIgnoreCase) && path.EndsWith(".json", StringComparison.OrdinalIgnoreCase)))
        {
            var document = sources.Read(file); if (MaaJson.Required(document, "version") != "1.0") throw new MaaInputFailure("maa_mxu_schema_unsupported");
            foreach (var instance in MaaJson.Objects(document["instances"])) Add("mxu", file, MaaJson.Required(instance, "id"), MaaJson.Text(instance, "name", "MXU"));
        }
        if (sources.Contains("appsettings.json"))
        {
            var settings = sources.Read("appsettings.json");
            foreach (var file in sources.Paths.Where(path => path.StartsWith("config/instances/", StringComparison.OrdinalIgnoreCase) && path.EndsWith(".json", StringComparison.OrdinalIgnoreCase)))
            {
                var id = file["config/instances/".Length..^5]; var local = sources.Read(file);
                Add("mfa", file, id, MaaJson.Text(local, "InstanceName", id));
            }
            var ids = MaaJson.Text(settings, "Instances.List").Split(',', StringSplitOptions.RemoveEmptyEntries).ToList();
            var last = MaaJson.Text(settings, "Instances.LastActive"); if (last.Length > 0 && !ids.Contains(last, StringComparer.Ordinal)) ids.Add(last);
            if (ids.Count == 0 && sources.Contains("config/config.json") && sources.Read("config/config.json")["TaskItems"] is JsonArray) ids.Add("default");
            foreach (var id in ids.Distinct(StringComparer.Ordinal))
            {
                if (candidates.Any(candidate => candidate.Kind == "mfa" && candidate.InstanceId == id)) continue;
                var cfg = MaaJson.Text(settings, "Instance." + id + ".Config", MaaJson.Text(settings, "DefaultConfig", "Default"));
                var file = cfg == "Default" ? "config/config.json" : "config/mfa_" + cfg + ".json";
                if (!sources.Contains(file)) continue;
                var global = sources.Read(file);
                if (global["Instance." + id + ".TaskItems"] is JsonArray || global["TaskItems"] is JsonArray)
                    Add("mfa", file, id, MaaJson.Text(settings, "Instance." + id + ".Name", id));
            }
        }
        if (sources.Contains("config/multi_config.json"))
        {
            var main = sources.Read("config/multi_config.json");
            foreach (var id in MaaJson.Strings(main["config_list"]))
            { var file = "config/configs/" + id + ".json"; Add("cfa", file, id, MaaJson.Text(sources.Read(file), "name", id)); }
        }
        if (sources.Contains("config/maa_pi_config.json")) Add("maapicli", "config/maa_pi_config.json", "cli", "MaaPiCli");
        MaaImportRules.Unique(candidates.Select(candidate => candidate.Id));
        return new(interfaces, selected, candidates.ToArray());
    }
}
