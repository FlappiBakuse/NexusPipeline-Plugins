using System.Text.Json.Nodes;

namespace NexusPipeline.Plugin.MaaFrameworkDriver;

public sealed record DriverProfile
{
    public int SchemaVersion { get; init; }
    public string ProfileId { get; init; } = "";
    public string Revision { get; init; } = "";
    public string ParentRevision { get; init; } = "";
    public string PackageRoot { get; init; } = "";
    public string InterfacePath { get; init; } = "interface.json";
    public string Controller { get; init; } = "";
    public string Resource { get; init; } = "";
    public string NativeDirectory { get; init; } = "";
    public string NativeVersion { get; init; } = "";
    public NativeDependencyLock? DependencyLock { get; init; }
    public string AdbPath { get; init; } = "";
    public string AdbSerial { get; init; } = "";
    public long WindowHandle { get; init; }
    public int WindowProcessId { get; init; }
    public string WindowExecutable { get; init; } = "";
    public bool HostLaunchRequired { get; init; }
    public JsonObject HostLaunchConfiguration { get; init; } = new();
    public DateTime? WindowStartedAtUtc { get; init; }
    public string WindowSelection { get; init; } = "exact_process";
    public int WindowWaitMilliseconds { get; init; } = 10000;
    public string Language { get; init; } = "zh_cn";
    public string[] SelectedTasks { get; init; } = [];
    public TaskOccurrence[] TaskOccurrences { get; init; } = [];
    public JsonObject Options { get; init; } = new();
    public JsonObject ResourceOptions { get; init; } = new();
    public JsonObject ControllerOptions { get; init; } = new();
    public JsonObject ControllerConfiguration { get; init; } = new();
    public JsonObject TaskOptions { get; init; } = new();
    public string[] AttachResourcePaths { get; init; } = [];
    public string AuthorizedFingerprint { get; init; } = "";
    public JsonObject ImportProvenance { get; init; } = new();
    public SourceBinding? SourceBinding { get; init; }
    public SourceSnapshot? SourceSnapshot { get; init; }
}

public sealed record SourceBinding(string RootIdentity, string InterfaceRelativePath, string SourceKind,
    string SourceSchemaVersion, int MapperVersion, string SourceInstanceId, string[] SourceFiles, string TrustScopeId);
public sealed record SourceSnapshot(string SourceHash, string PiHash, string EffectiveConfigHash, DateTimeOffset ReadAt,
    string SourceRevision, string DependencyHash = "");

public sealed record TaskOccurrence
{
    public string OccurrenceId { get; init; } = "";
    public string SourceTaskId { get; init; } = "";
    public string PiTaskName { get; init; } = "";
    public string GuiAction { get; init; } = "";
    public int Order { get; init; }
    public bool Enabled { get; init; } = true;
    public int RepeatCount { get; init; } = 1;
    public JsonObject Options { get; init; } = new();
    public JsonObject PipelineOverride { get; init; } = new();
}

public sealed record CompiledTask(string Name, string Label, string Entry, JsonObject Override,
    string Id = "", string OccurrenceId = "", int ExecutionOrdinal = 1)
{
    public string GuiAction { get; init; } = "";
}
public sealed record CompiledProgram(string Name, string Executable, string[] Arguments, string? Identifier,
    long TimeoutMilliseconds = 10000, JsonObject? GeneratedOptionPayload = null);
public sealed record SemanticProject(JsonObject Controller, JsonObject Resource, string[] ResourcePaths,
    int BaseResourceCount, string[] ResourceHashes, CompiledTask[] Tasks, JsonObject PublicSchema);
public sealed record CompiledProject(string Name, string Version, string InterfaceDirectory,
    JsonObject Controller, JsonObject Resource, string[] ResourcePaths, int BaseResourceCount, string[] ResourceHashes,
    CompiledTask[] Tasks, CompiledProgram[] Pretasks, CompiledProgram[] Agents,
    string ExecutionFingerprint, JsonObject PublicSchema, int SchemaVersion = 2, JsonObject? AuthorizationManifest = null)
{
    public DeclaredLogSource[] LogSources { get; init; } = [];
}
public sealed record DeclaredLogSource(string Id, string RelativePath, string? BackupPattern = null, bool Optional = false);
