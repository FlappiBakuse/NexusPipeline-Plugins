namespace NexusPipeline.Extensions.GameActivities;

internal sealed record ActivityDocument(long Revision, ReadOnlyMemory<byte> Json);
internal sealed record ActivityDocumentCommit(long Revision, bool IsNew);
internal interface IActivityDocuments
{
    ValueTask<ActivityDocument?> ReadAsync(string name, CancellationToken cancellationToken);
    ValueTask<ActivityDocumentCommit> WriteAsync(Guid operationId, string name, long expectedRevision, ReadOnlyMemory<byte> json,
        CancellationToken cancellationToken);
}

internal sealed record ActivityResponse(int StatusCode, IReadOnlyDictionary<string, string[]> Headers, ReadOnlyMemory<byte> Content);
internal interface IActivityNetwork
{
    ValueTask<ActivityResponse> GetAsync(Uri uri, int maximumBytes, CancellationToken cancellationToken);
}

internal sealed record ActivityManualRequest(Guid OperationId, DateTimeOffset AcceptedAt, string[] FeedIds);
internal sealed record ActivityRefreshControl
{
    [System.Text.Json.Serialization.JsonRequired] public int FormatVersion { get; init; } = 1;
    public ActivityManualRequest[] Requests { get; init; } = [];
}

internal sealed class ActivityRefreshOperation(Guid id, long generation)
{
    internal Guid Id { get; } = id;
    internal long Generation { get; } = generation;
    internal string Status { get; set; } = "queued";
    internal int Checked { get; set; }
    internal int Changed { get; set; }
    internal int Failed { get; set; }
    internal DateTimeOffset CreatedAt { get; init; }
    internal Task? Worker { get; set; }
    internal Queue<ActivitySource> Pending { get; } = new();
    internal HashSet<string> FeedIds { get; } = new(StringComparer.Ordinal);
    internal bool Accepting { get; set; } = true;
}

internal sealed class ActivityCachedSource(ActivitySource source)
{
    internal ActivitySource Source { get; } = source;
    internal long Revision { get; set; }
    internal ActivityCache Cache { get; set; } = new() { FeedId = source.Id };
    internal bool Unsupported { get; set; }
}

internal sealed record ActivityImage(string ContentType, ReadOnlyMemory<byte> Bytes);
internal sealed record ActivityImageEntry(ActivityImage? Image, DateTimeOffset Expires);
