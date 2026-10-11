using NexusPipeline.Plugin.Abstractions;
using System.Security.Cryptography;
using System.Text.Json.Nodes;

namespace NexusPipeline.Plugin.GameActivities;

internal sealed class ActivityAssetCache(ActivityHttp http, IPluginAssetStore assets, IPluginScopedDataStore data)
{
    public const string Scope = "activity-v3";
    private const string ManifestScope = "sra/v3/asset-manifest";
    private readonly SemaphoreSlim _writes = new(1, 1);
    private readonly HashSet<string> _protected = new(StringComparer.Ordinal);
    private readonly Dictionary<string, Task<string?>> _requests = new();
    private JsonObject? _manifest;
    public async Task CacheAsync(JsonObject feed, GameSource source, bool force, CancellationToken ct,
        Func<string, string, string, Task> published, Action<string> failed)
    {
        var targets = feed["activities"]!.AsArray().OfType<JsonObject>().Append(feed["overview"]!.AsObject())
            .Where(i => SraImages.Allowed(ActivityPolicy.Text(i["cover"]?["sourceUrl"]))).ToArray();
        await Task.WhenAll(targets.Select(async target =>
        {
            string url = ActivityPolicy.Text(target["cover"]?["sourceUrl"]);
            try
            {
                Task<string?> task;
                await _writes.WaitAsync(ct).ConfigureAwait(false);
                try
                {
                    await Initialize(ct).ConfigureAwait(false);
                    string requestKey = (force ? "forced:" : "automatic:") + url;
                    if (!_requests.TryGetValue(requestKey, out task!)) _requests[requestKey] = task = Download(url, force, ct);
                }
                finally { _writes.Release(); }
                string? id = await task.ConfigureAwait(false);
                if (id is null) { failed(url); return; }
                string entityId = ActivityPolicy.Text(target["eventId"] ?? target["overviewId"]);
                await published(entityId, url, id).ConfigureAwait(false);
            }
            catch (OperationCanceledException) when (!ct.IsCancellationRequested) { failed(url); }
            catch (OperationCanceledException) { throw; }
            catch (Exception error) when (error is HttpRequestException or ActivityException or IOException or UnauthorizedAccessException)
            { failed(url); }
        })).ConfigureAwait(false);
    }
    private async Task Initialize(CancellationToken ct)
    {
        if (_manifest is not null) return;
        var value = await data.ReadJsonAsync(ManifestScope, ct).ConfigureAwait(false) ?? new JsonObject { ["formatVersion"] = 3, ["entries"] = new JsonObject() };
        if (value["formatVersion"]?.GetValue<int>() != 3 || value["entries"] is not JsonObject) throw new ActivityException("asset_manifest_invalid", 500);
        var protectedIds = new HashSet<string>(StringComparer.Ordinal);
        foreach (var source in GameSources.All)
        {
            var cached = await data.ReadJsonAsync(ActivityCoordinator.Scope(source, "merged"), ct).ConfigureAwait(false);
            foreach (var cover in (cached?["activities"]?.AsArray() ?? []).Select(i => i?["cover"]).Append(cached?["overview"]?["cover"]))
            { string id = ActivityPolicy.Text(cover?["assetId"]); if (id.Length > 0) protectedIds.Add(id); }
        }
        _protected.UnionWith(protectedIds); _manifest = value;
    }
    private async Task<string?> Download(string url, bool force, CancellationToken ct)
    {
        // Yield before acquiring the manifest gate held by the caller that registers this shared request.
        await Task.Yield();
        string key = ActivityNormalizer.Hash(url); JsonObject? old; string? existing;
        await _writes.WaitAsync(ct).ConfigureAwait(false);
        try
        {
            old = _manifest!["entries"]![key]?.DeepClone().AsObject();
            string id = ActivityPolicy.Text(old?["assetId"]);
            existing = id.Length > 0 && (await assets.ListAsync(Scope, ct).ConfigureAwait(false)).Any(a => a.Id == id) ? id : null;
        }
        finally { _writes.Release(); }
        var now = DateTimeOffset.UtcNow;
        bool due = force || old is null || !DateTimeOffset.TryParse(ActivityPolicy.Text(old["validatedAt"]), out var validated) || validated <= now.AddHours(-6);
        if (existing is not null && !due)
        {
            await _writes.WaitAsync(ct).ConfigureAwait(false);
            try
            {
                var next = _manifest!.DeepClone().AsObject();
                next["entries"]![key]!["lastReferencedAt"] = ActivityNormalizer.Utc(now);
                await data.WriteJsonAsync(ManifestScope, next, ct).ConfigureAwait(false); _manifest = next; _protected.Add(existing);
            }
            finally { _writes.Release(); }
            return existing;
        }
        string etag = ActivityPolicy.Text(old?["etag"]);
        bool strong = etag.StartsWith('"') && !etag.StartsWith("W/", StringComparison.OrdinalIgnoreCase);
        var response = await http.ReadAsync(new Uri(url), existing is not null && strong ? etag : null, 8388608, ct).ConfigureAwait(false);
        if (response.NotModified && existing is null) throw new ActivityException("asset_checkpoint_missing", 502);
        string hash = response.NotModified ? ActivityPolicy.Text(old?["contentHash"]) : Convert.ToHexStringLower(SHA256.HashData(response.Bytes));
        string? extension = response.NotModified ? null : Extension(response.Bytes, response.Mime);
        if (!response.NotModified && extension is null) throw new ActivityException("image_type_invalid", 502);
        await _writes.WaitAsync(ct).ConfigureAwait(false);
        try
        {
            string? id = existing;
            if (id is null || !response.NotModified && hash != ActivityPolicy.Text(old?["contentHash"]))
            {
                var list = await assets.ListAsync(Scope, ct).ConfigureAwait(false); long total = list.Sum(a => a.SizeBytes);
                var entries = _manifest!["entries"]!.AsObject();
                var referenced = entries.Select(p => p.Value).OfType<JsonObject>().GroupBy(e => ActivityPolicy.Text(e["assetId"]))
                    .ToDictionary(g => g.Key, g => g.Max(e => ActivityPolicy.Text(e["lastReferencedAt"]))!);
                foreach (var asset in list.OrderBy(a => referenced.GetValueOrDefault(a.Id, ActivityNormalizer.Utc(a.CreatedAt)), StringComparer.Ordinal))
                {
                    if (total + response.Bytes.Length <= 134217728) break;
                    if (_protected.Contains(asset.Id) || !await assets.DeleteAsync(Scope, asset.Id, ct).ConfigureAwait(false)) continue;
                    total -= asset.SizeBytes;
                    foreach (string entry in entries.Where(p => ActivityPolicy.Text(p.Value?["assetId"]) == asset.Id).Select(p => p.Key).ToArray()) entries.Remove(entry);
                }
                if (total + response.Bytes.Length > 134217728) return null;
                using var content = new MemoryStream(response.Bytes, false);
                id = (await assets.WriteAsync(Scope, extension!, content, ct).ConfigureAwait(false)).Id;
            }
            _protected.Add(id);
            var next = _manifest!.DeepClone().AsObject();
            next["entries"]![key] = ActivityNormalizer.Object(new { assetId = id, url, contentHash = hash, etag = response.ETag,
                lastModified = response.LastModified, validatedAt = ActivityNormalizer.Utc(now), lastReferencedAt = ActivityNormalizer.Utc(now) });
            await data.WriteJsonAsync(ManifestScope, next, ct).ConfigureAwait(false); _manifest = next;
            return id;
        }
        finally { _writes.Release(); }
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
