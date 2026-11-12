using NexusPipeline.Extensions.GameActivities;

internal static class ReadyCases
{
    private static readonly AsyncLocal<string?> AcceptedCall = new();
    internal static async Task RunAsync(Func<string, Func<Task>, Task> run)
    {
        await run("unselected-feeds-remain-unread-and-selected-cache-is-loaded-once", async () =>
        {
            var reads = new List<string>(); var docs = new TestDocuments { BeforeRead = reads.Add };
            var source = ActivitySources.All.First(item => item.GameId == "blue-archive");
            docs.Values[source.DocumentName] = new(1, "{}"u8.ToArray());
            await using var service = new ActivityCoordinator(docs, new TestNetwork(), new TestClock());
            await service.InitializeAsync(default); Check.That(reads.SequenceEqual(new[] { "settings" }));
            await service.SaveAsync(Guid.NewGuid(), 0, TestActivity.Select("blue-archive"), default);
            Check.That(reads.Count(name => name == source.DocumentName) == 1);
            await service.SaveAsync(Guid.NewGuid(), 1, TestActivity.Select("blue-archive"), default);
            Check.That(reads.Count(name => name == source.DocumentName) == 1);
        });
        await run("scope-initialization-waits-ready-once-and-cancels-without-consumption", async () =>
        {
            var reads = 0; var docs = new TestDocuments { BeforeRead = _ => Interlocked.Increment(ref reads) };
            var ready = new ReadyGate(); var scope = new CancellationTokenSource();
            var service = new ActivityCoordinator(docs, new TestNetwork(), new TestClock());
            service.StartWhenReady(ready.WaitReadyAsync, scope.Token);
            await Task.Delay(20); Check.That(reads == 0);
            var pending = service.WaitInitializedAsync(default); Check.That(!pending.IsCompleted);
            scope.Cancel(); await service.DisposeAsync(); await Check.Reject(() => pending); Check.That(reads == 0);
        });
        await run("install-and-frontend-call-authority-never-flow-to-owned-background-work", async () =>
        {
            var ready = new ReadyGate(); var docs = new TestDocuments(); var network = new TestNetwork();
            docs.BeforeRead = _ => Check.That(AcceptedCall.Value is null, "install_authority_flowed_to_initialization");
            docs.BeforeWrite = name => { if (name.StartsWith("feed-", StringComparison.Ordinal)) Check.That(AcceptedCall.Value is null, "frontend_authority_flowed_to_cache"); };
            network.Handler = (_, _) => { Check.That(AcceptedCall.Value is null, "frontend_authority_flowed_to_http"); return Task.FromResult(TestNetwork.Feed()); };
            await using var service = new ActivityCoordinator(docs, network, new TestClock());
            AcceptedCall.Value = "install-call"; service.StartWhenReady(ready.WaitReadyAsync, default); ready.Publish();
            await service.WaitInitializedAsync(default); Check.That(AcceptedCall.Value == "install-call");
            docs.BeforeRead = name => { if (name == "settings") Check.That(AcceptedCall.Value == "frontend-call"); };
            AcceptedCall.Value = "frontend-call";
            await service.SaveAsync(Guid.NewGuid(), 0, TestActivity.Select("blue-archive"), default);
            AcceptedCall.Value = null; await TestActivity.Idle(service);
            Check.That(TestActivity.Cache(docs).Content is not null && network.Calls.Count == 1);
        });
    }
}
