using System.Diagnostics;
using System.Security.Cryptography;
using System.Text.Json;
using System.Text.Json.Nodes;
using Xunit;

namespace NexusPipeline.Plugin.MaaFrameworkDriver.Tests;

public sealed class OfficialProjectQualificationTests
{
    [Theory]
    [InlineData("MaaEnd")]
    [InlineData("MaaStellaSora")]
    public async Task LockedOfficialPiImportsAndEffectivePlanRemainReadOnly(string projectName)
    {
        string inputRoot = Environment.GetEnvironmentVariable("NEXUS_MAA_OFFICIAL_PROJECTS")
            ?? throw new InvalidOperationException("Pinned official project preparation required");
        Assert.True(File.Exists(Path.Combine(inputRoot, ".nxp-project-test-owned")));
        var input = JsonNode.Parse(await File.ReadAllTextAsync(Path.Combine(inputRoot, "inputs.json")))!.AsArray()
            .OfType<JsonObject>().Single(item => item["name"]!.GetValue<string>() == projectName);
        string root = input["root"]!.GetValue<string>();
        string source = Path.Combine(root, "interface.json");
        byte[] before = await File.ReadAllBytesAsync(source);
        var compiler = new ProjectCompiler(root, "interface.json");
        JsonObject schema = compiler.Inspect();
        string controller = schema["controller"]!.AsArray().OfType<JsonObject>().First(item => item["type"]!.GetValue<string>() == "Win32")["name"]!.GetValue<string>();
        string resource = schema["resource"]!.AsArray().OfType<JsonObject>().First(item => item["controller"] is null
            || item["controller"]!.AsArray().Any(value => value!.GetValue<string>() == controller))["name"]!.GetValue<string>();
        bool Applicable(JsonObject item) => (item["controller"] is null || item["controller"]!.AsArray().Any(value => value!.GetValue<string>() == controller))
            && (item["resource"] is null || item["resource"]!.AsArray().Any(value => value!.GetValue<string>() == resource));
        JsonObject[] tasks = schema["task"]!.AsArray().OfType<JsonObject>().Where(Applicable).Take(3).ToArray();
        Assert.NotEmpty(tasks);
        var profile = new DriverProfile { ProfileId = "official-read-only", PackageRoot = root,
            Controller = controller, Resource = resource, NativeDirectory = input["nativeDirectory"]!.GetValue<string>() };
        string fixture = Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "NativeWindow", "bin",
            AppContext.BaseDirectory.Split(Path.DirectorySeparatorChar).Last(part => part is "Debug" or "Release"), "net8.0-windows", "NexusPipeline.MaaTestWindow.exe");
        using var versionProcess = new Process { StartInfo = new(Path.GetFullPath(fixture)) { UseShellExecute = false, CreateNoWindow = true,
            RedirectStandardOutput = true, RedirectStandardError = true } };
        versionProcess.StartInfo.ArgumentList.Add("--native-version");
        versionProcess.StartInfo.ArgumentList.Add(Path.Combine(root, profile.NativeDirectory));
        Assert.True(versionProcess.Start());
        Task<string> output = versionProcess.StandardOutput.ReadToEndAsync(), errors = versionProcess.StandardError.ReadToEndAsync();
        try { await versionProcess.WaitForExitAsync().WaitAsync(TimeSpan.FromSeconds(10)); }
        catch { if (!versionProcess.HasExited) versionProcess.Kill(); throw; }
        string actualVersion = (await output).Trim();
        string error = await errors;
        Assert.True(versionProcess.ExitCode == 0, error);
        profile = profile with { NativeVersion = actualVersion };
        // Build a normal supported MXU saved instance using real task identities,
        // then compare its independent plan with an equivalent direct selection.
        var saved = new JsonObject { ["version"] = "1.0", ["instances"] = new JsonArray(new JsonObject {
            ["id"] = "qualified-instance", ["controllerName"] = controller, ["resourceName"] = resource,
            ["tasks"] = new JsonArray(tasks.Select(task => (JsonNode)new JsonObject { ["taskName"] = task["name"]!.DeepClone(),
                ["enabled"] = true, ["optionValues"] = new JsonObject() }).ToArray()) }) };
        string savedBefore = saved.ToJsonString();
        DriverProfile imported = ConfigurationImporter.Map("mxu", saved, schema, profile, "qualified-instance");
        CompiledProject mapped = compiler.Compile(imported);
        CompiledProject direct = compiler.Compile(profile with { SelectedTasks = tasks.Select(task => task["name"]!.GetValue<string>()).ToArray() });
        Assert.Equal(JsonSerializer.Serialize(direct.Tasks), JsonSerializer.Serialize(mapped.Tasks));
        Assert.Equal(direct.ResourcePaths, mapped.ResourcePaths);
        Assert.NotEmpty(mapped.Agents);
        int inspectionBytes = System.Text.Encoding.UTF8.GetByteCount(schema.ToJsonString());
        Assert.True(inspectionBytes <= 2 * 1024 * 1024, "Host inspection response limit exceeded");
        var privatePlan = new JsonObject { ["profile"] = JsonSerializer.SerializeToNode(imported, DriverJson.Options),
            ["compiled"] = JsonSerializer.SerializeToNode(mapped with { PublicSchema = new() }, DriverJson.Options) };
        int workerInputBytes = System.Text.Encoding.UTF8.GetByteCount(privatePlan.ToJsonString());
        Assert.True(workerInputBytes < NexusPipeline.Plugin.Abstractions.PluginWorkerProtocol.MaximumFrameBytes - 4096,
            "Bounded worker bootstrap cannot carry the effective plan");
        Assert.Equal(savedBefore, saved.ToJsonString());
        Assert.Equal(before, await File.ReadAllBytesAsync(source));
        string reportRoot = Environment.GetEnvironmentVariable("NEXUS_MAA_REPORT_ROOT")!;
        await File.WriteAllTextAsync(Path.Combine(reportRoot, "official-" + projectName + "-" + Guid.NewGuid().ToString("N") + ".json"),
            JsonSerializer.Serialize(new { source = input, actualNativeVersion = actualVersion,
                interfaceSha256 = Convert.ToHexString(SHA256.HashData(before)), controller, resource,
                taskNames = mapped.Tasks.Select(task => task.Name), agents = mapped.Agents.Select(agent => new { agent.Executable, agent.Arguments, agent.TimeoutMilliseconds }),
                inspectionBytes, workerInputBytes, effectivePlanMatches = true, sourceModified = false, gameExecuted = false }, new JsonSerializerOptions { WriteIndented = true }));
    }
}
