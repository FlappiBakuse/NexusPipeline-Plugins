using System.Text.Json;
using System.Text.Json.Nodes;
using NexusPipeline.Extensions.MaaFramework;

internal static class BundleCases
{
    internal static readonly MaaCompilationSelection Selection = new("assets/interface.json", "mxu", "zh_cn", new("mxu", "mxu.json", "one"));
    internal static MaaSourceSet Sources(bool large = false)
    {
        var pi = CompilerFixture.Interface();
        if (large) pi["description"] = new string('x', 530000);
        var source = CompilerFixture.Mxu(); var instance = source["instances"]![0]!;
        instance["upstreamProgress"] = new JsonObject { ["count"] = 7, ["unknown"] = "preserve" };
        var duplicate = instance["tasks"]![0]!.DeepClone(); duplicate["id"] = "task-2";
        duplicate["enabled"] = false; duplicate["enabledByController"]!["PC"] = false;
        instance["tasks"]!.AsArray().Add(duplicate);
        return new([CompilerFixture.Input("assets/interface.json", pi.ToJsonString()), CompilerFixture.Input("mxu.json", source.ToJsonString())]);
    }
    internal static void Assert(bool value) { if (!value) throw new InvalidOperationException("bundle_assertion_failed"); }
    internal static void Reject(Action action)
    { try { action(); } catch (MaaInputFailure) { return; } throw new InvalidOperationException("expected_bundle_rejection"); }
    internal static void Run(Action<string, Action> run)
    {
        run("bundle-binds-full-pi-profile-progress-semantic-and-ordered-duplicate-occurrences", () => {
            var sources = Sources(); var bundle = MaaCompilationBundle.Build(sources, Selection);
            var view = MaaJson.Read(bundle.Execution); var full = MaaJson.Read(bundle.Artifact);
            var plan = MaaRuntimePlan.Read(bundle.Artifact, bundle.Pi.Artifact, JsonSerializer.Deserialize<JsonElement>(bundle.Execution));
            Assert(plan.Fingerprint == bundle.SemanticFingerprint);
            var index = MaaJson.Read(bundle.Index);
            Assert(index["artifact"]!["sha256"]!.GetValue<string>() == bundle.ArtifactSha256 &&
                index["execution"]!["sha256"]!.GetValue<string>() == bundle.ExecutionSha256 && bundle.Index.Length <= 65536);
            var rows = MaaJson.Objects(view["Tasks"]); var semantic = MaaJson.Objects(full["semantic"]!["Tasks"]);
            Assert(rows.Length == 2 && rows[0]["Id"]!.GetValue<string>() != rows[1]["Id"]!.GetValue<string>() &&
                rows[0]["Name"]!.GetValue<string>() == rows[1]["Name"]!.GetValue<string>() &&
                rows[0]["Order"]!.GetValue<int>() == 0 && rows[1]["Order"]!.GetValue<int>() == 1 &&
                rows[0]["Enabled"]!.GetValue<bool>() && !rows[1]["Enabled"]!.GetValue<bool>() && rows[1]["Compiled"] is null && semantic.Length == 1);
            Assert(full["profile"]!["SourceSnapshot"]!["instances"]![0]!["upstreamProgress"]!["count"]!.GetValue<int>() == 7 &&
                full["profile"]!["Sources"]!.AsArray().Count == 2 && bundle.SourceFingerprint == full["semantic"]!["SourceFingerprint"]!.GetValue<string>());
            var option = rows[0]["Options"]!;
            Assert(option["pointer"]!.GetValue<string>() == "/profile/Tasks/0/Options" && option["sha256"]!.GetValue<string>() ==
                MaaCompilationBundle.Hash(JsonSerializer.SerializeToUtf8Bytes(full["profile"]!["Tasks"]![0]!["Options"])));
            Assert(rows[0]["Entry"]!.GetValue<string>() == semantic[0]["Entry"]!.GetValue<string>() && bundle.Execution.Length <= 262144);
        });
        run("bundle-four-client-imports-use-one-semantic-owner-and-retain-native-repeat-count", () => {
            var fixtures = new[] {
                (Kind:"mxu", Inputs: new[] { ("mxu.json", CompilerFixture.Mxu()) }, Path:"mxu.json", Id:"one"),
                (Kind:"mfa", Inputs: new[] { ("appsettings.json", new JsonObject()), ("config/config.json", CompilerFixture.Mfa()) }, Path:"config/config.json", Id:"one"),
                (Kind:"maapicli", Inputs: new[] { ("config/maa_pi_config.json", CompilerFixture.Cli()) }, Path:"config/maa_pi_config.json", Id:"cli"),
                (Kind:"cfa", Inputs: new[] { ("config/configs/one.json", CompilerFixture.Cfa()),
                    ("config/multi_config.json", new JsonObject { ["config_list"] = new JsonArray("one"),
                        ["bundle"] = new JsonObject { ["Bundle"] = new JsonObject { ["path"] = "assets" } } }) }, Path:"config/configs/one.json", Id:"one") };
            foreach (var fixture in fixtures)
            {
                var sources = CompilerFixture.Sources(fixture.Inputs);
                var selection = new MaaCompilationSelection("assets/interface.json", fixture.Kind, "zh_cn", new(fixture.Kind, fixture.Path, fixture.Id));
                var bundle = MaaCompilationBundle.Build(sources, selection); var view = MaaJson.Read(bundle.Execution);
                var plan = MaaRuntimePlan.Read(bundle.Artifact, bundle.Pi.Artifact, JsonSerializer.Deserialize<JsonElement>(bundle.Execution));
                var selected = plan.Select([MaaJson.Required(view["Tasks"]![0]!.AsObject(), "Id")]);
                Assert(selected.Single().RepeatCount == (fixture.Kind == "mfa" ? 2 : 1));
            }
        });
        run("bundle-source-identity-and-available-source-set-are-part-of-frozen-input", () => {
            var same = new[] { CompilerFixture.Input("assets/interface.json", CompilerFixture.Interface().ToJsonString()),
                CompilerFixture.Input("mxu.json", CompilerFixture.Mxu().ToJsonString()) };
            var original = MaaCompilationBundle.Build(new MaaSourceSet(same), Selection);
            var changedIdentity = MaaCompilationBundle.Build(new MaaSourceSet([same[0] with { Identity = "other-physical-file" }, same[1]]), Selection);
            var additionalPath = MaaCompilationBundle.Build(new MaaSourceSet([.. same, CompilerFixture.Input("config/previously-missing.json", "{}")]), Selection);
            Assert(changedIdentity.SourceFingerprint != original.SourceFingerprint && changedIdentity.SnapshotFingerprint != original.SnapshotFingerprint);
            Assert(additionalPath.SourceFingerprint == original.SourceFingerprint && additionalPath.SnapshotFingerprint != original.SnapshotFingerprint);
            Assert(changedIdentity.ArtifactSha256 != original.ArtifactSha256 && additionalPath.ArtifactSha256 != original.ArtifactSha256);
        });
        run("bundle-execution-and-complete-closure-budgets-reject-without-truncation", () => {
            var sources = Sources(); Reject(() => MaaCompilationBundle.Build(sources, Selection, 1));
            Reject(() => MaaCompilationBundle.Serialize(new { value = new string('x', 16384) }, 16384));
            var bundle = MaaCompilationBundle.Build(sources, Selection);
            var view = JsonSerializer.Deserialize<JsonElement>(bundle.Execution);
            Reject(() => MaaRuntimePlan.Read(new byte[MaaCompilationBundle.MaximumBundleBytes + 1], bundle.Pi.Artifact, view));
            var largerView = MaaJson.Read(bundle.Execution);
            largerView["unexpected"] = new string('x', MaaCompilationBundle.MaximumExecutionBytes);
            Reject(() => MaaRuntimePlan.Read(bundle.Artifact, bundle.Pi.Artifact, JsonSerializer.SerializeToElement(largerView)));
        });
    }
}
