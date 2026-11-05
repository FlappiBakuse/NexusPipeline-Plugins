using System.Text.Json;
using System.Text.Json.Serialization;
using NexusPipeline.Extensibility.Execution;

namespace NexusPipeline.Extensions.MaaFramework;

internal sealed class MaaWorkerInputs : IMaaSessionInputs
{
    private readonly MaaInputLease held = new();
    private readonly ExecutionWorkDirectory workspace;
    private readonly MaaFrozenResources resources;
    private bool disposed;
    public string RuntimeLibrary { get; }
    public string RuntimeSha256 { get; }
    public string ControllerSha256 { get; }
    public string LogDirectory { get; }
    internal string NativeDirectory { get; }
    internal IReadOnlyList<RuntimeFile> NativeFiles { get; }
    internal string AgentLibrary { get; }
    internal string AgentSha256 { get; }
    internal long AgentSizeBytes { get; }
    public IReadOnlyList<string> ResourceDirectories => resources.Directories;
    private static readonly string[] Required = ["MaaFramework.dll", "MaaCustomControlUnit.dll", "MaaUtils.dll", "opencv_world4_maa.dll",
        "fastdeploy_ppocr_maa.dll", "onnxruntime_maa.dll", "webgpu_dawn_maa.dll", "DirectML.dll", "dxcompiler.dll", "dxil.dll", "MaaAgentClient.dll"];

    internal MaaWorkerInputs(string package, ExecutionWorkDirectory workspace, MaaFrozenResources resources, MaaRuntimePlan? plan = null)
    {
        this.workspace = workspace; this.resources = resources;
        try
        {
            RequireCurrent(); package = MaaNativePath.Capture(package, true);
            var selected = plan?.Runtime?.NativeDirectory;
            var directory = MaaNativePath.Capture(selected is null ? Path.Combine(package, "runtime/win-x64") :
                Path.Combine(resources.ProjectRoot, selected.Replace('/', Path.DirectorySeparatorChar)), true);
            held.Directory(directory); NativeDirectory = directory;
            var files = selected is null ? PackageFiles(directory) : ProjectFiles(directory, selected, resources);
            NativeFiles = Array.AsReadOnly(files);
            foreach (var file in files)
            {
                if (file.SizeBytes is < 1 or > 536870912 || file.Sha256 is not { Length: 64 } || !file.Sha256.All(char.IsAsciiHexDigitLower)) throw Invalid();
                held.File(Path.Combine(directory, file.Name), file.SizeBytes, file.Sha256);
            }
            RuntimeLibrary = Path.Combine(directory, "MaaFramework.dll");
            RuntimeSha256 = files.Single(file => file.Name == "MaaFramework.dll").Sha256;
            ControllerSha256 = files.Single(file => file.Name == "MaaCustomControlUnit.dll").Sha256;
            var agent = files.SingleOrDefault(file => file.Name == "MaaAgentClient.dll");
            if (plan?.Programs.Any(program => program.Kind == "agent") == true && agent is null) throw Invalid();
            AgentLibrary = Path.Combine(directory, "MaaAgentClient.dll"); AgentSha256 = agent?.Sha256 ?? ""; AgentSizeBytes = agent?.SizeBytes ?? 0;
            LogDirectory = Path.Combine(workspace.OutputDirectory, "logs"); Directory.CreateDirectory(LogDirectory);
        }
        catch { held.Dispose(); throw; }
    }
    public void RequireCurrent()
    { ObjectDisposedException.ThrowIf(disposed, this); workspace.RequireHeld(); resources.RequireCurrent(); held.RequireCurrent(); }
    public ValueTask DisposeAsync() { if (!disposed) { disposed = true; held.Dispose(); } return ValueTask.CompletedTask; }
    private static RuntimeFile[] PackageFiles(string directory)
    {
        using var input = new FileStream(Path.Combine(directory, "runtime-lock.json"), FileMode.Open, FileAccess.Read, FileShare.Read);
        if (input.Length is < 1 or > 8192) throw Invalid();
        var bytes = new byte[checked((int)input.Length)]; input.ReadExactly(bytes);
        var options = new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase, UnmappedMemberHandling = JsonUnmappedMemberHandling.Disallow };
        var value = MaaJson.Read(bytes).Deserialize<RuntimeLock>(options) ?? throw Invalid();
        if (value.Format != "nexus.maa.runtime-lock" || value.Version != 1 || value.RuntimeVersion != "5.14.3" || value.Files is null ||
            !value.Files.Select(file => file.Name).Order(StringComparer.Ordinal).SequenceEqual(Required.Order(StringComparer.Ordinal)) ||
            !Directory.EnumerateFileSystemEntries(directory).Select(Path.GetFileName).Order(StringComparer.Ordinal)
                .SequenceEqual(Required.Append("runtime-lock.json").Order(StringComparer.Ordinal))) throw Invalid();
        return value.Files;
    }
    private static RuntimeFile[] ProjectFiles(string directory, string relative, MaaFrozenResources resources)
    {
        var files = Directory.EnumerateFiles(directory, "*.dll", SearchOption.TopDirectoryOnly).Select(path => {
            var name = Path.GetFileName(path); var proof = resources.File(relative + "/" + name);
            return new RuntimeFile(name, proof.Bytes, proof.Sha256);
        }).ToArray();
        if (files.Length is < 2 or > 64 || !files.Any(file => file.Name == "MaaFramework.dll") ||
            !files.Any(file => file.Name == "MaaCustomControlUnit.dll")) throw Invalid();
        return files;
    }
    private sealed record RuntimeLock(string Format, int Version, string RuntimeVersion, RuntimeFile[] Files);
    internal sealed record RuntimeFile(string Name, long SizeBytes, string Sha256);
    private static IOException Invalid() => new("maa_runtime_closure_unbound");
}
