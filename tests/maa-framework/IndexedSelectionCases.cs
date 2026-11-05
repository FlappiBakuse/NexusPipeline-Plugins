using System.Text;
using System.Text.Json.Nodes;
using NexusPipeline.Extensions.MaaFramework;

internal static class IndexedSelectionCases
{
    internal static void Run(Action<string, Action> run)
    {
        static void Assert(bool value) { if (!value) throw new InvalidOperationException("assertion_failed"); }
        static void Reject(Action action)
        { try { action(); } catch (MaaInputFailure) { return; } throw new InvalidOperationException("expected_index_rejection"); }
        (MaaImportedProfile Profile, byte[] Bytes) Import(JsonObject instance)
        {
            var (sources, project) = CompilerFixture.Project(("appsettings.json", new()), ("config/config.json", CompilerFixture.Mfa()),
                ("config/instances/one.json", instance));
            return (new MaaProjectImport(sources, project).Import(new("mfa", "config/instances/one.json", "one")), Encoding.UTF8.GetBytes(instance.ToJsonString()));
        }
        JsonObject Local()
        {
            var local = CompilerFixture.Mfa(); var copy = local["TaskItems"]![0]!.DeepClone(); copy["repeat_count"] = 1;
            copy["upstreamProgress"] = new JsonObject { ["counter"] = 17 }; local["TaskItems"]!.AsArray().Add(copy);
            return local;
        }
        MaaIndexedSelection Capture((MaaImportedProfile Profile, byte[] Bytes) input) =>
            MaaIndexedSelection.Capture(input.Profile, "instance:one", 3, "config/instances/one.json", input.Bytes);
        run("indexed-mfa-duplicate-names-and-entries-remain-distinct-occurrences", () => {
            var input = Import(Local()); var mapping = Capture(input);
            Assert(mapping.Targets.Count == 2 && mapping.Targets[0].OccurrenceId != mapping.Targets[1].OccurrenceId &&
                mapping.Targets[0].NativeName == mapping.Targets[1].NativeName && mapping.Targets.Select(row => row.Index).SequenceEqual(new[] { 0, 1 }));
            var edits = mapping.Select(input.Bytes, mapping.Targets.Select(row => row.OccurrenceId).ToArray(), [mapping.Targets[1].OccurrenceId]);
            Assert(edits.Length == 2 && !edits[0].Value && edits[1].Value && edits[0].Expected && edits[1].Expected &&
                (int)edits[0].Selector[1] == 0 && (int)edits[1].Selector[1] == 1);
        });
        run("indexed-mfa-excluded-disabled-unknown-row-and-progress-are-preserved", () => {
            var local = Local(); local["TaskItems"]!.AsArray().Add(new JsonObject { ["name"] = "unknown", ["entry"] = "UnknownEntry", ["default_check"] = false,
                ["upstreamProgress"] = new JsonObject { ["counter"] = 99 } });
            var input = Import(local); var mapping = Capture(input); var before = local.DeepClone();
            var edits = mapping.Select(input.Bytes, [mapping.Targets[0].OccurrenceId], []);
            Assert(edits.Length == 1 && !edits[0].Value && JsonNode.DeepEquals(local, before));
            var candidate = MaaJson.Read(input.Bytes);
            foreach (var edit in edits) candidate["TaskItems"]![(int)edit.Selector[1]]!["default_check"] = edit.Value;
            Assert(candidate["TaskItems"]![2]!["default_check"]!.GetValue<bool>() == false &&
                candidate["TaskItems"]![2]!["upstreamProgress"]!["counter"]!.GetValue<int>() == 99 &&
                candidate["TaskItems"]![1]!["upstreamProgress"]!["counter"]!.GetValue<int>() == 17);
        });
        run("indexed-mfa-inherited-missing-or-null-tasks-require-materialization", () => {
            Reject(() => Capture(Import(new()))); Reject(() => Capture(Import(new() { ["TaskItems"] = null })));
            Reject(() => Capture(Import(new() { ["TaskItems"] = new JsonArray(), ["CurrentTasks"] = new JsonArray() })));
        });
        run("indexed-mfa-missing-or-null-enable-flag-is-not-coerced-to-false", () => {
            var local = Local(); local["TaskItems"]![0]!.AsObject().Remove("default_check"); Reject(() => Capture(Import(local)));
            local["TaskItems"]![0]!["default_check"] = null; Reject(() => Capture(Import(local)));
        });
        run("indexed-mfa-reordered-source-and-whitespace-byte-change-reject-stale-mapping", () => {
            var input = Import(Local()); var mapping = Capture(input); var changed = MaaJson.Read(input.Bytes); var rows = changed["TaskItems"]!.AsArray();
            var first = rows[0]!.DeepClone(); rows.RemoveAt(0); rows.Add(first);
            Reject(() => mapping.Select(Encoding.UTF8.GetBytes(changed.ToJsonString()), [mapping.Targets[0].OccurrenceId], []));
            Reject(() => mapping.Select(input.Bytes.Concat(new byte[] { 32 }).ToArray(), [mapping.Targets[0].OccurrenceId], []));
        });
        run("indexed-mfa-foreign-duplicate-and-unselected-authority-ids-rejected", () => {
            var input = Import(Local()); var mapping = Capture(input); var id = mapping.Targets[0].OccurrenceId;
            Reject(() => mapping.Select(input.Bytes, [id, id], [])); Reject(() => mapping.Select(input.Bytes, [id], [id, id]));
            Reject(() => mapping.Select(input.Bytes, [id], [mapping.Targets[1].OccurrenceId])); Reject(() => mapping.Select(input.Bytes, [Guid.NewGuid().ToString("D")], []));
        });
        run("indexed-mfa-source-path-instance-revision-and-source-proof-are-bound", () => {
            var input = Import(Local());
            Reject(() => MaaIndexedSelection.Capture(input.Profile, "instance:one", 3, "config/instances/two.json", input.Bytes));
            Reject(() => MaaIndexedSelection.Capture(input.Profile, "instance:one", 0, "config/instances/one.json", input.Bytes));
            Reject(() => Capture(input with { Profile = input.Profile with { SourceFingerprint = new string('0', 64) } }));
        });
    }
}
