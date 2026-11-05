namespace NexusPipeline.Extensions.GameCheckIn;

internal sealed class CheckInIdentity(ICheckInNetwork network, ICheckInPassportDevice devices, TimeProvider clock)
{
    private static readonly ICheckInEffects ReadOnly = new ReadOnlyEffects();
    internal Task<CredentialMaterial> VerifyAsync(string platform, CredentialMaterial captured, CancellationToken cancellationToken) => platform switch {
        "cn" or "os" => new HoyoCheckIn(network, ReadOnly, clock).ValidateAsync(platform, captured, cancellationToken),
        "skland" or "skport" => new PassportCheckIn(network, ReadOnly, devices, clock).ValidateAsync(platform, captured, cancellationToken),
        "kuro" => new KuroCheckIn(network, ReadOnly).ValidateAsync(captured, cancellationToken),
        _ => Task.FromException<CredentialMaterial>(new CheckInFailure("credential_native_login_proof_required")) };

    private sealed class ReadOnlyEffects : ICheckInEffects
    {
        private static CheckInFailure Rejected() => new("checkin_readonly_violation");
        public ValueTask<CheckInEffectLease> BeginGameAsync(string platform, string gameCode, CancellationToken cancellationToken) =>
            ValueTask.FromException<CheckInEffectLease>(Rejected());
        public ValueTask GameConfirmedAsync(CheckInEffectLease lease, CancellationToken cancellationToken) => ValueTask.FromException(Rejected());
        public ValueTask<CheckInEffectLease> AcquireAsync(CheckInEffectScope scope, CancellationToken cancellationToken) =>
            ValueTask.FromException<CheckInEffectLease>(Rejected());
        public ValueTask SubmittedAsync(CheckInEffectLease lease, CancellationToken cancellationToken) => ValueTask.FromException(Rejected());
        public ValueTask ConfirmedAsync(CheckInEffectLease lease, string evidenceCode, CancellationToken cancellationToken) => ValueTask.FromException(Rejected());
    }
}
