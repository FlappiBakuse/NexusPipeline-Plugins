namespace NexusPipeline.Extensions.GameCheckIn;

internal sealed record CheckInEffectScope(string Platform, string GameCode, string RoleId, string ServerId);
internal sealed record CheckInEffectLease(string Id, string State);
internal interface ICheckInEffects
{
    ValueTask<CheckInEffectLease> BeginGameAsync(string platform, string gameCode, CancellationToken cancellationToken);
    ValueTask GameConfirmedAsync(CheckInEffectLease lease, CancellationToken cancellationToken);
    ValueTask<CheckInEffectLease> AcquireAsync(CheckInEffectScope scope, CancellationToken cancellationToken);
    ValueTask SubmittedAsync(CheckInEffectLease lease, CancellationToken cancellationToken);
    ValueTask ConfirmedAsync(CheckInEffectLease lease, string evidenceCode, CancellationToken cancellationToken);
}
internal sealed record CheckInGameGate(CheckInEffectLease Lease, bool MaySubmit, CheckInGameResult? Result);
internal static class CheckInEffectGate
{
    internal static async ValueTask<CheckInGameGate> BeginAsync(ICheckInEffects effects, string platform, string game, CancellationToken cancellationToken)
    {
        var lease = await effects.BeginGameAsync(platform, game, cancellationToken);
        return lease.State switch {
            "new" => new(lease, true, null), "unknown" => new(lease, false, null),
            "confirmed" => new(lease, false, CheckInResults.Result(platform, game, "already", true, "confirmed")),
            "busy" => new(lease, false, CheckInResults.Result(platform, game, "effect_busy", effectState: "unknown")),
            _ => new(lease, false, CheckInResults.Result(platform, game, "effect_unavailable")) };
    }
    internal static async Task<CheckInGameResult> FinishAsync(ICheckInEffects effects, CheckInGameGate gate, CheckInGameResult result, CancellationToken cancellationToken)
    {
        if (!result.Success) return result;
        try { await effects.GameConfirmedAsync(gate.Lease, cancellationToken); return result; }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested) { throw; }
        catch (Exception error) when (error is not OutOfMemoryException)
        { return CheckInResults.Result(result.Platform, result.GameCode, "success_unconfirmed", effectState: "unknown"); }
    }
}
