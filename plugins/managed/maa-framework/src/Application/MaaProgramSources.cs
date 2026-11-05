namespace NexusPipeline.Extensions.MaaFramework;

internal static class MaaProgramSources
{
    internal static async ValueTask CaptureAsync(MaaSelectedFiles files, MaaCompilationState state, MaaRuntimeSelection? runtime)
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
            if (entry is null || entry.Name != name || entry.Kind != (directory ? NexusPipeline.Extensibility.Compilation.SourceEntryKind.Directory :
                NexusPipeline.Extensibility.Compilation.SourceEntryKind.File)) throw new MaaInputFailure("maa_program_source_missing");
            paths.Add(path);
        }
    }
    private static string Parent(string path) => path.Contains('/') ? path[..path.LastIndexOf('/')] : "";
}
