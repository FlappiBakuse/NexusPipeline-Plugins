using System.Text.Json;
using System.Text.Json.Nodes;
using NexusPipeline.Extensibility.Compilation;
using NexusPipeline.Extensibility.Protocol;
using NexusPipeline.Extensions.MaaFramework;

internal static class ProjectInputCases
{
    internal static void Run(Action<string, Action> run)
    {
        run("runtime-source-consumes-original-compiler-assets-through-bounded-sdk-chunks", () => {
            var source = new Source(); var project = source.Read(); var plan = project.Plan;
            BundleCases.Assert(plan.Fingerprint == source.Bundle.SemanticFingerprint && source.Reads.Contains("pi-artifact") &&
                source.Reads.Contains("bundle-artifact") && source.Reads.All(name => !name.StartsWith("editor", StringComparison.Ordinal)));
            BundleCases.Assert(plan.Select([source.Result.ExecutionView.GetProperty("Tasks")[0].GetProperty("Id").GetString()!]).Length == 1);
            BundleCases.Assert(project.ConsumerExtensionId == "maas" && project.BindingId == Guid.Parse("edc7f66f-6d2f-4990-833a-61b5c3f1a6eb") && project.Tasks.Length == 1);
            project.Tasks[0].Pipeline["changed"] = true;
            BundleCases.Assert(project.Tasks[0].Pipeline["changed"] is null);
        });
        run("runtime-source-large-private-pi-is-never-truncated-to-a-jint-frame", () => {
            var source = new Source(true); var plan = source.Read().Plan;
            BundleCases.Assert(plan.Fingerprint == source.Bundle.SemanticFingerprint && source.Chunks > source.Reads.Count &&
                source.Bundle.Pi.Artifact.Length > 524288);
        });
        run("runtime-source-binds-business-task-alias-to-the-original-independent-native-occurrence", () => {
            var source = new Source { Fault = "mapped" }; var project = source.Read();
            BundleCases.Assert(project.Tasks.Length == 1 && project.BusinessId(project.Tasks[0].OccurrenceId) == "business-id");
            BundleCases.Reject(() => project.BusinessId("foreign-occurrence"));
        });
        foreach (var fault in new[] { "root", "inventory-count", "inventory-offset", "duplicate", "digest", "chunk", "chunk-offset", "view", "index",
            "selection-missing", "selection-duplicate", "selection-disabled", "selection-unknown", "consumer", "binding",
            "mapping-count", "mapping-duplicate", "mapping-unknown", "mapping-empty" })
            run("runtime-source-rejects-mixed-input-" + fault, () => {
                var source = new Source { Fault = fault }; BundleCases.Reject(() => source.Read());
            });
    }

    private sealed class Source : IMaaProjectSource
    {
        internal MaaCompilationBundle Bundle { get; }
        internal CompilationResult Result { get; }
        internal string? Fault { get; init; }
        internal HashSet<string> Reads { get; } = new(StringComparer.Ordinal);
        internal int Chunks { get; private set; }
        private readonly Dictionary<string, byte[]> contents;
        private const string Fingerprint = "dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd";
        internal Source(bool large = false)
        {
            Bundle = MaaCompilationBundle.Build(BundleCases.Sources(large), BundleCases.Selection);
            Result = MaaCompilerAssets.Create(Bundle, new MaaSelectedFiles(SelectedSourceFixture.Create(), default));
            contents = Result.Assets.ToDictionary(asset => asset.Name, asset => asset.Content.ToArray(), StringComparer.Ordinal);
        }
        internal MaaWorkerProject Read() => MaaProjectInputs.ReadAsync(this, default).GetAwaiter().GetResult();
        public Task<ExecutionProjectResponse> ManifestAsync(CancellationToken cancellation)
        {
            var view = MaaJson.Read(JsonSerializer.SerializeToUtf8Bytes(Result.ExecutionView));
            if (Fault == "view") view["Tasks"]![0]!["Entry"] = "unrelated";
            var id = view["Tasks"]![0]!["Id"]!.GetValue<string>();
            var selection = new ExecutionProjectResponseSelection { ConsumerExtensionId = Fault == "consumer" ? "../other" : "maas",
                BindingId = Fault == "binding" ? Guid.Empty.ToString("D") : "edc7f66f-6d2f-4990-833a-61b5c3f1a6eb",
                SelectedTaskIds = Fault switch { "selection-duplicate" => [id, id], "selection-disabled" => [view["Tasks"]![1]!["Id"]!.GetValue<string>()],
                    "selection-unknown" => ["DailyEntry"], "mapped" => ["business-id"], "mapping-duplicate" => ["business-a", "business-b"], _ => [id] },
                ExecutionTaskIds = Fault switch { "mapped" => [id], "mapping-count" => [], "mapping-duplicate" => [id, id],
                    "mapping-unknown" => ["foreign"], "mapping-empty" => [""], _ => null } };
            return Task.FromResult(Response("manifest") with { RootIndex = Fault == "root" ? "other" : Result.RootIndex,
                Selection = Fault == "selection-missing" ? null : selection,
                AssetCount = contents.Count + (Fault == "inventory-count" ? 1 : 0), View = JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(view.ToJsonString()) });
        }
        public Task<ExecutionProjectResponse> AssetsAsync(long index, CancellationToken cancellation)
        {
            var assets = Result.Assets.Skip(checked((int)index)).Take(16).Select(asset => new ExecutionProjectResponseAssetsItem {
                Name = asset.Name, Kind = asset.Kind.ToString().ToLowerInvariant(), Sha256 = MaaCompilationBundle.Hash(asset.Content.Span), SizeBytes = asset.Content.Length }).ToArray();
            if (Fault == "duplicate" && assets.Length > 1) assets[1] = assets[0];
            return Task.FromResult(Response("assets") with { Index = Fault == "inventory-offset" ? index + 1 : index, Assets = assets });
        }
        public Task<ExecutionProjectResponse> ReadAsync(string name, long offset, int maximumBytes, CancellationToken cancellation)
        {
            Reads.Add(name); Chunks++; var bytes = contents[name]; var count = Math.Min(maximumBytes, bytes.Length - checked((int)offset));
            var chunk = bytes.AsSpan(checked((int)offset), count).ToArray();
            if (Fault == "chunk" && chunk.Length > 0) chunk[0] ^= 1;
            if (Fault == "index" && name == "bundle-index")
            {
                var index = MaaJson.Read(bytes); index["artifact"]!["bytes"] = 1; bytes = JsonSerializer.SerializeToUtf8Bytes(index);
                chunk = bytes.AsSpan(checked((int)offset), Math.Min(maximumBytes, bytes.Length - checked((int)offset))).ToArray();
            }
            return Task.FromResult(Response("asset") with { Offset = Fault == "chunk-offset" ? offset + 1 : offset,
                Sha256 = Fault == "digest" ? new string('0', 64) : MaaCompilationBundle.Hash(bytes),
                SizeBytes = bytes.Length, ContentBase64 = Convert.ToBase64String(chunk) });
        }
        private static ExecutionProjectResponse Response(string kind) => new() { Fingerprint = Fingerprint, Sequence = 1, Kind = kind };
    }
}
