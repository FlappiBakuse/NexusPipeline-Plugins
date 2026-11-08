using System.Security.Cryptography;
using System.Text.Json.Serialization;
using NexusPipeline.Extensibility.State;

namespace NexusPipeline.Extensions.GameActivities;

internal sealed class SdkActivityImages(IExtensionDocuments documents, IExtensionImages images) : IActivityImages
{
    private const string Name = "cover-cache";

    public async ValueTask<ActivityImage?> ReadAsync(string coverId, CancellationToken cancellationToken)
    {
        var (cache, _) = await LoadAsync(cancellationToken);
        var entry = cache.Entries.SingleOrDefault(item => item.CoverId == coverId);
        if (entry is null) return null;
        var image = await images.ReadAsync(entry.ImageId, cancellationToken);
        if (image.Info.SizeBytes != entry.SizeBytes) throw new ActivityFailure("activity_cover_cache_unbound");
        return new(image.Info.ContentType, image.Content);
    }

    public async ValueTask SaveAsync(string coverId, ActivityImage image, IReadOnlySet<string> currentIds, CancellationToken cancellationToken)
    {
        var (cache, revision) = await LoadAsync(cancellationToken);
        var imageId = Convert.ToHexStringLower(SHA256.HashData(image.Bytes.Span));
        var entries = cache.Entries.Where(item => item.CoverId != coverId && currentIds.Contains(item.CoverId)).ToList();
        entries.Add(new(coverId, imageId, image.Bytes.Length));
        while (entries.Count > 32 || entries.DistinctBy(item => item.ImageId).Sum(item => (long)item.SizeBytes) > 33554432)
            entries.RemoveAt(0);
        await images.WriteAsync(Guid.NewGuid(), Name, revision, ActivityJson.Bytes(new CoverCache { Entries = entries.ToArray() }),
            entries.Select(item => item.ImageId).Distinct(StringComparer.Ordinal).ToArray(), new(image.ContentType, image.Bytes), cancellationToken);
    }

    private async ValueTask<(CoverCache Cache, long Revision)> LoadAsync(CancellationToken cancellationToken)
    {
        var saved = await documents.ReadAsync(Name, cancellationToken);
        var cache = saved is null ? new CoverCache() : ActivityJson.Read<CoverCache>(saved.Json);
        if (cache.FormatVersion != 1 || cache.Entries.Length > 32 ||
            cache.Entries.Select(item => item.CoverId).Distinct(StringComparer.Ordinal).Count() != cache.Entries.Length ||
            cache.Entries.Any(item => !Identity(item.CoverId) || !Identity(item.ImageId) || item.SizeBytes is < 1 or > 8388608) ||
            cache.Entries.DistinctBy(item => item.ImageId).Sum(item => (long)item.SizeBytes) > 33554432)
            throw new ActivityFailure("activity_cover_cache_unsupported");
        var inventory = await images.ListAsync(Name, cancellationToken);
        if (inventory.Count != cache.Entries.Select(item => item.ImageId).Distinct(StringComparer.Ordinal).Count() ||
            cache.Entries.Any(item => !inventory.Any(asset => asset.Id == item.ImageId && asset.SizeBytes == item.SizeBytes)))
            throw new ActivityFailure("activity_cover_cache_unbound");
        return (cache, saved?.Revision ?? 0);
    }

    private static bool Identity(string value) => value.Length == 64 && value.All(character => character is >= '0' and <= '9' or >= 'a' and <= 'f');
    private sealed record CoverEntry(string CoverId, string ImageId, int SizeBytes);
    private sealed record CoverCache
    {
        [JsonRequired] public int FormatVersion { get; init; } = 1;
        public CoverEntry[] Entries { get; init; } = [];
    }
}
