using Xunit;

namespace NexusPipeline.Plugin.MaaFrameworkDriver.Tests;

public sealed class PythonDependencyTests
{
    [Fact]
    public async Task PythonPlanPinsClosureAndRejectsUnknownDeclarationsTargetsAndChangedLocks()
    {
        string root = Path.Combine(Path.GetTempPath(), "nxp-python-plan-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(root);
        try
        {
            File.WriteAllText(Path.Combine(root, "interface.json"), """
                {"interface_version":2,"name":"MaaStellaSora","version":"1.6.0","controller":[{"name":"PC","type":"Win32"}],
                "resource":[{"name":"R","path":"resource"}],"task":[{"name":"T","entry":"Entry"}],
                "agent":{"child_exec":"./python/python.exe","child_args":["./agent/main.py"]}}
                """);
            string requirements = Path.Combine(root, "requirements.txt"); File.WriteAllText(requirements, "maafw\njson-with-comments\n");
            var native = NativeDependencies.Bind(new() { SchemaVersion = 3, PackageRoot = root, ProfileId = "owned" }, "MaaStellaSora", "1.6.0", default);
            var profile = PythonDependencies.Bind(native, default);
            Assert.Equal(2, profile.DependencyLock!.SchemaVersion);
            var recipe = PythonDependencies.RequireRecipe(profile);
            Assert.Equal("3.12.10", recipe.PythonVersion); Assert.Equal(6, recipe.Components.Length);
            Assert.Equal(new[] { "maaagentbinary-1.0.1", "numpy-2.5.3", "strenum-0.4.15" }, recipe.Components.Single(item => item.Name == "maafw").Dependencies);
            Assert.False(Directory.Exists(Path.Combine(root, ".nexus")));
            using var cancelled = new CancellationTokenSource(); cancelled.Cancel();
            await Assert.ThrowsAnyAsync<OperationCanceledException>(async () => await PythonDependencies.InstallAsync(profile, "cancelled", cancelled.Token));
            Assert.False(Directory.Exists(Path.Combine(root, ".nexus")));
            var changed = profile with { DependencyLock = profile.DependencyLock with { Python = profile.DependencyLock.Python! with { RecipeHash = new string('0', 64) } } };
            Assert.Contains("lock_changed", Assert.Throws<InvalidDataException>(() => PythonDependencies.RequireRecipe(changed)).Message);
            string target = Path.Combine(root, profile.DependencyLock.Python!.InstallTarget.Replace('/', Path.DirectorySeparatorChar));
            Directory.CreateDirectory(target); string unknown = Path.Combine(target, "user-data"); File.WriteAllText(unknown, "preserve");
            Assert.Contains("unknown_or_incomplete_target", (await Assert.ThrowsAsync<InvalidDataException>(async () => await PythonDependencies.InstallAsync(profile, "owned", default))).Message);
            Assert.Equal("preserve", File.ReadAllText(unknown));
            File.WriteAllText(requirements, "maafw\nunknown-package\n");
            Assert.Contains("declaration_changed", Assert.Throws<InvalidDataException>(() => PythonDependencies.RequireRecipe(profile)).Message);
            Assert.Contains("unsupported_declaration", Assert.Throws<InvalidDataException>(() => PythonDependencies.Bind(native, default)).Message);
        }
        finally { Directory.Delete(root, true); }
    }
}
