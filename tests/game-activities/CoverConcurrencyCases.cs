using NexusPipeline.Extensions.GameActivities;

internal static class CoverConcurrencyCases
{
    internal static async Task RunAsync(Func<string, Func<Task>, Task> run)
    {
        await run("cached-cover-completes-while-other-network-is-blocked", async () =>
        {
            var docs = new TestDocuments(); var net = new TestNetwork();
            await using var service = await Prepare(docs, net);
            net.Handler = (_, _) => Task.FromResult(Image());
            await service.CoverAsync(Id(0), default);
            var started = Signal(); var release = new TaskCompletionSource<ActivityResponse>(TaskCreationOptions.RunContinuationsAsynchronously);
            net.Handler = (_, _) => { started.TrySetResult(); return release.Task; };
            var pending = service.CoverAsync(Id(1), default); await started.Task.WaitAsync(TimeSpan.FromSeconds(5));
            var cached = service.CoverAsync(Id(0), default);
            Check.That(cached.IsCompletedSuccessfully && !pending.IsCompleted);
            release.SetResult(Image()); await pending;
        });
        await run("local-cover-preparation-never-fetches-missing-images", async () =>
        {
            var docs = new TestDocuments(); var net = new TestNetwork();
            await using var service = await Prepare(docs, net);
            net.Handler = (_, _) => Task.FromResult(Image());
            await service.CoverAsync(Id(0), default);
            net.Handler = (_, _) => throw new InvalidOperationException("preparation_network_forbidden");
            Check.That((await service.CachedCoverAsync(Id(0), default)).Bytes.Length > 0);
            await Check.Reject(() => service.CachedCoverAsync(Id(1), default), "not_cached");
        });
        await run("cover-network-allows-four-and-drains-waiters", async () =>
        {
            var docs = new TestDocuments(); var net = new TestNetwork();
            await using var service = await Prepare(docs, net);
            var four = Signal(); var release = Signal(); int active = 0, maximum = 0, started = 0;
            net.Handler = async (_, token) =>
            {
                var count = Interlocked.Increment(ref active);
                int previous; do { previous = maximum; } while (count > previous && Interlocked.CompareExchange(ref maximum, count, previous) != previous);
                if (Interlocked.Increment(ref started) == 4) four.TrySetResult();
                await release.Task.WaitAsync(token); Interlocked.Decrement(ref active); return Image();
            };
            var pending = Enumerable.Range(0, 6).Select(index => service.CoverAsync(Id(index), default)).ToArray();
            await four.Task.WaitAsync(TimeSpan.FromSeconds(5));
            Check.That(started == 4 && active == 4 && pending.All(task => !task.IsCompleted));
            release.SetResult(); await Task.WhenAll(pending);
            Check.That(started == 6 && maximum == 4 && active == 0);
        });
        await run("old-cover-generation-cannot-publish-after-unsubscribe", async () =>
        {
            var docs = new TestDocuments(); var net = new TestNetwork();
            await using var service = await Prepare(docs, net);
            var started = Signal(); var release = new TaskCompletionSource<ActivityResponse>(TaskCreationOptions.RunContinuationsAsynchronously);
            net.Handler = (_, _) => { started.TrySetResult(); return release.Task; };
            var pending = service.CoverAsync(Id(0), default); await started.Task.WaitAsync(TimeSpan.FromSeconds(5));
            await service.SaveAsync(Guid.NewGuid(), 1, new ActivitySettings(), default); release.SetResult(Image());
            try { await pending; throw new InvalidOperationException("stale_cover_published"); } catch (OperationCanceledException) { }
            await Check.Reject(() => service.CoverAsync(Id(0), default), "unknown");
        });
        await run("cover-scope-stop-cancels-active-and-queued-network", async () =>
        {
            var docs = new TestDocuments(); var net = new TestNetwork(); var service = await Prepare(docs, net);
            var four = Signal(); int started = 0, cancelled = 0;
            net.Handler = async (_, token) =>
            {
                if (Interlocked.Increment(ref started) == 4) four.TrySetResult();
                try { await Task.Delay(Timeout.Infinite, token); return Image(); }
                catch (OperationCanceledException) { Interlocked.Increment(ref cancelled); throw; }
            };
            var pending = Enumerable.Range(0, 6).Select(index => service.CoverAsync(Id(index), default)).ToArray();
            await four.Task.WaitAsync(TimeSpan.FromSeconds(5)); await service.DisposeAsync();
            foreach (var task in pending) { try { await task; throw new InvalidOperationException("cover_survived_stop"); } catch (OperationCanceledException) { } }
            Check.That(started == 4 && cancelled == 4);
        });
    }

    private static string Url(int index) => "https://i0.hdslb.com/cover-" + index + ".png";
    private static string Id(int index) => ActivityCovers.Identity(Url(index))!;
    private static ActivityResponse Image() => TestNetwork.Image([137, 80, 78, 71, 13, 10, 26, 10]);
    private static TaskCompletionSource Signal() => new(TaskCreationOptions.RunContinuationsAsynchronously);
    private static async Task<ActivityCoordinator> Prepare(TestDocuments docs, TestNetwork net)
    {
        var events = "[" + string.Join(",", Enumerable.Range(0, 6).Select(index => "{\"name\":\"event-" + index + "\",\"cover\":\"" + Url(index) + "\"}")) + "]";
        net.Handler = (_, _) => Task.FromResult(TestNetwork.Feed(activities: events));
        var service = new ActivityCoordinator(docs, net, new TestClock()); await service.InitializeAsync(default);
        await service.SaveAsync(Guid.NewGuid(), 0, TestActivity.Select("blue-archive"), default); await TestActivity.Idle(service);
        return service;
    }
}
