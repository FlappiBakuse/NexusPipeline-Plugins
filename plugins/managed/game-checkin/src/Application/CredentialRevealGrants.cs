namespace NexusPipeline.Extensions.GameCheckIn;

internal sealed class CredentialRevealGrants(TimeProvider clock) : IDisposable
{
    private sealed class Grant(long start)
    {
        internal long Start = start;
        internal CancellationTokenRegistration Cancellation;
    }
    private readonly Dictionary<(Guid Host, Guid Client), Grant> grants = [];
    private bool stopped;
    internal void Confirm(CheckInClient client)
    {
        client.Require();
        lock (grants)
        {
            if (stopped) throw new CheckInFailure("credential_service_stopping");
            Prune(); var key = (client.ActivationScopeId, client.ClientId);
            if (grants.ContainsKey(key)) return;
            if (grants.Count >= 256) throw new CheckInFailure("credential_confirmation_limit");
            var grant = new Grant(clock.GetTimestamp()); grants[key] = grant;
            grant.Cancellation = client.Lifetime.Register(() => { lock (grants) { if (grants.GetValueOrDefault(key) == grant) grants.Remove(key); } });
        }
    }
    internal double RemainingSeconds(CheckInClient client)
    {
        client.Require();
        lock (grants)
        {
            if (stopped) throw new CheckInFailure("credential_service_stopping");
            Prune();
            if (!grants.TryGetValue((client.ActivationScopeId, client.ClientId), out var grant)) throw new CheckInFailure("reveal_confirmation_required");
            return Math.Max(0, (TimeSpan.FromHours(24) - clock.GetElapsedTime(grant.Start)).TotalSeconds);
        }
    }
    internal bool IsConfirmed(CheckInClient client)
    {
        try { return RemainingSeconds(client) > 0; }
        catch (CheckInFailure) { return false; }
    }
    private void Prune()
    {
        foreach (var key in grants.Where(pair => clock.GetElapsedTime(pair.Value.Start) >= TimeSpan.FromHours(24)).Select(pair => pair.Key).ToArray())
        { var grant = grants[key]; grants.Remove(key); grant.Cancellation.Unregister(); }
    }
    public void Dispose()
    {
        lock (grants)
        { stopped = true; foreach (var grant in grants.Values) grant.Cancellation.Unregister(); grants.Clear(); }
    }
}
