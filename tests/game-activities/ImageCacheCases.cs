using NexusPipeline.Extensions.GameActivities;

internal static class ImageCacheCases
{
    internal static async Task RunAsync(Func<string, Func<Task>, Task> run)
    {
        await run("persistent-cover-reopens-offline-and-rejects-disabled-source", async () =>
        {
            var docs = new TestDocuments(); var assets = new TestImages(docs); var net = new TestNetwork(); var clock = new TestClock();
            const string url = "https://i0.hdslb.com/offline.png";
            var bytes = Convert.FromBase64String("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aDXsAAAAASUVORK5CYII=");
            var id = ActivityCovers.Identity(url)!;
            net.Handler = (uri, _) => Task.FromResult(uri.Host == "i0.hdslb.com" ? TestNetwork.Image(bytes) : TestNetwork.Feed(cover: url));
            await using (var service = new ActivityCoordinator(docs, net, clock, new SdkActivityImages(docs, assets)))
            {
                await service.InitializeAsync(default);
                await service.SaveAsync(Guid.NewGuid(), 0, TestActivity.Select("blue-archive"), default); await TestActivity.Idle(service);
                Check.That((await service.CoverAsync(id, default)).Bytes.Span.SequenceEqual(bytes));
            }
            var offline = new TestNetwork { Handler = (_, _) => throw new IOException("offline") };
            clock.Advance(TimeSpan.FromDays(1));
            await using var restarted = new ActivityCoordinator(docs, offline, clock, new SdkActivityImages(docs, assets));
            await restarted.InitializeAsync(default);
            Check.That((await restarted.CoverAsync(id, default)).Bytes.Span.SequenceEqual(bytes) && offline.Calls.Count == 0);
            await restarted.SaveAsync(Guid.NewGuid(), 1, new ActivitySettings(), default);
            await Check.Reject(() => restarted.CoverAsync(id, default), "unknown");
        });
        await run("persistent-cover-evicts-old-references-and-preserves-unknown-document", async () =>
        {
            var docs = new TestDocuments(); var assets = new TestImages(docs); var cache = new SdkActivityImages(docs, assets);
            var ids = Enumerable.Range(0, 33).Select(index => ActivityCovers.Identity($"https://i0.hdslb.com/{index}.png")!).ToHashSet();
            foreach (var (id, index) in ids.Select((id, index) => (id, index)))
                await cache.SaveAsync(id, new("image/png", new byte[] { 137, 80, 78, 71, (byte)index }), ids, default);
            Check.That(assets.Assets.Count == 32 && await cache.ReadAsync(ids.First(), default) is null);
            var retained = ids.Last();
            await cache.SaveAsync(retained, new("image/png", new byte[] { 137, 80, 78, 71, 32 }), new HashSet<string> { retained }, default);
            Check.That(assets.Assets.Count == 1 && await cache.ReadAsync(retained, default) is not null);
            var unsupported = "{\"formatVersion\":2,\"entries\":[]}"u8.ToArray();
            docs.Values["cover-cache"] = new(99, unsupported);
            await Check.Reject(async () => await cache.SaveAsync(retained, new("image/png", new byte[] { 1 }), ids, default), "unsupported");
            Check.That(docs.Values["cover-cache"].Json.Span.SequenceEqual(unsupported) && assets.Assets.Count == 1);
        });
        await run("persistent-cover-conflict-preserves-winning-image-references", async () =>
        {
            var docs = new TestDocuments(); var assets = new TestImages(docs); var cache = new SdkActivityImages(docs, assets);
            var id = ActivityCovers.Identity("https://i0.hdslb.com/race.png")!;
            await cache.SaveAsync(id, new("image/png", new byte[] { 1 }), new HashSet<string> { id }, default);
            var saved = docs.Values["cover-cache"];
            docs.BeforeWrite = name => { if (name == "cover-cache") docs.Values[name] = saved with { Revision = saved.Revision + 1 }; };
            await Check.Reject(async () => await cache.SaveAsync(id, new("image/png", new byte[] { 2 }), new HashSet<string> { id }, default), "revision_conflict");
            Check.That((await cache.ReadAsync(id, default))!.Bytes.Span.SequenceEqual(new byte[] { 1 }));
        });
    }
}
