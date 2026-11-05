using System.Text.Json.Nodes;

namespace NexusPipeline.Extensions.MaaFramework;

internal static class MaaSourceCapture
{
    internal static async ValueTask PiAsync(MaaSelectedFiles files, string root, string client, string language)
    {
        var stack = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        async ValueTask<JsonObject> Load(string path, int depth)
        {
            if (depth > 32 || !stack.Add(path)) throw new MaaInputFailure("maa_import_cycle_or_depth");
            try
            {
                var document = MaaJson.Clone(await files.ReadAsync(path, true) ?? throw new MaaInputFailure("maa_interface_missing"));
                foreach (var import in MaaJson.Strings(document["import"]))
                    MaaPiMerge.Apply(document, await Load(MaaSourceSet.Relative(root, import), depth + 1), client);
                return document;
            }
            finally { stack.Remove(path); }
        }
        var declaration = await Load(root, 0);
        if (declaration["languages"] is JsonObject languages && languages[language] is JsonValue value && value.TryGetValue<string>(out var relative))
            await files.ReadAsync(MaaSourceSet.Relative(root, relative), true);
    }
    internal static async ValueTask<MaaCompilationBundle> CompileAsync(MaaSelectedFiles files, MaaCompilationSelection selection, CancellationToken cancellation)
    {
        files.BindConfigurations(selection.Source.InstanceId); files.RequireConfiguration(selection.Source.Path);
        await PiAsync(files, selection.InterfacePath, selection.ClientKind, selection.Language);
        await files.ReadAsync(selection.Source.Path, true);
        if (selection.Source.Kind == "mfa")
        {
            files.RequireConfiguration("appsettings.json");
            var settings = await files.ReadAsync("appsettings.json", true) ?? throw new MaaInputFailure("maa_source_missing:appsettings.json");
            var separate = selection.Source.Path == "config/instances/" + selection.Source.InstanceId + ".json";
            var config = MaaJson.Text(settings, separate ? "DefaultConfig" : "Instance." + selection.Source.InstanceId + ".Config",
                MaaJson.Text(settings, "DefaultConfig", "Default"));
            var global = MaaSourceDiscovery.GlobalPath(config);
            files.RequireConfiguration(global);
            if (await files.ReadAsync(global) is null)
            { files.RequireConfiguration("config/config.json"); await files.ReadAsync("config/config.json", true); }
        }
        if (selection.Source.Kind == "cfa")
        { files.RequireConfiguration("config/multi_config.json"); await files.ReadAsync("config/multi_config.json", true); }
        var snapshot = files.Snapshot();
        var state = MaaCompilationBundle.Prepare(snapshot, selection, cancellation);
        var roots = MaaSemanticCompiler.Resources(state.Project, state.Profile).Distinct(StringComparer.Ordinal).ToArray();
        if (roots.Length > 8 || roots.Distinct(StringComparer.OrdinalIgnoreCase).Count() != roots.Length)
            throw new MaaInputFailure("maa_resource_tree_budget");
        foreach (var root in roots)
        {
            if (!(await files.ListAsync(root)).Exists) throw new MaaInputFailure("maa_resource_directory_missing:" + root);
            await files.ListAsync(root + "/pipeline"); files.ResourceTrees.Add(root);
        }
        await MaaProgramSources.CaptureAsync(files, state, selection.Runtime);
        if (files.ResourceTrees.Count + (files.ProgramPaths.Count == 0 ? 0 : 1) > 8)
            throw new MaaInputFailure("maa_resource_tree_budget");
        var bundle = MaaCompilationBundle.Build(state, files.Snapshot(), selection, cancellationToken: cancellation);
        return bundle;
    }
}

