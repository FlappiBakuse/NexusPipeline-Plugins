using System.Text.Json;
using NexusPipeline.Extensibility;
using NexusPipeline.Extensibility.Lifecycle;
using NexusPipeline.Extensibility.Protocol;
using NexusPipeline.Extensibility.Execution;

var message = new TaskAdapter
{
    Format = "nexus.task.adapter", Version = 1, Direction = "request", Phase = "discover",
    ExtensionId = "bettergi", OperationId = Guid.NewGuid().ToString("D"), Resources = []
};
var source = new ScriptSource { Format = "nexus.script.source", Version = 1, Direction = "response",
    ExtensionId = "bettergi", OperationId = message.OperationId, Diagnostics = [], Candidates = [new ScriptSourceCandidate {
        CandidateId = "account", Title = "Explicit account", Executable = "script.exe", Arguments = ["account"],
        Resources = [new ScriptSourceResource { ResourceId = "main", Path = "config/account.json", Syntax = "json" }],
        LogPaths = ["logs/*.log"] }] };
var task = new TaskDefinitionsTask { TaskId = "leaf", Title = "Leaf", IsSelected = true, IsEnabled = true,
    ExecutionTaskId = "native-leaf", RepetitionLimit = 3,
    Dependencies = ["parent"], RetrySafety = "safe", RetryPrerequisites = ["parent"],
    Projection = new() { ResourceId = "main", RelativePath = "config.yaml", Selector = [JsonSerializer.SerializeToElement("leaf_enable")] } };
var selection = new ExecutionProjectResponseSelection { ConsumerExtensionId = "maas", BindingId = Guid.NewGuid().ToString("D"),
    SelectedTaskIds = ["leaf"], ExecutionTaskIds = ["native-leaf"],
    RepetitionOffsets = [new TaskDefinitionsRepetitionOffset { TaskId = "leaf", CompletedRepetitions = 1 }] };
var observation = new TaskDefinitionsObservation { TaskId = "leaf", State = "failed", ReasonCode = "native_failed", CompletedRepetitions = 1 };
var handshake = new FrontendHandshake
{
    Format = "nexus.extension.frontend", Version = 1, ExtensionId = "fixture",
    SdkVersion = SdkIdentity.Version, ContractFingerprint = SdkIdentity.ContractFingerprint
};
var manifest = new ExtensionManifest
{
    Format = "nexus.extension.manifest", Version = 1, ExtensionId = "fixture", ArtifactName = "Fixture",
    DisplayName = "Fixture", PackageVersion = "0.5.0", Kind = "managed-code", MinHostVersion = "0.18.0",
    SdkVersion = SdkIdentity.Version, ContractFingerprint = SdkIdentity.ContractFingerprint,
    Capabilities = [], Permissions = new(), Managed = new() { EntryAssembly = "Fixture.dll", EntryType = "Fixture.Extension" }
};
var project = new ExecutionProjectRequest { Fingerprint = new string('a', 64), Sequence = 1, Kind = "asset",
    Name = "root", Offset = 0, MaximumBytes = 131072 };
_ = new object[] { message, source, task, selection, observation, handshake, manifest, project };

public static class ConsumerCalls
{
    public static IExtension Create(ExtensionActivationContext context) => new ConsumerExtension(context);
    public static Task<ExecutionProjectResponse> Read(ExecutionProjectReader reader, CancellationToken cancellationToken) =>
        reader.ReadFileAsync("root", "config.json", 0, 65536, cancellationToken);
}

public sealed class ConsumerExtension(ExtensionActivationContext context) : IExtension
{
    public ValueTask ActivateAsync(IExtensionScope scope, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        ArgumentNullException.ThrowIfNull(context.PackageAssets);
        return ValueTask.CompletedTask;
    }
}
