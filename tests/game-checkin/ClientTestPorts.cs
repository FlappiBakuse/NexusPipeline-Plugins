using System.Text;
using NexusPipeline.Extensions.GameCheckIn;

internal sealed record ObservedRequest(string Address, string Method, Dictionary<string, string> Headers, string Body);
internal sealed class ClientNetwork(TestEffects effects, params string[] replies) : ICheckInNetwork
{
    private readonly Queue<string> responses = new(replies);
    internal List<ObservedRequest> Requests { get; } = [];
    internal Action<ObservedRequest>? Inspect;
    internal Func<ObservedRequest, Exception?>? Failure;
    internal bool RequireGameGate = true;
    internal int Posts => Requests.Count(request => BusinessPost(new Uri(request.Address).AbsolutePath));
    internal static bool BusinessPost(string path) => path.EndsWith("/sign", StringComparison.Ordinal) || path.Contains("attendance", StringComparison.Ordinal) || path == "/encourage/signIn/v2";
    public ValueTask<CheckInResponse> SendAsync(CheckInRequest request, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        if (RequireGameGate && !effects.Began) throw new InvalidOperationException("protocol_started_without_total_host_claim");
        var observed = new ObservedRequest(request.Address.AbsoluteUri, request.Method, new(request.Headers), Encoding.UTF8.GetString(request.Content));
        Requests.Add(observed);
        if (BusinessPost(request.Address.AbsolutePath) && (!effects.Submitted.Contains(effects.LastRole) || request.Method != "POST"))
            throw new InvalidOperationException("signin_post_without_persisted_host_submission");
        Inspect?.Invoke(observed);
        var failure = Failure?.Invoke(observed); if (failure is not null) throw failure;
        if (responses.Count == 0) throw new InvalidOperationException("unexpected_extra_platform_request");
        return ValueTask.FromResult(new CheckInResponse(200, "application/json", Encoding.UTF8.GetBytes(responses.Dequeue())));
    }
}
internal sealed class TestEffects : ICheckInEffects
{
    internal string GameState = "new", RoleState = "new";
    internal readonly Dictionary<string, string> RoleStates = [];
    internal bool Began, GameConfirmed, FailSubmitted, FailGameConfirmation;
    internal string LastRole = "";
    internal readonly HashSet<string> Submitted = [], Confirmed = [];
    public ValueTask<CheckInEffectLease> BeginGameAsync(string platform, string gameCode, CancellationToken cancellationToken)
    { Began = true; return ValueTask.FromResult(new CheckInEffectLease(platform + "/" + gameCode, GameState)); }
    public ValueTask GameConfirmedAsync(CheckInEffectLease lease, CancellationToken cancellationToken)
    {
        if (FailGameConfirmation) throw new IOException("synthetic_commit_reply_lost");
        if (Confirmed.Count == 0 && RoleState != "confirmed") throw new InvalidOperationException("game_confirmed_without_role_confirmation");
        GameConfirmed = true; return ValueTask.CompletedTask;
    }
    public ValueTask<CheckInEffectLease> AcquireAsync(CheckInEffectScope scope, CancellationToken cancellationToken)
    {
        if (!Began) throw new InvalidOperationException("role_claim_without_total_claim");
        LastRole = scope.RoleId + "/" + scope.ServerId;
        return ValueTask.FromResult(new CheckInEffectLease(LastRole, RoleStates.GetValueOrDefault(LastRole, RoleState)));
    }
    public ValueTask SubmittedAsync(CheckInEffectLease lease, CancellationToken cancellationToken)
    {
        if (GameState != "new") throw new InvalidOperationException("unknown_total_claim_cannot_submit");
        if (FailSubmitted) throw new IOException("synthetic_submission_commit_unknown");
        Submitted.Add(lease.Id); return ValueTask.CompletedTask;
    }
    public ValueTask ConfirmedAsync(CheckInEffectLease lease, string evidenceCode, CancellationToken cancellationToken)
    { Confirmed.Add(lease.Id); return ValueTask.CompletedTask; }
}
internal sealed class TestDevice : ICheckInPassportDevice
{
    internal int Calls;
    public ValueTask<string> GetAsync(CancellationToken cancellationToken) { Calls++; return ValueTask.FromResult("Bsynthetic-device"); }
}
internal sealed class TestRotation : ICheckInCredentialRotation
{
    internal bool Accept = true, Persisted;
    internal string? Access;
    public ValueTask<bool> PersistAsync(CredentialMaterial expected, CredentialMaterial replacement, CancellationToken cancellationToken)
    {
        replacement.Use(value => {
            var bytes = Encoding.UTF8.GetBytes(value.ToString());
            try { Access = TajiduoCredential.Parse(bytes).AccessToken; } finally { Array.Clear(bytes); }
        });
        Persisted = Accept; return ValueTask.FromResult(Accept);
    }
}
internal static class ClientFixtures
{
    internal const string HoyoFalse = "{\"retcode\":0,\"data\":{\"is_sign\":false}}";
    internal const string HoyoTrue = "{\"retcode\":0,\"data\":{\"is_sign\":true}}";
    internal const string HoyoRoles = "{\"retcode\":0,\"data\":{\"list\":[{\"game_uid\":\"123456\",\"region\":\"cn_gf01\"}]}}";
    internal const string Native = "{\"accessToken\":\"synthetic-access\",\"refreshToken\":\"synthetic-refresh\",\"uid\":\"123456\",\"deviceId\":\"synthetic-device\",\"sdkToken\":\"synthetic-sdk-token\",\"sdkUid\":\"456789\"}";
    internal const string Refresh = "{\"code\":0,\"data\":{\"accessToken\":\"synthetic-new-access\",\"refreshToken\":\"synthetic-new-refresh\",\"uid\":\"123456\"}}";
    internal const string NativeRoles = "{\"code\":0,\"data\":{\"roles\":[{\"roleId\":\"789123\"}]}}";
    internal const string NativeFalse = "{\"code\":0,\"data\":{\"todaySign\":false}}";
    internal const string NativeTrue = "{\"code\":0,\"data\":{\"todaySign\":true}}";
    internal static CredentialMaterial Material(string platform) => new(platform == "tajiduo" ? Native : platform is "cn" or "os" ? "synthetic-cookie" : "synthetic-token", "manual");
}
