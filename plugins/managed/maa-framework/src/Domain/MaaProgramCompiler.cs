using System.Text.Json.Nodes;

namespace NexusPipeline.Extensions.MaaFramework;

internal sealed record MaaProgramSpec(string OccurrenceId, string Kind, string Executable, string[] Arguments,
    long TimeoutMilliseconds, string Identifier, JsonObject? Options, int? ScriptIndex);

internal static class MaaProgramCompiler
{
    internal static MaaProgramSpec[] Compile(MaaPiProject project, MaaImportedProfile profile, MaaOptionCompiler options, MaaRuntimeSelection? runtime)
    {
        var programs = new List<MaaProgramSpec>();
        var agents = MaaJson.Objects(project.Declaration["agent"], true);
        for (var index = 0; index < agents.Length; index++)
        {
            var id = MaaImportRules.Identity("agent", profile.InstanceId, project.CompilationFingerprint + "/" + index);
            programs.Add(Build(agents[index], id, "agent", null));
        }
        foreach (var occurrence in profile.Pretasks.Where(row => row.Enabled).OrderBy(row => row.Order))
        {
            var declaration = MaaJson.Objects(project.Declaration["pretask"], true).SingleOrDefault(item =>
                "__MXU_PRETASK__" + MaaJson.Required(item, "name") == occurrence.Name) ?? throw new MaaInputFailure("maa_pretask_unmapped");
            if (!options.Active(declaration)) continue;
            var names = MaaJson.Strings(declaration["option"]);
            programs.Add(Build(declaration, occurrence.Id, "pretask", names.Length == 0 ? null : options.Effective(names, occurrence.Options)));
        }
        if (programs.Count > 32 || programs.Select(item => item.OccurrenceId).Distinct(StringComparer.Ordinal).Count() != programs.Count)
            throw new MaaInputFailure("maa_program_budget");
        return programs.ToArray();

        MaaProgramSpec Build(JsonObject declaration, string id, string kind, JsonObject? payload)
        {
            var agent = kind == "agent";
            var declared = MaaJson.Required(declaration, agent ? "child_exec" : "exec");
            string executable;
            if (runtime?.Executables.TryGetValue(declared, out var chosen) == true) executable = chosen;
            else
            {
                if (!declared.Contains('/') && !declared.Contains('\\') || Path.IsPathRooted(declared))
                    throw new MaaBusinessFailure("maa_program_executable_selection_required");
                executable = MaaResourcePaths.Resolve(project.InterfacePath, declared);
                if (!Path.HasExtension(executable)) executable += ".exe";
            }
            var arguments = MaaJson.Strings(declaration[agent ? "child_args" : "args"]);
            if (arguments.Length > 256 || arguments.Any(value => value.Length > 32760 || value.Contains('\0')))
                throw new MaaInputFailure("maa_program_arguments_invalid");
            var name = Path.GetFileNameWithoutExtension(executable);
            int? scriptIndex = null;
            if (name.Equals("uv", StringComparison.OrdinalIgnoreCase))
            {
                if (arguments.Length < 3 || arguments[0] != "run" || arguments[1] != "python")
                    throw new MaaBusinessFailure("maa_python_environment_incomplete");
                scriptIndex = PythonEntry(arguments, 2);
            }
            else if (name.StartsWith("python", StringComparison.OrdinalIgnoreCase) &&
                name[6..].All(value => value is 'w' or 'W' or '.' || char.IsAsciiDigit(value))) scriptIndex = PythonEntry(arguments, 0);
            if (scriptIndex is { } entry) arguments[entry] = MaaResourcePaths.Resolve(project.InterfacePath, arguments[entry]);
            var timeout = declaration["timeout"]?.GetValue<long>() ?? (agent ? 10000 : 900000);
            if ((timeout < 1 || timeout > (agent ? 120000 : 1200000)) && !(agent && timeout == -1))
                throw new MaaInputFailure("maa_program_timeout_invalid");
            var identifier = agent ? MaaJson.Text(declaration, "identifier") : "";
            if (identifier.Length > 128 || identifier.Any(char.IsControl)) throw new MaaInputFailure("maa_agent_identifier_invalid");
            return new(id, kind, executable, arguments, timeout, identifier, payload, scriptIndex);
        }
    }
    private static int PythonEntry(string[] arguments, int start)
    {
        for (var index = start; index < arguments.Length; index++)
        {
            var value = arguments[index];
            if (value is "-u" or "-B" or "-E" or "-s" or "-S" or "-I" or "-O" or "-OO") continue;
            if (value == "-X" && index + 1 < arguments.Length && arguments[index + 1] is "utf8" or "utf8=1") { index++; continue; }
            if (!value.StartsWith('-') && (value.EndsWith(".py", StringComparison.OrdinalIgnoreCase) || value.EndsWith(".pyw", StringComparison.OrdinalIgnoreCase))) return index;
            throw new MaaBusinessFailure("maa_python_entry_unbound");
        }
        throw new MaaBusinessFailure("maa_python_entry_unbound");
    }
}
