using System.Text.Json.Nodes;
using NexusPipeline.Extensibility.Compilation;

namespace NexusPipeline.Extensions.MaaFramework;

internal static class MaaSourceCapture
{
    internal static async ValueTask CaptureDiscoveryAsync(MaaSelectedFiles files, MaaCompilerChoice choice)
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
        if (choice.InterfacePath is not null) await CaptureInterfaceSourcesAsync(files, choice.InterfacePath, choice.ClientKind, choice.Language);
    }
    private static bool Interface(string path) => path is "interface.json" or "interface.jsonc" ||
        path.EndsWith("/interface.json", StringComparison.Ordinal) || path.EndsWith("/interface.jsonc", StringComparison.Ordinal);
    private static string GlobalPath(string name)
    {
        if (name.Length is < 1 or > 128 || name.Any(character => character is '/' or '\\' or ':' || char.IsControl(character)))
            throw new MaaInputFailure("maa_mfa_config_invalid");
        return name == "Default" ? "config/config.json" : MaaSourceSet.Normalize("config/mfa_" + name + ".json");
    }

    private static async ValueTask CaptureInterfaceSourcesAsync(MaaSelectedFiles files, string root, string client, string language)
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
        await CaptureInterfaceSourcesAsync(files, selection.InterfacePath, selection.ClientKind, selection.Language);
        await files.ReadAsync(selection.Source.Path, true);
        if (selection.Source.Kind == "mfa")
        {
            files.RequireConfiguration("appsettings.json");
            var settings = await files.ReadAsync("appsettings.json", true) ?? throw new MaaInputFailure("maa_source_missing:appsettings.json");
            var separate = selection.Source.Path == "config/instances/" + selection.Source.InstanceId + ".json";
            var config = MaaJson.Text(settings, separate ? "DefaultConfig" : "Instance." + selection.Source.InstanceId + ".Config",
                MaaJson.Text(settings, "DefaultConfig", "Default"));
            var global = GlobalPath(config);
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
        await CaptureProgramSourcesAsync(files, state, selection.Runtime);
        if (files.ResourceTrees.Count + (files.ProgramPaths.Count == 0 ? 0 : 1) > 8)
            throw new MaaInputFailure("maa_resource_tree_budget");
        var bundle = MaaCompilationBundle.Build(state, files.Snapshot(), selection, cancellationToken: cancellation);
        return bundle;
    }

    private static async ValueTask CaptureProgramSourcesAsync(MaaSelectedFiles files, MaaCompilationState state, MaaRuntimeSelection? runtime)
    {
        if (state.Semantic is not { } semantic) return;
        var programs = semantic.Programs;
        if (programs.Length == 0 && runtime?.NativeDirectory is null) return;
        if (programs.Length > 0 && runtime?.NativeDirectory is null) throw new MaaInputFailure("maa_project_runtime_selection_required");
        var paths = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var directory in runtime?.Directories ?? []) await Add(directory, directory: true);
        if (runtime?.NativeDirectory is { } native) await Add(native, directory: true);
        foreach (var program in programs)
        {
            await Add(program.Executable, directory: false);
            var parent = Parent(program.Executable);
            if (parent.Length > 0) await Add(parent, directory: true);
            if (program.ScriptIndex is { } index)
            {
                var script = program.Arguments[index]; await Add(script, directory: false);
                var code = Parent(script);
                if (code.Length > 0) await Add(code, directory: true);
            }
            if (Path.GetFileNameWithoutExtension(program.Executable).Equals("uv", StringComparison.OrdinalIgnoreCase))
            {
                var interfaceRoot = Parent(state.Project.InterfacePath);
                foreach (var name in new[] { "uv.lock", "pyproject.toml", ".venv" })
                    await Add(MaaSelectedFiles.Join(interfaceRoot, name), name == ".venv");
            }
        }
        foreach (var proof in state.Project.Sources) await Add(proof.Path, directory: false);
        var selected = paths.Order(StringComparer.Ordinal).Where(path => !paths.Any(other =>
            !other.Equals(path, StringComparison.OrdinalIgnoreCase) && path.StartsWith(other + "/", StringComparison.OrdinalIgnoreCase))).ToArray();
        if (selected.Length > 128) throw new MaaInputFailure("maa_program_input_budget");
        files.ProgramPaths.AddRange(selected);

        async ValueTask Add(string path, bool directory)
        {
            MaaSourceSet.Normalize(path);
            var parent = Parent(path); var name = path[(parent.Length == 0 ? 0 : parent.Length + 1)..];
            var listing = await files.ListAsync(parent);
            var entry = listing.Entries.SingleOrDefault(item => item.Name.Equals(name, StringComparison.OrdinalIgnoreCase));
            if (entry is null || entry.Name != name || entry.Kind != (directory ? SourceEntryKind.Directory :
                SourceEntryKind.File)) throw new MaaInputFailure("maa_program_source_missing");
            paths.Add(path);
        }
    }
    private static string Parent(string path) => path.Contains('/') ? path[..path.LastIndexOf('/')] : "";
}
