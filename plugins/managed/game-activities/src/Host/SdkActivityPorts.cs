using NexusPipeline.Extensibility.State;
using NexusPipeline.Extensibility.Networking;

namespace NexusPipeline.Extensions.GameActivities;

internal sealed class SdkActivityDocuments(IExtensionDocuments documents) : IActivityDocuments
{
    public async ValueTask<ActivityDocument?> ReadAsync(string name, CancellationToken cancellationToken)
    {
        var value = await documents.ReadAsync(name, cancellationToken);
        return value is null ? null : new(value.Revision, value.Json);
    }
    public async ValueTask<ActivityDocumentCommit> WriteAsync(Guid operationId, string name, long expectedRevision,
        ReadOnlyMemory<byte> json, CancellationToken cancellationToken)
    {
        var result = await documents.WriteAsync(operationId, name, expectedRevision, json, cancellationToken);
        return new(result.Revision, result.IsNew);
    }
}

internal sealed class SdkActivityNetwork(IExtensionHttp http) : IActivityNetwork
{
    private readonly SemaphoreSlim requests = new(4, 4);
    public async ValueTask<ActivityResponse> GetAsync(Uri uri, int maximumBytes, CancellationToken cancellationToken)
    {
        using var budget = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        budget.CancelAfter(TimeSpan.FromSeconds(15));
        await requests.WaitAsync(budget.Token);
        try
        {
            var result = await http.SendAsync(new(uri, "GET", new Dictionary<string, string>(), ReadOnlyMemory<byte>.Empty, null, maximumBytes), budget.Token);
            return new(result.StatusCode, result.Headers, result.Content);
        }
        finally { requests.Release(); }
    }
}
