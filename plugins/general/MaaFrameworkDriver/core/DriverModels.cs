using System.Text.Json.Nodes;

namespace NexusPipeline.Plugin.MaaFrameworkDriver;

public sealed record DriverProfile
{
    public int SchemaVersion { get; init; } = 1;
    public string ProfileId { get; init; } = "";
    public string Revision { get; init; } = "";
    public string ParentRevision { get; init; } = "";
    public string PackageRoot { get; init; } = "";
    public string InterfacePath { get; init; } = "interface.json";
    public string Controller { get; init; } = "";
    public string Resource { get; init; } = "";
    public string NativeDirectory { get; init; } = "";
    public string NativeVersion { get; init; } = "";
    public string AdbPath { get; init; } = "";
    public string AdbSerial { get; init; } = "";
    public long WindowHandle { get; init; }
    public int WindowProcessId { get; init; }
    public string WindowExecutable { get; init; } = "";
    public bool HostLaunchRequired { get; init; }
    public JsonObject HostLaunchConfiguration { get; init; } = new();
    public DateTime? WindowStartedAtUtc { get; init; }
    public string Language { get; init; } = "zh_cn";
    public string[] SelectedTasks { get; init; } = [];
    public JsonObject Options { get; init; } = new();
    public JsonObject ResourceOptions { get; init; } = new();
    public JsonObject ControllerOptions { get; init; } = new();
    public JsonObject TaskOptions { get; init; } = new();
    public string[] AttachResourcePaths { get; init; } = [];
    public string AuthorizedFingerprint { get; init; } = "";
    public JsonObject ImportProvenance { get; init; } = new();
}

public sealed record CompiledTask(string Name, string Label, string Entry, JsonObject Override);
public sealed record CompiledProgram(string Name, string Executable, string[] Arguments, string? Identifier, long TimeoutMilliseconds = 10000);
public sealed record CompiledProject(string Name, string Version, string InterfaceDirectory,
    JsonObject Controller, JsonObject Resource, string[] ResourcePaths, int BaseResourceCount, string[] ResourceHashes,
    CompiledTask[] Tasks, CompiledProgram[] Pretasks, CompiledProgram[] Agents,
    string ExecutionFingerprint, JsonObject PublicSchema);
