using NexusPipeline.Extensions.GameActivities;

internal static class CoordinatorCases
{
    internal static async Task RunAsync(Func<string, Func<Task>, Task> run)
    {
        await run("default-no-requests-and-no-settings-write", async () =>
        {
            var docs = new TestDocuments(); var net = new TestNetwork();
            await using var service = new ActivityCoordinator(docs, net, new TestClock()); await service.InitializeAsync(default);
            await service.TickAsync(default);
            Check.That(net.Calls.Count == 0 && docs.Writes == 0 && (await TestActivity.State(service)).GetProperty("feeds").GetArrayLength() == 11);
        });
        await run("cache-six-hour-success-and-empty-replacement", async () =>
        {
            var docs = new TestDocuments(); var net = new TestNetwork(); var clock = new TestClock();
            net.Handler = (_, _) => Task.FromResult(TestNetwork.Feed("1", "[{\"name\":\"event\"}]"));
            await using var service = new ActivityCoordinator(docs, net, clock); await service.InitializeAsync(default);
            await service.SaveAsync(Guid.NewGuid(), 0, TestActivity.Select("blue-archive"), default); await TestActivity.Idle(service);
            Check.That(TestActivity.Cache(docs).Content?.Events.Length == 1);
            clock.Advance(TimeSpan.FromHours(6) - TimeSpan.FromSeconds(1)); await service.TickAsync(default); Check.That(net.Calls.Count == 1);
            net.Handler = (_, _) => Task.FromResult(TestNetwork.Feed("2")); clock.Advance(TimeSpan.FromSeconds(1));
            await service.TickAsync(default); await TestActivity.Idle(service);
            Check.That(TestActivity.Cache(docs).Content is { Events.Length: 0, Overview.Number: "2" } && net.Calls.Count == 2);
        });
        await run("failure-retains-good-and-retry-after-backoff", async () =>
        {
            var docs = new TestDocuments(); var net = new TestNetwork(); var clock = new TestClock();
            await using var service = new ActivityCoordinator(docs, net, clock); await service.InitializeAsync(default);
            await service.SaveAsync(Guid.NewGuid(), 0, TestActivity.Select("blue-archive"), default); await TestActivity.Idle(service);
            var original = TestActivity.Cache(docs); clock.Advance(TimeSpan.FromHours(6));
            net.Handler = (_, _) => Task.FromResult(new ActivityResponse(429, new Dictionary<string, string[]> { ["Retry-After"] = ["600"] }, ReadOnlyMemory<byte>.Empty));
            await service.TickAsync(default); await TestActivity.Idle(service);
            var failed = TestActivity.Cache(docs);
            Check.That(failed.Content?.SnapshotId == original.Content?.SnapshotId && failed.LastGoodAt == original.LastGoodAt && failed.FailureCount == 1 && failed.NextCheckAt == clock.Now.AddMinutes(10));
            clock.Advance(TimeSpan.FromMinutes(9)); await service.TickAsync(default); Check.That(net.Calls.Count == 2);
        });
        await run("failed-feed-does-not-block-other-feed", async () =>
        {
            var docs = new TestDocuments(); var net = new TestNetwork();
            net.Handler = (url, _) => Task.FromResult(url.AbsolutePath.Contains("ba-cn", StringComparison.Ordinal) ? new ActivityResponse(500, new Dictionary<string, string[]>(), ReadOnlyMemory<byte>.Empty) : TestNetwork.Feed());
            await using var service = new ActivityCoordinator(docs, net, new TestClock()); await service.InitializeAsync(default);
            await service.SaveAsync(Guid.NewGuid(), 0, TestActivity.Select("blue-archive", "genshin-impact"), default); await TestActivity.Idle(service);
            Check.That(TestActivity.Cache(docs).Content is null && TestActivity.Cache(docs, "ys").Content is not null &&
                (await TestActivity.State(service)).GetProperty("refreshOperation").GetProperty("status").GetString() == "partial");
        });
        await run("manual-sixty-seconds-persisted-and-replay", async () =>
        {
            var docs = new TestDocuments(); var net = new TestNetwork(); var clock = new TestClock(); var op = Guid.NewGuid();
            await using (var service = new ActivityCoordinator(docs, net, clock))
            {
                await service.InitializeAsync(default); await service.RefreshAsync(op, default); await TestActivity.Idle(service);
                var writes = docs.Writes; await service.RefreshAsync(op, default); Check.That(docs.Writes == writes);
                await Check.Reject(() => service.RefreshAsync(Guid.NewGuid(), default), "rate_limited");
            }
            await using var restarted = new ActivityCoordinator(docs, net, clock); await restarted.InitializeAsync(default);
            clock.Advance(TimeSpan.FromSeconds(59)); await Check.Reject(() => restarted.RefreshAsync(Guid.NewGuid(), default), "rate_limited");
            clock.Advance(TimeSpan.FromSeconds(1)); await restarted.RefreshAsync(Guid.NewGuid(), default); await TestActivity.Idle(restarted);
        });
        await run("two-clients-settings-cas-cannot-overwrite", async () =>
        {
            var docs = new TestDocuments(); var net = new TestNetwork();
            await using var first = new ActivityCoordinator(docs, net, new TestClock()); await using var second = new ActivityCoordinator(docs, net, new TestClock());
            await first.InitializeAsync(default); await second.InitializeAsync(default);
            await first.SaveAsync(Guid.NewGuid(), 0, new ActivitySettings { RotationSeconds = 40 }, default);
            await Check.Reject(() => second.SaveAsync(Guid.NewGuid(), 0, new ActivitySettings { RotationSeconds = 50 }, default), "revision_conflict");
            Check.That(ActivityJson.Read<ActivitySettings>(docs.Values["settings"].Json).RotationSeconds == 40);
        });
        await run("lost-write-response-replay-reads-latest-winner", async () =>
        {
            var docs = new TestDocuments(); var net = new TestNetwork(); var op = Guid.NewGuid(); var proposed = new ActivitySettings { RotationSeconds = 40 };
            await using var service = new ActivityCoordinator(docs, net, new TestClock()); await service.InitializeAsync(default);
            docs.LoseReply = true; await Check.Reject(() => service.SaveAsync(op, 0, proposed, default), "lost_reply");
            await docs.WriteAsync(Guid.NewGuid(), "settings", 1, ActivityJson.Bytes(new ActivitySettings { RotationSeconds = 50 }), default);
            await service.SaveAsync(op, 0, proposed, default);
            var state = await TestActivity.State(service);
            Check.That(state.GetProperty("settingsRevision").GetInt64() == 2 && state.GetProperty("rotationSeconds").GetInt32() == 50 && docs.Writes == 2);
        });
        await run("late-uncooperative-response-after-unsubscribe-is-discarded", async () =>
        {
            var docs = new TestDocuments(); var net = new TestNetwork(); var pending = new TaskCompletionSource<ActivityResponse>(TaskCreationOptions.RunContinuationsAsynchronously);
            net.Handler = (_, _) => pending.Task;
            await using var service = new ActivityCoordinator(docs, net, new TestClock()); await service.InitializeAsync(default);
            await service.SaveAsync(Guid.NewGuid(), 0, TestActivity.Select("blue-archive"), default);
            while (net.Calls.Count == 0) await Task.Delay(1);
            await service.SaveAsync(Guid.NewGuid(), 1, new ActivitySettings(), default); pending.SetResult(TestNetwork.Feed());
            await Task.Delay(20);
            Check.That(!docs.Values.ContainsKey("feed-ba-cn") && !(await TestActivity.State(service)).GetProperty("refreshing").GetBoolean());
        });
        await run("scope-stop-cancels-and-drains-no-late-writes", async () =>
        {
            var docs = new TestDocuments(); var net = new TestNetwork(); var started = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
            net.Handler = async (_, token) => { started.SetResult(); await Task.Delay(Timeout.Infinite, token); return TestNetwork.Feed(); };
            var service = new ActivityCoordinator(docs, net, new TestClock()); await service.InitializeAsync(default);
            await service.SaveAsync(Guid.NewGuid(), 0, TestActivity.Select("blue-archive"), default); await started.Task;
            await service.DisposeAsync(); Check.That(docs.Writes == 1 && !docs.Values.ContainsKey("feed-ba-cn"));
        });
        await CacheBoundaryCases.RunAsync(run);
        await CoverConcurrencyCases.RunAsync(run);
    }
}
