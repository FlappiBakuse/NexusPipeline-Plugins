namespace NexusPipeline.Extensions.GameCheckIn;

internal static class CheckInCancellation
{
    internal static void Stop(CancellationTokenSource cancellation)
    {
        try { cancellation.Cancel(); }
        // One failing callback must not retain other clients' credential drafts or login sessions.
        catch (AggregateException) { }
        finally { cancellation.Dispose(); }
    }
}
