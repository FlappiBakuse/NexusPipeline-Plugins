namespace NexusPipeline.Plugin.MaaFrameworkDriver;

public static class ProjectLogSources
{
    public static DeclaredLogSource[] Resolve(string name, string version, CompiledProgram[] agents)
    {
        var sources = new List<DeclaredLogSource>();
        if (name == "MaaEnd" && version.TrimStart('v') == "2.32.0")
        {
            if (agents.Any(agent => Path.GetFileNameWithoutExtension(agent.Executable).Equals("go-service", StringComparison.OrdinalIgnoreCase)))
            {
                sources.Add(new("agent.go", "debug/go-service.log"));
                sources.Add(new("agent.go.native", "debug/maafw.log", "maafw.bak.*.log", Optional: true));
            }
            if (agents.Any(agent => Path.GetFileNameWithoutExtension(agent.Executable).Equals("cpp-algo", StringComparison.OrdinalIgnoreCase)))
                sources.Add(new("agent.cpp.native", "debug/cpp-algo/debug/maafw.log", "maafw.bak.*.log", Optional: true));
        }
        if (name == "MaaStellaSora" && version.TrimStart('v') == "1.6.0" && agents.Any(agent =>
            agent.Arguments.Any(argument => IsPythonAgent(argument))))
        {
            sources.Add(new("agent.python.native", "debug/maafw.log", "maafw.bak.*.log", Optional: true));
            sources.Add(new("agent.python.debug", "debug/agent/{date}.log", Optional: true));
        }
        return sources.ToArray();
    }
    private static bool IsPythonAgent(string argument)
    {
        string path = argument.Replace('\\', '/');
        if (path.StartsWith("./", StringComparison.Ordinal)) path = path[2..];
        return path.Equals("agent/main.py", StringComparison.OrdinalIgnoreCase);
    }
}
