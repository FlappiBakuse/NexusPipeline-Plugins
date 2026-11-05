using NexusPipeline.Extensibility.Scheduling;

namespace NexusPipeline.Extensions.GameCheckIn;

internal sealed class SdkCheckInEffects(IWorkEffects effects, IWorkTasks tasks, Guid taskId, string platform, long expectedSecretRevision) : ICheckInEffects
{
    private readonly Dictionary<string, (Guid Id, string State, bool Activity)> leases = new(StringComparer.Ordinal);
    private Guid activityId;
    private string? gameCode;

    public async ValueTask<CheckInEffectLease> BeginGameAsync(string field, string game, CancellationToken cancellationToken)
    {
        if (field != platform || expectedSecretRevision <= 0 || activityId != Guid.Empty ||
            !CheckInCatalog.Platform(field).Games.Any(item => item.Code == game)) throw new CheckInFailure("checkin_effect_scope_invalid");
        var current = await tasks.ReadCurrentAsync(cancellationToken);
        if (taskId == Guid.Empty || current.TaskId != taskId) throw new CheckInFailure("checkin_execution_owner_invalid");
        var actual = await effects.BeginAsync(field, expectedSecretRevision, game, cancellationToken);
        var lease = Remember(actual, true); activityId = actual.Id; gameCode = game; return lease;
    }
    public async ValueTask<CheckInEffectLease> AcquireAsync(CheckInEffectScope scope, CancellationToken cancellationToken)
    {
        if (activityId == Guid.Empty || scope.Platform != platform || scope.GameCode != gameCode ||
            string.IsNullOrEmpty(scope.RoleId) || string.IsNullOrEmpty(scope.ServerId) ||
            !leases.Values.Any(item => item.Id == activityId && item.State is "new" or "unknown"))
            throw new CheckInFailure("checkin_effect_scope_invalid");
        return Remember(await effects.AcquireAsync(activityId, scope.RoleId, scope.ServerId, cancellationToken), false);
    }
    public ValueTask SubmittedAsync(CheckInEffectLease lease, CancellationToken cancellationToken)
    {
        var actual = Resolve(lease, false);
        if (actual.State != "new") throw new CheckInFailure("checkin_effect_submission_forbidden");
        return effects.SubmittedAsync(actual.Id, cancellationToken);
    }
    public ValueTask ConfirmedAsync(CheckInEffectLease lease, string evidenceCode, CancellationToken cancellationToken)
    {
        var actual = Resolve(lease, false);
        if (actual.State is not ("new" or "unknown")) throw new CheckInFailure("checkin_effect_confirmation_invalid");
        return effects.ConfirmedAsync(actual.Id, evidenceCode, cancellationToken);
    }
    public ValueTask GameConfirmedAsync(CheckInEffectLease lease, CancellationToken cancellationToken)
    {
        var actual = Resolve(lease, true);
        if (actual.State is not ("new" or "unknown")) throw new CheckInFailure("checkin_effect_confirmation_invalid");
        return effects.CompleteAsync(actual.Id, cancellationToken);
    }
    private CheckInEffectLease Remember(WorkEffectLease actual, bool activity)
    {
        var state = actual.State switch { WorkEffectState.New => "new", WorkEffectState.Busy => "busy",
            WorkEffectState.Unknown => "unknown", WorkEffectState.Confirmed => "confirmed", _ => throw new CheckInFailure("checkin_effect_lease_invalid") };
        var id = actual.Id.ToString("D");
        if (actual.Id == Guid.Empty || !leases.TryAdd(id, (actual.Id, state, activity))) throw new CheckInFailure("checkin_effect_lease_invalid");
        return new(id, state);
    }
    private (Guid Id, string State, bool Activity) Resolve(CheckInEffectLease lease, bool activity)
    {
        if (!leases.TryGetValue(lease.Id, out var actual) || actual.State != lease.State || actual.Activity != activity)
            throw new CheckInFailure("checkin_effect_lease_invalid");
        return actual;
    }
}
