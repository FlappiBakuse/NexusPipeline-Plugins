using System.Text.Json;
using System.Text.Json.Nodes;
using NexusPipeline.Extensions.MaaFramework;

var cases = new List<object>();
var failed = false;
void Run(string name, Action action)
{ try { action(); cases.Add(new { name, status = "PASS" }); } catch (Exception error) { failed = true; cases.Add(new { name, status = "FAIL", error = error.ToString() }); } }
void Assert(bool value) { if (!value) throw new InvalidOperationException("assertion_failed"); }
void Reject(Action action)
{ try { action(); } catch (Exception error) when (error is MaaInputFailure or JsonException) { return; } throw new InvalidOperationException("rejection_expected"); }
Run("jsonc-bom-and-comment-like-string-retain-original-source-hash", () => {
    var pi = CompilerFixture.Interface(); pi["description"] = "https://example.test/a//b/*c*/";
    var input = CompilerFixture.Input("assets/interface.json", "\ufeff/* header */" + pi.ToJsonString()[..^1] + ",}"); var set = new MaaSourceSet([input]);
    var project = new MaaPiCompiler(set).Compile("assets/interface.json"); Assert(project.Sources.Single().Sha256 == input.Sha256 && project.Tasks.Length == 1);
});
foreach (var text in new[] { "{,}", "{\"name\":1,\"name\":2}", "{\"x\":/*", "{\"x\":[,]}" })
    Run("jsonc-reject/" + text, () => Reject(() => MaaJson.Read(System.Text.Encoding.UTF8.GetBytes(text))));
foreach (var path in new[] { "../interface.json", "C:/interface.json", "/interface.json", "assets\\interface.json", "assets/./interface.json" })
    Run("source-path-reject/" + path, () => Reject(() => MaaSourceSet.Normalize(path)));
Run("source-hash-and-case-alias-identity-rejected", () => {
    var input = CompilerFixture.Input("assets/interface.json", CompilerFixture.Interface().ToJsonString());
    Reject(() => new MaaSourceSet([input with { Sha256 = new string('0', 64) }])); Reject(() => new MaaSourceSet([input, input with { Path = "ASSETS/interface.json" }]));
});
Run("pi-import-full-options-late-override-group-dedupe-and-pretask-order", () => {
    var pi = CompilerFixture.Interface(); pi["import"] = new JsonArray("tasks/one.json", "tasks/two.json");
    pi["pretask"] = new JsonObject { ["name"] = "main", ["exec"] = "agent/main.exe" };
    var first = new JsonObject { ["group"] = new JsonArray(new JsonObject { ["name"] = "g", ["label"] = "first" }),
        ["option"] = new JsonObject { ["Mode"] = new JsonObject { ["type"] = "select", ["cases"] = new JsonArray(new JsonObject { ["name"] = "C" }) } },
        ["pretask"] = new JsonArray(new JsonObject { ["name"] = "one", ["exec"] = "agent/one.exe" }) };
    var second = new JsonObject { ["group"] = new JsonArray(new JsonObject { ["name"] = "g", ["label"] = "second" }),
        ["global_option"] = new JsonArray("Mode", "Mode"), ["pretask"] = new JsonObject { ["name"] = "two", ["exec"] = "agent/two.exe" } };
    var sources = new MaaSourceSet([CompilerFixture.Input("assets/interface.json", pi.ToJsonString()), CompilerFixture.Input("assets/tasks/one.json", first.ToJsonString()), CompilerFixture.Input("assets/tasks/two.json", second.ToJsonString())]);
    var project = new MaaPiCompiler(sources).Compile("assets/interface.json");
    Assert(project.Sources.Length == 3 && project.Options["Mode"]!["cases"]![0]!["name"]!.GetValue<string>() == "C");
    Assert(project.Declaration["group"]![0]!["label"]!.GetValue<string>() == "first" && project.Declaration["global_option"]!.AsArray().Count == 1);
    Assert(MaaJson.Objects(project.Declaration["pretask"], true).Select(item => MaaJson.Required(item, "name")).SequenceEqual(new[] { "main", "one", "two" }));
});
Run("pi-missing-import-cycle-duplicate-task-and-option-cycle-rejected", () => {
    var pi = CompilerFixture.Interface(); pi["import"] = new JsonArray("missing.json");
    Reject(() => new MaaPiCompiler(new([CompilerFixture.Input("assets/interface.json", pi.ToJsonString())])).Compile("assets/interface.json"));
    pi["import"] = new JsonArray("interface.json"); Reject(() => new MaaPiCompiler(new([CompilerFixture.Input("assets/interface.json", pi.ToJsonString())])).Compile("assets/interface.json"));
    pi.Remove("import"); pi["task"]!.AsArray().Add(pi["task"]![0]!.DeepClone()); Reject(() => new MaaPiCompiler(new([CompilerFixture.Input("assets/interface.json", pi.ToJsonString())])).Compile("assets/interface.json"));
});
SourceCases.Run(Run);
SemanticCases.Run(Run);
ProtectedCases.Run(Run);
PatternCases.Run(Run);
EffectiveCases.Run(Run);
DiscoveryCases.Run(Run);
ProjectionCases.Run(Run);
IndexedSelectionCases.Run(Run);
BundleCases.Run(Run);
DraftCases.Run(Run);
RuntimeCases.Run(Run);
ProjectInputCases.Run(Run);
var report = args[^1];
ResourceCases.Run(Run, report);
WorkerPolicyCases.Run(Run);
ProviderCases.Run(Run);
MountCases.Run(Run);
ReadonlyCases.Run(Run);
EditorCases.Run(Run);
if (args.Length > 1) CorpusCases.Run(Run, args[0], report + ".corpus.json");
await File.WriteAllBytesAsync(report, JsonSerializer.SerializeToUtf8Bytes(cases, new JsonSerializerOptions { WriteIndented = true }));
Console.WriteLine($"{cases.Count} cases");
return cases.Count > 0 && !failed ? 0 : 1;
