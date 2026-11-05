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
    internal static MaaCompilationBundle Rewrite(MaaCompilationBundle bundle, Action<JsonObject> edit)
    {
        var document = MaaJson.Read(bundle.Artifact); edit(document);
        var bytes = JsonSerializer.SerializeToUtf8Bytes(document);
        return bundle with { Artifact = bytes, ArtifactSha256 = MaaCompilationBundle.Hash(bytes) };
    }
    internal static void Run(Action<string, Action> run)
    {
        run("bundle-binds-full-pi-profile-progress-semantic-and-ordered-duplicate-occurrences", () => {
            var sources = Sources(); var bundle = MaaCompilationBundle.Build(sources, Selection);
            var view = bundle.Verify(sources, bundle.ArtifactSha256); var full = MaaJson.Read(bundle.Artifact);
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
                var bundle = MaaCompilationBundle.Build(sources, selection); var view = bundle.Verify(sources, bundle.ArtifactSha256);
                Assert(view["Tasks"]![0]!["RepeatCount"]!.GetValue<int>() == (fixture.Kind == "mfa" ? 2 : 1));
            }
        });
        foreach (var field in new[] { "profile-options", "profile-snapshot", "semantic", "semantic-fingerprint", "source-read-set", "selection" })
            run("bundle-reject-rehashed-" + field, () => {
                var sources = Sources(); var bundle = MaaCompilationBundle.Build(sources, Selection);
                var changed = Rewrite(bundle, document => {
                    if (field == "profile-options") document["profile"]!["Tasks"]![0]!["Options"]!["Mode"] = "A";
                    if (field == "profile-snapshot") document["profile"]!["SourceSnapshot"]!["instances"]![0]!["upstreamProgress"]!["count"] = 8;
                    if (field == "semantic") document["semantic"]!["Tasks"]![0]!["Entry"] = "other";
                    if (field == "semantic-fingerprint") document["semanticFingerprint"] = new string('0', 64);
                    if (field == "source-read-set") document["profile"]!["Sources"]![0]!["Identity"] = "other";
                    if (field == "selection") document["selection"]!["Language"] = "other";
                });
                Reject(() => changed.Verify(sources, changed.ArtifactSha256));
            });
        run("bundle-source-identity-and-available-source-set-are-part-of-frozen-input", () => {
            var sources = Sources(); var bundle = MaaCompilationBundle.Build(sources, Selection);
            var changed = CompilerFixture.Sources(("mxu.json", CompilerFixture.Mxu()));
            Reject(() => bundle.Verify(changed, bundle.ArtifactSha256));
            var same = new[] { CompilerFixture.Input("assets/interface.json", CompilerFixture.Interface().ToJsonString()),
                CompilerFixture.Input("mxu.json", CompilerFixture.Mxu().ToJsonString()) };
            var first = new MaaSourceSet(same); var original = MaaCompilationBundle.Build(first, Selection);
            Reject(() => original.Verify(new([same[0] with { Identity = "other-physical-file" }, same[1]]), original.ArtifactSha256));
            Reject(() => original.Verify(new([.. same, CompilerFixture.Input("config/previously-missing.json", "{}")]), original.ArtifactSha256));
        });
        run("bundle-reject-missing-corrupted-and-extraneous-pi-pages", () => {
            var sources = Sources(true); var bundle = MaaCompilationBundle.Build(sources, Selection);
            Assert(bundle.Pi.Pages.Count > 0);
            var pages = bundle.Pi.Pages.ToDictionary(pair => pair.Key, pair => pair.Value.ToArray()); var key = pages.Keys.First();
            pages.Remove(key); Reject(() => (bundle with { Pi = bundle.Pi with { Pages = pages } }).Verify(sources, bundle.ArtifactSha256));
            pages = bundle.Pi.Pages.ToDictionary(pair => pair.Key, pair => pair.Value.ToArray()); pages[key][0] ^= 1;
            Reject(() => (bundle with { Pi = bundle.Pi with { Pages = pages } }).Verify(sources, bundle.ArtifactSha256));
            pages = bundle.Pi.Pages.ToDictionary(pair => pair.Key, pair => pair.Value.ToArray()); pages.Add(new string('0', 64), "[]"u8.ToArray());
            Reject(() => (bundle with { Pi = bundle.Pi with { Pages = pages } }).Verify(sources, bundle.ArtifactSha256));
        });
        run("bundle-execution-must-be-derived-from-the-same-full-artifact", () => {
            var sources = Sources(); var bundle = MaaCompilationBundle.Build(sources, Selection); var view = MaaJson.Read(bundle.Execution);
            view["Tasks"]![0]!["RepeatCount"] = 99; var bytes = JsonSerializer.SerializeToUtf8Bytes(view);
            Reject(() => (bundle with { Execution = bytes, ExecutionSha256 = MaaCompilationBundle.Hash(bytes) }).Verify(sources, bundle.ArtifactSha256));
            Reject(() => bundle.Verify(sources, new string('0', 64)));
            var index = MaaJson.Read(bundle.Index); index["artifact"]!["sha256"] = new string('0', 64);
            var changed = JsonSerializer.SerializeToUtf8Bytes(index);
            Reject(() => (bundle with { Index = changed, IndexSha256 = MaaCompilationBundle.Hash(changed) }).Verify(sources, bundle.ArtifactSha256));
        });
        run("bundle-execution-and-complete-closure-budgets-reject-without-truncation", () => {
            var sources = Sources(); Reject(() => MaaCompilationBundle.Build(sources, Selection, 1));
            Reject(() => MaaCompilationBundle.Serialize(new { value = new string('x', 16384) }, 16384));
            var bundle = MaaCompilationBundle.Build(sources, Selection);
            Reject(() => (bundle with { Execution = new byte[262145] }).Verify(sources, bundle.ArtifactSha256));
            Reject(() => (bundle with { Artifact = new byte[MaaCompilationBundle.MaximumBundleBytes + 1] }).Verify(sources, bundle.ArtifactSha256));
        });
    }
}
