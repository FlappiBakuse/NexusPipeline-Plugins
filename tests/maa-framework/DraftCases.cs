using System.Text.Json;
using System.Text.Json.Nodes;
using NexusPipeline.Extensions.MaaFramework;
using static BundleCases;

internal static class DraftCases
{
    internal static void Run(Action<string, Action> run)
    {
        run("preset-preview-uses-the-production-compiler-and-its-independent-rows-remain-editable", () =>
        {
            var pi = CompilerFixture.Interface();
            pi["preset"] = new JsonArray(new JsonObject { ["name"] = "DailyOnly", ["task"] = new JsonArray(
                new JsonObject { ["name"] = "Daily", ["enabled"] = true, ["option"] = new JsonObject { ["Mode"] = "A" } }) });
            var source = new MaaSourceSet([CompilerFixture.Input("assets/interface.json", pi.ToJsonString()),
                CompilerFixture.Input("mxu.json", CompilerFixture.Mxu().ToJsonString())]);
            var preview = MaaCompilationBundle.Build(source, Selection with { Preset = "DailyOnly" });
            var rows = MaaJson.Objects(MaaJson.Read(preview.Artifact)["profile"]!["Tasks"]);
            BundleCases.Assert(rows.Length == 1 && rows[0]["Options"]!["Mode"]!.GetValue<string>() == "A");
            var edited = MaaCompilationBundle.Build(source, Selection with { Profile = new JsonObject
                { ["Tasks"] = new JsonArray(Row(rows[0], 0, true, 2)) } });
            var task = MaaJson.Objects(MaaJson.Read(edited.Artifact)["semantic"]!["Tasks"]).Single();
            BundleCases.Assert(task["OccurrenceId"]!.GetValue<string>() == rows[0]["Id"]!.GetValue<string>());
            BundleCases.Assert(task["RepeatCount"]!.GetValue<int>() == 2);
        });
        run("draft-freezes-independent-order-repeat-and-options-without-changing-imported-progress", () =>
        {
            var source = Sources(); var original = MaaCompilationBundle.Build(source, Selection);
            var raw = MaaJson.Read(original.Artifact); var rows = MaaJson.Objects(raw["profile"]!["Tasks"]);
            var draft = new JsonObject { ["Tasks"] = new JsonArray(Row(rows[1], 0, true, 2), Row(rows[0], 1, false, 1)),
                ["GlobalOptions"] = new JsonObject { ["Mode"] = "A" } };
            var bundle = MaaCompilationBundle.Build(source, Selection with { Profile = draft });
            var view = bundle.Verify(source, bundle.ArtifactSha256); var full = MaaJson.Read(bundle.Artifact);
            BundleCases.Assert(bundle.ArtifactSha256 != original.ArtifactSha256);
            BundleCases.Assert(view["Tasks"]![0]!["Id"]!.GetValue<string>() == rows[1]["Id"]!.GetValue<string>());
            BundleCases.Assert(view["Tasks"]![0]!["RepeatCount"]!.GetValue<int>() == 2 && !view["Tasks"]![1]!["Enabled"]!.GetValue<bool>());
            BundleCases.Assert(MaaJson.Objects(full["semantic"]!["Tasks"]).Single()["OccurrenceId"]!.GetValue<string>() == rows[1]["Id"]!.GetValue<string>());
            BundleCases.Assert(JsonNode.DeepEquals(raw["profile"]!["SourceSnapshot"], full["profile"]!["SourceSnapshot"]));
            BundleCases.Assert(MaaJson.Read(original.Artifact)["profile"]!["GlobalOptions"] is JsonObject);
        });
        run("draft-adds-a-new-independent-occurrence-from-the-original-pi-definition", () =>
        {
            var source = Sources(); var id = Guid.NewGuid().ToString("D");
            var draft = new JsonObject { ["Tasks"] = new JsonArray(new JsonObject { ["Id"] = id, ["Name"] = "Daily", ["Order"] = 0,
                ["Enabled"] = true, ["RepeatCount"] = 3, ["Options"] = new JsonObject { ["Mode"] = "A" } }) };
            var bundle = MaaCompilationBundle.Build(source, Selection with { Profile = draft });
            var full = MaaJson.Read(bundle.Artifact); var task = MaaJson.Objects(full["semantic"]!["Tasks"]).Single();
            BundleCases.Assert(task["OccurrenceId"]!.GetValue<string>() == id && task["Entry"]!.GetValue<string>() == "DailyEntry");
            BundleCases.Assert(task["RepeatCount"]!.GetValue<int>() == 3 && task["SourceId"]!.GetValue<string>() == "nexus-profile:" + id);
        });
        run("draft-can-disable-an-unmapped-imported-row-without-erasing-its-source-identity", () =>
        {
            var saved = CompilerFixture.Mxu(); saved["instances"]![0]!["tasks"]![0]!["taskName"] = "Unknown";
            var source = CompilerFixture.Sources(("mxu.json", saved));
            var blocked = MaaCompilationBundle.Build(source, Selection);
            BundleCases.Assert(!blocked.CanExecute);
            var row = MaaJson.Objects(MaaJson.Read(blocked.Artifact)["profile"]!["Tasks"]).Single();
            var repaired = MaaCompilationBundle.Build(source, Selection with { Profile = new JsonObject
                { ["Tasks"] = new JsonArray(Row(row, 0, false, 1)) } });
            BundleCases.Assert(repaired.CanExecute);
            var kept = MaaJson.Objects(MaaJson.Read(repaired.Artifact)["profile"]!["Tasks"]).Single();
            BundleCases.Assert(kept["Id"]!.GetValue<string>() == row["Id"]!.GetValue<string>() &&
                kept["SourceId"]!.GetValue<string>() == row["SourceId"]!.GetValue<string>());
        });
        foreach (var changed in new[] { "entry", "source", "duplicate-id", "duplicate-order", "foreign", "repeat" })
            run("draft-rejects-injected-or-ambiguous-row/" + changed, () =>
            {
                var source = Sources(); var raw = MaaJson.Read(MaaCompilationBundle.Build(source, Selection).Artifact);
                var original = MaaJson.Objects(raw["profile"]!["Tasks"]); var first = Row(original[0], 0, true, 1); var second = Row(original[1], 1, false, 1);
                var draft = new JsonObject { ["Tasks"] = new JsonArray(first, second) };
                if (changed == "entry") first["Entry"] = "OtherEntry";
                if (changed == "source") first["SourceId"] = "other-source";
                if (changed == "duplicate-id") second["Id"] = first["Id"]!.DeepClone();
                if (changed == "duplicate-order") second["Order"] = 0;
                if (changed == "foreign") draft["Connection"] = new JsonObject { ["windowHandle"] = 7 };
                if (changed == "repeat") first["RepeatCount"] = 101;
                BundleCases.Reject(() => MaaCompilationBundle.Build(source, Selection with { Profile = draft }));
            });
        run("draft-ordinary-input-merges-keep-protected-fields-and-refuses-secret-plaintext-edits", () =>
        {
            var pi = CompilerFixture.Interface();
            pi["option"]!["Login"] = new JsonObject { ["type"] = "input", ["inputs"] = new JsonArray(
                new JsonObject { ["name"] = "user" }, new JsonObject { ["name"] = "password", ["password"] = true }) };
            var source = new MaaSourceSet([CompilerFixture.Input("assets/interface.json", pi.ToJsonString()), CompilerFixture.Input("mxu.json", CompilerFixture.Mxu().ToJsonString())]);
            var project = new MaaPiCompiler(source).Compile("assets/interface.json");
            var saved = new MaaProjectImport(source, project).Import(Selection.Source) with
                { GlobalOptions = new JsonObject { ["Login"] = new JsonObject { ["user"] = "before", ["password"] = "protected-original" } } };
            var draft = new JsonObject { ["GlobalOptions"] = new JsonObject { ["Login"] = new JsonObject { ["user"] = "after" } } };
            var changed = MaaProfileDraft.Apply(project, saved, draft, new(true));
            BundleCases.Assert(changed.GlobalOptions["Login"]!["user"]!.GetValue<string>() == "after");
            BundleCases.Assert(changed.GlobalOptions["Login"]!["password"]!.GetValue<string>() == "protected-original");
            BundleCases.Assert(saved.GlobalOptions["Login"]!["user"]!.GetValue<string>() == "before");
            draft["GlobalOptions"]!["Login"]!["password"] = "must-not-enter-the-ordinary-dto";
            BundleCases.Reject(() => MaaProfileDraft.Apply(project, saved, draft, new(true)));
        });
        run("draft-selection-is-retained-by-the-actual-compiler-choice-parser", () =>
        {
            var value = JsonSerializer.SerializeToElement(new { InterfacePath = "assets/interface.json", ClientKind = "mxu", Language = "zh_cn",
                Source = new { Kind = "mxu", Path = "mxu.json", InstanceId = "one" }, Profile = new { GlobalOptions = new { Mode = "A" } } });
            var parsed = MaaCompilerChoice.Read(value, true);
            BundleCases.Assert(parsed.Profile!["GlobalOptions"]!["Mode"]!.GetValue<string>() == "A");
        });
    }

    private static JsonObject Row(JsonObject source, int order, bool enabled, int repeat) => new()
    {
        ["Id"] = source["Id"]!.DeepClone(), ["SourceId"] = source["SourceId"]!.DeepClone(), ["Name"] = source["Name"]!.DeepClone(),
        ["Order"] = order, ["Enabled"] = enabled, ["RepeatCount"] = repeat,
        ["Options"] = source["Options"]!.DeepClone(), ["Pipeline"] = source["Pipeline"]!.DeepClone()
    };
}
