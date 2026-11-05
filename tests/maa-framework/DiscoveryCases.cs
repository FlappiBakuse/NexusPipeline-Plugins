using System.Text.Json.Nodes;
using NexusPipeline.Extensions.MaaFramework;

internal static class DiscoveryCases
{
    internal static void Run(Action<string, Action> run)
    {
        static void Assert(bool value) { if (!value) throw new InvalidOperationException("assertion_failed"); }
        static void Reject(Action action) { try { action(); } catch (MaaInputFailure) { return; } throw new InvalidOperationException("rejection_expected"); }
        run("optional-assets-discovery-does-not-probe-unobserved-case-alias", () => {
            var source = new SelectedSourceFixture();
            source.Add(CompilerFixture.Input("interface.json", CompilerFixture.Interface().ToJsonString()));
            source.Add(CompilerFixture.Input("Assets/icon.png", "not-read"));
            var files = new MaaSelectedFiles(source, CancellationToken.None);
            MaaSourceDiscovery.CaptureAsync(files, new(null, "project", "zh_cn", null)).AsTask().GetAwaiter().GetResult();
            Assert(source.Lists.Contains("") && !source.Lists.Contains("assets") && source.Reads.Contains("interface.json"));
        });
        run("discovery-all-four-sources-preserve-same-labels-as-distinct-explicit-identities", () => {
            var mxu = CompilerFixture.Mxu(); var second = mxu["instances"]![0]!.DeepClone(); second["id"] = "two"; mxu["instances"]!.AsArray().Add(second);
            var sources = CompilerFixture.Sources(("config/mxu-project.json", mxu), ("appsettings.json", new()), ("config/config.json", CompilerFixture.Mfa()),
                ("config/instances/one.json", new()), ("config/maa_pi_config.json", CompilerFixture.Cli()),
                ("config/multi_config.json", new() { ["config_list"] = new JsonArray("one") }), ("config/configs/one.json", CompilerFixture.Cfa()));
            var result = MaaProjectDiscovery.Discover(sources);
            Assert(result.SelectedInterface == "assets/interface.json" && result.Sources.Select(source => source.Kind).Distinct().Count() == 4);
            var copies = result.Sources.Where(source => source.Kind == "mxu").ToArray(); Assert(copies.Length == 2 && copies[0].Name == copies[1].Name && copies[0].Id != copies[1].Id);
        });
        run("multiple-interfaces-require-explicit-selection-not-current-gui", () => {
            var sources = CompilerFixture.Sources(("other/interface.json", CompilerFixture.Interface()));
            var candidates = MaaProjectDiscovery.Discover(sources); Assert(candidates.Interfaces.Length == 2 && candidates.SelectedInterface is null);
            Assert(MaaProjectDiscovery.Discover(sources, "other/interface.json").SelectedInterface == "other/interface.json");
            Reject(() => MaaProjectDiscovery.Discover(sources, "missing/interface.json"));
        });
        run("import-dialects-keep-native-cli-first-option-mxu-replacement-mfa-patch-and-cfa-deep-merge", () => {
            var main = CompilerFixture.Interface(); main["import"] = new JsonArray("part.json");
            main["option"]!["Mode"]!["pipeline_override"] = new JsonObject { ["N"] = new JsonObject { ["a"] = 1, ["b"] = 2 } };
            var child = new JsonObject { ["option"] = new JsonObject { ["Mode"] = new JsonObject { ["type"] = "checkbox", ["label"] = "child",
                ["cases"] = new JsonArray(new JsonObject { ["name"] = "C" }), ["pipeline_override"] = new JsonObject { ["N"] = new JsonObject { ["a"] = 3 } } } } };
            MaaPiProject Compile(string kind) => new MaaPiCompiler(new([CompilerFixture.Input("assets/interface.json", main.ToJsonString()), CompilerFixture.Input("assets/part.json", child.ToJsonString())]), kind).Compile("assets/interface.json");
            var cli = Compile("maapicli"); Assert(MaaJson.Text(MaaJson.Object(cli.Options["Mode"]), "type") == "select" && cli.Options["Mode"]!["label"] is null);
            var mxu = Compile("mxu"); Assert(MaaJson.Text(MaaJson.Object(mxu.Options["Mode"]), "type") == "checkbox" && mxu.Options["Mode"]!["pipeline_override"]!["N"]!["b"] is null);
            var mfa = Compile("mfa"); Assert(MaaJson.Text(MaaJson.Object(mfa.Options["Mode"]), "type") == "select" && mfa.Options["Mode"]!["label"]!.GetValue<string>() == "child");
            var cfa = Compile("cfa"); Assert(cfa.Options["Mode"]!["pipeline_override"]!["N"]!["b"]!.GetValue<int>() == 2 && cfa.Options["Mode"]!["pipeline_override"]!["N"]!["a"]!.GetValue<int>() == 3);
            Assert(new[] { cli, mxu, mfa, cfa }.Select(project => project.CompilationFingerprint).Distinct().Count() == 4);
        });
        run("cfa-normalizes-legacy-global-options-to-visible-setting-once", () => {
            var main = CompilerFixture.Interface(); main["global_option"] = new JsonArray("Mode");
            var project = new MaaPiCompiler(new([CompilerFixture.Input("assets/interface.json", main.ToJsonString())]), "cfa").Compile("assets/interface.json");
            Assert(project.Declaration["global_option"] is null && project.Declaration["setting"]![0]!["name"]!.GetValue<string>() == "global_option");
        });
        run("mfa-wait-actions-have-technical-native-custom-parameters-without-arbitrary-programs", () => {
            var source = CompilerFixture.Mfa(); source["TaskItems"]!.AsArray().Add(new JsonObject { ["name"] = "wait", ["entry"] = "CountdownAction", ["default_check"] = true,
                ["pipeline_override"] = new JsonObject { ["CountdownAction"] = new JsonObject { ["action"] = "Custom", ["custom_action"] = "CountdownAction", ["custom_action_param"] = new JsonObject { ["seconds"] = 60 } } } });
            var (files, project) = CompilerFixture.Project(("appsettings.json", new()), ("config/config.json", source), ("config/instances/one.json", new()));
            var profile = new MaaProjectImport(files, project).Import(new("mfa", "config/instances/one.json", "one")); var plan = MaaSemanticCompiler.Compile(project, profile);
            Assert(profile.Tasks.Last().Role == "technical" && plan.Tasks.Last().Kind == "mfa-wait" && plan.Tasks.Last().Pipeline["CountdownAction"]!["custom_action_param"]!["seconds"]!.GetValue<int>() == 60);
            Reject(() => MaaWaitPolicy.Parameters("CountdownAction", new() { ["CountdownAction"] = new JsonObject { ["action"] = "Custom", ["custom_action"] = "CountdownAction", ["custom_action_param"] = new JsonObject { ["seconds"] = 86401 } } }));
        });
        run("mxu-disabled-preactions-are-preserved-but-not-enabled-unsupported-shells", () => {
            var source = CompilerFixture.Mxu(); source["instances"]![0]!["preActions"] = new JsonArray(new JsonObject { ["enabled"] = false, ["useCmd"] = true, ["program"] = "do-not-run" });
            var (files, project) = CompilerFixture.Project(("mxu.json", source));
            Assert(new MaaProjectImport(files, project).Import(new("mxu", "mxu.json", "one")).Connection["hostLaunch"] is null);
            source["instances"]![0]!["preActions"]![0]!["enabled"] = true; var next = CompilerFixture.Project(("mxu.json", source));
            Reject(() => new MaaProjectImport(next.Sources, next.Project).Import(new("mxu", "mxu.json", "one")));
        });
        run("discovery-and-other-instance-reads-do-not-contaminate-selected-source-fingerprint", () => {
            var sources = CompilerFixture.Sources(("appsettings.json", new()), ("config/config.json", CompilerFixture.Mfa()),
                ("config/instances/one.json", new()), ("config/instances/two.json", new() { ["InstanceName"] = "other" }));
            _ = MaaProjectDiscovery.Discover(sources); var project = new MaaPiCompiler(sources).Compile("assets/interface.json");
            Assert(project.Sources.All(proof => proof.Path == "assets/interface.json"));
            var profile = new MaaProjectImport(sources, project).Import(new("mfa", "config/instances/one.json", "one"));
            Assert(profile.Sources.Any(proof => proof.Path == "config/instances/one.json") && profile.Sources.All(proof => proof.Path != "config/instances/two.json"));
        });
        run("frozen-input-is-copied-and-cancelled-compilation-starts-no-read-work", () => {
            var original = CompilerFixture.Input("assets/interface.json", CompilerFixture.Interface().ToJsonString());
            var bytes = original.Content.ToArray(); var sources = new MaaSourceSet([original with { Content = bytes }]); Array.Fill(bytes, (byte)'x');
            Assert(new MaaPiCompiler(sources).Compile("assets/interface.json").Tasks.Length == 1);
            using var cancellation = new CancellationTokenSource(); cancellation.Cancel();
            try { new MaaPiCompiler(sources).Compile("assets/interface.json", cancellationToken: cancellation.Token); throw new InvalidOperationException("cancelled_compile_started"); }
            catch (OperationCanceledException) { }
        });
    }
}
