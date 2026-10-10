using System.Text.Json;
using System.Text.Json.Nodes;
using NexusPipeline.Plugin.Abstractions;

namespace NexusPipeline.Plugin.GameActivities;

internal sealed class ActivityCoordinator(IPluginHostContext context, TimeProvider? timeProvider = null)
{
    private readonly TimeProvider _clock = timeProvider ?? TimeProvider.System;
    private readonly SemaphoreSlim _gate = new(1, 1);
    private readonly CancellationTokenSource _lifetime = new();
    private CancellationTokenSource _selection = new();
    private ActivitySettingsState _settings = new(0, new());
    private readonly Dictionary<string, JsonObject> _feeds = new();
    private readonly Dictionary<string, DateTimeOffset> _next = new();
    private readonly Dictionary<string, int> _failures = new();
    private readonly Dictionary<string, DateTimeOffset> _manual = new();
    private readonly Dictionary<string, (string Status, DateTimeOffset Created)> _operations = new();
    private JsonObject _boundaryChecks = new();
    private readonly Dictionary<string, JsonObject> _withdrawals = new();
    private Task? _running;
    private string? _runningId;
    private readonly object _stopLock = new();
    private Task? _stopTask;
    private bool _stopped;

    public async Task InitializeAsync(CancellationToken ct)
    {
        _boundaryChecks = await context.ScopedData.ReadJsonAsync("boundary-checks/v1", ct).ConfigureAwait(false) ?? new();
        var saved = await context.Config.ReadAsync<ActivitySettingsState>(ct).ConfigureAwait(false);
        if (saved is not null)
        {
            var settings = saved.Settings.CarouselIntervalSeconds == 6
                ? saved.Settings with { CarouselIntervalSeconds = 30 }
                : saved.Settings;
            _settings = saved with { Settings = GameSources.Validate(settings) };
        }
        foreach (var source in GameSources.All)
        {
            var ledger = await context.ScopedData.ReadJsonAsync(Scope(source, "withdrawals"), ct).ConfigureAwait(false) ?? ActivityWithdrawals.Empty(source);
            ActivityWithdrawals.Validate(ledger, source);
            _withdrawals[GameSources.Key(source)] = ledger;
            var feed = await context.ScopedData.ReadJsonAsync(Scope(source, "merged"), ct).ConfigureAwait(false);
            if (feed is null) continue;
            if (ActivityPolicy.Text(feed["gameId"]) != source.GameId || ActivityPolicy.Text(feed["progressionId"]) != source.ProgressionId || ActivityPolicy.Text(feed["dataClass"]) != "live")
                throw new ActivityException("cache_identity_invalid", 500);
            feed = await RefreshCachedSemanticsAsync(source, feed, ct).ConfigureAwait(false);
            var official = await context.ScopedData.ReadAsync<OfficialCache>(Scope(source, "official"), ct).ConfigureAwait(false);
            await ApplyWithdrawalsAsync(source, feed, official?.Result, ct).ConfigureAwait(false);
            ActivityNormalizer.Finalize(feed, _clock.GetUtcNow());
            _feeds[GameSources.Key(source)] = feed;
            _next[GameSources.Key(source)] = DateTimeOffset.TryParse(ActivityPolicy.Text(feed["health"]?["nextCheckAt"]), out var due) ? due : DateTimeOffset.MinValue;
            if (await context.ScopedData.ReadAsync<OfficialCache>(Scope(source, "official"), ct).ConfigureAwait(false) is null)
                _next[GameSources.Key(source)] = DateTimeOffset.MinValue;
        }
    }
    private async Task<JsonObject> RefreshCachedSemanticsAsync(GameSource source, JsonObject previous, CancellationToken ct)
    {
        var checkpoint = await context.ScopedData.ReadJsonAsync(Scope(source, "sra"), ct).ConfigureAwait(false);
        if (checkpoint?["raw"] is not JsonObject raw) return previous;
        var now = _clock.GetUtcNow();
        var feed = ActivityNormalizer.Normalize(source, raw, now);
        var assets = await context.ScopedData.ReadJsonAsync("asset-manifest", ct).ConfigureAwait(false) ?? new JsonObject();
        ActivityAssetCache.RestoreOverview(feed, raw, assets);
        var official = await context.ScopedData.ReadAsync<OfficialCache>(Scope(source, "official"), ct).ConfigureAwait(false);
        if (official is not null) OfficialActivityProvider.Merge(feed, official.Result, source, now);
        PreserveOpen(feed, previous, now);
        foreach (var item in feed["activities"]!.AsArray().OfType<JsonObject>())
        {
            var old = previous["activities"]!.AsArray().OfType<JsonObject>().FirstOrDefault(value => ActivityPolicy.Text(value["eventId"]) == ActivityPolicy.Text(item["eventId"]));
            if (old?["cover"] is not null) item["cover"] = old["cover"]!.DeepClone();
            var provenance = item["provenance"]!.AsArray();
            foreach (var evidence in provenance.Where(value => ActivityPolicy.Text(value?["field"]) == "/cover").ToArray()) provenance.Remove(evidence);
            foreach (var evidence in old?["provenance"]?.AsArray() ?? []) if (ActivityPolicy.Text(evidence?["field"]) == "/cover") provenance.Add(evidence!.DeepClone());
        }
        foreach (var sourceNode in feed["sources"]!.AsArray().OfType<JsonObject>())
        {
            var old = previous["sources"]!.AsArray().OfType<JsonObject>().FirstOrDefault(value => ActivityPolicy.Text(value["sourceId"]) == ActivityPolicy.Text(sourceNode["sourceId"]));
            if (old is not null) sourceNode["retrievedAt"] = old["retrievedAt"]!.DeepClone();
        }
        feed["coverage"] = previous["coverage"]!.DeepClone();
        feed["health"] = previous["health"]!.DeepClone();
        ActivityNormalizer.Finalize(feed, now);
        return feed;
    }
    private static string Scope(GameSource source, string provider) => "feed/" + source.GameId + "/" + source.ProgressionId + "/" + source.Locale + "/" + provider + (provider == "official" ? "/v4" : "/v1");
    public async Task<JsonObject> StateAsync(CancellationToken ct)
    {
        await _gate.WaitAsync(ct).ConfigureAwait(false);
        try
        {
            var now = _clock.GetUtcNow();
            return ActivityNormalizer.Object(new
            {
                formatVersion = 1,
                serverNowUtc = ActivityNormalizer.Utc(now),
                settingsRevision = _settings.Revision,
                refreshing = _running is { IsCompleted: false },
                settings = _settings.Settings,
                games = GameSources.All.Select(source => new { source.GameId, source.ProgressionId, contentLocale = source.Locale }).ToArray(),
                selectedFeeds = GameSources.Selected(_settings.Settings).Select(source => new
                {
                    source.GameId,
                    source.ProgressionId,
                    contentLocale = source.Locale,
                    snapshotId = _feeds.TryGetValue(GameSources.Key(source), out var feed) ? ActivityPolicy.Text(feed["snapshotId"]) : null,
                    cacheState = CacheState(GameSources.Key(source), now),
                    nextCheckAt = _next.TryGetValue(GameSources.Key(source), out var next) ? ActivityNormalizer.Utc(next) : null
                }).ToArray()
            });
        }
        finally { _gate.Release(); }
    }
    private string CacheState(string key, DateTimeOffset now) => !_feeds.TryGetValue(key, out var feed) ? "empty" : _next.GetValueOrDefault(key) <= now || ActivityPolicy.Text(feed["health"]?["cacheState"]) == "stale" ? "stale" : "fresh";
    public async Task<JsonObject?> FeedAsync(GameSource source, string locale, CancellationToken ct)
    {
        if (locale != source.Locale) throw new ActivityException("content_locale_unavailable", 400);
        await _gate.WaitAsync(ct).ConfigureAwait(false);
        try
        {
            var feed = _feeds.GetValueOrDefault(GameSources.Key(source))?.DeepClone().AsObject();
            if (feed is not null)
            {
                feed["health"]!["cacheState"] = CacheState(GameSources.Key(source), _clock.GetUtcNow());
                ActivityNormalizer.Finalize(feed, _clock.GetUtcNow());
            }
            return feed;
        }
        finally { _gate.Release(); }
    }
    public async Task<JsonObject> SettingsAsync(long expected, ActivitySettings settings, CancellationToken ct)
    {
        settings = GameSources.Validate(settings);
        await _gate.WaitAsync(ct).ConfigureAwait(false);
        try
        {
            if (_stopped) throw new ActivityException("plugin_stopped", 409);
            if (expected != _settings.Revision) throw new ActivityException("settings_conflict", 409);
            var next = new ActivitySettingsState(expected + 1, settings);
            await context.Config.WriteAsync(next, ct).ConfigureAwait(false);
            _settings = next;
            _selection.Cancel();
            _selection.Dispose();
            _selection = new();
            return ActivityNormalizer.Object(new { revision = next.Revision, settings = next.Settings });
        }
        finally { _gate.Release(); }
    }
    public async Task<JsonObject> QueueAsync(bool manual, CancellationToken ct)
    {
        await _gate.WaitAsync(ct).ConfigureAwait(false);
        try
        {
            if (_stopped) throw new ActivityException("plugin_stopped", 409);
            var now = _clock.GetUtcNow();
            foreach (var key in _operations.Where(pair => pair.Value.Created < now.AddMinutes(-30)).Select(pair => pair.Key).ToArray()) _operations.Remove(key);
            if (_running is { IsCompleted: false }) return ActivityNormalizer.Object(new { operationId = _runningId, joinedExisting = true });
            var sources = GameSources.Selected(_settings.Settings).Where(source => manual || Due(source, now)).ToArray();
            if (manual && sources.Any(source => _manual.TryGetValue(GameSources.Key(source), out var last) && last > now.AddSeconds(-60)))
                throw new ActivityException("refresh_rate_limited", 429);
            var boundaries = _boundaryChecks.DeepClone().AsObject();
            foreach (var entry in boundaries.ToArray())
                if (!DateTimeOffset.TryParse(ActivityPolicy.Text(entry.Value), out var checkedAt) || checkedAt < now.AddHours(-1)) boundaries.Remove(entry.Key);
            foreach (var source in sources)
                foreach (string marker in BoundaryMarkers(source, now)) boundaries[marker] = ActivityNormalizer.Utc(now);
            await context.ScopedData.WriteJsonAsync("boundary-checks/v1", boundaries, ct).ConfigureAwait(false);
            _boundaryChecks = boundaries;
            string id = Guid.NewGuid().ToString("N");
            long revision = _settings.Revision;
            if (manual) foreach (var source in sources) _manual[GameSources.Key(source)] = now;
            if (_operations.Count >= 128)
            {
                var oldest = _operations.OrderBy(pair => pair.Value.Created).First().Key;
                _operations.Remove(oldest);
            }
            _operations[id] = ("queued", now);
            _runningId = id;
            var token = CancellationTokenSource.CreateLinkedTokenSource(_lifetime.Token, _selection.Token);
            _running = Task.Run(async () => { using (token) await RefreshAsync(id, sources, revision, token.Token).ConfigureAwait(false); });
            return ActivityNormalizer.Object(new { operationId = id, joinedExisting = false });
        }
        finally { _gate.Release(); }
    }
    private bool Due(GameSource source, DateTimeOffset now)
    {
        string key = GameSources.Key(source);
        if (!_next.TryGetValue(key, out var next) || next <= now) return true;
        if (!_feeds.TryGetValue(key, out var feed)) return true;
        return BoundaryMarkers(source, now).Any(marker => !_boundaryChecks.ContainsKey(marker));
    }
    private IEnumerable<string> BoundaryMarkers(GameSource source, DateTimeOffset now)
    {
        string key = GameSources.Key(source);
        if (!_feeds.TryGetValue(key, out var feed)) yield break;
        foreach (var item in (feed["activities"]?.AsArray() ?? []).OfType<JsonObject>())
            foreach (var field in new[] { "start", "playEnd", "claimEnd" })
            {
                var boundary = ActivityPolicy.Instant(item["times"]?[field]);
                if (boundary is null || Math.Abs((boundary.Value - now).TotalMinutes) > 15) continue;
                string phase = now < boundary ? "pre" : "post", marker = key + "/" + ActivityPolicy.Text(item["eventId"]) + "/" + field + "/" + ActivityNormalizer.Utc(boundary.Value) + "/" + phase;
                yield return ActivityNormalizer.Hash(marker);
            }
        var versionEnd = ActivityPolicy.Instant(feed["version"]?["end"]);
        if (versionEnd is not null && Math.Abs((versionEnd.Value - now).TotalMinutes) <= 15)
        {
            string phase = now < versionEnd ? "pre" : "post";
            yield return ActivityNormalizer.Hash(key + "/version/" + ActivityPolicy.Text(feed["contentPeriod"]?["key"])
                + "/end/" + ActivityNormalizer.Utc(versionEnd.Value) + "/" + phase);
        }
    }
    public async Task<JsonObject> OperationAsync(string id, CancellationToken ct)
    {
        await _gate.WaitAsync(ct).ConfigureAwait(false);
        try
        {
            if (!_operations.TryGetValue(id, out var operation) || operation.Created < _clock.GetUtcNow().AddMinutes(-30))
                throw new ActivityException("operation_not_found", 404);
            return ActivityNormalizer.Object(new { operationId = id, status = operation.Status });
        }
        finally { _gate.Release(); }
    }
    private async Task RefreshAsync(string id, GameSource[] sources, long revision, CancellationToken ct)
    {
        int good = 0;
        int bad = 0;
        await SetOperation(id, "running").ConfigureAwait(false);
        var http = new ActivityHttp(context.Http);
        var sra = new SraActivityProvider(http);
        var official = new OfficialActivityProvider(http);
        var images = new ActivityAssetCache(http, context.Assets, context.ScopedData);
        try
        {
            await Task.WhenAll(sources.Select(source => Task.Run(async () =>
            {
                ct.ThrowIfCancellationRequested();
                string key = GameSources.Key(source);
                var now = _clock.GetUtcNow();
                using var budget = CancellationTokenSource.CreateLinkedTokenSource(ct);
                budget.CancelAfter(TimeSpan.FromSeconds(90));
                try
                {
                    var checkpoint = await context.ScopedData.ReadJsonAsync(Scope(source, "sra"), budget.Token).ConfigureAwait(false);
                    var response = await sra.FetchAsync(source, checkpoint, budget.Token).ConfigureAwait(false);
                    var feed = ActivityNormalizer.Normalize(source, response.Raw, now);
                    await _gate.WaitAsync(budget.Token).ConfigureAwait(false);
                    try
                    {
                        if (_stopped || revision != _settings.Revision) throw new OperationCanceledException(ct);
                        if (_feeds.TryGetValue(key, out var lastGood) && EventIdentityResolver.IsOlderVersion(feed, lastGood))
                            throw new ActivityException("source_version_rollback", 502);
                        await context.ScopedData.WriteJsonAsync(Scope(source, "sra"), ActivityNormalizer.Object(new { etag = response.ETag, lastModified = response.LastModified, raw = response.Raw }), budget.Token).ConfigureAwait(false);
                    }
                    finally { _gate.Release(); }
                    var officialCache = await context.ScopedData.ReadAsync<OfficialCache>(Scope(source, "official"), budget.Token).ConfigureAwait(false);
                    if (officialCache is not null) OfficialActivityProvider.Merge(feed, officialCache.Result, source, now);
                    await PublishAsync(source, feed, revision, budget.Token, officialCache?.Result).ConfigureAwait(false);
                    try
                    {
                        await images.CacheAsync(feed, response.Raw, budget.Token,
                            () => PublishAsync(source, feed, revision, budget.Token, officialCache?.Result)).ConfigureAwait(false);
                    }
                    catch (OperationCanceledException) when (!ct.IsCancellationRequested)
                    {
                        AddDiagnostic(feed, "image_budget_exhausted", "Text snapshot remains available.");
                    }
                    OfficialResult? supplements = officialCache?.Result;
                    Exception? officialFailure = null;
                    if (officialCache is null || officialCache.CheckedAt <= now.AddHours(-12))
                    {
                        try
                        {
                            supplements = await official.FetchAsync(source, budget.Token, supplements).ConfigureAwait(false);
                            officialCache = new(now, supplements);
                        }
                        catch (OperationCanceledException) { throw; }
                        catch (Exception error) when (error is HttpRequestException or ActivityException or JsonException)
                        {
                            supplements ??= new([], "unavailable", "Official source failed; cached fields retained when available.");
                            officialFailure = error;
                            AddDiagnostic(feed, "official_source_failed", error.GetType().Name);
                        }
                    }
                    var complete = ActivityNormalizer.Normalize(source, response.Raw, now);
                    complete["overview"]!["cover"] = feed["overview"]?["cover"]?.DeepClone();
                    foreach (var evidence in feed["overview"]!["provenance"]!.AsArray())
                        if (ActivityPolicy.Text(evidence?["field"]) == "/cover") complete["overview"]!["provenance"]!.AsArray().Add(evidence!.DeepClone());
                    foreach (var item in complete["activities"]!.AsArray().OfType<JsonObject>())
                    {
                        string incomingId = ActivityPolicy.Text(item["eventId"]);
                        var cached = feed["activities"]!.AsArray().OfType<JsonObject>().FirstOrDefault(candidate => ActivityPolicy.Text(candidate["eventId"]) == incomingId
                            || candidate["provenance"]!.AsArray().Any(evidence => ActivityPolicy.Text(evidence?["field"]) == "/eventId"
                                && ActivityPolicy.Text(evidence?["note"]) == "Incoming provider fingerprint: " + incomingId));
                        item["cover"] = cached?["cover"]?.DeepClone();
                        foreach (var evidence in cached?["provenance"]?.AsArray() ?? [])
                            if (ActivityPolicy.Text(evidence?["field"]) == "/cover") item["provenance"]!.AsArray().Add(evidence!.DeepClone());
                    }
                    foreach (var diagnostic in feed["health"]!["diagnostics"]!.AsArray())
                        if (ActivityPolicy.Text(diagnostic?["code"]).StartsWith("image_", StringComparison.Ordinal) || ActivityPolicy.Text(diagnostic?["code"]) == "official_source_failed")
                            complete["health"]!["diagnostics"]!.AsArray().Add(diagnostic!.DeepClone());
                    feed = complete;
                    if (supplements is not null) OfficialActivityProvider.Merge(feed, supplements, source, now);
                    await _gate.WaitAsync(budget.Token).ConfigureAwait(false);
                    try
                    {
                        if (_stopped || revision != _settings.Revision) throw new OperationCanceledException(ct);
                        if (_feeds.TryGetValue(key, out var previous)) PreserveOpen(feed, previous, now);
                        await ApplyWithdrawalsAsync(source, feed, supplements, budget.Token).ConfigureAwait(false);
                        var nextCheck = officialFailure is null ? now.AddHours(6) : FailureDue(key, now, officialFailure);
                        feed["health"]!["nextCheckAt"] = ActivityNormalizer.Utc(nextCheck);
                        if (officialFailure is not null) feed["health"]!["cacheState"] = "stale";
                        ActivityNormalizer.Finalize(feed, now);
                        await context.ScopedData.WriteJsonAsync(Scope(source, "sra"), ActivityNormalizer.Object(new { etag = response.ETag, lastModified = response.LastModified, raw = response.Raw }), budget.Token).ConfigureAwait(false);
                        if (officialCache is not null) await context.ScopedData.WriteAsync(Scope(source, "official"), officialCache, budget.Token).ConfigureAwait(false);
                        await context.ScopedData.WriteJsonAsync(Scope(source, "merged"), feed, budget.Token).ConfigureAwait(false);
                        _feeds[key] = feed.DeepClone().AsObject();
                        _next[key] = nextCheck;
                        if (officialFailure is null) _failures.Remove(key);
                        else Interlocked.Increment(ref bad);
                        Interlocked.Increment(ref good);
                    }
                    finally { _gate.Release(); }
                }
                catch (OperationCanceledException) when (ct.IsCancellationRequested) { throw; }
                catch (Exception error) when (error is HttpRequestException or ActivityException or JsonException or OperationCanceledException or IOException or UnauthorizedAccessException)
                {
                    await _gate.WaitAsync(CancellationToken.None).ConfigureAwait(false);
                    try
                    {
                        if (_stopped || revision != _settings.Revision) throw new OperationCanceledException(ct);
                        _next[key] = FailureDue(key, now, error);
                        if (_feeds.TryGetValue(key, out var previous))
                        {
                            var failed = previous.DeepClone().AsObject();
                            AddDiagnostic(failed, "refresh_failed", error.GetType().Name);
                            failed["health"]!["cacheState"] = "stale";
                            failed["health"]!["lastCheckedAt"] = ActivityNormalizer.Utc(now);
                            failed["health"]!["nextCheckAt"] = ActivityNormalizer.Utc(_next[key]);
                            try { await context.ScopedData.WriteJsonAsync(Scope(source, "merged"), failed, ct).ConfigureAwait(false); }
                            catch (Exception storageError) when (storageError is IOException or UnauthorizedAccessException)
                            {
                                // A failed disk cannot persist health, but the mounted last-good feed must still report the failure.
                                context.Logger.Warn("Activity failure state could not be persisted: " + storageError.GetType().Name);
                            }
                            _feeds[key] = failed;
                        }
                    }
                    finally { _gate.Release(); }
                    context.Logger.Warn($"Activity refresh failed for {key}: {error.GetType().Name}");
                    Interlocked.Increment(ref bad);
                }
            }, ct))).ConfigureAwait(false);
            await SetOperation(id, bad == 0 ? "succeeded" : good > 0 ? "partial" : "failed").ConfigureAwait(false);
        }
        catch (OperationCanceledException) { await SetOperation(id, "cancelled").ConfigureAwait(false); }
        catch (Exception error) { context.Logger.Error("Activity operation failed: " + error.GetType().Name); await SetOperation(id, "failed").ConfigureAwait(false); }
    }
    private async Task PublishAsync(GameSource source, JsonObject feed, long revision, CancellationToken ct, OfficialResult? official = null)
    {
        await _gate.WaitAsync(ct).ConfigureAwait(false);
        try
        {
            if (_stopped || revision != _settings.Revision) throw new OperationCanceledException(ct);
            string key = GameSources.Key(source);
            var now = _clock.GetUtcNow();
            if (_feeds.TryGetValue(key, out var previous)) PreserveOpen(feed, previous, now);
            await ApplyWithdrawalsAsync(source, feed, official, ct).ConfigureAwait(false);
            feed["health"]!["nextCheckAt"] = ActivityNormalizer.Utc(now.AddHours(6));
            ActivityNormalizer.Finalize(feed, now);
            await context.ScopedData.WriteJsonAsync(Scope(source, "merged"), feed, ct).ConfigureAwait(false);
            _feeds[key] = feed.DeepClone().AsObject();
            _next[key] = now.AddHours(6);
        }
        finally { _gate.Release(); }
    }
    private DateTimeOffset FailureDue(string key, DateTimeOffset now, Exception error)
    {
        int failures = _failures.GetValueOrDefault(key) + 1;
        _failures[key] = failures;
        var due = now.AddMinutes(new[] { 1, 5, 30, 120 }[Math.Min(failures - 1, 3)]).AddSeconds(Random.Shared.Next(0, 16));
        return error is ActivityException { RetryAfter: { } retry } && retry > due ? retry : due;
    }
    private async Task ApplyWithdrawalsAsync(GameSource source, JsonObject feed, OfficialResult? official, CancellationToken ct)
    {
        string key = GameSources.Key(source);
        var current = _withdrawals.GetValueOrDefault(key) ?? ActivityWithdrawals.Empty(source);
        var next = ActivityWithdrawals.Record(current, feed, official, source, _clock.GetUtcNow());
        if (!JsonNode.DeepEquals(current, next))
            await context.ScopedData.WriteJsonAsync(Scope(source, "withdrawals"), next, ct).ConfigureAwait(false);
        _withdrawals[key] = next;
        ActivityWithdrawals.Apply(feed, next);
    }
    private static void PreserveOpen(JsonObject feed, JsonObject previous, DateTimeOffset now)
    {
        EventIdentityResolver.Reconcile(feed, previous);
        ActivityFeedMerger.PreserveOfficialFields(feed, previous);
        var items = feed["activities"]!.AsArray();
        var ids = items.OfType<JsonObject>().Select(item => ActivityPolicy.Text(item["eventId"])).ToHashSet();
        foreach (var item in previous["activities"]!.AsArray().OfType<JsonObject>())
        {
            if (ids.Contains(ActivityPolicy.Text(item["eventId"]))) continue;
            var end = ActivityPolicy.Instant(item["times"]?["playEnd"]);
            if (end < now.AddDays(-30)) continue;
            var carried = item.DeepClone().AsObject();
            if (ActivityPolicy.Text(carried["periodKey"]) != ActivityPolicy.Text(feed["contentPeriod"]?["key"])) carried["versionRelation"] = "carried";
            items.Add(carried);
        }
        var sources = feed["sources"]!.AsArray();
        var sourceIds = sources.Select(s => ActivityPolicy.Text(s?["sourceId"])).ToHashSet();
        var referenced = ActivityNormalizer.ReferencedSources(feed);
        foreach (var source in previous["sources"]!.AsArray())
            if (referenced.Contains(ActivityPolicy.Text(source?["sourceId"])) && sourceIds.Add(ActivityPolicy.Text(source?["sourceId"]))) sources.Add(source!.DeepClone());
        if (items.Count > 250) throw new ActivityException("feed_too_large", 502);
    }
    private static void AddDiagnostic(JsonObject feed, string code, string message)
    {
        var list = feed["health"]!["diagnostics"]!.AsArray();
        if (list.Count >= 32) list.RemoveAt(0);
        list.Add(ActivityNormalizer.Object(new { code, sourceRef = (string?)null, message }));
    }
    private async Task SetOperation(string id, string status)
    {
        await _gate.WaitAsync().ConfigureAwait(false);
        try { if (_operations.TryGetValue(id, out var old)) _operations[id] = (status, old.Created); } finally { _gate.Release(); }
    }
    public Task StopAsync(CancellationToken ct)
    {
        lock (_stopLock) return (_stopTask ??= StopCoreAsync()).WaitAsync(ct);
    }
    private async Task StopCoreAsync()
    {
        // A pending atomic store write holds the gate and must receive cancellation before shutdown waits for it.
        _lifetime.Cancel();
        await _gate.WaitAsync().ConfigureAwait(false);
        Task? running;
        try
        {
            _stopped = true;
            _selection.Cancel();
            running = _running;
        }
        finally { _gate.Release(); }
        if (running is not null) await running.ConfigureAwait(false);
        _selection.Dispose();
        _lifetime.Dispose();
    }
    private sealed record OfficialCache(DateTimeOffset CheckedAt, OfficialResult Result);
}
