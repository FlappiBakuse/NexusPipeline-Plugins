namespace NexusPipeline.Extensions.GameCheckIn;

internal sealed class CheckInClients(CancellationToken scopeLifetime) : IDisposable
{
    private sealed record Entry(CancellationToken HostLifetime, CancellationTokenSource Combined);
    private readonly Guid scopeId = Guid.NewGuid();
    private readonly Dictionary<Guid, Entry> clients = [];
    private bool disposed;
    internal CheckInClient Get(Guid? id, CancellationToken hostLifetime)
    {
        if (id is null || id == Guid.Empty || !hostLifetime.CanBeCanceled) throw new CheckInFailure("client_session_required");
        hostLifetime.ThrowIfCancellationRequested(); scopeLifetime.ThrowIfCancellationRequested();
        lock (clients)
        {
            ObjectDisposedException.ThrowIf(disposed, this);
            foreach (var old in clients.Where(pair => pair.Value.Combined.IsCancellationRequested).Select(pair => pair.Key).ToArray())
            { clients[old].Combined.Dispose(); clients.Remove(old); }
            if (!clients.TryGetValue(id.Value, out var entry))
            {
                if (clients.Count >= 256) throw new CheckInFailure("client_session_limit");
                entry = new(hostLifetime, CancellationTokenSource.CreateLinkedTokenSource(hostLifetime, scopeLifetime)); clients.Add(id.Value, entry);
            }
            if (entry.HostLifetime != hostLifetime) throw new CheckInFailure("client_session_required");
            return new(scopeId, id.Value, entry.Combined.Token);
        }
    }
    public void Dispose()
    {
        lock (clients)
        { if (disposed) return; disposed = true; foreach (var entry in clients.Values) CheckInCancellation.Stop(entry.Combined); clients.Clear(); }
    }
}
