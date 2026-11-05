using System.Text;
using System.Text.Json;
using NexusPipeline.Extensions.GameActivities;
using NexusPipeline.Extensibility.State;
using NexusPipeline.Extensibility.Networking;

internal sealed class TestClock : TimeProvider
{
    internal DateTimeOffset Now = DateTimeOffset.Parse("2026-10-25T12:00:00Z");
    public override DateTimeOffset GetUtcNow() => Now;
    internal void Advance(TimeSpan value) => Now += value;
}

internal sealed class TestDocuments : IActivityDocuments, IExtensionDocuments
{
    internal readonly Dictionary<string, ActivityDocument> Values = [];
    private readonly Dictionary<Guid, (string Name, long Expected, byte[] Json, ActivityDocumentCommit Commit)> commits = [];
    internal int Writes;
    internal bool LoseReply;
    internal Action<string>? BeforeRead;
    internal Action<string>? BeforeWrite;
    public ValueTask<ActivityDocument?> ReadAsync(string name, CancellationToken cancellationToken)
    { cancellationToken.ThrowIfCancellationRequested(); BeforeRead?.Invoke(name); lock (Values) return ValueTask.FromResult(Values.GetValueOrDefault(name)); }
    public ValueTask<ActivityDocumentCommit> WriteAsync(Guid id, string name, long expected, ReadOnlyMemory<byte> json, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        BeforeWrite?.Invoke(name);
        lock (Values)
        {
            if (commits.TryGetValue(id, out var replay))
            {
                if (replay.Name != name || replay.Expected != expected || !replay.Json.AsSpan().SequenceEqual(json.Span)) throw new InvalidOperationException("operation_mismatch");
                return ValueTask.FromResult(replay.Commit with { IsNew = false });
            }
            var revision = Values.GetValueOrDefault(name)?.Revision ?? 0;
            if (revision != expected) throw new InvalidOperationException("revision_conflict");
            if (json.Length > 1048576) throw new InvalidOperationException("document_too_large");
            var commit = new ActivityDocumentCommit(revision + 1, true);
            Values[name] = new(commit.Revision, json.ToArray()); commits[id] = (name, expected, json.ToArray(), commit); Writes++;
            if (LoseReply) { LoseReply = false; throw new IOException("lost_reply"); }
            return ValueTask.FromResult(commit);
        }
    }
    async ValueTask<ExtensionDocument?> IExtensionDocuments.ReadAsync(string name, CancellationToken cancellationToken)
    { var value = await ReadAsync(name, cancellationToken); return value is null ? null : new(value.Revision, ActivityTimes.Hash(Encoding.UTF8.GetString(value.Json.Span)), value.Json); }
    async ValueTask<DocumentCommit> IExtensionDocuments.WriteAsync(Guid operationId, string name, long expectedRevision, ReadOnlyMemory<byte> json, CancellationToken cancellationToken)
    { var result = await WriteAsync(operationId, name, expectedRevision, json, cancellationToken); return new(operationId, result.Revision, ActivityTimes.Hash(Encoding.UTF8.GetString(json.Span)), result.IsNew); }
    ValueTask<DocumentCommit?> IExtensionDocuments.ReadCommitAsync(Guid operationId, CancellationToken cancellationToken)
    {
        lock (Values) return ValueTask.FromResult(commits.TryGetValue(operationId, out var value) ?
            new DocumentCommit(operationId, value.Commit.Revision, ActivityTimes.Hash(Encoding.UTF8.GetString(value.Json)), false) : null);
    }
}

internal sealed class TestNetwork : IActivityNetwork, IExtensionHttp
{
    internal Func<Uri, CancellationToken, Task<ActivityResponse>> Handler = (_, _) => Task.FromResult(Feed());
    internal readonly List<Uri> Calls = [];
    internal int MaximumBytes;
    public async ValueTask<ActivityResponse> GetAsync(Uri uri, int maximumBytes, CancellationToken cancellationToken)
    {
        lock (Calls) Calls.Add(uri); MaximumBytes = maximumBytes;
        return await Handler(uri, cancellationToken);
    }
    async ValueTask<ExtensionHttpResponse> IExtensionHttp.SendAsync(ExtensionHttpRequest request, CancellationToken cancellationToken)
    {
        Check.That(request.Method == "GET" && request.Content.Length == 0 && request.Headers.Count == 0);
        var value = await GetAsync(request.Address, request.MaximumResponseBytes, cancellationToken);
        return new(value.StatusCode, value.Headers, value.Content);
    }
    internal static ActivityResponse Feed(string version = "1", string activities = "[]", string cover = "") =>
        new(200, new Dictionary<string, string[]>(), Encoding.UTF8.GetBytes("{\"version\":\"" + version + "\",\"cover\":\"" + cover + "\",\"activities\":" + activities + "}"));
    internal static ActivityResponse Image(byte[] bytes, string mime = "image/png") => new(200, new Dictionary<string, string[]> { ["Content-Type"] = [mime] }, bytes);
}

internal static class TestActivity
{
    internal static ActivitySettings Select(params string[] games) => new ActivitySettings { SelectedGames = games };
    internal static async Task<JsonElement> State(ActivityCoordinator service) => Check.Element(await service.StateAsync(default));
    internal static async Task Idle(ActivityCoordinator service)
    {
        for (var attempt = 0; attempt < 200; attempt++)
        { if (!(await State(service)).GetProperty("refreshing").GetBoolean()) return; await Task.Delay(5); }
        throw new TimeoutException("refresh_did_not_finish");
    }
    internal static ActivityCache Cache(TestDocuments docs, string file = "ba-cn") => ActivityJson.Read<ActivityCache>(docs.Values["feed-" + file].Json);
}
