using System.Text.Json;
using System.Text.Json.Nodes;
using NexusPipeline.Extensions.MaaFramework;

internal static class ProjectionCases
{
    internal static void Run(Action<string, Action> run)
    {
        static void Assert(bool value) { if (!value) throw new InvalidOperationException("assertion_failed"); }
        static void Reject(Action action)
        { try { action(); } catch (MaaInputFailure) { return; } throw new InvalidOperationException("expected_projection_rejection"); }
        MaaPiProject Project()
        {
            var declaration = CompilerFixture.Interface();
            declaration["task"]![0]!["pipeline_override"] = new JsonObject { ["source~name/with/slash"] = new JsonObject { ["value"] = new string('x', 4096) } };
            declaration["controller"]![0]!["private_extension"] = new JsonObject { ["future_field"] = "preserve" };
            var input = CompilerFixture.Input("assets/interface.json", declaration.ToJsonString());
            return new MaaPiCompiler(new([input])).Compile(input.Path);
        }
        run("compact-pi-asset-preserves-full-declaration-and-binds-externalized-pipeline", () => {
            var project = Project(); var projection = MaaCompactProjection.Build(project);
            var artifact = MaaJson.Read(projection.Artifact);
            var view = MaaJson.Read(projection.View);
            var pipeline = JsonSerializer.SerializeToUtf8Bytes(project.Declaration["task"]![0]!["pipeline_override"]);
            var binding = view["externalized"]!["value"]![0]!;
            Assert(projection.Bindings.Length == 1 && projection.View.Length < projection.Artifact.Length &&
                JsonNode.DeepEquals(artifact["declaration"], project.Declaration) &&
                view["artifact"]!["sha256"]!.GetValue<string>() == MaaCompilationBundle.Hash(projection.Artifact) &&
                view["artifact"]!["bytes"]!.GetValue<int>() == projection.Artifact.Length &&
                binding["Pointer"]!.GetValue<string>() == "/task/0/pipeline_override" &&
                binding["Sha256"]!.GetValue<string>() == MaaCompilationBundle.Hash(pipeline) && binding["Bytes"]!.GetValue<int>() == pipeline.Length);
            var metadata = view["metadata"]!["value"]!;
            Assert(metadata["controller"]![0]!["private_extension"]!["future_field"]!.GetValue<string>() == "preserve" &&
                metadata["task"]![0]!["pipeline_override"] is null);
        });
        run("compact-is-bound-to-original-sources-and-compiler-identity", () => {
            var project = Project(); var projection = MaaCompactProjection.Build(project);
            Assert(MaaJson.Required(MaaJson.Read(projection.Artifact), "compilationFingerprint") == project.CompilationFingerprint &&
                MaaJson.Required(MaaJson.Read(projection.View), "compilationFingerprint") == project.CompilationFingerprint);
            Reject(() => MaaCompactProjection.Build(project with { SourceFingerprint = new string('0', 64) }));
        });
        run("compact-pages-large-option-description-and-preserves-unicode-and-generic-metadata", () => {
            var project = Project();
            var text = string.Concat(Enumerable.Range(0, 55000).Select(index => $"{index:D5}选项😀\n"));
            project.Declaration["option"] = new JsonObject { ["CompleteOption"] = new JsonObject { ["description"] = text } };
            project.Declaration["future"] = new JsonObject { [""] = "空键😀", ["line\nkey"] = "preserve" };
            var projection = MaaCompactProjection.Build(project);
            var metadata = MaaJson.Read(projection.View)["metadata"]!;
            var options = Member(projection.Pages, metadata, "option");
            var description = Member(projection.Pages, Member(projection.Pages, options, "CompleteOption"), "description");
            Assert(description["kind"]!.GetValue<string>() == "string" &&
                string.Concat(PageRows(projection.Pages, description).Select(value => value!.GetValue<string>())) == text);
            var future = Member(projection.Pages, metadata, "future")["value"]!;
            Assert(future[""]!.GetValue<string>() == "空键😀" && future["line\nkey"]!.GetValue<string>() == "preserve");
            Reject(() => MaaCompactProjection.Build(project, 1));
        });
        run("compact-externalized-asset-escapes-exact-option-identities", () => {
            var project = Project(); project.Declaration["option"]!["name/with~special"] = new JsonObject { ["pipeline_override"] = new JsonObject { ["v"] = new string('x', 4096) } };
            var projection = MaaCompactProjection.Build(project);
            var bindings = MaaJson.Read(projection.View)["externalized"]!["value"]!.AsArray();
            Assert(bindings.Any(binding => binding!["Pointer"]!.GetValue<string>() == "/option/name~1with~0special/pipeline_override"));
        });
    }

    internal static JsonNode Member(IReadOnlyDictionary<string, byte[]> pages, JsonNode node, string name) =>
        PageRows(pages, node).Single(row => row!["name"]!.GetValue<string>() == name)!["node"]!;

    internal static IEnumerable<JsonNode?> PageRows(IReadOnlyDictionary<string, byte[]> pages, JsonNode node)
    {
        foreach (var reference in node["pages"]!.AsArray())
        {
            var sha = reference!["sha256"]!.GetValue<string>();
            var bytes = pages[sha];
            BundleCases.Assert(bytes.Length <= MaaProjectionPages.MaximumPageBytes && bytes.Length == reference["bytes"]!.GetValue<int>() &&
                MaaCompilationBundle.Hash(bytes) == sha);
            var rows = JsonNode.Parse(bytes)!.AsArray();
            BundleCases.Assert(rows.Count == reference["count"]!.GetValue<int>());
            foreach (var row in rows) yield return row;
        }
    }
}
