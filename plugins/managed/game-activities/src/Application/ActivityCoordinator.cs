using System.Globalization;

namespace NexusPipeline.Extensions.GameActivities;

internal sealed class ActivityCoordinator(IActivityDocuments documents, IActivityNetwork network,
    TimeProvider clock, IActivityImages? imageStore = null) : IAsyncDisposable
{
    private readonly SemaphoreSlim gate = new(1, 1);
    private readonly CancellationTokenSource lifetime = new();
    private CancellationTokenSource selection = new();
    private readonly Dictionary<string, ActivityCachedSource> feeds = ActivitySources.All.ToDictionary(s => s.Id, s => new ActivityCachedSource(s));
    private readonly List<Task> workers = [];
    private ActivitySettings settings = new();
    private long settingsRevision, revision = 1, generation;
    private ActivityRefreshOperation? operation;
    private Task? loop;
    private Task? initialization;
    private CancellationTokenRegistration activationCancellation;
    internal void StartWhenReady(Func<CancellationToken, ValueTask> waitReady, CancellationToken scopeCancellation)
    {
        if (initialization is not null) throw new ActivityFailure("activity_already_started");
        activationCancellation = scopeCancellation.Register(lifetime.Cancel);
        initialization = Detached(async () => {
            await waitReady(lifetime.Token);
            await InitializeAsync(lifetime.Token);
            lifetime.Token.ThrowIfCancellationRequested(); Start();
        });
    }
    internal Task WaitInitializedAsync(CancellationToken cancellationToken) =>
        (initialization ?? throw new ActivityFailure("activity_not_started")).WaitAsync(cancellationToken);
    private static Task Detached(Func<Task> action)
    {
        if (ExecutionContext.IsFlowSuppressed()) return Task.Run(action);
        // Accepted frontend/install authority expires with that call and must never flow into scope-owned work.
        using (ExecutionContext.SuppressFlow()) return Task.Run(action);
    }
    internal async Task InitializeAsync(CancellationToken cancellationToken)
    {
        var saved = await documents.ReadAsync("settings", cancellationToken);
        if (saved is not null) { settings = ActivityJson.Read<ActivitySettings>(saved.Json).Validate(); settingsRevision = saved.Revision; }
        foreach (var entry in feeds.Values)
        {
            var document = await documents.ReadAsync(entry.Source.DocumentName, cancellationToken);
            if (document is null) continue;
            entry.Revision = document.Revision;
            try
            {
                var cache = ActivityJson.Read<ActivityCache>(document.Json);
                entry.Cache = cache.Validate(entry.Source);
            }
            catch (Exception error) when (error is not OutOfMemoryException)
            { entry.Unsupported = true; }
        }
    }
    internal void Start() => loop = RunLoopAsync();
    private async Task RunLoopAsync()
    {
        try
        {
            while (!lifetime.IsCancellationRequested)
            { await TickAsync(lifetime.Token); await Task.Delay(TimeSpan.FromSeconds(30), clock, lifetime.Token); }
        }
        catch (OperationCanceledException) when (lifetime.IsCancellationRequested) { }
    }
    internal async Task TickAsync(CancellationToken cancellationToken)
    {
        await gate.WaitAsync(cancellationToken);
        try
        {
            ExpireCovers(clock.GetUtcNow());
            if (operation is { Accepting: true, Worker.IsCompleted: false } && operation.Generation == generation) return;
            var now = clock.GetUtcNow();
            var due = ActivitySources.Selected(settings).Where(s => !feeds[s.Id].Unsupported &&
                (feeds[s.Id].Cache.NextCheckAt <= now || (feeds[s.Id].Cache.FailureCount == 0 &&
                    ActivityTimes.Boundaries(s, feeds[s.Id].Cache, now).Any(key => !feeds[s.Id].Cache.BoundaryChecks.ContainsKey(key))))).ToArray();
            if (due.Length > 0) BeginRefresh(Guid.NewGuid(), due);
        }
        finally { gate.Release(); }
    }
    internal async Task SaveAsync(Guid operationId, long expectedRevision, ActivitySettings proposed, CancellationToken cancellationToken)
    {
        using var linked = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken, lifetime.Token);
        cancellationToken = linked.Token;
        proposed = proposed.Validate();
        await gate.WaitAsync(cancellationToken);
        try
        {
            lifetime.Token.ThrowIfCancellationRequested();
            await documents.WriteAsync(operationId, "settings", expectedRevision, ActivityJson.Bytes(proposed), cancellationToken);
            var current = await documents.ReadAsync("settings", cancellationToken) ?? throw new ActivityFailure("activity_settings_missing_after_commit");
            settings = ActivityJson.Read<ActivitySettings>(current.Json).Validate(); settingsRevision = current.Revision;
            generation++; revision++; selection.Cancel(); selection.Dispose(); selection = new(); operation = null;
        }
        finally { gate.Release(); }
        await TickAsync(cancellationToken);
    }
    internal async Task RefreshAsync(Guid operationId, CancellationToken cancellationToken)
    {
        using var linked = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken, lifetime.Token);
        cancellationToken = linked.Token;
        await gate.WaitAsync(cancellationToken);
        try
        {
            lifetime.Token.ThrowIfCancellationRequested();
            var current = await documents.ReadAsync("refresh-control", cancellationToken);
            var control = current is null ? new ActivityRefreshControl() : ActivityJson.Read<ActivityRefreshControl>(current.Json);
            if (control.FormatVersion != 1 || control.Requests.Length > 32) throw new ActivityFailure("activity_refresh_control_unsupported");
            if (control.Requests.Any(item => item.OperationId == operationId)) return;
            var now = clock.GetUtcNow();
            if (control.Requests.Any(item => now - item.AcceptedAt < TimeSpan.FromSeconds(60)))
                throw new ActivityFailure("activity_manual_refresh_rate_limited");
            var selected = ActivitySources.Selected(settings).ToArray();
            var requests = control.Requests.Where(item => now - item.AcceptedAt < TimeSpan.FromHours(1)).TakeLast(31)
                .Append(new ActivityManualRequest(operationId, now, selected.Select(s => s.Id).ToArray())).ToArray();
            await documents.WriteAsync(operationId, "refresh-control", current?.Revision ?? 0,
                ActivityJson.Bytes(control with { Requests = requests }), cancellationToken);
            foreach (var id in covers.Where(pair => pair.Value.Image is null).Select(pair => pair.Key).ToArray()) covers.Remove(id);
            if (operation is { Accepting: true, Worker.IsCompleted: false } && operation.Generation == generation)
            {
                foreach (var source in selected.Where(s => !feeds[s.Id].Unsupported))
                    if (operation.FeedIds.Add(source.Id)) operation.Pending.Enqueue(source);
                return;
            }
            BeginRefresh(operationId, selected.Where(s => !feeds[s.Id].Unsupported).ToArray());
        }
        finally { gate.Release(); }
    }
    private void BeginRefresh(Guid id, ActivitySource[] selected)
    {
        var op = new ActivityRefreshOperation(id, generation) { CreatedAt = clock.GetUtcNow(), Status = "running" };
        operation = op; revision++;
        foreach (var source in selected) { op.FeedIds.Add(source.Id); op.Pending.Enqueue(source); }
        var token = CancellationTokenSource.CreateLinkedTokenSource(lifetime.Token, selection.Token);
        workers.RemoveAll(task => task.IsCompleted);
        op.Worker = Detached(() => RefreshSourcesAsync(op, token)); workers.Add(op.Worker);
    }
    private async Task RefreshSourcesAsync(ActivityRefreshOperation op, CancellationTokenSource cancellation)
    {
        using (cancellation)
        {
            try
            {
                while (true)
                {
                    ActivitySource[] sources;
                    await gate.WaitAsync(cancellation.Token);
                    try
                    {
                        sources = Enumerable.Range(0, Math.Min(4, op.Pending.Count)).Select(_ => op.Pending.Dequeue()).ToArray();
                        if (sources.Length == 0) op.Accepting = false;
                    }
                    finally { gate.Release(); }
                    if (sources.Length == 0) break;
                    await Task.WhenAll(sources.Select(Refresh));
                }
            }
            catch (OperationCanceledException) when (cancellation.IsCancellationRequested) { }
            catch (Exception error) when (error is not OutOfMemoryException)
            {
                await gate.WaitAsync();
                try { op.Failed++; }
                finally { gate.Release(); }
            }
            finally
            {
                await gate.WaitAsync();
                try
                {
                    if (op.Generation == generation && !lifetime.IsCancellationRequested)
                    { op.Status = op.Failed == 0 ? "succeeded" : op.Checked == op.Failed ? "failed" : "partial"; revision++; }
                }
                finally { gate.Release(); }
            }
        }

        async Task Refresh(ActivitySource source)
        {
            try { await RefreshOneAsync(op, source, cancellation.Token); }
            catch (OperationCanceledException) when (cancellation.IsCancellationRequested) { throw; }
            catch (Exception error) when (error is not OutOfMemoryException)
            {
                await gate.WaitAsync();
                try { op.Failed++; }
                finally { gate.Release(); }
            }
        }
    }
    public async ValueTask DisposeAsync()
    {
        lifetime.Cancel(); selection.Cancel();
        if (initialization is not null)
        {
            try { await initialization; }
            catch (Exception error) when (error is not OutOfMemoryException) { }
        }
        if (loop is not null) await loop;
        await Task.WhenAll(workers.ToArray());
        for (var index = 0; index < 4; index++) await coverRequests.WaitAsync();
        await gate.WaitAsync();
        try { ClearCovers(); } finally { gate.Release(); }
        coverRequests.Dispose();
        activationCancellation.Dispose(); selection.Dispose(); lifetime.Dispose(); gate.Dispose();
    }

    private async Task RefreshOneAsync(ActivityRefreshOperation op, ActivitySource source, CancellationToken cancellationToken)
    {
        ActivityContent? content = null; string[] diagnostics = []; ActivityFailure? failure = null;
        try
        {
            var response = await network.GetAsync(source.Endpoint, 4194304, cancellationToken);
            if (response.StatusCode != 200) throw new ActivityFailure("activity_http_" + response.StatusCode, RetryAfter(response));
            (content, diagnostics) = SraFeed.Parse(source, response.Content);
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested) { throw; }
        catch (Exception error) when (error is not OutOfMemoryException)
        { failure = error as ActivityFailure ?? new ActivityFailure("activity_feed_read_failed"); }
        await gate.WaitAsync(cancellationToken);
        try
        {
            cancellationToken.ThrowIfCancellationRequested(); lifetime.Token.ThrowIfCancellationRequested();
            if (op.Generation != generation || !ActivitySources.Selected(settings).Any(s => s.Id == source.Id)) return;
            var entry = feeds[source.Id]; var old = entry.Cache; var now = clock.GetUtcNow();
            var markers = old.BoundaryChecks.Where(pair => now - pair.Value < TimeSpan.FromDays(2)).TakeLast(1024).ToDictionary();
            foreach (var key in ActivityTimes.Boundaries(source, old, now)) markers[key] = now;
            var count = failure is null ? 0 : Math.Min(old.FailureCount + 1, 1000);
            var delay = failure is null ? TimeSpan.FromHours(6) : (failure.RetryAfter is {} retry ? (TimeSpan?)(retry - now) : null) ?? TimeSpan.FromMinutes(count switch { 1 => 1, 2 => 5, 3 => 30, _ => 120 });
            delay = delay < TimeSpan.FromMinutes(1) ? TimeSpan.FromMinutes(1) : delay > TimeSpan.FromDays(1) ? TimeSpan.FromDays(1) : delay;
            var next = old with { Content = content ?? old.Content, LastGoodAt = failure is null ? now : old.LastGoodAt,
                LastCheckedAt = now, NextCheckAt = now + delay, FailureCount = count, Diagnostics = failure is null ? diagnostics : [failure.Code],
                BoundaryChecks = markers };
            try
            {
                var commit = await documents.WriteAsync(Guid.NewGuid(), source.DocumentName, entry.Revision, ActivityJson.Bytes(next), cancellationToken);
                entry.Revision = commit.Revision; entry.Cache = next; op.Checked++;
                if (failure is not null) op.Failed++;
                else if (old.Content?.SnapshotId != content?.SnapshotId) op.Changed++;
            }
            catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested) { throw; }
            catch (Exception error) when (error is not OutOfMemoryException)
            {
                op.Checked++; op.Failed++;
                // A competing activation owns the winning bytes; never retry with a newer CAS against stale content.
                var winner = await documents.ReadAsync(source.DocumentName, cancellationToken);
                if (winner is not null)
                {
                    try
                    {
                        var cache = ActivityJson.Read<ActivityCache>(winner.Json);
                        entry.Cache = cache.Validate(source); entry.Revision = winner.Revision;
                    }
                    catch (Exception parse) when (parse is not OutOfMemoryException) { entry.Unsupported = true; }
                }
            }
            revision++;
        }
        finally { gate.Release(); }
    }
    private DateTimeOffset? RetryAfter(ActivityResponse response)
    {
        var text = response.Headers.FirstOrDefault(pair => pair.Key.Equals("Retry-After", StringComparison.OrdinalIgnoreCase)).Value?.FirstOrDefault();
        if (int.TryParse(text, NumberStyles.None, CultureInfo.InvariantCulture, out var seconds)) return clock.GetUtcNow() + TimeSpan.FromSeconds(Math.Clamp(seconds, 60, 86400));
        if (DateTimeOffset.TryParse(text, CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out var time)) return time;
        return null;
    }

    internal async Task<object> StateAsync(CancellationToken cancellationToken)
    {
        await gate.WaitAsync(cancellationToken);
        try
        {
            var selected = ActivitySources.Selected(settings).Select(s => s.Id).ToArray();
            return new { revision, settingsRevision, feeds = ActivitySources.All.Select(source => Feed(source, false)).ToArray(),
                selectedFeedIds = selected, settings.GameOrder, settings.Progressions, settings.RotationSeconds,
                settings.PauseOnInteraction, pauseOnHover = true, pauseWhenHidden = true,
                refreshing = operation?.Status is "running" or "queued", refreshStatus = operation?.Status is "partial" or "failed" ? operation.Status : "idle",
                refreshOperation = operation is null ? null : new { operation.Status, checkedFeedCount = operation.Checked,
                    changedFeedCount = operation.Changed, failedFeedCount = operation.Failed, imageFailureCount = Volatile.Read(ref imageFailures) },
                serverNowUtc = clock.GetUtcNow(), progressionOptions = new Dictionary<string, object> {
                    ["blue-archive"] = new[] { new { value = "cn", label = "国服" }, new { value = "jp", label = "日服" }, new { value = "global", label = "国际服" } },
                    ["neverness-to-everness"] = new[] { new { value = "cn", label = "国服" }, new { value = "global", label = "国际服" } } } };
        }
        finally { gate.Release(); }
    }
    internal async Task<object> FeedAsync(string id, CancellationToken cancellationToken)
    {
        await gate.WaitAsync(cancellationToken);
        try { return new { revision, feed = Feed(ActivitySources.Resolve(id), true) }; }
        finally { gate.Release(); }
    }
    private object Feed(ActivitySource source, bool includeEvents)
    {
        var entry = feeds[source.Id]; var cache = entry.Cache; var content = cache.Content;
        var selected = ActivitySources.Selected(settings).Any(s => s.Id == source.Id);
        var overview = content?.Overview;
        return new { id = source.Id, game = source.GameId, source.Server, source.ProgressionId, contentLocale = source.Locale,
            enabled = selected, overview = new { title = overview?.Title ?? "", number = overview?.Number,
                coverId = ActivityCovers.Identity(overview?.CoverUrl), start = overview?.Start, end = overview?.End },
            events = includeEvents && selected ? content?.Events.Select(item => new { item.Id, item.Title, item.Summary, item.Kind,
                item.Start, item.PlayEnd, coverId = ActivityCovers.Identity(item.CoverUrl) }).ToArray() : null,
            cacheState = entry.Unsupported ? "failed" : content is null ? (cache.FailureCount > 0 ? "failed" : "missing") :
                cache.FailureCount > 0 || cache.NextCheckAt <= clock.GetUtcNow() ? "stale" : "fresh",
            cache.LastGoodAt, cache.LastCheckedAt, cache.NextCheckAt,
            diagnostics = entry.Unsupported ? ["activity_cache_format_unsupported"] : cache.Diagnostics };
    }
    private string? ResolveCover(string id)
    {
        foreach (var source in ActivitySources.Selected(settings))
        {
            var content = feeds[source.Id].Cache.Content;
            if (content is null) continue;
            foreach (var url in content.Events.Select(item => item.CoverUrl).Prepend(content.Overview.CoverUrl))
                if (ActivityCovers.Identity(url) == id) return url;
        }
        return null;
    }

    private readonly Dictionary<string, ActivityImageEntry> covers = new(StringComparer.Ordinal);
    private readonly SemaphoreSlim coverRequests = new(4, 4);
    private int imageFailures;
    internal async Task<ActivityImage> CachedCoverAsync(string id, CancellationToken cancellationToken)
    {
        using var combined = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken, lifetime.Token);
        await gate.WaitAsync(combined.Token);
        try
        {
            if (id.Length != 64 || !id.All(Uri.IsHexDigit) || ResolveCover(id) is null)
                throw new ActivityFailure("activity_cover_unknown");
            if (covers.TryGetValue(id, out var entry) && entry.Image is { } image) return image;
            if (imageStore is not null && await imageStore.ReadAsync(id, combined.Token) is { } saved) return saved;
            throw new ActivityFailure("activity_cover_not_cached");
        }
        finally { gate.Release(); }
    }
    internal async Task<ActivityImage> CoverAsync(string id, CancellationToken cancellationToken)
    {
        if (id.Length != 64 || !id.All(Uri.IsHexDigit)) throw new ActivityFailure("activity_cover_unknown");
        using var combined = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken, lifetime.Token);
        string url; long captured;
        await gate.WaitAsync(combined.Token);
        try
        {
            url = ResolveCover(id) ?? throw new ActivityFailure("activity_cover_unknown"); captured = generation;
            ExpireCovers(clock.GetUtcNow());
            if (covers.TryGetValue(id, out var cached)) return cached.Image ?? throw new ActivityFailure("activity_cover_temporarily_unavailable");
        }
        finally { gate.Release(); }
        await coverRequests.WaitAsync(combined.Token);
        try
        {
            await gate.WaitAsync(combined.Token);
            try
            {
                RequireCover();
                if (covers.TryGetValue(id, out var cached) && cached.Expires > clock.GetUtcNow())
                    return cached.Image ?? throw new ActivityFailure("activity_cover_temporarily_unavailable");
                if (imageStore is not null && await imageStore.ReadAsync(id, combined.Token) is { } persisted)
                {
                    RequireCover();
                    Remember(id, persisted);
                    return persisted;
                }
            }
            finally { gate.Release(); }
            try
            {
                var response = await network.GetAsync(new Uri(url), 8388608, combined.Token);
                var mime = response.Headers.FirstOrDefault(pair => pair.Key.Equals("Content-Type", StringComparison.OrdinalIgnoreCase)).Value?.FirstOrDefault()?.Split(';')[0].Trim().ToLowerInvariant() ?? "";
                if (response.StatusCode != 200 || response.Content.Length is < 1 or > 8388608 || ActivityCovers.MediaType(response.Content.Span, mime) is null)
                    throw new ActivityFailure("activity_cover_content_invalid");
                await gate.WaitAsync(combined.Token);
                try
                {
                    RequireCover();
                    var image = new ActivityImage(mime, response.Content.ToArray());
                    if (imageStore is not null)
                    {
                        var currentIds = feeds.Values.SelectMany(feed => (feed.Cache.Content?.Events.Select(item => item.CoverUrl) ?? [])
                            .Prepend(feed.Cache.Content?.Overview.CoverUrl)).Select(ActivityCovers.Identity)
                            .Where(value => value is not null).Select(value => value!).ToHashSet(StringComparer.Ordinal);
                        await Detached(async () => await imageStore.SaveAsync(id, image, currentIds, combined.Token));
                        RequireCover();
                    }
                    Remember(id, image); return image;
                }
                finally { gate.Release(); }
            }
            catch (OperationCanceledException) { throw; }
            catch (Exception error) when (error is not OutOfMemoryException)
            {
                await gate.WaitAsync(combined.Token);
                try
                {
                    RequireCover();
                    covers[id] = new(null, clock.GetUtcNow() + TimeSpan.FromMinutes(1)); Interlocked.Increment(ref imageFailures);
                    while (covers.Count > 128) covers.Remove(covers.MinBy(pair => pair.Value.Expires).Key);
                }
                finally { gate.Release(); }
                throw new ActivityFailure("activity_cover_unavailable");
            }
        }
        finally { coverRequests.Release(); }

        void RequireCover()
        {
            combined.Token.ThrowIfCancellationRequested();
            if (captured != generation || ResolveCover(id) != url) throw new OperationCanceledException(combined.Token);
        }
    }
    private void Remember(string id, ActivityImage image)
    {
        while (covers.Values.Sum(item => item.Image?.Bytes.Length ?? 0) + image.Bytes.Length > 33554432 || covers.Count >= 128)
            covers.Remove(covers.MinBy(pair => pair.Value.Expires).Key);
        covers[id] = new(image, clock.GetUtcNow() + TimeSpan.FromMinutes(30));
    }
    private void ExpireCovers(DateTimeOffset now)
    { foreach (var key in covers.Where(pair => pair.Value.Expires <= now).Select(pair => pair.Key).ToArray()) covers.Remove(key); }
    private void ClearCovers() { covers.Clear(); }
}
