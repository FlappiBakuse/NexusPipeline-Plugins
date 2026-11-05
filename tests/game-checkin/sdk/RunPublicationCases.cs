using System.Security.Cryptography;
using NexusPipeline.Extensions.GameCheckIn;
using NexusPipeline.Extensibility.State;

internal static class RunPublicationCases
{
    internal static async Task RunAsync(Func<string, Func<Task>, Task> run)
    {
        static void Assert(bool value) { if (!value) throw new InvalidOperationException("assertion_failed"); }
        var task = Guid.NewGuid(); var started = DateTimeOffset.UtcNow;
        var result = new CheckInRun(Guid.NewGuid().ToString("D"), "manual", "failed", started, started,
            [CheckInResults.Result("kuro", "ww", "credential_not_configured")], Guid.NewGuid().ToString("D"), 7);
        await run("actual-sdk-result-document-roundtrips-at-exact-cas-revision", async () =>
        {
            using var secrets = new PersistencePorts(); var documents = new RunDocuments();
            var adapter = new SdkCheckInPersistence(documents, secrets, secrets); var operation = Guid.NewGuid();
            Assert(await adapter.WriteRunAsync(operation, task, 0, result, default) == 1);
            var saved = await adapter.ReadRunAsync(task, default);
            Assert(saved.Revision == 1 && saved.Run!.AttemptId == result.AttemptId && saved.Run.Results.Single().Code == "credential_not_configured");
            Assert(documents.Name == "run-" + task.ToString("N") && documents.Writes == 1 && documents.Queries == 0);
        });
        await run("lost-result-commit-response-queries-original-operation-without-second-write", async () =>
        {
            using var secrets = new PersistencePorts(); var documents = new RunDocuments { LoseResponse = true };
            var adapter = new SdkCheckInPersistence(documents, secrets, secrets); var operation = Guid.NewGuid();
            Assert(await adapter.WriteRunAsync(operation, task, 0, result, default) == 1);
            Assert(documents.Writes == 1 && documents.Queries == 1 && documents.Queried == operation);
        });
        await run("unknown-or-mismatched-result-publication-does-not-become-success", async () =>
        {
            foreach (var mode in new[] { "missing", "operation", "revision", "hash" })
            {
                using var secrets = new PersistencePorts(); var documents = new RunDocuments { LoseResponse = true, Corruption = mode };
                var adapter = new SdkCheckInPersistence(documents, secrets, secrets);
                try { await adapter.WriteRunAsync(Guid.NewGuid(), task, 0, result, default); throw new InvalidOperationException("unknown_commit_accepted"); }
                catch (CheckInFailure error) when (error.Code == "checkin_run_publication_unknown") { }
                Assert(documents.Writes == 1 && documents.Queries == 1);
            }
        });
    }
    private sealed class RunDocuments : IExtensionDocuments
    {
        internal bool LoseResponse;
        internal string? Corruption, Name;
        internal Guid Queried;
        internal int Writes, Queries;
        private ExtensionDocument? saved;
        private DocumentCommit? committed;
        public ValueTask<ExtensionDocument?> ReadAsync(string name, CancellationToken cancellationToken) => ValueTask.FromResult(saved);
        public ValueTask<DocumentCommit> WriteAsync(Guid operationId, string name, long expectedRevision, ReadOnlyMemory<byte> json, CancellationToken cancellationToken)
        {
            Writes++; Name = name;
            if ((saved?.Revision ?? 0) != expectedRevision) throw new InvalidOperationException("synthetic_cas_conflict");
            saved = new(expectedRevision + 1, Convert.ToHexStringLower(SHA256.HashData(json.Span)), json.ToArray());
            committed = new(operationId, saved.Revision, saved.Sha256, true);
            if (LoseResponse) throw new IOException("synthetic_commit_response_lost");
            return ValueTask.FromResult(committed);
        }
        public ValueTask<DocumentCommit?> ReadCommitAsync(Guid operationId, CancellationToken cancellationToken)
        {
            Queries++; Queried = operationId;
            return ValueTask.FromResult(Corruption switch {
                "missing" => null, "operation" => committed! with { OperationId = Guid.NewGuid() },
                "revision" => committed! with { Revision = committed.Revision + 1 }, "hash" => committed! with { Sha256 = new string('0', 64) }, _ => committed });
        }
    }
}
