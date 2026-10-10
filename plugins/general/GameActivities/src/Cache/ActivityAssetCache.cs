using NexusPipeline.Plugin.Abstractions;
using System.Text.Json.Nodes;

namespace NexusPipeline.Plugin.GameActivities;

internal sealed class ActivityAssetCache(ActivityHttp http, IPluginAssetStore assets, IPluginScopedDataStore data)
{
    public const string Scope = "activity";
    private static readonly HashSet<string> Hosts = ["i0.hdslb.com", "prod-alicdn-community.kurobbs.com", "resource.starrailassistant.top", "web.hycdn.cn", "webusstatic.yo-star.com"];
    private readonly SemaphoreSlim _writes = new(1, 1);
    private readonly HashSet<string> _protectedIds = new(StringComparer.Ordinal);
    private JsonObject? _manifest;

    public static void RestoreOverview(JsonObject feed, JsonObject raw, JsonObject manifest)
    {
        string url = ActivityPolicy.Text(raw["cover"]);
        if (!Allowed(url)) return;
        string id = ActivityPolicy.Text(manifest[ActivityNormalizer.Hash(url)]?["id"]);
        AttachCover(feed["overview"]!.AsObject(), url, id.Length == 0 ? null : id, ActivityPolicy.Text(feed["sources"]?[0]?["sourceId"]), "/cover");
    }

    public async Task CacheAsync(JsonObject feed, JsonObject raw, CancellationToken ct, Func<Task>? published = null)
    {
        await CacheCoverAsync(feed["overview"]!.AsObject(), ActivityPolicy.Text(raw["cover"]), "/cover", feed, ct, published).ConfigureAwait(false);
        foreach (var item in feed["activities"]!.AsArray().OfType<JsonObject>())
        {
            var original = raw["activities"]!.AsArray().OfType<JsonObject>().FirstOrDefault(row => ActivityPolicy.Text(row["name"]) == ActivityPolicy.Text(item["title"]));
            if (original is null) continue;
            await CacheCoverAsync(item, ActivityPolicy.Text(original["cover"]), "/activities/cover", feed, ct, published).ConfigureAwait(false);
        }
    }

    private static bool Allowed(string url) => url.Length <= 2048 && Uri.TryCreate(url, UriKind.Absolute, out var uri)
        && uri.Scheme == "https" && Hosts.Contains(uri.Host) && uri.UserInfo.Length == 0;

    private static void AttachCover(JsonObject target, string url, string? id, string sourceRef, string locator)
    {
        target["cover"] = ActivityNormalizer.Object(new { sourceUrl = url, assetId = id, alt = ActivityPolicy.Text(target["title"]), sourceRef });
        var evidence = target["provenance"]!.AsArray();
        foreach (var old in evidence.Where(row => ActivityPolicy.Text(row?["field"]) == "/cover").ToArray()) evidence.Remove(old);
        evidence.Add(ActivityNormalizer.Evidence("/cover", sourceRef, locator));
    }

    private async Task InitializeManifestAsync(CancellationToken ct)
    {
        if (_manifest is not null) return;
        _manifest = await data.ReadJsonAsync("asset-manifest", ct).ConfigureAwait(false) ?? new JsonObject();
        foreach (var source in GameSources.All)
        {
            var cached = await data.ReadJsonAsync("feed/" + source.GameId + "/" + source.ProgressionId + "/" + source.Locale + "/merged/v1", ct).ConfigureAwait(false);
            var covers = (cached?["activities"]?.AsArray() ?? []).Select(item => item?["cover"])
                .Append(cached?["overview"]?["cover"]);
            foreach (var cover in covers)
            {
                string id = ActivityPolicy.Text(cover?["assetId"]);
                if (id.Length > 0) _protectedIds.Add(id);
            }
        }
    }

    private async Task<string?> ExistingIdAsync(string key, CancellationToken ct)
    {
        string id = ActivityPolicy.Text(_manifest![key]?["id"]);
        return id.Length > 0 && (await assets.ListAsync(Scope, ct).ConfigureAwait(false)).Any(asset => asset.Id == id) ? id : null;
    }

