using System.Text;
using NexusPipeline.Extensions.GameCheckIn;
using NexusPipeline.Extensibility.Networking;
using NexusPipeline.Extensibility.Scheduling;

internal static class RoleEpochCases
{
    private const string Refresh = "{\"code\":0,\"data\":{\"accessToken\":\"synthetic-new-access\",\"refreshToken\":\"synthetic-new-refresh\",\"uid\":\"123456\"}}";
    private const string Roles = "{\"code\":0,\"data\":{\"roles\":[{\"roleId\":\"111\"},{\"roleId\":\"222\"}]}}";
    private const string False = "{\"code\":0,\"data\":{\"todaySign\":false}}", True = "{\"code\":0,\"data\":{\"todaySign\":true}}";
    internal static async Task RunAsync(Func<string, Func<Task>, Task> run)
    {
        static void Assert(bool value) { if (!value) throw new InvalidOperationException("assertion_failed"); }
        await run("actual-sdk-consumer-completed-role-a-does-not-cover-role-b-in-next-coordination-epoch", async () => {
            var host = new Host(); var a = await ExecuteAsync(host, "111", [Refresh, Roles, False, "{\"code\":0}", True]);
            var b = await ExecuteAsync(host, "222", [Refresh, Roles, False, "{\"code\":0}", True]);
            var repeat = await ExecuteAsync(host, "111", [Refresh, Roles]);
            Assert(a.Result.Success && b.Result.Success && repeat.Result.Code == "already" && host.Epochs == 3 &&
                host.Posts.SequenceEqual(new[] { "111", "222" }) && repeat.Network.BusinessPosts == 0);
        });
        await run("actual-sdk-consumer-unknown-activity-does-not-repost-old-or-unseen-role", async () => {
            var host = new Host(); host.States["111"] = WorkEffectState.Unknown;
            foreach (var role in new[] { "111", "222" })
            {
                var result = await ExecuteAsync(host, role, [Roles, False]);
                Assert(result.Result.EffectState == "unknown" && result.Network.Methods.All(method => method == "GET") && result.Rotation.Calls == 0);
            }
            Assert(host.Posts.Count == 0 && host.Epochs == 0);
        });
        await run("actual-sdk-consumer-readonly-role-a-reconciliation-allows-new-role-b-epoch", async () => {
            var host = new Host(); host.States["111"] = WorkEffectState.Unknown;
            var a = await ExecuteAsync(host, "111", [Roles, True]);
            Assert(a.Result.Success && a.Result.Code == "already" && a.Rotation.Calls == 0 && a.Network.Methods.All(method => method == "GET"));
            var b = await ExecuteAsync(host, "222", [Refresh, Roles, False, "{\"code\":0}", True]);
            Assert(b.Result.Success && host.Posts.Single() == "222" && host.Epochs == 1);
        });
        await run("actual-sdk-consumer-busy-family-game-has-zero-http-including-refresh", async () => {
            var host = new Host { Busy = true }; var result = await ExecuteAsync(host, "222", []);
            Assert(!result.Result.Success && result.Network.Requests == 0 && result.Rotation.Calls == 0 && host.Posts.Count == 0);
        });
    }
    private static async Task<(CheckInGameResult Result, Network Network, Rotation Rotation)> ExecuteAsync(Host host, string role, string[] responses)
    {
        var task = Guid.NewGuid(); var network = new Network(host, responses); var rotation = new Rotation();
        var effects = new SdkCheckInEffects(host, new Work(task), task, "tajiduo", 1);
        using var material = new CredentialMaterial("{\"accessToken\":\"synthetic-access\",\"refreshToken\":\"synthetic-refresh\",\"uid\":\"123456\",\"deviceId\":\"synthetic-device\",\"sdkToken\":\"shared-synthetic-sdk\",\"sdkUid\":\"456789\",\"roleId\":\"" + role + "\"}", "manual");
        var result = await new TajiduoCheckIn(new SdkCheckInNetwork(network), effects, rotation, TimeProvider.System).SignAsync(material, default);
        return (result, network, rotation);
    }
    private sealed class Rotation : ICheckInCredentialRotation
    {
        internal int Calls;
        public ValueTask<bool> PersistAsync(CredentialMaterial expected, CredentialMaterial replacement, CancellationToken cancellationToken)
        { Calls++; return ValueTask.FromResult(true); }
    }
    private sealed class Network(Host host, string[] responses) : IExtensionHttp
    {
        private readonly Queue<string> replies = new(responses);
        internal readonly List<string> Methods = [];
        internal int Requests, BusinessPosts;
        public ValueTask<ExtensionHttpResponse> SendAsync(ExtensionHttpRequest request, CancellationToken cancellationToken)
        {
            Requests++; Methods.Add(request.Method);
            if (request.Address.AbsolutePath == "/apihub/awapi/sign")
            {
                if (host.SubmittedRole is null) throw new InvalidOperationException("business_post_without_submitted_lease");
                host.Posts.Add(host.SubmittedRole); host.SubmittedRole = null; BusinessPosts++;
            }
            if (replies.Count == 0) throw new InvalidOperationException("unexpected_protocol_request");
            return ValueTask.FromResult(new ExtensionHttpResponse(200, new Dictionary<string, string[]> { ["Content-Type"] = ["application/json"] }, Encoding.UTF8.GetBytes(replies.Dequeue())));
        }
    }
    private sealed class Host : IWorkEffects
    {
        internal readonly Dictionary<string, WorkEffectState> States = [];
        internal readonly List<string> Posts = [];
        internal bool Busy;
        internal int Epochs;
        internal string? SubmittedRole;
        private Guid activity;
        private WorkEffectState currentState;
        private readonly Dictionary<Guid, string> roles = [];
        public ValueTask<WorkEffectLease> BeginAsync(string field, long expectedSecretRevision, string activityId, CancellationToken cancellationToken)
        {
            if (field != "tajiduo" || expectedSecretRevision != 1 || activityId != "nte") throw new InvalidOperationException("unexpected_scope");
            currentState = Busy ? WorkEffectState.Busy : States.Values.Any(state => state == WorkEffectState.Unknown) ? WorkEffectState.Unknown : WorkEffectState.New;
            if (currentState == WorkEffectState.New) Epochs++;
            activity = Guid.NewGuid(); return ValueTask.FromResult(new WorkEffectLease(activity, currentState));
        }
        public ValueTask<WorkEffectLease> AcquireAsync(Guid activityLeaseId, string roleId, string serverId, CancellationToken cancellationToken)
        {
            if (activityLeaseId != activity || serverId != "1289") throw new InvalidOperationException("unexpected_role_scope");
            var state = States.GetValueOrDefault(roleId, currentState == WorkEffectState.Unknown ? WorkEffectState.Unknown : WorkEffectState.New);
            var id = Guid.NewGuid(); roles.Add(id, roleId); return ValueTask.FromResult(new WorkEffectLease(id, state));
        }
        public ValueTask SubmittedAsync(Guid leaseId, CancellationToken cancellationToken)
        {
            var role = roles[leaseId]; if (currentState != WorkEffectState.New || States.GetValueOrDefault(role) == WorkEffectState.Confirmed) throw new InvalidOperationException("replay_forbidden");
            SubmittedRole = role; States[role] = WorkEffectState.Unknown; return ValueTask.CompletedTask;
        }
        public ValueTask ConfirmedAsync(Guid leaseId, string evidenceCode, CancellationToken cancellationToken)
        { States[roles[leaseId]] = WorkEffectState.Confirmed; return ValueTask.CompletedTask; }
        public ValueTask CompleteAsync(Guid activityLeaseId, CancellationToken cancellationToken)
        { if (activityLeaseId != activity || States.Values.Any(state => state != WorkEffectState.Confirmed)) throw new InvalidOperationException("incomplete_roles"); return ValueTask.CompletedTask; }
    }
    private sealed class Work(Guid task) : IWorkTasks
    {
        public ValueTask<WorkInvocation> ReadCurrentAsync(CancellationToken cancellationToken) => ValueTask.FromResult(new WorkInvocation(Guid.NewGuid(), Guid.NewGuid(), task, task, 1, new(2026, 10, 25), "UTC", DateTimeOffset.UtcNow.AddMinutes(30)));
        public ValueTask<bool> HasStoppedAsync(string providerId, Guid taskId, Guid runId, Guid attemptId, CancellationToken cancellationToken) => throw new NotSupportedException();
        public ValueTask<WorkClock> ReadClockAsync(CancellationToken cancellationToken) => throw new NotSupportedException();
        public ValueTask<WorkTaskSnapshot> ReadAsync(string providerId, IReadOnlyList<Guid> ids, CancellationToken cancellationToken) => throw new NotSupportedException();
        public ValueTask<ManualRunReceipt> RunAsync(string providerId, Guid taskId, long revision, CancellationToken cancellationToken) => throw new NotSupportedException();
        public ValueTask<IAsyncDisposable> QuiesceAsync(string providerId, Guid taskId, long revision, CancellationToken cancellationToken) => throw new NotSupportedException();
    }
}
