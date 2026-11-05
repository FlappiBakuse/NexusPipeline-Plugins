using System.Text.Json;
using System.Text.Json.Nodes;
using NexusPipeline.Extensibility.Compilation;
using NexusPipeline.Extensions.MaaFramework;

internal static class ProviderCases
{
    private static JsonElement Selection(MaaCompilationSelection? selection = null) => JsonSerializer.SerializeToElement(selection ?? BundleCases.Selection);
    private static CompilationResult Compile(ISelectedSource source, JsonElement? selection = null)
        => new MaaProjectCompiler().CompileAsync(source, selection ?? Selection(), default).GetAwaiter().GetResult();
    private static JsonObject Json(ReadOnlyMemory<byte> bytes) => MaaJson.Read(bytes);
    private static void Assert(bool value) => BundleCases.Assert(value);
    private static void Reject(Action action) => BundleCases.Reject(action);
    internal static void Run(Action<string, Action> run)
    {
        run("sdk-provider-agent-without-runtime-remains-readable-and-cannot-execute", () => {
            var source = SelectedSourceFixture.Create(); var pi = CompilerFixture.Interface();
            pi["agent"] = new JsonArray(new JsonObject { ["child_exec"] = "agent/service.exe" });
            source.Files["assets/interface.json"] = CompilerFixture.Input("assets/interface.json", pi.ToJsonString());
            var result = Compile(source);
            Assert(!result.CanExecute && result.ResourceTrees!.All(tree => tree.IncludedPaths is null));
            var full = Json(result.Assets.Single(asset => asset.Name == "bundle-artifact").Content);
            Assert(full["blockingDiagnostics"]!.AsArray().Any(issue => issue!["Code"]!.GetValue<string>() == "maa_project_runtime_selection_required"));
            Assert(full["pi"] is JsonObject && full["profile"] is JsonObject);
        });
        run("sdk-provider-actual-interface-discovers-and-compiles-only-host-selected-bytes", () => {
            var source = SelectedSourceFixture.Create(); IProjectCompiler compiler = new MaaProjectCompiler();
            var discovered = compiler.DiscoverAsync(source, Selection(), default).GetAwaiter().GetResult();
            Assert(discovered.GetProperty("SelectedInterface").GetString() == "assets/interface.json" && discovered.GetProperty("Sources").GetArrayLength() == 1);
            source.Reads.Clear(); var result = Compile(source);
            Assert(source.Reads.SequenceEqual(new[] { "assets/interface.json", "mxu.json" }) &&
                source.Lists.Contains("assets/resource") && source.Lists.Contains("assets/resource/pipeline"));
            Assert(result.RootIndex == "project" && result.ExecutionView.GetProperty("Tasks").GetArrayLength() == 1);
            var facts = Json(result.Assets.Single(asset => asset.Name == "source-observations").Content);
            Assert(facts["resourceArchiveRequired"]!.GetValue<bool>() && facts["resourceTrees"]![0]!.GetValue<string>() == "assets/resource");
            Assert(result.ResourceTrees is { Count: 1 } && result.ResourceTrees[0] == new SourceResourceTree("resource-0", "assets/resource"));
        });
        run("sdk-provider-returns-one-closed-dag-and-bounded-assets-without-hydrating-native-files", () => {
            var source = SelectedSourceFixture.Create(true); var result = Compile(source);
            var assets = result.Assets.ToDictionary(asset => asset.Name, StringComparer.OrdinalIgnoreCase);
            var visited = new HashSet<string>(); var visiting = new HashSet<string>();
            void Visit(string name)
            {
                if (visited.Contains(name)) return; Assert(visiting.Add(name)); var asset = assets[name];
                foreach (var child in asset.References) { Assert(assets.ContainsKey(child)); Visit(child); }
                visiting.Remove(name); visited.Add(name);
            }
            Visit(result.RootIndex); Assert(visited.Count == assets.Count && assets[result.RootIndex].Kind == CompiledAssetKind.Index);
            Assert(assets.Values.Any(asset => asset.Kind == CompiledAssetKind.Page) &&
                assets.Values.Where(asset => asset.Kind == CompiledAssetKind.Page).All(asset => asset.Content.Length <= 65536) &&
                assets.Values.Sum(asset => (long)asset.Content.Length) <= 32 * 1024 * 1024 && JsonSerializer.SerializeToUtf8Bytes(result.ExecutionView).Length <= 262144);
            Assert(!source.Reads.Any(path => path.Contains("/pipeline/", StringComparison.Ordinal) || path.EndsWith(".png", StringComparison.Ordinal) || path.EndsWith(".dll", StringComparison.Ordinal)));
        });
        run("sdk-provider-retains-negative-global-fallback-and-missing-pipeline-observations", () => {
            var source = new SelectedSourceFixture();
            source.Add(CompilerFixture.Input("assets/interface.json", CompilerFixture.Interface().ToJsonString()));
            source.Add(CompilerFixture.Input("appsettings.json", "{\"DefaultConfig\":\"Absent\"}"));
            source.Add(CompilerFixture.Input("config/config.json", CompilerFixture.Mfa().ToJsonString()));
            source.Add(CompilerFixture.Input("config/instances/one.json", "{}")); source.Directories.Add("assets/resource");
            source.Mount("appsettings.json", SourceEntryKind.File, null); source.Mount("config", SourceEntryKind.Directory, "one");
            var result = Compile(source, Selection(new("assets/interface.json", "mfa", "zh_cn", new("mfa", "config/instances/one.json", "one"))));
            var facts = Json(result.Assets.Single(asset => asset.Name == "source-observations").Content);
            Assert(MaaJson.Strings(facts["absentFiles"]).Contains("config/mfa_Absent.json", StringComparer.Ordinal) &&
                MaaJson.Objects(facts["directories"]).Any(item => MaaJson.Text(item, "path") == "assets/resource/pipeline" && !item["Exists"]!.GetValue<bool>()));
            Assert(result.ExecutionView.GetProperty("Tasks")[0].GetProperty("RepeatCount").GetInt32() == 2);
        });
        run("sdk-provider-recursive-import-and-selected-locale-use-main-interface-basis", () => {
            var source = SelectedSourceFixture.Create(); var pi = CompilerFixture.Interface(); pi["import"] = new JsonArray("tasks/extra.json");
            pi["languages"] = new JsonObject { ["zh_cn"] = "locales/zh.json" };
            source.Files["assets/interface.json"] = CompilerFixture.Input("assets/interface.json", pi.ToJsonString());
            source.Add(CompilerFixture.Input("assets/tasks/extra.json", "{\"import\":[\"tasks/deep.json\"]}"));
            source.Add(CompilerFixture.Input("assets/tasks/deep.json", "{}"));
            source.Add(CompilerFixture.Input("assets/locales/zh.json", "{\"name\":\"翻译\"}"));
            var result = Compile(source);
            Assert(source.Reads.Contains("assets/tasks/extra.json") && source.Reads.Contains("assets/locales/zh.json"));
            var full = Json(result.Assets.Single(asset => asset.Name == "bundle-artifact").Content);
            Assert(source.Reads.Contains("assets/tasks/deep.json") && full["profile"]!["Sources"]!.AsArray().Count == 5);
        });
        foreach (var kind in new[] { "mfa", "cfa", "maapicli" })
            run("sdk-provider-discover-and-compile-client/" + kind, () => {
                var source = SelectedSourceFixture.Create(); string path;
                if (kind == "mfa")
                {
                    source.Add(CompilerFixture.Input("appsettings.json", "{}"));
                    source.Add(CompilerFixture.Input("config/config.json", CompilerFixture.Mfa().ToJsonString()));
                    source.Add(CompilerFixture.Input("config/instances/one.json", "{}")); path = "config/instances/one.json";
                }
                else if (kind == "cfa")
                {
                    source.Add(CompilerFixture.Input("config/multi_config.json", "{\"config_list\":[\"one\"],\"bundle\":{\"Bundle\":{\"path\":\"assets\"}}}"));
                    source.Add(CompilerFixture.Input("config/configs/one.json", CompilerFixture.Cfa().ToJsonString())); path = "config/configs/one.json";
                }
                else { source.Add(CompilerFixture.Input("config/maa_pi_config.json", CompilerFixture.Cli().ToJsonString())); path = "config/maa_pi_config.json"; }
                if (kind == "mfa") source.Mount("appsettings.json", SourceEntryKind.File, null);
                if (kind is "mfa" or "cfa") source.Mount("config", SourceEntryKind.Directory, "one");
                else source.Mount(path, SourceEntryKind.File, "cli");
                var selection = Selection(new("assets/interface.json", kind, "zh_cn", new(kind, path, kind == "maapicli" ? "cli" : "one")));
                var discovered = new MaaProjectCompiler().DiscoverAsync(source, selection, default).GetAwaiter().GetResult();
                Assert(discovered.GetProperty("Sources").EnumerateArray().Any(item => item.GetProperty("Kind").GetString() == kind));
                Assert(Compile(source, selection).ExecutionView.GetProperty("Kind").GetString() == kind);
            });
        foreach (var input in new[] { "{\"interfacePath\":\"assets/interface.json\"}", "{\"Other\":1}",
                     "{\"InterfacePath\":\"../interface.json\"}", "{\"InterfacePath\":\"assets/interface.json\",\"InterfacePath\":\"interface.json\"}" })
            run("sdk-provider-reject-selection/" + input, () => {
                var source = SelectedSourceFixture.Create(); using var value = JsonDocument.Parse(input);
                Reject(() => Compile(source, value.RootElement)); Assert(source.Reads.Count == 0 && source.Lists.Count == 0);
            });
        foreach (var fault in new[] { "sha", "identity", "path", "case-alias", "false-directory" })
            run("sdk-provider-reject-unbound-host-source/" + fault, () => {
                var source = SelectedSourceFixture.Create();
                if (fault == "case-alias") source.ChangeDirectory = (_, value) => new(value.Exists, [.. value.Entries, new("INTERFACE.json", SourceEntryKind.File, "other")]);
                else if (fault == "false-directory") source.ChangeDirectory = (_, value) => new(false, value.Entries);
                else source.ChangeFile = (_, value) => fault == "sha" ? value with { Sha256 = new string('0', 64) } :
                    fault == "identity" ? value with { Identity = "foreign" } : value with { Path = "other.json" };
                Reject(() => Compile(source));
            });
        run("sdk-provider-file-budget-refuses-full-import-closure-without-truncating", () => {
            var source = SelectedSourceFixture.Create(); var pi = CompilerFixture.Interface(); var imports = new JsonArray();
            for (var index = 0; index < 128; index++) { imports.Add("tasks/" + index + ".json"); source.Add(CompilerFixture.Input("assets/tasks/" + index + ".json", "{}")); }
            pi["import"] = imports; source.Files["assets/interface.json"] = CompilerFixture.Input("assets/interface.json", pi.ToJsonString());
            Reject(() => Compile(source));
        });
        run("sdk-provider-refuses-oversized-file-or-directory-before-copying-content", () => {
            var source = SelectedSourceFixture.Create(); source.ChangeFile = (_, file) => file with { Content = new byte[8 * 1024 * 1024 + 1] };
            Reject(() => Compile(source));
            source = SelectedSourceFixture.Create(); source.ChangeDirectory = (_, _) => new(true,
                Enumerable.Range(0, 4097).Select(index => new SourceEntry("file" + index, SourceEntryKind.File, "identity")).ToArray());
            Reject(() => Compile(source));
        });
        run("sdk-provider-compiler-registration-uses-the-declared-project-id", () => {
            var registration = new Registration(); MaaProjectCompiler.RegisterAsync(registration, default).GetAwaiter().GetResult();
            Assert(registration.Id == "project" && registration.Compiler is MaaProjectCompiler);
            Assert(registration.Compiler!.CompileAsync(SelectedSourceFixture.Create(), Selection(), default).GetAwaiter().GetResult().RootIndex == "project");
        });
        run("sdk-provider-cancellation-does-not-start-source-reads", () => {
            var source = SelectedSourceFixture.Create(); using var cancellation = new CancellationTokenSource(); cancellation.Cancel();
            try { new MaaProjectCompiler().CompileAsync(source, Selection(), cancellation.Token).GetAwaiter().GetResult(); throw new InvalidOperationException("cancellation_expected"); }
            catch (OperationCanceledException) { Assert(source.Lists.Count == 0 && source.Reads.Count == 0); }
        });
    }
    private sealed class Registration : ICompilerRegistration
    {
        internal string? Id; internal IProjectCompiler? Compiler;
        public ValueTask RegisterAsync(string compilerId, IProjectCompiler compiler, CancellationToken cancellationToken)
        { cancellationToken.ThrowIfCancellationRequested(); Id = compilerId; Compiler = compiler; return ValueTask.CompletedTask; }
    }
}
