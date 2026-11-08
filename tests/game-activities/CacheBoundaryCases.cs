using NexusPipeline.Extensions.GameActivities;

internal static class CacheBoundaryCases
{
    internal static async Task RunAsync(Func<string, Func<Task>, Task> run)
    {
        await run("boundary-pre-post-once-and-persisted", async () =>
        {
            var docs = new TestDocuments(); var net = new TestNetwork(); var clock = new TestClock();
            net.Handler = (_, _) => Task.FromResult(TestNetwork.Feed("1", "[{\"name\":\"edge\",\"startTime\":\"2026-10-25T12:10:00Z\",\"endTime\":\"2026-10-26T12:10:00Z\"}]"));
            await using (var service = new ActivityCoordinator(docs, net, clock))
            {
                await service.InitializeAsync(default); await service.SaveAsync(Guid.NewGuid(), 0, TestActivity.Select("blue-archive"), default); await TestActivity.Idle(service);
                await service.TickAsync(default); await TestActivity.Idle(service); Check.That(net.Calls.Count == 2);
                await service.TickAsync(default); Check.That(net.Calls.Count == 2);
                clock.Advance(TimeSpan.FromMinutes(10)); await service.TickAsync(default); await TestActivity.Idle(service); Check.That(net.Calls.Count == 3);
            }
            await using var restarted = new ActivityCoordinator(docs, net, clock); await restarted.InitializeAsync(default);
            await restarted.TickAsync(default); Check.That(net.Calls.Count == 3 && TestActivity.Cache(docs).BoundaryChecks.Count == 2);
        });
        await run("unknown-times-do-not-schedule-guessed-boundaries", async () =>
        {
            var docs = new TestDocuments(); var net = new TestNetwork(); var clock = new TestClock();
            net.Handler = (_, _) => Task.FromResult(TestNetwork.Feed("1", "[{\"name\":\"unknown\",\"startTime\":\"2026-10-25T12:10:00\"}]"));
            await using var service = new ActivityCoordinator(docs, net, clock); await service.InitializeAsync(default);
            await service.SaveAsync(Guid.NewGuid(), 0, TestActivity.Select("blue-archive"), default); await TestActivity.Idle(service);
            clock.Advance(TimeSpan.FromMinutes(15)); await service.TickAsync(default); Check.That(net.Calls.Count == 1);
        });
        await run("unknown-cache-bytes-preserved-other-feed-refreshes", async () =>
        {
            var docs = new TestDocuments(); docs.Values["feed-ba-cn"] = new(9, "{\"formatVersion\":2,\"feedId\":\"blue-archive/cn\"}"u8.ToArray());
            var original = docs.Values["feed-ba-cn"].Json.ToArray(); var net = new TestNetwork();
            await using var service = new ActivityCoordinator(docs, net, new TestClock()); await service.InitializeAsync(default);
            await service.SaveAsync(Guid.NewGuid(), 0, TestActivity.Select("blue-archive", "genshin-impact"), default); await TestActivity.Idle(service);
            Check.That(docs.Values["feed-ba-cn"].Json.Span.SequenceEqual(original) && net.Calls.Count == 1 && TestActivity.Cache(docs, "ys").Content is not null);
        });
        await run("unknown-settings-format-rejects-without-overwrite", async () =>
        {
            var docs = new TestDocuments(); docs.Values["settings"] = new(1, "{}"u8.ToArray());
            await using var service = new ActivityCoordinator(docs, new TestNetwork(), new TestClock());
            await Check.Reject(() => service.InitializeAsync(default)); Check.That(docs.Writes == 0);
        });
        await run("saved-case-alias-rejects-and-preserves-original-bytes", async () =>
        {
            var docs = new TestDocuments(); var network = new TestNetwork();
            var body = System.Text.Encoding.UTF8.GetBytes(System.Text.Encoding.UTF8.GetString(ActivityJson.Bytes(new ActivitySettings()))
                .Replace("\"formatVersion\":1", "\"formatVersion\":1,\"FormatVersion\":1", StringComparison.Ordinal));
            docs.Values["settings"] = new(7, body);
            await using var service = new ActivityCoordinator(docs, network, new TestClock());
            await Check.Reject(() => service.InitializeAsync(default));
            Check.That(docs.Writes == 0 && docs.Values["settings"].Json.Span.SequenceEqual(body) && network.Calls.Count == 0);
        });
        await run("text-refresh-never-requests-cover", async () =>
        {
            var docs = new TestDocuments(); var net = new TestNetwork();
            net.Handler = (_, _) => Task.FromResult(TestNetwork.Feed(cover: "https://i0.hdslb.com/fixture.png"));
            await using var service = new ActivityCoordinator(docs, net, new TestClock()); await service.InitializeAsync(default);
            await service.SaveAsync(Guid.NewGuid(), 0, TestActivity.Select("blue-archive"), default); await TestActivity.Idle(service);
            Check.That(net.Calls.Count == 1 && net.Calls[0].Host == "starrailassistant.top" && TestActivity.Cache(docs).Content?.Overview.CoverUrl is not null);
        });
        await run("cover-cache-origin-binding-signature-negative-cache-and-expiry", async () =>
        {
            var docs = new TestDocuments(); var net = new TestNetwork(); var clock = new TestClock(); const string url = "https://i0.hdslb.com/fixture.png";
            net.Handler = (_, _) => Task.FromResult(TestNetwork.Feed(cover: url));
            await using var service = new ActivityCoordinator(docs, net, clock); await service.InitializeAsync(default);
            await service.SaveAsync(Guid.NewGuid(), 0, TestActivity.Select("blue-archive"), default); await TestActivity.Idle(service);
            var id = ActivityCovers.Identity(url)!; net.Handler = (_, _) => Task.FromResult(TestNetwork.Image([137, 80, 78, 71, 13, 10, 26, 10]));
            var image = await service.CoverAsync(id, default); Check.That(image.ContentType == "image/png" && net.MaximumBytes == 8388608);
            await service.CoverAsync(id, default); Check.That(net.Calls.Count == 2);
            await Check.Reject(() => service.CoverAsync(new string('a', 64), default), "unknown"); Check.That(net.Calls.Count == 2);
            clock.Advance(TimeSpan.FromMinutes(31)); net.Handler = (_, _) => Task.FromResult(TestNetwork.Image("<html/>"u8.ToArray()));
            await Check.Reject(() => service.CoverAsync(id, default)); await Check.Reject(() => service.CoverAsync(id, default)); Check.That(net.Calls.Count == 3);
            clock.Advance(TimeSpan.FromSeconds(61)); net.Handler = (_, _) => Task.FromResult(TestNetwork.Image([255, 216, 255], "image/jpeg"));
            Check.That((await service.CoverAsync(id, default)).ContentType == "image/jpeg" && net.Calls.Count == 4);
            await service.SaveAsync(Guid.NewGuid(), 1, new ActivitySettings(), default);
            await Check.Reject(() => service.CoverAsync(id, default), "unknown");
        });
        await run("manual-refresh-retries-negative-covers-and-keeps-successful-covers", async () =>
        {
            var docs = new TestDocuments(); var net = new TestNetwork(); var clock = new TestClock();
            const string url = "https://yh.wanmei.com/cover.jpg";
            net.Handler = (_, _) => Task.FromResult(TestNetwork.Feed(cover: url));
            await using var service = new ActivityCoordinator(docs, net, clock); await service.InitializeAsync(default);
            await service.SaveAsync(Guid.NewGuid(), 0, TestActivity.Select("blue-archive"), default); await TestActivity.Idle(service);
            var id = ActivityCovers.Identity(url)!;
            net.Handler = (_, _) => throw new IOException("transient-cover-failure");
            await Check.Reject(() => service.CoverAsync(id, default));
            net.Handler = (uri, _) => Task.FromResult(uri.Host == "yh.wanmei.com"
                ? TestNetwork.Image([255, 216, 255], "image/jpeg") : TestNetwork.Feed(cover: url));
            await service.RefreshAsync(Guid.NewGuid(), default); await TestActivity.Idle(service);
            Check.That((await service.CoverAsync(id, default)).ContentType == "image/jpeg");
            clock.Advance(TimeSpan.FromSeconds(61));
            net.Handler = (uri, _) => uri.Host == "yh.wanmei.com" ? throw new IOException("positive-cache-must-remain")
                : Task.FromResult(TestNetwork.Feed(cover: url));
            await service.RefreshAsync(Guid.NewGuid(), default); await TestActivity.Idle(service);
            Check.That((await service.CoverAsync(id, default)).ContentType == "image/jpeg");
            Check.That(ActivityCovers.Allowed("https://sdk.hoyoverse.com/cover.png") &&
                !ActivityCovers.Allowed("https://yh.wanmei.com.evil.example/cover.jpg"));
        });
        await run("cover-oversize-rejected-without-affecting-text", async () =>
        {
            var docs = new TestDocuments(); var net = new TestNetwork(); const string url = "https://i0.hdslb.com/large.png";
            net.Handler = (_, _) => Task.FromResult(TestNetwork.Feed(cover: url));
            await using var service = new ActivityCoordinator(docs, net, new TestClock()); await service.InitializeAsync(default);
            await service.SaveAsync(Guid.NewGuid(), 0, TestActivity.Select("blue-archive"), default); await TestActivity.Idle(service);
            net.Handler = (_, _) => Task.FromResult(TestNetwork.Image(new byte[8388609]));
            await Check.Reject(() => service.CoverAsync(ActivityCovers.Identity(url)!, default));
            Check.That(TestActivity.Cache(docs).FailureCount == 0 && TestActivity.Cache(docs).Content?.Overview.Number == "1");
        });
    }
}
