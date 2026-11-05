namespace NexusPipeline.Extensions.GameCheckIn;

internal interface ICheckInExecutionPorts
{
    ICheckInEffects Effects(Guid taskId, string platform, long expectedSecretRevision);
    ICheckInCredentialRotation Rotation(Guid taskId, long expectedTaskRevision, long expectedSecretRevision);
    ValueTask<bool> IsStoppedAsync(Guid taskId, Guid runId, Guid attemptId, CancellationToken cancellationToken);
}
internal sealed class CheckInInterrupted(bool unknown) : OperationCanceledException
{ internal bool Unknown { get; } = unknown; }
internal sealed class CheckInProtocols(ICheckInNetwork network, ICheckInExecutionPorts ports, ICheckInPassportDevice devices, TimeProvider clock)
{
    internal async Task<CheckInGameResult> SignAsync(CheckInTask task, string platform, string game, CheckInCredentialRead credential,
        DateOnly localDate, CancellationToken cancellationToken)
    {
        var effects = new ObservedEffects(ports.Effects(task.Id, platform, credential.Revision));
        try
        {
            var result = platform switch {
                "cn" or "os" => await new HoyoCheckIn(network, effects, clock).SignAsync(platform, game, credential.Material!, task.Protocol.CnDeviceId.ToString("D"), cancellationToken),
                "skland" or "skport" => await new PassportCheckIn(network, effects, devices, clock).SignAsync(platform, game, credential.Material!, cancellationToken),
                "kuro" => await new KuroCheckIn(network, effects).SignAsync(game, credential.Material!, task.Protocol.KuroDeviceId.ToString("D"),
                    task.Protocol.KuroDistinctId.ToString("D"), localDate, cancellationToken),
                "tajiduo" => await new TajiduoCheckIn(network, effects, ports.Rotation(task.Id, task.Revision, credential.Revision), clock).SignAsync(credential.Material!, cancellationToken),
                _ => throw new CheckInFailure("checkin_platform_unknown") };
            return effects.Uncertain && !result.Success ? result with { EffectState = "unknown" } : result;
        }
        catch (OperationCanceledException error) when (cancellationToken.IsCancellationRequested)
        { throw new CheckInInterrupted(effects.Uncertain || error is CheckInInterrupted { Unknown: true }); }
    }
    private sealed class ObservedEffects(ICheckInEffects inner) : ICheckInEffects
    {
        private readonly HashSet<string> uncertain = [];
        internal bool Uncertain => uncertain.Count > 0;
        public async ValueTask<CheckInEffectLease> BeginGameAsync(string platform, string gameCode, CancellationToken cancellationToken)
        { var lease = await inner.BeginGameAsync(platform, gameCode, cancellationToken); if (lease.State is "unknown" or "busy") uncertain.Add(lease.Id); return lease; }
        public async ValueTask GameConfirmedAsync(CheckInEffectLease lease, CancellationToken cancellationToken)
        { await inner.GameConfirmedAsync(lease, cancellationToken); uncertain.Remove(lease.Id); }
        public async ValueTask<CheckInEffectLease> AcquireAsync(CheckInEffectScope scope, CancellationToken cancellationToken)
        { var lease = await inner.AcquireAsync(scope, cancellationToken); if (lease.State is "unknown" or "busy") uncertain.Add(lease.Id); return lease; }
        public ValueTask SubmittedAsync(CheckInEffectLease lease, CancellationToken cancellationToken)
        { uncertain.Add(lease.Id); return inner.SubmittedAsync(lease, cancellationToken); }
        public async ValueTask ConfirmedAsync(CheckInEffectLease lease, string evidenceCode, CancellationToken cancellationToken)
        { await inner.ConfirmedAsync(lease, evidenceCode, cancellationToken); uncertain.Remove(lease.Id); }
    }
}
