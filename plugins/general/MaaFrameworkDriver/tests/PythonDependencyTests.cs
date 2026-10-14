using System.Text.Json.Nodes;
using Xunit;

namespace NexusPipeline.Plugin.MaaFrameworkDriver.Tests;

public sealed class PythonDependencyTests
{
    [Fact]
    public void LocalInterpreterAndScriptAreResolvedWithoutProjectRecipeOrSystemPath()
    {
        string root = Path.Combine(Path.GetTempPath(), "nxp-python-input-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(Path.Combine(root, "assets"));
        Directory.CreateDirectory(Path.Combine(root, "resource"));
        Directory.CreateDirectory(Path.Combine(root, "agent"));
        try
        {
            string pi = """
                {"interface_version":2,"name":"Arbitrary","version":"99","controller":[{"name":"PC","type":"Win32"}],
                "resource":[{"name":"R","path":"../resource"}],"task":[],
                "agent":{"child_exec":"python.exe","child_args":["-u","../agent/main.py","{literal}","secret:literal"]}}
                """;
            File.WriteAllText(Path.Combine(root, "assets", "interface.jsonc"), pi);
            File.WriteAllText(Path.Combine(root, "agent", "main.py"), "print(1)");
            File.WriteAllText(Path.Combine(root, "python.exe"), "inert owned interpreter");
            var profile = new DriverProfile { SchemaVersion = 3, PackageRoot = root, InterfacePath = "assets/interface.jsonc", Controller = "PC", Resource = "R" };
            var project = new ProjectCompiler(root, profile.InterfacePath).Compile(profile);
            var program = Assert.Single(project.Agents);
            Assert.Equal(Path.Combine(root, "python.exe"), program.Executable);
            Assert.Equal(Path.Combine(root, "agent", "main.py"), program.Arguments[1]);
            Assert.Equal(new[] { "{literal}", "secret:literal" }, program.Arguments.Skip(2));
            var single = new ProjectCompiler(root, profile.InterfacePath);
            single.Compile(profile);
            var declarations = JsonNode.Parse(pi)!;
            var agent = declarations["agent"]!.DeepClone();
            declarations["agent"] = new JsonArray(agent.DeepClone(), agent.DeepClone());
            File.WriteAllText(Path.Combine(root, "assets", "interface.jsonc"), declarations.ToJsonString());
            var multiple = new ProjectCompiler(root, profile.InterfacePath);
            Assert.Equal(2, multiple.Compile(profile).Agents.Length);
            Assert.Equal(single.EntriesEnumerated, multiple.EntriesEnumerated);
            Assert.Equal(single.FilesHashed, multiple.FilesHashed);
            File.WriteAllText(Path.Combine(root, "assets", "interface.jsonc"), pi.Replace("Arbitrary", "Renamed").Replace("99", "100"));
            Assert.Equal(program.Executable, Assert.Single(new ProjectCompiler(root, profile.InterfacePath).Compile(profile).Agents).Executable);
            File.Delete(Path.Combine(root, "python.exe"));
            Assert.Throws<InvalidDataException>(() => new ProjectCompiler(root, profile.InterfacePath).Compile(profile));
        }
        finally { Directory.Delete(root, true); }
    }
}
