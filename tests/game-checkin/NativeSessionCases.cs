using System.Text;
using NexusPipeline.Extensions.GameCheckIn;

internal static class NativeSessionCases
{
    internal static void Run(Action<string, Action> run)
    {
        void Assert(bool condition) { if (!condition) throw new InvalidOperationException("assertion_failed"); }
        void Reject(Action action, string code)
        { try { action(); } catch (CheckInFailure error) when (error.Code == code) { return; } throw new InvalidOperationException("expected_" + code); }
        CheckInClient Client() => new(Guid.NewGuid(), Guid.NewGuid(), default);
        run("native-login-requires-real-native-proof-before-preparing-field", () =>
        {
            var client = Client(); var clock = new DraftClock(); using var editors = new CheckInEditors(clock);
            var editor = editors.Add(client, null, 0, new Dictionary<string, SavedCredentialField>());
            var network = new ClientNetwork(new TestEffects()) { RequireGameGate = false };
            using var logins = new TajiduoLogins(editors, new(network, clock), new NativeProof(false), clock);
            Reject(() => logins.PrepareAsync(client, editor.Id, 0, default).AsTask().GetAwaiter().GetResult(), "client_not_supported");
            Assert(editor.View(client).Fields["tajiduo"].FieldGeneration == 0 && network.Requests.Count == 0);
        });
        run("sms-cooldown-is-client-wide-across-new-editors-and-cancel", () =>
        {
            var client = Client(); var clock = new DraftClock(); using var editors = new CheckInEditors(clock);
            var network = new ClientNetwork(new TestEffects(), "{\"code\":0}", "{\"code\":0}") { RequireGameGate = false };
            using var logins = new TajiduoLogins(editors, new(network, clock), new NativeProof(true), clock);
            var first = editors.Add(client, null, 0, new Dictionary<string, SavedCredentialField>());
            var operation = logins.PrepareAsync(client, first.Id, 0, default).Result;
            logins.SendCodeAsync(client, operation, "13800000000", default).AsTask().GetAwaiter().GetResult(); logins.Cancel(client, operation, first.Id);
            var second = editors.Add(client, null, 0, new Dictionary<string, SavedCredentialField>());
            operation = logins.PrepareAsync(client, second.Id, 0, default).Result;
            Reject(() => logins.SendCodeAsync(client, operation, "13800000000", default).AsTask().GetAwaiter().GetResult(), "tajiduo_sms_cooldown");
            Assert(network.Requests.Count == 1); clock.Advance(TimeSpan.FromSeconds(60));
            logins.SendCodeAsync(client, operation, "13800000000", default).AsTask().GetAwaiter().GetResult(); Assert(network.Requests.Count == 2);
        });
        run("native-operation-expiry-and-cross-client-deny-before-http", () =>
        {
            var client = Client(); var clock = new DraftClock(); using var editors = new CheckInEditors(clock);
            var editor = editors.Add(client, null, 0, new Dictionary<string, SavedCredentialField>());
            var network = new ClientNetwork(new TestEffects()) { RequireGameGate = false };
            using var logins = new TajiduoLogins(editors, new(network, clock), new NativeProof(true), clock);
            var operation = logins.PrepareAsync(client, editor.Id, 0, default).Result;
            Reject(() => logins.SendCodeAsync(client with { ClientId = Guid.NewGuid() }, operation, "13800000000", default).AsTask().GetAwaiter().GetResult(), "credential_editor_owner_mismatch");
            clock.Advance(TimeSpan.FromMinutes(15));
            Reject(() => logins.SendCodeAsync(client, operation, "13800000000", default).AsTask().GetAwaiter().GetResult(), "tajiduo_login_expired"); Assert(network.Requests.Count == 0);
        });
        run("native-accepted-candidate-can-be-cancelled-before-ui-acceptance", () =>
        {
            var client = Client(); var clock = new DraftClock(); using var editors = new CheckInEditors(clock);
            var editor = editors.Add(client, null, 0, new Dictionary<string, SavedCredentialField>());
            var network = new ClientNetwork(new TestEffects(), "{\"code\":0,\"result\":{\"token\":\"synthetic-sdk\",\"userId\":\"456789\"}}",
                "{\"code\":0,\"data\":{\"accessToken\":\"synthetic-access\",\"refreshToken\":\"synthetic-refresh\",\"uid\":\"123456\"}}") { RequireGameGate = false };
            using var logins = new TajiduoLogins(editors, new(network, clock), new NativeProof(true), clock);
            var operation = logins.PrepareAsync(client, editor.Id, 0, default).Result; using var secret = new CredentialMaterial("synthetic-password", "manual");
            var candidate = logins.LoginAsync(client, operation, editor.Id, "password", "13800000000", secret, default).Result;
            Assert(editor.View(client).Fields["tajiduo"].CandidateId == candidate);
            logins.Cancel(client, operation, editor.Id); Assert(editor.View(client).Fields["tajiduo"].CandidateId is null);
            Assert(network.Requests.Last().Address.EndsWith("/loginV2", StringComparison.Ordinal) && network.Requests.Last().Headers["appVersion"] == "1.2.7");
        });
        run("client-retirement-immediately-clears-candidate-memory", () =>
        {
            using var lifetime = new CancellationTokenSource(); var client = Client() with { Lifetime = lifetime.Token };
            var clock = new DraftClock(); using var editors = new CheckInEditors(clock); var editor = editors.Add(client, null, 0, new Dictionary<string, SavedCredentialField>());
            var binding = editor.Prepare(client, "kuro", 0); var material = new CredentialMaterial("synthetic-sensitive-canary", "browser", "kuro · 12**56");
            editor.Accept(client, binding, material); lifetime.Cancel();
            try { material.Use(_ => { }); throw new InvalidOperationException("candidate_not_cleared"); } catch (ObjectDisposedException) { }
        });
        run("native-v2-refresh-wire-and-private-sdk-rotation-material", () =>
        {
            var effects = new TestEffects(); var rotation = new TestRotation();
            var network = new ClientNetwork(effects, ClientFixtures.Refresh, ClientFixtures.NativeRoles, ClientFixtures.NativeTrue);
            using var material = ClientFixtures.Material("tajiduo");
            var result = new TajiduoCheckIn(network, effects, rotation, TimeProvider.System).SignAsync(material, default).GetAwaiter().GetResult();
            var refresh = network.Requests.First(); Assert(result.Success && refresh.Address.EndsWith("/refreshTokenV2", StringComparison.Ordinal));
            Assert(refresh.Headers["AuthorizationV2"] == "" && !refresh.Headers.ContainsKey("Authorization") && refresh.Headers["Referer"] == "https://app.tajiduo.com/");
            Assert(refresh.Body.Contains("token=synthetic-sdk-token", StringComparison.Ordinal) && refresh.Body.Contains("userIdentity=456789", StringComparison.Ordinal));
        });
        run("legacy-native-json-is-preserved-but-does-not-fallback-to-old-refresh", () =>
        {
            const string old = "{\"accessToken\":\"synthetic-access\",\"refreshToken\":\"synthetic-refresh\",\"uid\":\"123456\",\"deviceId\":\"synthetic-device\"}";
            using var material = ManualCredentials.Prepare("tajiduo", old); var effects = new TestEffects(); var network = new ClientNetwork(effects);
            var result = new TajiduoCheckIn(network, effects, new TestRotation(), TimeProvider.System).SignAsync(material, default).GetAwaiter().GetResult();
            Assert(result.Code == "tajiduo_sdk_credential_required" && !result.Success && network.Requests.Count == 0);
            material.Use(value => Assert(value.SequenceEqual(old)));
        });
    }
    private sealed class NativeProof(bool available) : ICheckInNativeLogin
    {
        public ValueTask<CheckInNativeAvailability> ReadAsync(CheckInClient client, CancellationToken cancellationToken) => ValueTask.FromResult(new CheckInNativeAvailability(available, available));
        public ValueTask RequireAsync(CheckInClient client, CancellationToken cancellationToken)
        { client.Require(); if (!available) throw new CheckInFailure("client_not_supported"); return ValueTask.CompletedTask; }
    }
}
