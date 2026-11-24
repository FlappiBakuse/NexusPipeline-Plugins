using NexusPipeline.Extensions.GameCheckIn;

internal static class RunnerCases
{
    internal static void Run(Action<string, Action> run)
    {
        void Assert(bool condition) { if (!condition) throw new InvalidOperationException("assertion_failed"); }
        void Reject(Action action, string code)
        { try { action(); } catch (CheckInFailure error) when (error.Code == code) { return; } throw new InvalidOperationException("expected_" + code); }
        CheckInExecutionIdentity Identity() => new(Guid.NewGuid(), Guid.NewGuid(), "manual", new(2026, 1, 31));
        CheckInTask KuroTask() => new() { Id = Guid.NewGuid(), Revision = 3, Name = "one", Games = new() { ["kuro"] = ["ww", "pgr"] } };
        run("all-fourteen-selected-games-retain-results-when-credentials-absent", () =>
        {
            var task = KuroTask() with { Games = CheckInCatalog.Platforms.ToDictionary(platform => platform.Id, platform => platform.Games.Select(game => game.Code).ToArray()) };
            using var store = new RunnerPersistence(task); var ports = new RunnerExecutionPorts(); var network = new RunnerNetwork(ports);
            var progress = new List<CheckInRun>(); store.OnPublished = progress.Add;
            var runner = new CheckInRunner(store, new(network, ports, new TestDevice(), TimeProvider.System), ports, TimeProvider.System);
            var result = runner.ExecuteAsync(task, Identity(), default).GetAwaiter().GetResult();
            Assert(result.Results.Length == 14 && result.Results.All(result => result.Code == "credential_not_configured") && result.Status == "failed");
            Assert(store.Saved!.Results.Length == 14 && network.Requests.Count == 0 && ports.Claims == 0);
            if (progress.Count != 28) throw new InvalidOperationException($"expected 28 durable progress writes, observed {progress.Count}");
            for (var index = 0; index < result.Results.Length; index++)
            {
                var started = progress[2 * index]; var finished = progress[2 * index + 1];
                Assert(started.Results[index].Code == "running" && started.Results.Take(index).SequenceEqual(result.Results.Take(index)) &&
                    started.Results.Skip(index + 1).All(game => game.Code == "pending"));
                Assert(finished.Results.Take(index + 1).SequenceEqual(result.Results.Take(index + 1)) &&
                    finished.Results.Skip(index + 1).All(game => game.Code == "pending"));
            }
            Assert(progress[^1].Status == result.Status && progress[^1].CompletedAt == result.CompletedAt);
        });
        run("terminal-result-publication-failure-preserves-prior-confirmation-and-blocks-attempt-replay", () =>
        {
            var task = KuroTask(); using var store = new RunnerPersistence(task) { RejectWrite = 4 }; store.Materials["kuro"] = new("synthetic-token", "manual");
            var ports = new RunnerExecutionPorts(); var network = new RunnerNetwork(ports);
            var runner = new CheckInRunner(store, new(network, ports, new TestDevice(), TimeProvider.System), ports, TimeProvider.System);
            var identity = Identity();
            Reject(() => runner.ExecuteAsync(task, identity, default).GetAwaiter().GetResult(), "checkin_run_publication_unknown");
            var saved = store.Saved!;
            var requestCount = network.Requests.Count;
            if (ports.Claims != 2) throw new InvalidOperationException($"expected both games to reach effects before terminal rejection, observed {ports.Claims}");
            Assert(network.Requests.Count(request => request.Address.EndsWith("/signIn/v2", StringComparison.Ordinal)) == 2);
            Reject(() => runner.ExecuteAsync(task, identity, default).GetAwaiter().GetResult(), "checkin_attempt_already_recorded");
            var projected = CheckInRunFacts.Merge(saved, new(identity.RunId, identity.AttemptId, task.Revision, "unknown", DateTimeOffset.UtcNow));
            Assert(store.Writes == 4 && network.Requests.Count == requestCount && saved.Results[0].Success &&
                projected.Results[0].EffectState == "confirmed" && projected.Results[1].EffectState == "unknown");
        });
        run("runner-uses-host-frozen-month-and-versioned-secret-per-game", () =>
        {
            var task = KuroTask(); using var store = new RunnerPersistence(task); store.Materials["kuro"] = new("synthetic-token", "manual");
            var ports = new RunnerExecutionPorts(); var network = new RunnerNetwork(ports); var runner = new CheckInRunner(store, new(network, ports, new TestDevice(), TimeProvider.System), ports, TimeProvider.System);
            var identity = Identity(); var result = runner.ExecuteAsync(task, identity, default).GetAwaiter().GetResult();
            Assert(result.Status == "success" && result.Results.Length == 2 && result.Results.All(result => result.Success));
            Assert(ports.Claims == 2 && ports.SecretRevisions.All(revision => revision == 7) &&
                store.Operations.Count > 0 && store.Operations.Distinct().Count() == store.Operations.Count);
            Assert(store.Saved!.AttemptId == result.AttemptId && store.Saved.Status == "success" && store.Saved.Results.SequenceEqual(result.Results));
            Assert(network.Requests.Where(request => request.Address.EndsWith("/signIn/v2", StringComparison.Ordinal)).All(request => request.Body.Contains("reqMonth=01", StringComparison.Ordinal)));
            Assert(result.AttemptId == identity.AttemptId.ToString("D") && result.TaskRevision == 3);
        });
        run("unknown-result-publication-stops-before-any-platform-protocol", () =>
        {
            var task = KuroTask(); using var store = new RunnerPersistence(task) { RejectWrite = 1 }; store.Materials["kuro"] = new("synthetic-token", "manual");
            var ports = new RunnerExecutionPorts(); var network = new RunnerNetwork(ports); var runner = new CheckInRunner(store, new(network, ports, new TestDevice(), TimeProvider.System), ports, TimeProvider.System);
            Reject(() => runner.ExecuteAsync(task, Identity(), default).GetAwaiter().GetResult(), "checkin_run_publication_unknown");
            Assert(ports.Claims == 0 && network.Requests.Count == 0);
        });
        run("cancellation-after-submission-preserves-unknown-and-does-not-use-uncancelled-write", () =>
        {
            var task = KuroTask(); using var store = new RunnerPersistence(task); store.Materials["kuro"] = new("synthetic-token", "manual");
            using var cancellation = new CancellationTokenSource(); var ports = new RunnerExecutionPorts(); var network = new RunnerNetwork(ports) { CancelOnSign = cancellation };
            var runner = new CheckInRunner(store, new(network, ports, new TestDevice(), TimeProvider.System), ports, TimeProvider.System);
            var result = runner.ExecuteAsync(task, Identity(), cancellation.Token).GetAwaiter().GetResult();
            Assert(result.Status == "cancelled" && result.Results[0].EffectState == "unknown" && result.Results[1].Code == "cancelled");
            Assert(store.Saved!.Results[0].Code == "running" && store.Saved.Results[1].Code == "pending");
            var merged = CheckInRunFacts.Merge(store.Saved!, new(Guid.Parse(result.Id), Guid.Parse(result.AttemptId), 3, "cancelled", result.CompletedAt));
            Assert(merged.Results[0].EffectState == "unknown" && merged.Results[1].Code == "not_executed");
        });
        run("cached-success-never-proves-previous-writer-stopped", () =>
        {
            var task = KuroTask(); using var store = new RunnerPersistence(task); var old = Identity();
            store.Saved = new(old.RunId.ToString("D"), "manual", "success", DateTimeOffset.UtcNow, DateTimeOffset.UtcNow,
                [CheckInResults.Result("kuro", "ww", "success", true, "confirmed")], old.AttemptId.ToString("D"), 3);
            var ports = new RunnerExecutionPorts { WriterStopped = false }; var network = new RunnerNetwork(ports);
            var runner = new CheckInRunner(store, new(network, ports, new TestDevice(), TimeProvider.System), ports, TimeProvider.System);
            Reject(() => runner.ExecuteAsync(task, Identity(), default).GetAwaiter().GetResult(), "checkin_run_writer_active");
            Assert(store.Writes == 0 && network.Requests.Count == 0 && ports.WriterQueries.Count > 0 &&
                ports.WriterQueries.All(query => query == (task.Id, old.RunId, old.AttemptId)));
        });
        run("same-attempt-cache-is-not-a-replay-permit", () =>
        {
            var task = KuroTask(); using var store = new RunnerPersistence(task); var identity = Identity();
            store.Saved = new(identity.RunId.ToString("D"), "manual", "running", DateTimeOffset.UtcNow, null, [], identity.AttemptId.ToString("D"), 3);
            var ports = new RunnerExecutionPorts(); var network = new RunnerNetwork(ports); var runner = new CheckInRunner(store, new(network, ports, new TestDevice(), TimeProvider.System), ports, TimeProvider.System);
            Reject(() => runner.ExecuteAsync(task, identity, default).GetAwaiter().GetResult(), "checkin_attempt_already_recorded");
            Assert(store.Writes == 0 && network.Requests.Count == 0);
        });
        run("unknown-game-effect-survives-empty-readonly-role-list", () =>
        {
            var task = KuroTask() with { Games = new() { ["cn"] = ["gi"] } }; using var store = new RunnerPersistence(task);
            store.Materials["cn"] = new("synthetic-cookie", "manual"); var ports = new RunnerExecutionPorts { GameState = "unknown" }; var network = new RunnerNetwork(ports);
            var runner = new CheckInRunner(store, new(network, ports, new TestDevice(), TimeProvider.System), ports, TimeProvider.System);
            var result = runner.ExecuteAsync(task, Identity(), default).GetAwaiter().GetResult();
            Assert(result.Status == "unknown" && result.Results.Single().Code == "no_role" && result.Results.Single().EffectState == "unknown" && !result.Results.Single().Success);
            Assert(network.Requests.Count > 0 && network.Requests.All(request => request.Method == "GET"));
        });
        run("host-failure-and-unknown-role-are-not-covered-by-positive-cache", () =>
        {
            var identity = Identity(); var cached = new CheckInRun(identity.RunId.ToString("D"), "manual", "success", DateTimeOffset.UtcNow,
                DateTimeOffset.UtcNow, [CheckInResults.Result("kuro", "ww", "success", true, "confirmed")], identity.AttemptId.ToString("D"), 3);
            Assert(CheckInRunFacts.Merge(cached, new(identity.RunId, identity.AttemptId, 3, "failed", cached.CompletedAt)).Status == "failed");
            var result = CheckInResults.Aggregate("cn", "gi", [CheckInResults.Result("cn", "gi", "api_error"), CheckInResults.Result("cn", "gi", "success_unconfirmed", effectState: "unknown")]);
            Assert(!result.Success && result.EffectState == "unknown");
        });
    }
}
