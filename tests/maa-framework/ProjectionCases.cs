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
        run("compact-full-pi-roundtrip-preserves-all-metadata-and-complete-pipeline", () => {
            var project = Project(); var projection = MaaCompactProjection.Build(project);
            Assert(projection.Bindings.Length == 1 && projection.View.Length < projection.Artifact.Length &&
                JsonNode.DeepEquals(MaaCompactProjection.Restore(projection, project.CompilationFingerprint), project.Declaration));
            var view = MaaJson.Read(projection.View); var pages = new MaaProjectionPages();
            foreach (var pair in projection.Pages) pages.Contents.Add(pair.Key, pair.Value);
            var metadata = pages.Decode(MaaJson.Object(view["metadata"]))!;
            Assert(metadata["controller"]![0]!["private_extension"]!["future_field"]!.GetValue<string>() == "preserve" &&
                metadata["task"]![0]!["pipeline_override"] is null);
        });
        run("compact-artifact-and-view-mutations-fail-before-hydration", () => {
            var project = Project(); var projection = MaaCompactProjection.Build(project); projection.Artifact[^2] ^= 1;
            Reject(() => MaaCompactProjection.Restore(projection, project.CompilationFingerprint));
            projection = MaaCompactProjection.Build(project); projection.View[^2] ^= 1;
            Reject(() => MaaCompactProjection.Restore(projection, project.CompilationFingerprint));
        });
        run("compact-is-bound-to-original-sources-and-compiler-identity", () => {
            var project = Project(); var projection = MaaCompactProjection.Build(project);
            Reject(() => MaaCompactProjection.Restore(projection, new string('0', 64)));
            Reject(() => MaaCompactProjection.Build(project with { SourceFingerprint = new string('0', 64) }));
        });
        run("compact-pages-large-option-description-without-truncating-any-character", () => {
            var project = Project(); project.Declaration["option"] = new JsonObject { ["CompleteOption"] = new JsonObject { ["description"] = new string('x', 530000) } };
            var projection = MaaCompactProjection.Build(project);
            Assert(projection.Pages.Count > 0 && projection.Pages.Values.All(page => page.Length <= MaaProjectionPages.MaximumPageBytes) &&
                MaaCompactProjection.Restore(projection, project.CompilationFingerprint)["option"]!["CompleteOption"]!["description"]!.GetValue<string>().Length == 530000);
            Reject(() => MaaCompactProjection.Build(project, 1));
        });
        run("compact-missing-corrupted-and-unreferenced-pages-are-rejected", () => {
            var project = Project(); project.Declaration["description"] = new string('x', 530000); var projection = MaaCompactProjection.Build(project);
            var contents = projection.Pages.ToDictionary(pair => pair.Key, pair => pair.Value);
            var first = contents.Keys.First(); contents.Remove(first);
            Reject(() => MaaCompactProjection.Restore(projection with { Pages = contents }, project.CompilationFingerprint));
            contents = projection.Pages.ToDictionary(pair => pair.Key, pair => pair.Value.ToArray()); contents[first][0] ^= 1;
            Reject(() => MaaCompactProjection.Restore(projection with { Pages = contents }, project.CompilationFingerprint));
            contents = projection.Pages.ToDictionary(pair => pair.Key, pair => pair.Value); contents.Add(new string('0', 64), "[]"u8.ToArray());
            Reject(() => MaaCompactProjection.Restore(projection with { Pages = contents }, project.CompilationFingerprint));
        });
        run("compact-roundtrip-escapes-exact-option-identities", () => {
            var project = Project(); project.Declaration["option"]!["name/with~special"] = new JsonObject { ["pipeline_override"] = new JsonObject { ["v"] = new string('x', 4096) } };
            var projection = MaaCompactProjection.Build(project);
            Assert(projection.Bindings.Any(binding => binding.Pointer.Contains("name~1with~0special", StringComparison.Ordinal)) &&
                JsonNode.DeepEquals(MaaCompactProjection.Restore(projection, project.CompilationFingerprint), project.Declaration));
        });
        run("compact-generic-metadata-and-non-bmp-long-text-remain-lossless", () => {
            var project = Project(); var text = string.Concat(Enumerable.Repeat("选项😀", 5000));
            project.Declaration["future"] = new JsonObject { [""] = text, ["line\nkey"] = "preserve" };
            var projection = MaaCompactProjection.Build(project);
            Assert(JsonNode.DeepEquals(MaaCompactProjection.Restore(projection, project.CompilationFingerprint), project.Declaration));
        });
    }
}
