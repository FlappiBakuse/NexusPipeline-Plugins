using System.Text;
using NexusPipeline.Extensions.GameCheckIn;

internal sealed class RunnerPersistence(CheckInTask task) : ICheckInPersistence, IDisposable
{
    internal readonly Dictionary<string, CredentialMaterial> Materials = [];
    internal CheckInRun? Saved;
    internal int Writes, RejectWrite;
    internal long RunRevision;
    internal readonly List<Guid> Operations = [];
    public ValueTask<CheckInTaskSnapshot> ReadTasksAsync(CancellationToken cancellationToken) => ValueTask.FromResult(new CheckInTaskSnapshot(1, new() { Tasks = [task] }));
    public ValueTask<CheckInCredentialRead> ReadCredentialAsync(Guid taskId, string platform, CancellationToken cancellationToken)
        => ValueTask.FromResult(new CheckInCredentialRead(7, Materials.ContainsKey(platform), Materials.GetValueOrDefault(platform)?.Copy()));
    public ValueTask<CheckInRecentRunSnapshot> ReadRunAsync(Guid taskId, CancellationToken cancellationToken) => ValueTask.FromResult(new CheckInRecentRunSnapshot(RunRevision, Saved));
    public ValueTask<long> WriteRunAsync(Guid operationId, Guid taskId, long expectedRevision, CheckInRun run, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested(); Writes++;
        if (Writes == RejectWrite) throw new CheckInFailure("checkin_run_publication_unknown");
        if (expectedRevision != RunRevision) throw new InvalidOperationException("synthetic_run_revision_conflict");
        _ = new CheckInRunDocument { Run = run }.Validate(); Operations.Add(operationId); Saved = run with { Results = run.Results.ToArray() };
        return ValueTask.FromResult(++RunRevision);
    }
    public ValueTask<CheckInPublication> PublishAsync(Guid operationId, long expectedDocumentRevision, CheckInTaskStore proposed, Guid? secretSubjectId,
        IReadOnlyList<CredentialMutation> changes, CancellationToken cancellationToken) => throw new NotSupportedException();
    public ValueTask<CheckInPublication?> ReadPublicationAsync(Guid operationId, CancellationToken cancellationToken) => throw new NotSupportedException();
    public void Dispose() { foreach (var material in Materials.Values) material.Dispose(); }
}
internal sealed class RunnerExecutionPorts : ICheckInExecutionPorts
{
    internal int Claims, WriterQueries;
    internal bool WriterStopped = true;
    internal string GameState = "new";
    internal TestEffects? Current;
    internal readonly List<long> SecretRevisions = [];
    public ICheckInEffects Effects(Guid taskId, string platform, long expectedSecretRevision)
    { Claims++; SecretRevisions.Add(expectedSecretRevision); return Current = new TestEffects { GameState = GameState }; }
    public ICheckInCredentialRotation Rotation(Guid taskId, long expectedTaskRevision, long expectedSecretRevision) => new TestRotation();
    public ValueTask<bool> IsStoppedAsync(Guid taskId, Guid runId, Guid attemptId, CancellationToken cancellationToken)
    { WriterQueries++; return ValueTask.FromResult(WriterStopped); }
}
internal sealed class RunnerNetwork(RunnerExecutionPorts ports) : ICheckInNetwork
{
    internal readonly List<ObservedRequest> Requests = [];
    internal CancellationTokenSource? CancelOnSign;
    public ValueTask<CheckInResponse> SendAsync(CheckInRequest request, CancellationToken cancellationToken)
    {
        if (ports.Current is not { Began: true } effects) throw new InvalidOperationException("missing_synthetic_host_game_claim");
        var body = Encoding.UTF8.GetString(request.Content); Requests.Add(new(request.Address.AbsoluteUri, request.Method, new(request.Headers), body));
        if (request.Address.Host == "api-takumi.mihoyo.com")
            return ValueTask.FromResult(new CheckInResponse(200, "application/json", "{\"retcode\":0,\"data\":{\"list\":[]}}"u8.ToArray()));
        if (request.Address.AbsolutePath == "/encourage/signIn/v2")
        {
            if (effects.Submitted.Count == 0) throw new InvalidOperationException("missing_synthetic_host_submitted_fact");
            if (CancelOnSign is not null) { CancelOnSign.Cancel(); cancellationToken.ThrowIfCancellationRequested(); }
            return ValueTask.FromResult(new CheckInResponse(200, "application/json", "{\"code\":200}"u8.ToArray()));
        }
        var game = body.Contains("gameId=3", StringComparison.Ordinal) ? "3" : "2";
        return ValueTask.FromResult(new CheckInResponse(200, "application/json", Encoding.UTF8.GetBytes("{\"code\":200,\"data\":[{\"gameId\":\"" + game +
            "\",\"roleId\":\"789123\",\"serverId\":\"1\",\"userId\":\"123456\"}]}")));
    }
}
