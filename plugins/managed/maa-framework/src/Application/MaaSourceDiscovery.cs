using System.Text.Json.Nodes;
using NexusPipeline.Extensibility.Compilation;

namespace NexusPipeline.Extensions.MaaFramework;

internal static class MaaSourceDiscovery
{
    internal static async ValueTask CaptureAsync(MaaSelectedFiles files, MaaCompilerChoice choice)
    {
        var root = await files.ListAsync("");
        if (root.Entries.Any(entry => entry.Name == "assets" && entry.Kind == SourceEntryKind.Directory))
            await files.ListAsync("assets");
        await files.ListAsync("config");
        await files.ListAsync("config/instances");
        var settings = await files.ReadAsync("appsettings.json");
        await files.ReadAsync("mxu.json"); await files.ReadAsync("config/maa_pi_config.json");
        var main = await files.ReadAsync("config/multi_config.json");
        if (main is not null)
        {
            foreach (var id in MaaJson.Strings(main["config_list"]))
            { MaaImportRules.Instance(id); await files.ReadAsync("config/configs/" + id + ".json", true); }
            foreach (var item in (main["bundle"] as JsonObject ?? new()).Select(pair => MaaJson.Object(pair.Value)))
            {
                var path = MaaJson.Required(item, "path"); while (path.StartsWith("./", StringComparison.Ordinal)) path = path[2..];
                if (path == ".") path = ""; if (path.Length > 0) MaaSourceSet.Normalize(path);
                await files.ListAsync(path);
            }
        }
        if (settings is not null)
        {
            await files.ReadAsync("config/config.json");
            var ids = MaaJson.Text(settings, "Instances.List").Split(',', StringSplitOptions.RemoveEmptyEntries).ToList();
            var last = MaaJson.Text(settings, "Instances.LastActive"); if (last.Length > 0) ids.Add(last);
            foreach (var id in ids.Distinct(StringComparer.Ordinal))
            {
                MaaImportRules.Instance(id);
                var name = MaaJson.Text(settings, "Instance." + id + ".Config", MaaJson.Text(settings, "DefaultConfig", "Default"));
                await files.ReadAsync(GlobalPath(name));
            }
            foreach (var path in files.Paths.Where(path => path.StartsWith("config/instances/", StringComparison.Ordinal) && path.EndsWith(".json", StringComparison.Ordinal)))
                await files.ReadAsync(path, true);
        }
        foreach (var path in files.Paths.Where(Interface)) await files.ReadAsync(path, true);
        foreach (var path in files.Paths.Where(path => path.StartsWith("config/mxu-", StringComparison.Ordinal) && path.EndsWith(".json", StringComparison.Ordinal)))
            await files.ReadAsync(path, true);
        if (choice.InterfacePath is not null) await MaaSourceCapture.PiAsync(files, choice.InterfacePath, choice.ClientKind, choice.Language);
    }
    internal static bool Interface(string path) => path is "interface.json" or "interface.jsonc" ||
        path.EndsWith("/interface.json", StringComparison.Ordinal) || path.EndsWith("/interface.jsonc", StringComparison.Ordinal);
    internal static string GlobalPath(string name)
    {
        if (name.Length is < 1 or > 128 || name.Any(character => character is '/' or '\\' or ':' || char.IsControl(character)))
            throw new MaaInputFailure("maa_mfa_config_invalid");
        return name == "Default" ? "config/config.json" : MaaSourceSet.Normalize("config/mfa_" + name + ".json");
    }
}
