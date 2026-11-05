using System.Text.Json;
using System.Text.Json.Nodes;
using NexusPipeline.Extensibility.Compilation;
using NexusPipeline.Extensions.MaaFramework;

internal static class MountCases
{
    private static readonly MaaCompilationSelection Mfa = new("assets/interface.json", "mfa", "zh_cn", new("mfa", "config/instances/one.json", "one"));
    private static JsonElement Selection(MaaCompilationSelection? selection = null) => JsonSerializer.SerializeToElement(selection ?? BundleCases.Selection);
    private static CompilationResult Compile(SelectedSourceFixture source, MaaCompilationSelection? selection = null)
        => new MaaProjectCompiler().CompileAsync(source, Selection(selection), default).GetAwaiter().GetResult();
    private static void Assert(bool condition) => BundleCases.Assert(condition);
    private static void Reject(Action action) => BundleCases.Reject(action);
    private static SelectedSourceFixture MfaSource(string config = "Default")
    {
        var source = new SelectedSourceFixture();
        source.Add(CompilerFixture.Input("assets/interface.json", CompilerFixture.Interface().ToJsonString()));
        source.Add(CompilerFixture.Input("appsettings.json", JsonSerializer.Serialize(new { DefaultConfig = config })));
        source.Add(CompilerFixture.Input("config/instances/one.json", "{}"));
        source.Add(CompilerFixture.Input("config/config.json", CompilerFixture.Mfa().ToJsonString()));
        source.Directories.Add("assets/resource");
        return source;
    }
    internal static void Run(Action<string, Action> run)
    {
        run("mount-unsaved-discovery-candidate-does-not-authorize-compile", () => {
            var source = SelectedSourceFixture.Create(); source.Mounts.Clear();
            var result = new MaaProjectCompiler().DiscoverAsync(source, Selection(), default).GetAwaiter().GetResult();
            Assert(result.GetProperty("Sources").GetArrayLength() == 1);
            source.Reads.Clear(); source.Lists.Clear(); Reject(() => Compile(source));
            Assert(source.Reads.Count == 0 && source.Lists.Count == 0);
        });
        run("mount-selection-cannot-supply-fabricated-metadata", () => {
            var source = SelectedSourceFixture.Create(); source.Mounts.Clear();
            var node = JsonSerializer.SerializeToNode(BundleCases.Selection)!.AsObject();
            node["Configurations"] = JsonSerializer.SerializeToNode(new[] { new SourceConfiguration("fake", "mxu.json", 1, 1,
                new string('a', 64), new string('b', 64), SourceEntryKind.File, true, "one") });
            using var selection = JsonDocument.Parse(node.ToJsonString());
            Reject(() => new MaaProjectCompiler().CompileAsync(source, selection.RootElement, default).GetAwaiter().GetResult());
            Assert(source.Reads.Count == 0 && source.Lists.Count == 0);
        });
        foreach (var instance in new[] { "other", "One" })
            run("mount-required-instance-must-match-exactly/" + instance, () => {
                var source = SelectedSourceFixture.Create(); source.Mounts[0] = source.Mounts[0] with { InstanceKey = instance };
                Reject(() => Compile(source)); Assert(source.Reads.Count == 0);
            });
        run("mount-directory-grant-does-not-cover-a-prefix-sibling-or-directory-itself-as-file", () => {
            var source = SelectedSourceFixture.Create(); source.Mounts.Clear(); source.Mount("mxu", SourceEntryKind.Directory, "one");
            Reject(() => Compile(source));
            source.Mounts.Clear(); source.Mount("mxu.json", SourceEntryKind.Directory, "one"); Reject(() => Compile(source));
            Assert(source.Reads.Count == 0);
        });
        run("mount-revision-change-during-a-real-source-read-rejects-the-compilation", () => {
            var source = SelectedSourceFixture.Create(); source.ChangeFile = (_, file) => {
                source.Mounts[0] = source.Mounts[0] with { Revision = 2 }; return file; };
            Reject(() => Compile(source)); Assert(source.Reads.Count == 1);
        });
        foreach (var changed in new[] { "revision", "contract-revision", "contract-sha", "snapshot-sha" })
            run("mount-complete-identity-is-bound-even-when-source-bytes-match/" + changed, () => {
                var source = SelectedSourceFixture.Create(); var original = Compile(source);
                var mount = source.Mounts[0]; source.Mounts[0] = changed switch {
                    "revision" => mount with { Revision = 2 }, "contract-revision" => mount with { ContractRevision = 2 },
                    "contract-sha" => mount with { ContractSha256 = new string('c', 64) }, _ => mount with { SnapshotSha256 = new string('d', 64) } };
                var result = Compile(source);
                Assert(original.ExecutionView.GetProperty("snapshotFingerprint").GetString() != result.ExecutionView.GetProperty("snapshotFingerprint").GetString() &&
                    original.ExecutionView.GetProperty("semanticFingerprint").GetString() == result.ExecutionView.GetProperty("semanticFingerprint").GetString());
                var facts = MaaJson.Read(result.Assets.Single(asset => asset.Name == "source-observations").Content);
                Assert(facts["configurations"]![0]!["Revision"]!.GetValue<long>() == source.Mounts[0].Revision);
            });
        foreach (var dependency in new[] { "settings", "global", "missing-global-namespace", "live-alternate", "fallback" })
            run("mount-mfa-every-inheritance-input-needs-saved-namespace/" + dependency, () => {
                var source = MfaSource(dependency is "missing-global-namespace" or "fallback" ? "Absent" : dependency == "live-alternate" ? "Alternate" : "Default");
                source.Mount("config/instances/one.json", SourceEntryKind.File, "one");
                if (dependency != "settings") source.Mount("appsettings.json", SourceEntryKind.File, null);
                if (dependency == "live-alternate")
                {
                    source.Add(CompilerFixture.Input("config/mfa_Alternate.json", CompilerFixture.Mfa().ToJsonString()));
                    source.Mount("config/config.json", SourceEntryKind.File, "one");
                }
                if (dependency == "missing-global-namespace") source.Mount("config/config.json", SourceEntryKind.File, "one");
                if (dependency == "fallback") source.Mount("config/mfa_Absent.json", SourceEntryKind.File, "one");
                Reject(() => Compile(source, Mfa));
                if (dependency == "settings") Assert(!source.Reads.Contains("appsettings.json"));
                if (dependency == "live-alternate") Assert(!source.Reads.Contains("config/mfa_Alternate.json"));
                if (dependency == "missing-global-namespace") Assert(!source.Reads.Contains("config/mfa_Absent.json"));
                if (dependency is "global" or "fallback") Assert(!source.Reads.Contains("config/config.json"));
            });
        run("mount-mfa-primary-and-all-prefix-default-global-layers-come-from-saved-files", () => {
            var source = MfaSource(); var global = CompilerFixture.Mfa();
            global["Instance.one.Resource"] = "Official"; global["Instance.default.CurrentControllerName"] = "PC";
            source.Files["config/config.json"] = CompilerFixture.Input("config/config.json", global.ToJsonString());
            source.Mount("appsettings.json", SourceEntryKind.File, null); source.Mount("config", SourceEntryKind.Directory, "one");
            Assert(Compile(source, Mfa).ExecutionView.GetProperty("Tasks")[0].GetProperty("RepeatCount").GetInt32() == 2);
        });
        run("mount-cfa-main-bundle-configuration-is-not-authorized-by-the-task-file-mount", () => {
            var source = SelectedSourceFixture.Create();
            source.Add(CompilerFixture.Input("config/multi_config.json", "{\"config_list\":[\"one\"],\"bundle\":{\"Bundle\":{\"path\":\"assets\"}}}"));
            source.Add(CompilerFixture.Input("config/configs/one.json", CompilerFixture.Cfa().ToJsonString()));
            source.Mount("config/configs/one.json", SourceEntryKind.File, "one");
            Reject(() => Compile(source, new("assets/interface.json", "cfa", "zh_cn", new("cfa", "config/configs/one.json", "one"))));
            Assert(!source.Reads.Contains("config/multi_config.json"));
        });
        run("resource-tree-declarations-preserve-semantic-order-and-deduplicate-exact-paths", () => {
            var source = SelectedSourceFixture.Create(); var pi = CompilerFixture.Interface();
            pi["resource"]![0]!["path"] = new JsonArray("resource", "other", "resource");
            pi["controller"]![0]!["attach_resource_path"] = new JsonArray("other", "extra");
            source.Files["assets/interface.json"] = CompilerFixture.Input("assets/interface.json", pi.ToJsonString());
            source.Directories.Add("assets/other"); source.Directories.Add("assets/extra");
            var trees = Compile(source).ResourceTrees!;
            Assert(trees.Select(tree => tree.Path).SequenceEqual(new[] { "assets/resource", "assets/other", "assets/extra" }) &&
                trees.Select(tree => tree.Name).SequenceEqual(new[] { "resource-0", "resource-1", "resource-2" }));
        });
        run("resource-tree-declarations-reject-nine-trees-without-truncation", () => {
            var source = SelectedSourceFixture.Create(); var pi = CompilerFixture.Interface();
            pi["resource"]![0]!["path"] = new JsonArray(Enumerable.Range(0, 9).Select(index => (JsonNode)JsonValue.Create("resource-" + index)!).ToArray());
            source.Files["assets/interface.json"] = CompilerFixture.Input("assets/interface.json", pi.ToJsonString());
            Reject(() => Compile(source)); Assert(!source.Lists.Any(path => path.StartsWith("assets/resource-", StringComparison.Ordinal)));
        });
    }
}
