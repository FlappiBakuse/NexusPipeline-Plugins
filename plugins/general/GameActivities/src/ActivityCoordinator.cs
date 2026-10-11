using System.Text.Json;
using System.Text.Json.Nodes;
using NexusPipeline.Plugin.Abstractions;

namespace NexusPipeline.Plugin.GameActivities;

internal enum RefreshReason { Startup, Scheduled, Manual, Boundary, SelectionChanged }
internal sealed class ActivityCoordinator(IPluginHostContext context, TimeProvider? timeProvider = null)
{
    private readonly TimeProvider _clock = timeProvider ?? TimeProvider.System;
    private readonly SemaphoreSlim _gate = new(1, 1);
    private readonly CancellationTokenSource _lifetime = new();
    private CancellationTokenSource _selection = new();
    private ActivitySettingsState _settings = new(0, new());
    private readonly Dictionary<string, JsonObject> _feeds = new(), _emptyHealth = new();
    private readonly Dictionary<string, DateTimeOffset> _next = new(), _manual = new();
    private readonly Dictionary<string, int> _failures = new();
    private readonly Dictionary<string, Operation> _operations = new();
    private JsonObject _boundaryChecks = new();
    private long _generation;
    private Task? _running;
    private Operation? _active;
    private Operation? _queued;
    private bool _stopped;
    private readonly object _stopLock = new();
    private Task? _stopTask;
    private sealed class Operation(string id, DateTimeOffset created, long generation)
    {
        public string Id = id, Status = "queued";
        public DateTimeOffset Created = created;
        public long Generation = generation;
        public Dictionary<string, (GameSource Source, RefreshReason Reason)> Pending = new();
        public Dictionary<string, RefreshReason> Checked = new();
        public HashSet<string> Changed = new(), Failed = new(), ImageFailures = new();
    }
    internal static string Scope(GameSource source, string provider) => "sra/v3/" + source.GameId + "/" + source.ProgressionId + "/" + source.Locale + "/" + provider;
    public async Task InitializeAsync(CancellationToken ct)
    {
        _boundaryChecks = await context.ScopedData.ReadJsonAsync("sra/v3/boundary-checks", ct).ConfigureAwait(false) ?? new();
        var saved = await context.Config.ReadAsync<ActivitySettingsState>(ct).ConfigureAwait(false);
        if (saved is not null) _settings = saved with { Settings = GameSources.Validate(saved.Settings.CarouselIntervalSeconds == 6 ? saved.Settings with { CarouselIntervalSeconds = 30 } : saved.Settings) };
        foreach (var source in GameSources.All)
        {
            var feed = await context.ScopedData.ReadJsonAsync(Scope(source, "merged"), ct).ConfigureAwait(false);
            if (feed is null) continue;
            if (feed["formatVersion"]?.GetValue<int>() != 3 || ActivityPolicy.Text(feed["gameId"]) != source.GameId
                || ActivityPolicy.Text(feed["progressionId"]) != source.ProgressionId || ActivityPolicy.Text(feed["contentLocale"]) != source.Locale)
                throw new ActivityException("cache_identity_invalid", 500);
            ActivityNormalizer.Finalize(feed, _clock.GetUtcNow());
            _feeds[GameSources.Key(source)] = feed;
            _next[GameSources.Key(source)] = DateTimeOffset.TryParse(ActivityPolicy.Text(feed["health"]?["nextCheckAt"]), out var due) ? due : DateTimeOffset.MinValue;
        }
    }
    public async Task<JsonObject> StateAsync(CancellationToken ct)
    {
        await _gate.WaitAsync(ct).ConfigureAwait(false);
        try
        {
            var now = _clock.GetUtcNow();
            return ActivityNormalizer.Object(new { formatVersion = 3, serverNowUtc = ActivityNormalizer.Utc(now), settingsRevision = _settings.Revision,
                refreshing = _active is not null, settings = _settings.Settings,
                games = GameSources.All.Select(s => new { s.GameId, s.ProgressionId, contentLocale = s.Locale }).ToArray(),
                selectedFeeds = GameSources.Selected(_settings.Settings).Select(s => new { s.GameId, s.ProgressionId, contentLocale = s.Locale,
                    snapshotId = _feeds.TryGetValue(GameSources.Key(s), out var f) ? ActivityPolicy.Text(f["snapshotId"]) : null,
                    health = Health(GameSources.Key(s), now) }).ToArray() });
        }
        finally { _gate.Release(); }
    }
    private JsonObject Health(string key, DateTimeOffset now)
    {
        var health = _feeds.GetValueOrDefault(key)?["health"]?.DeepClone().AsObject()
            ?? _emptyHealth.GetValueOrDefault(key)?.DeepClone().AsObject()
            ?? ActivityNormalizer.Object(new { cacheState = "empty", contentState = "empty", lastGoodAt = (string?)null, lastCheckedAt = (string?)null, nextCheckAt = (string?)null, diagnostics = Array.Empty<object>() });
        if (_next.TryGetValue(key, out var due)) { health["nextCheckAt"] = ActivityNormalizer.Utc(due); if (due <= now && _feeds.ContainsKey(key)) health["cacheState"] = "stale"; }
        return health;
    }
    public async Task<JsonObject?> FeedAsync(GameSource source, string locale, CancellationToken ct)
    {
        if (locale != source.Locale) throw new ActivityException("content_locale_unavailable", 400);
        await _gate.WaitAsync(ct).ConfigureAwait(false);
        try
        {
            var feed = _feeds.GetValueOrDefault(GameSources.Key(source))?.DeepClone().AsObject();
            if (feed is not null) feed["health"] = Health(GameSources.Key(source), _clock.GetUtcNow());
            return feed;
        }
        finally { _gate.Release(); }
    }
    public async Task<JsonObject> SettingsAsync(long expected, ActivitySettings settings, CancellationToken ct)
    {
        settings = GameSources.Validate(settings); bool changed;
        await _gate.WaitAsync(ct).ConfigureAwait(false);
        try
        {
            if (_stopped) throw new ActivityException("plugin_stopped", 409);
            if (expected != _settings.Revision) throw new ActivityException("settings_conflict", 409);
            changed = !GameSources.Selected(_settings.Settings).Select(GameSources.Key).Order().SequenceEqual(GameSources.Selected(settings).Select(GameSources.Key).Order());
            var next = new ActivitySettingsState(expected + 1, settings);
            await context.Config.WriteAsync(next, ct).ConfigureAwait(false); _settings = next;
            if (changed)
            {
                _generation++; _selection.Cancel(); _selection.Dispose(); _selection = new();
            }
        }
        finally { _gate.Release(); }
        if (changed) await Queue(RefreshReason.SelectionChanged, ct).ConfigureAwait(false);
        return ActivityNormalizer.Object(new { revision = expected + 1, settings });
    }
    public Task<JsonObject> QueueAsync(bool manual, CancellationToken ct) => Queue(manual ? RefreshReason.Manual : RefreshReason.Scheduled, ct);
    private async Task<JsonObject> Queue(RefreshReason reason, CancellationToken ct)
    {
        await _gate.WaitAsync(ct).ConfigureAwait(false);
        try
        {
            if (_stopped) throw new ActivityException("plugin_stopped", 409);
            var now = _clock.GetUtcNow();
            foreach (string id in _operations.Where(p => p.Value.Created < now.AddMinutes(-30) && p.Value != _active).Select(p => p.Key).ToArray()) _operations.Remove(id);
            var sources = GameSources.Selected(_settings.Settings).Where(s => reason is RefreshReason.Manual or RefreshReason.SelectionChanged || Due(s, now)).ToArray();
            bool changing = _active is { } running && running.Generation != _generation;
            bool joined = changing ? _queued is not null : _active is not null;
            if (reason == RefreshReason.Manual && !joined && sources.Any(s => _manual.GetValueOrDefault(GameSources.Key(s)) > now.AddSeconds(-60))) throw new ActivityException("refresh_rate_limited", 429);
            var operation = (changing ? _queued : _active) ?? new Operation(Guid.NewGuid().ToString("N"), now, _generation);
            if (operation.Generation != _generation) { operation.Generation = _generation; operation.Pending.Clear(); }
            foreach (var source in sources)
            {
                string key = GameSources.Key(source);
                if (reason == RefreshReason.Manual) _manual[key] = now;
                if (operation.Checked.TryGetValue(key, out var checkedReason) && (checkedReason == RefreshReason.Manual || reason != RefreshReason.Manual)) continue;
                var requirement = reason == RefreshReason.Scheduled && BoundaryMarkers(source, now).Any() ? RefreshReason.Boundary : reason;
                if (!operation.Pending.TryGetValue(key, out var pending) || pending.Reason != RefreshReason.Manual) operation.Pending[key] = (source, requirement);
            }
            if (!joined)
            {
                _operations[operation.Id] = operation;
                if (changing) _queued = operation;
                else Start(operation);
            }
            return ActivityNormalizer.Object(new { operationId = operation.Id, joinedExisting = joined });
        }
        finally { _gate.Release(); }
    }
    private void Start(Operation operation)
    {
        _active = operation;
        var token = CancellationTokenSource.CreateLinkedTokenSource(_lifetime.Token, _selection.Token);
        _running = Task.Run(async () => { using (token) await Refresh(operation, token.Token).ConfigureAwait(false); });
    }
    private bool Due(GameSource source, DateTimeOffset now) => _next.GetValueOrDefault(GameSources.Key(source)) <= now || BoundaryMarkers(source, now).Any(m => !_boundaryChecks.ContainsKey(m));
    private IEnumerable<string> BoundaryMarkers(GameSource source, DateTimeOffset now)
    {
        if (!_feeds.TryGetValue(GameSources.Key(source), out var feed)) yield break;
        var points = feed["activities"]!.AsArray().OfType<JsonObject>().SelectMany(item => new[] { (ActivityPolicy.Text(item["eventId"]) + "/start", item["times"]?["start"]), (ActivityPolicy.Text(item["eventId"]) + "/end", item["times"]?["playEnd"]) })
            .Concat(new[] { ("overview/start", feed["overview"]?["start"]), ("overview/end", feed["overview"]?["end"]) });
        foreach (var (id, point) in points)
        {
            var boundary = ActivityPolicy.DisplayInstant(point);
            if (boundary is null || Math.Abs((boundary.Value - now).TotalMinutes) > 15) continue;
            yield return ActivityNormalizer.Hash(GameSources.Key(source) + "/" + id + "/" + ActivityNormalizer.Utc(boundary.Value) + "/" + (now < boundary ? "pre" : "post"));
        }
    }

