using NexusPipeline.Extensions.GameActivities;

internal static class FeedQueueCases
{
    internal static async Task RunAsync(Func<string, Func<Task>, Task> run)
    {
        await run("fifth-feed-starts-and-publishes-before-slow-first-feed", async () =>
        {
            var docs = new TestDocuments(); var http = new TestNetwork();
            var files = new[] { "ba-cn", "ys", "end", "xtlr", "sr" };
            var started = files.Select(_ => Signal()).ToArray();
            var responses = files.Select(_ => new TaskCompletionSource<ActivityResponse>(TaskCreationOptions.RunContinuationsAsynchronously)).ToArray();
            http.Handler = (url, token) =>
            {
                var index = Array.IndexOf(files, Path.GetFileNameWithoutExtension(url.AbsolutePath));
                started[index].TrySetResult(); return responses[index].Task.WaitAsync(token);
            };
            await using var service = new ActivityCoordinator(docs, new SdkActivityNetwork(http), new TestClock());
            await service.InitializeAsync(default);
            try
            {
                await service.SaveAsync(Guid.NewGuid(), 0, Selected(), default);
                await Task.WhenAll(started.Take(4).Select(item => item.Task)).WaitAsync(TimeSpan.FromSeconds(5));
                Check.That(http.Active == 4 && !started[4].Task.IsCompleted);
                for (var index = 1; index < 4; index++) responses[index].SetResult(TestNetwork.Feed("fast"));
                await started[4].Task.WaitAsync(TimeSpan.FromSeconds(5));
                responses[4].SetResult(TestNetwork.Feed("fifth"));
                await Published(service, "honkai-star-rail/default", "fifth");
                Check.That(!docs.Values.ContainsKey("feed-ba-cn") && !responses[0].Task.IsCompleted);
                await service.RefreshAsync(Guid.NewGuid(), default);
                lock (http.Calls) Check.That(http.Calls.Count == 5 && http.Calls.Distinct().Count() == 5);
                Check.That(http.MaximumActive == 4);
            }
            finally { foreach (var response in responses) response.TrySetResult(TestNetwork.Feed("released")); }
            await TestActivity.Idle(service);
            Check.That(TestActivity.Cache(docs).Content?.Overview.Number == "released" && http.Active == 0);
        });
        await run("joined-refresh-fills-idle-feed-workers-and-shares-http-budget-with-covers", async () =>
        {
            var docs = new TestDocuments(); var http = new TestNetwork(); var clock = new TestClock();
            var selected = Selected(); var sources = ActivitySources.Selected(selected);
            const string cover = "https://i0.hdslb.com/feed-queue.png";
            await docs.WriteAsync(Guid.NewGuid(), "settings", 0, ActivityJson.Bytes(selected), default);
            foreach (var source in sources.Skip(1))
            {
                var (content, _) = SraFeed.Parse(source, TestNetwork.Feed("cached", cover: cover).Content);
                await docs.WriteAsync(Guid.NewGuid(), source.DocumentName, 0, ActivityJson.Bytes(new ActivityCache
                    { FeedId = source.Id, Content = content, LastGoodAt = clock.Now, NextCheckAt = clock.Now.AddHours(6) }), default);
            }
            var first = Signal(); var coverStarted = Signal(); var filled = Signal(); var release = Signal();
            http.Handler = async (url, token) =>
            {
                if (url.AbsolutePath.EndsWith("ba-cn.json", StringComparison.Ordinal)) first.TrySetResult();
                else if (url.Host == "i0.hdslb.com") coverStarted.TrySetResult();
                if (http.Active == 4) filled.TrySetResult();
                await release.Task.WaitAsync(token);
                return url.Host == "i0.hdslb.com" ? TestNetwork.Image([137, 80, 78, 71, 13, 10, 26, 10]) : TestNetwork.Feed("joined");
            };
            await using var service = new ActivityCoordinator(docs, new SdkActivityNetwork(http), clock);
            await service.InitializeAsync(default); await service.TickAsync(default);
            await first.Task.WaitAsync(TimeSpan.FromSeconds(5));
            var image = service.CoverAsync(ActivityCovers.Identity(cover)!, default);
            try
            {
                await coverStarted.Task.WaitAsync(TimeSpan.FromSeconds(5));
                await service.RefreshAsync(Guid.NewGuid(), default);
                await filled.Task.WaitAsync(TimeSpan.FromSeconds(5));
                Check.That(http.Active == 4 && http.MaximumActive == 4);
            }
            finally { release.TrySetResult(); }
            await image; await TestActivity.Idle(service);
            lock (http.Calls) Check.That(http.Calls.Count(url => url.Host != "i0.hdslb.com") == 5);
            Check.That(http.MaximumActive == 4 && http.Active == 0);
        });
    }

    private static ActivitySettings Selected() => TestActivity.Select("blue-archive", "genshin-impact", "arknights-endfield", "stella-sora", "honkai-star-rail");
    private static TaskCompletionSource Signal() => new(TaskCreationOptions.RunContinuationsAsynchronously);
    private static async Task Published(ActivityCoordinator service, string id, string version)
    {
        for (var attempt = 0; attempt < 200; attempt++)
        {
            var feed = Check.Element(await service.FeedAsync(id, default)).GetProperty("feed");
            if (feed.GetProperty("overview").GetProperty("number").GetString() == version) return;
            await Task.Delay(5);
        }
        throw new TimeoutException("fifth_feed_not_published");
    }
}