    private async Task CacheCoverAsync(JsonObject target, string url, string locator, JsonObject feed, CancellationToken ct, Func<Task>? published)
    {
        if (!Allowed(url)) return;
        string key = ActivityNormalizer.Hash(url);
        try
        {
            string? id;
            await _writes.WaitAsync(ct).ConfigureAwait(false);
            try
            {
                await InitializeManifestAsync(ct).ConfigureAwait(false);
                id = await ExistingIdAsync(key, ct).ConfigureAwait(false);
            }
            finally { _writes.Release(); }
            if (id is null)
            {
                var response = await http.ReadAsync(new Uri(url), null, 8388608, ct).ConfigureAwait(false);
                string? extension = Extension(response.Bytes, response.Mime);
                if (extension is null) return;
                await _writes.WaitAsync(ct).ConfigureAwait(false);
                try
                {
                    id = await ExistingIdAsync(key, ct).ConfigureAwait(false);
                    if (id is null)
                    {
                        var list = await assets.ListAsync(Scope, ct).ConfigureAwait(false);
                        long total = list.Sum(asset => asset.SizeBytes);
                        var referencedAt = _manifest!.Select(pair => pair.Value).OfType<JsonObject>()
                            .GroupBy(entry => ActivityPolicy.Text(entry["id"]), StringComparer.Ordinal)
                            .ToDictionary(group => group.Key, group => group.Max(entry => ActivityPolicy.Text(entry["lastReferencedAt"]))!, StringComparer.Ordinal);
                        // A cancelled manifest write can leave an owned asset without a manifest entry.
                        foreach (var candidate in list.OrderBy(asset => referencedAt.GetValueOrDefault(asset.Id, ActivityNormalizer.Utc(asset.CreatedAt)), StringComparer.Ordinal))
                        {
                            if (total + response.Bytes.Length <= 134217728) break;
                            string oldId = candidate.Id;
                            if (_protectedIds.Contains(oldId)) continue;
                            if (!await assets.DeleteAsync(Scope, oldId, ct).ConfigureAwait(false)) continue;
                            total -= candidate.SizeBytes;
                            foreach (var entry in _manifest!.Where(pair => ActivityPolicy.Text(pair.Value?["id"]) == oldId).Select(pair => pair.Key).ToArray()) _manifest!.Remove(entry);
                        }
                        if (total + response.Bytes.Length > 134217728) return;
                        using var content = new MemoryStream(response.Bytes, false);
                        id = (await assets.WriteAsync(Scope, extension, content, ct).ConfigureAwait(false)).Id;
                    }
                    _protectedIds.Add(id);
                    _manifest![key] = ActivityNormalizer.Object(new { id, url, lastReferencedAt = ActivityNormalizer.Utc(DateTimeOffset.UtcNow) });
                    await data.WriteJsonAsync("asset-manifest", _manifest, ct).ConfigureAwait(false);
                }
                finally { _writes.Release(); }
            }
            else
            {
                await _writes.WaitAsync(ct).ConfigureAwait(false);
                try
                {
                    _protectedIds.Add(id);
                    _manifest![key]!["lastReferencedAt"] = ActivityNormalizer.Utc(DateTimeOffset.UtcNow);
                    await data.WriteJsonAsync("asset-manifest", _manifest, ct).ConfigureAwait(false);
                }
                finally { _writes.Release(); }
            }
            AttachCover(target, url, id, ActivityPolicy.Text(feed["sources"]?[0]?["sourceId"]), locator);
            if (published is not null) await published().ConfigureAwait(false);
        }
        catch (OperationCanceledException) { throw; }
        catch (Exception error) when (error is HttpRequestException or ActivityException)
        {
            var diagnostics = feed["health"]!["diagnostics"]!.AsArray();
            if (diagnostics.Count < 32) diagnostics.Add(ActivityNormalizer.Object(new
            {
                code = "image_source_failed",
                sourceRef = ActivityPolicy.Text(feed["sources"]?[0]?["sourceId"]),
                message = error.GetType().Name
            }));
        }
    }

    public static string? Extension(byte[] bytes, string mime)
    {
        if (mime == "image/png" && bytes.Length >= 8 && bytes.AsSpan(0, 8).SequenceEqual(new byte[] { 137, 80, 78, 71, 13, 10, 26, 10 })) return "png";
        if (mime == "image/jpeg" && bytes.Length >= 3 && bytes[0] == 255 && bytes[1] == 216 && bytes[2] == 255) return "jpg";
        if (mime == "image/gif" && bytes.Length >= 6 && System.Text.Encoding.ASCII.GetString(bytes, 0, 6) is "GIF87a" or "GIF89a") return "gif";
        if (mime == "image/webp" && bytes.Length >= 12 && System.Text.Encoding.ASCII.GetString(bytes, 0, 4) == "RIFF" && System.Text.Encoding.ASCII.GetString(bytes, 8, 4) == "WEBP") return "webp";
        if (mime == "image/avif" && bytes.Length >= 16 && System.Text.Encoding.ASCII.GetString(bytes, 4, 4) == "ftyp" && System.Text.Encoding.ASCII.GetString(bytes, 8, 4) is "avif" or "avis") return "avif";
        return null;
    }
}