    public async Task<JsonObject> OperationAsync(string id, CancellationToken ct)
    {
        await _gate.WaitAsync(ct).ConfigureAwait(false);
        try
        {
            if (!_operations.TryGetValue(id, out var operation) || operation.Created < _clock.GetUtcNow().AddMinutes(-30)) throw new ActivityException("operation_not_found", 404);
            return ActivityNormalizer.Object(new { operationId = id, status = operation.Status, checkedFeedCount = operation.Checked.Count,
                changedFeedCount = operation.Changed.Count, failedFeedCount = operation.Failed.Count, imageFailureCount = operation.ImageFailures.Count });
        }
        finally { _gate.Release(); }
    }
    private async Task Refresh(Operation operation, CancellationToken ct)
    {
        var http = new ActivityHttp(context.Http); var images = new ActivityAssetCache(http, context.Assets, context.ScopedData);
        try
        {
            while (true)
            {
                (GameSource Source, RefreshReason Reason)[] targets;
                await _gate.WaitAsync(ct).ConfigureAwait(false);
                try
                {
                    operation.Status = "running";
                    targets = operation.Pending.Values.ToArray(); operation.Pending.Clear();
                    if (targets.Length == 0)
                    { operation.Status = operation.Failed.Count + operation.ImageFailures.Count == 0 ? "succeeded" : operation.Changed.Count > 0 || operation.Failed.Count < operation.Checked.Count ? "partial" : "failed"; _active = null; break; }
                }
                finally { _gate.Release(); }
                await Task.WhenAll(targets.Select(target => RefreshSource(operation, target.Source, target.Reason, http, images, ct))).ConfigureAwait(false);
            }
        }
        catch (OperationCanceledException) { operation.Status = "cancelled"; }
        catch (Exception error) { context.Logger.Error("Activity operation failed: " + error.GetType().Name); operation.Status = "failed"; }
        finally
        {
            await _gate.WaitAsync().ConfigureAwait(false);
            try
            {
                if (_active == operation) _active = null;
                if (_queued is { } pending && !_stopped) { _queued = null; Start(pending); }
            }
            finally { _gate.Release(); }
        }
    }
    private async Task RefreshSource(Operation operation, GameSource source, RefreshReason reason, ActivityHttp http, ActivityAssetCache images, CancellationToken ct)
    {
        string key = GameSources.Key(source); var now = _clock.GetUtcNow();
        try
        {
            using var textBudget = CancellationTokenSource.CreateLinkedTokenSource(ct); textBudget.CancelAfter(TimeSpan.FromSeconds(90));
            var raw = await new SraActivityProvider(http).ReadAsync(source, textBudget.Token).ConfigureAwait(false);
            var feed = ActivityNormalizer.BuildSra(source, raw, now);
            await _gate.WaitAsync(textBudget.Token).ConfigureAwait(false);
            try
            {
                Ensure(operation, ct);
                operation.Checked[key] = reason;
                if (_feeds.TryGetValue(key, out var previous)) PreserveCovers(feed, previous);
                var next = now.AddHours(6);
                feed["health"]!["nextCheckAt"] = ActivityNormalizer.Utc(next);
                await Publish(source, feed, operation, textBudget.Token).ConfigureAwait(false); _next[key] = next;
                foreach (string expired in _boundaryChecks.Where(p => DateTimeOffset.TryParse(ActivityPolicy.Text(p.Value), out var checkedAt) && checkedAt < now.AddDays(-30)).Select(p => p.Key).ToArray()) _boundaryChecks.Remove(expired);
                foreach (string marker in BoundaryMarkers(source, now)) _boundaryChecks[marker] = ActivityNormalizer.Utc(now);
                await context.ScopedData.WriteJsonAsync("sra/v3/boundary-checks", _boundaryChecks, textBudget.Token).ConfigureAwait(false);
                _failures.Remove(key); _emptyHealth.Remove(key);
            }
            finally { _gate.Release(); }
            try
            {
            using var imageBudget = CancellationTokenSource.CreateLinkedTokenSource(ct); imageBudget.CancelAfter(TimeSpan.FromSeconds(90));
            await images.CacheAsync(feed, source, reason == RefreshReason.Manual, imageBudget.Token, async (entityId, url, assetId) =>
            {
                await _gate.WaitAsync(imageBudget.Token).ConfigureAwait(false);
                try
                {
                    Ensure(operation, ct);
                    if (!_feeds.TryGetValue(key, out var current)) return;
                    var copy = current.DeepClone().AsObject();
                    var target = ActivityPolicy.Text(copy["overview"]?["overviewId"]) == entityId ? copy["overview"]?.AsObject()
                        : copy["activities"]!.AsArray().OfType<JsonObject>().FirstOrDefault(i => ActivityPolicy.Text(i["eventId"]) == entityId);
                    if (target?["cover"] is null || ActivityPolicy.Text(target["cover"]?["sourceUrl"]) != url) return;
                    target["cover"]!["assetId"] = assetId;
                    await Publish(source, copy, operation, imageBudget.Token).ConfigureAwait(false);
                }
                finally { _gate.Release(); }
            }, url => { lock (operation.ImageFailures) operation.ImageFailures.Add(key + "/" + url); }).ConfigureAwait(false);
            }
            catch (OperationCanceledException) when (ct.IsCancellationRequested) { throw; }
            catch (Exception error) when (error is HttpRequestException or ActivityException or IOException or UnauthorizedAccessException or OperationCanceledException)
            { lock (operation.ImageFailures) operation.ImageFailures.Add(key + "/image-phase"); }
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested) { throw; }
        catch (Exception error) when (error is HttpRequestException or ActivityException or JsonException or IOException or UnauthorizedAccessException or OperationCanceledException)
        {
            await _gate.WaitAsync().ConfigureAwait(false);
            try
            {
                Ensure(operation, ct); operation.Checked[key] = reason; operation.Failed.Add(key); _next[key] = FailureDue(key, now, error);
                if (reason == RefreshReason.Boundary)
                {
                    foreach (string marker in BoundaryMarkers(source, now)) _boundaryChecks[marker] = ActivityNormalizer.Utc(now);
                    try { await context.ScopedData.WriteJsonAsync("sra/v3/boundary-checks", _boundaryChecks, ct).ConfigureAwait(false); }
                    catch (Exception storage) when (storage is IOException or UnauthorizedAccessException) { context.Logger.Warn("Activity boundary persistence failed: " + storage.GetType().Name); }
                }
                if (_feeds.TryGetValue(key, out var previous))
                {
                    var failed = previous.DeepClone().AsObject(); failed["health"]!["cacheState"] = "stale"; failed["health"]!["lastCheckedAt"] = ActivityNormalizer.Utc(now);
                    failed["health"]!["nextCheckAt"] = ActivityNormalizer.Utc(_next[key]);
                    var diagnostics = failed["health"]!["diagnostics"]!.AsArray(); if (diagnostics.Count >= 32) diagnostics.RemoveAt(0);
                    diagnostics.Add(ActivityNormalizer.Object(new { code = "refresh_failed", message = error is ActivityException activity ? activity.Code : error.GetType().Name }));
                    try { await context.ScopedData.WriteJsonAsync(Scope(source, "merged"), failed, ct).ConfigureAwait(false); }
                    catch (Exception storage) when (storage is IOException or UnauthorizedAccessException) { context.Logger.Warn("Activity health persistence failed: " + storage.GetType().Name); }
                    _feeds[key] = failed;
                }
                else _emptyHealth[key] = ActivityNormalizer.Object(new { cacheState = "empty", contentState = "empty", lastGoodAt = (string?)null,
                    lastCheckedAt = ActivityNormalizer.Utc(now), nextCheckAt = ActivityNormalizer.Utc(_next[key]),
                    diagnostics = new[] { new { code = "refresh_failed", message = error is ActivityException activity ? activity.Code : error.GetType().Name } } });
            }
            finally { _gate.Release(); }
            context.Logger.Warn("Activity source failed for " + key + ": " + (error is ActivityException a ? a.Code : error.GetType().Name));
        }
    }
    private void Ensure(Operation operation, CancellationToken ct)
    { ct.ThrowIfCancellationRequested(); if (_stopped || operation.Generation != _generation) throw new OperationCanceledException(ct); }
    private async Task Publish(GameSource source, JsonObject feed, Operation operation, CancellationToken ct)
    {
        Ensure(operation, ct); ActivityNormalizer.Finalize(feed, _clock.GetUtcNow());
        bool changed = !_feeds.TryGetValue(GameSources.Key(source), out var old) || ActivityPolicy.Text(old["snapshotId"]) != ActivityPolicy.Text(feed["snapshotId"]);
        await context.ScopedData.WriteJsonAsync(Scope(source, "merged"), feed, ct).ConfigureAwait(false);
        _feeds[GameSources.Key(source)] = feed.DeepClone().AsObject(); if (changed) operation.Changed.Add(GameSources.Key(source));
    }
    private DateTimeOffset FailureDue(string key, DateTimeOffset now, Exception error)
    {
        int count = _failures.GetValueOrDefault(key) + 1; _failures[key] = count;
        var due = now.AddMinutes(new[] { 1, 5, 30, 120 }[Math.Min(count - 1, 3)]).AddSeconds(Random.Shared.Next(0, 16));
        return error is ActivityException { RetryAfter: { } retry } && retry > due ? retry : due;
    }
    private static void PreserveCovers(JsonObject feed, JsonObject previous)
    {
        var old = previous["activities"]!.AsArray().OfType<JsonObject>().Append(previous["overview"]!.AsObject())
            .ToDictionary(i => ActivityPolicy.Text(i["eventId"] ?? i["overviewId"]));
        foreach (var item in feed["activities"]!.AsArray().OfType<JsonObject>().Append(feed["overview"]!.AsObject()))
            if (item["cover"] is JsonObject cover && old.TryGetValue(ActivityPolicy.Text(item["eventId"] ?? item["overviewId"]), out var prior)
                && ActivityPolicy.Text(cover["sourceUrl"]) == ActivityPolicy.Text(prior["cover"]?["sourceUrl"]))
                cover["assetId"] = prior["cover"]?["assetId"]?.DeepClone();
    }
    public Task StopAsync(CancellationToken ct) { lock (_stopLock) return (_stopTask ??= StopCore()).WaitAsync(ct); }
    private async Task StopCore()
    {
        _lifetime.Cancel();
        await _gate.WaitAsync().ConfigureAwait(false); Task? running;
        try { _stopped = true; _selection.Cancel(); running = _running; }
        finally { _gate.Release(); }
        if (running is not null) await running.ConfigureAwait(false);
        _selection.Dispose(); _lifetime.Dispose();
    }
}
