using System.Text.Json;
using NexusPipeline.Extensibility;
using NexusPipeline.Extensibility.Lifecycle;
using NexusPipeline.Extensibility.Protocol;
using NexusPipeline.Extensibility.Execution;

var entry = typeof(ConsumerExtension);
if (!typeof(IExtension).IsAssignableFrom(entry) || entry.GetConstructor([typeof(ExtensionActivationContext)]) is null) return 1;
var message = new TaskAdapter
{
    Format = "nexus.task.adapter", Version = 1, Direction = "request", Phase = "discover",
    ExtensionId = "bettergi", OperationId = Guid.NewGuid().ToString("D"), Resources = []
};
var json = JsonSerializer.SerializeToUtf8Bytes(message);
var result = JsonSerializer.Deserialize<TaskAdapter>(json)!;
if (result.OperationId != message.OperationId || result.Phase != "discover" || result.Version != 1) return 1;
var source = new ScriptSource { Format = "nexus.script.source", Version = 1, Direction = "response",
    ExtensionId = "bettergi", OperationId = message.OperationId, Diagnostics = [], Candidates = [new ScriptSourceCandidate {
        CandidateId = "account", Title = "Explicit account", Executable = "script.exe", Arguments = ["account"],
        Resources = [new ScriptSourceResource { ResourceId = "main", Path = "config/account.json", Syntax = "json" }],
        LogPaths = ["logs/*.log"] }] };
var reopenedSource = JsonSerializer.Deserialize<ScriptSource>(JsonSerializer.SerializeToUtf8Bytes(source))!;
if (reopenedSource.Candidates?.Single().Resources.Single().Path != "config/account.json" ||
    reopenedSource.OperationId != message.OperationId) return 1;
var task = new TaskDefinitionsTask { TaskId = "leaf", Title = "Leaf", IsSelected = true, IsEnabled = true,
    ExecutionTaskId = "native-leaf", RepetitionLimit = 3,
    Dependencies = ["parent"], RetrySafety = "safe", RetryPrerequisites = ["parent"],
    Projection = new() { ResourceId = "main", RelativePath = "config.yaml", Selector = [JsonSerializer.SerializeToElement("leaf_enable")] } };
var reopenedTask = JsonSerializer.Deserialize<TaskDefinitionsTask>(JsonSerializer.SerializeToUtf8Bytes(task))!;
if (reopenedTask.Projection?.ResourceId != "main" || reopenedTask.Projection.Selector.Single().GetString() != "leaf_enable" ||
    reopenedTask.RetryPrerequisites?.Single() != "parent" || reopenedTask.RepetitionLimit != 3) return 1;
var selection = new ExecutionProjectResponseSelection { ConsumerExtensionId = "maas", BindingId = Guid.NewGuid().ToString("D"),
    SelectedTaskIds = ["leaf"], ExecutionTaskIds = ["native-leaf"],
    RepetitionOffsets = [new TaskDefinitionsRepetitionOffset { TaskId = "leaf", CompletedRepetitions = 1 }] };
var reopenedSelection = JsonSerializer.Deserialize<ExecutionProjectResponseSelection>(JsonSerializer.SerializeToUtf8Bytes(selection))!;
if (reopenedSelection.RepetitionOffsets?.Single().CompletedRepetitions != 1 || reopenedSelection.ExecutionTaskIds?.Single() != "native-leaf") return 1;
var observation = new TaskDefinitionsObservation { TaskId = "leaf", State = "failed", ReasonCode = "native_failed", CompletedRepetitions = 1 };
if (JsonSerializer.Deserialize<TaskDefinitionsObservation>(JsonSerializer.SerializeToUtf8Bytes(observation))?.CompletedRepetitions != 1) return 1;
foreach (var name in new[] { "ControlError", "ExecutionPlan", "ExecutionJournal", "FileCleanupPlan", "WriterJobClosure" })
    if (typeof(IExtension).Assembly.GetType("NexusPipeline.Extensibility.Protocol." + name, throwOnError: false) is not null) return 1;
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
if (JsonSerializer.Deserialize<ExtensionManifest>(JsonSerializer.SerializeToUtf8Bytes(manifest))?.ContractFingerprint != SdkIdentity.ContractFingerprint) return 1;
var project = new ExecutionProjectRequest { Fingerprint = new string('a', 64), Sequence = 1, Kind = "asset",
    Name = "root", Offset = 0, MaximumBytes = 131072 };
var projectBytes = ExecutionProviderFrames.Encode(project, 65536);
if (JsonSerializer.Deserialize<ExecutionProjectRequest>(projectBytes) != project ||
    typeof(ExecutionProjectReader).GetMethod(nameof(ExecutionProjectReader.ReadFileAsync)) is null) return 1;
Console.WriteLine(JsonSerializer.Serialize(new { status = "PASS", scope = "independent SDK package consumer", handshake, manifest }));
return 0;

public sealed class ConsumerExtension(ExtensionActivationContext context) : IExtension
{
    public ValueTask ActivateAsync(IExtensionScope scope, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        ArgumentNullException.ThrowIfNull(context.PackageAssets);
        return ValueTask.CompletedTask;
    }
}
