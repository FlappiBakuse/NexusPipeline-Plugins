using System.Net;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using NexusPipeline.Plugin.Abstractions;
using NexusPipeline.Plugin.GameCheckIn.BrowserLogin;
using NexusPipeline.Plugin.GameCheckIn.Credentials;
using NexusPipeline.Plugin.TestKit;
using Xunit;

namespace NexusPipeline.Plugin.GameCheckIn.Tests;

public sealed class CredentialTests
{
    private static PluginClientSessionContext Client(string id = "one", bool native = true) => new("host", id, native ? "desktop" : "web", native);
    private static Dictionary<string, string?> Payloads(string? value = null) => new() { ["os"] = value };
    private static CredentialRecord Browser(string value = "candidate-secret") => new(1, value, "browser", "account · 12****89", DateTimeOffset.UtcNow, "1");
    private static PluginBrowserInvocation Invocation(CredentialDraftService service, PluginClientSessionContext client, string editor, long generation)
    {
        var preparation = service.Prepare(client, editor, "os", generation);
        return new(Guid.NewGuid().ToString("N"), editor, preparation.FieldGeneration, preparation.Context, client);
    }
    private static void Error(string code, Action action) => Assert.Equal(code, Assert.Throws<CredentialException>(action).Code);

    [Fact]
    public void RecordsPreserveLegacyValuesAndRejectCorruptionWithoutManualFallback()
    {
        Assert.Equal("manual", CredentialRecord.Decode("legacy-secret")!.Source);
        Assert.Equal("legacy-secret", CredentialRecord.Decode("legacy-secret")!.Value);
        var record = Browser(new string('x', 16384));
        Assert.Equal(record, CredentialRecord.Decode(record.Encode()));
        Assert.True(Encoding.UTF8.GetByteCount(record.Encode()) > 16384);
        Error("credential_record_invalid", () => CredentialRecord.Decode(CredentialRecord.Magic + "{}"));
        Error("credential_record_invalid", () => CredentialRecord.Decode(CredentialRecord.Magic + "[]"));
        Error("credential_record_invalid", () => CredentialRecord.Decode(CredentialRecord.Magic + "null"));
        Error("credential_record_invalid", () => CredentialRecord.Decode(CredentialRecord.Magic + "{\"recordVersion\":1,\"recordVersion\":1,\"source\":\"manual\",\"value\":\"secret\"}"));
        Assert.Throws<CredentialException>(() => CredentialRecord.Decode("a\nb"));
        Assert.Throws<CredentialException>(() => Browser(new string('x', 16385)).Encode());
    }

    [Fact]
    public void ProvisionalCandidatesRequireCleanupAndCancellationRestoresPreviousDraft()
    {
        using var service = new CredentialDraftService(new Clock());
        var client = Client();var editor = service.Create(client, null, Payloads("old-secret"));
        var first = Invocation(service, client, editor.EditorSessionId, 0);
        var provisional = service.Provisional(first, "os", Browser());
        var before = service.State(client, editor.EditorSessionId).Fields["os"];
        Assert.Null(before.CandidateId);Assert.Equal("manual", before.Source);
        service.Terminal(first, "os", PluginBrowserLoginTerminal.Completed);
        var active = service.State(client, editor.EditorSessionId).Fields["os"];
        Assert.Equal(provisional.CandidateId, active.CandidateId);
        Assert.Equal("browser", active.Source);
        Assert.DoesNotContain("candidate-secret", JsonSerializer.Serialize(active));
        var second = Invocation(service, client, editor.EditorSessionId, active.FieldGeneration);
        service.Provisional(second, "os", Browser("replacement-secret"));
        service.Terminal(second, "os", PluginBrowserLoginTerminal.Cancelled);
        var retained = service.State(client, editor.EditorSessionId).Fields["os"];
        Assert.Equal(active.CandidateId, retained.CandidateId);
        service.Terminal(first, "os", PluginBrowserLoginTerminal.Completed);
        Assert.Equal(retained, service.State(client, editor.EditorSessionId).Fields["os"]);
        service.Terminal(first, "os", PluginBrowserLoginTerminal.Failed);
        Assert.Equal("manual", service.State(client, editor.EditorSessionId).Fields["os"].Source);
    }

    [Fact]
    public void RevealUsesClientBoundMonotonicNonRollingLifetimeAndEditingRetainsSource()
    {
        var clock = new Clock();using var service = new CredentialDraftService(clock);
        var client = Client();var editor = service.Create(client, null, Payloads(Browser().Encode()));
        Error("reveal_confirmation_required", () => service.Read(client, editor.EditorSessionId, "os", 0));
        Error("credential_editor_owner_mismatch", () => service.Read(Client("two"), editor.EditorSessionId, "os", 0));
        var expires = service.Confirm(client);clock.Advance(TimeSpan.FromMinutes(20), TimeSpan.FromDays(-2));
        service.Lease(client, editor.EditorSessionId);
        Assert.Equal(expires, service.Confirm(client));
        Assert.Equal("candidate-secret", service.Read(client, editor.EditorSessionId, "os", 0).Value);
        var edited = service.Mutate(client, editor.EditorSessionId, "os", 0, "edit-current", "edited-secret");
        Assert.Equal("browser", edited.Source);Assert.NotNull(edited.CandidateId);
        Error("credential_clear_required", () => service.Mutate(client, editor.EditorSessionId, "os", edited.FieldGeneration, "set-manual", "manual-secret"));
        var cleared = service.Mutate(client, editor.EditorSessionId, "os", edited.FieldGeneration, "clear", null);
        var manual = service.Mutate(client, editor.EditorSessionId, "os", cleared.FieldGeneration, "set-manual", "manual-secret");
        Assert.Equal("manual", manual.Source);Assert.Null(manual.CandidateId);
        clock.Advance(TimeSpan.FromHours(24), TimeSpan.FromDays(-2));
        var fresh = service.Create(client, null, Payloads(Browser().Encode()));
        Error("reveal_confirmation_required", () => service.Read(client, fresh.EditorSessionId, "os", 0));
        var other = service.Create(Client("two"), null, Payloads(Browser().Encode()));
        Error("reveal_confirmation_required", () => service.Read(Client("two"), other.EditorSessionId, "os", 0));
    }

    [Fact]
    public void ReservationBindsOwnerGenerationTaskAndConsumesOnlyCommittedCandidates()
    {
        using var service = new CredentialDraftService();var client = Client();var task = Guid.NewGuid();
        var editor = service.Create(client, task, Payloads("old-secret"));
        var invocation = Invocation(service, client, editor.EditorSessionId, 0);
        service.Provisional(invocation, "os", Browser());service.Terminal(invocation, "os", PluginBrowserLoginTerminal.Completed);
        var field = service.State(client, editor.EditorSessionId).Fields["os"];
        var inputs = new Dictionary<string, CheckInSecretInput> { ["os"] = new() { Action = "set", CandidateId = field.CandidateId, FieldGeneration = field.FieldGeneration } };
        Error("credential_editor_task_mismatch", () => service.Reserve(client, editor.EditorSessionId, Guid.NewGuid(), inputs, Payloads("old-secret")));
        Error("credential_saved_conflict", () => service.Reserve(client, editor.EditorSessionId, task, inputs, Payloads("changed-secret")));
        using (var reservation = service.Reserve(client, editor.EditorSessionId, task, inputs, Payloads("old-secret")))
        {
            var record = CredentialRecord.Decode(reservation.Changes["os"].Value)!;
            Assert.Equal("browser", record.Source);Assert.Equal("candidate-secret", record.Value);
            Error("credential_editor_expired", () => service.Read(client, editor.EditorSessionId, "os", field.FieldGeneration));
        }
        Assert.Equal(field.CandidateId, service.State(client, editor.EditorSessionId).Fields["os"].CandidateId);
        using (var reservation = service.Reserve(client, editor.EditorSessionId, task, inputs, Payloads("old-secret"))) reservation.Committed = true;
        Error("credential_editor_expired", () => service.State(client, editor.EditorSessionId));
    }

    [Fact]
    public void ExpiredRevokedAndStaleEditorsCannotReadOrActivateLateResults()
    {
        var clock = new Clock();using var service = new CredentialDraftService(clock);using var lifetime = new CancellationTokenSource();
        var client = Client() with { Lifetime = lifetime.Token };var editor = service.Create(client, null, Payloads());
        var invocation = Invocation(service, client, editor.EditorSessionId, 0);
        var changed = service.Mutate(client, editor.EditorSessionId, "os", invocation.FieldGeneration, "set-manual", "new-secret");
        Error("credential_field_stale", () => service.Provisional(invocation, "os", Browser()));
        clock.Advance(TimeSpan.FromMinutes(30), TimeSpan.FromMinutes(-30));
        Error("credential_editor_expired", () => service.State(client, editor.EditorSessionId));
        var fresh = service.Create(client, null, Payloads());lifetime.Cancel();
        Error("client_session_required", () => service.State(client, fresh.EditorSessionId));
        Assert.Equal("manual", changed.Source);
        Error("client_not_supported", () => service.Prepare(Client("web", false), "unknown", "os", 0));
    }

    [Fact]
    public async Task HoyoLabValidationUsesOnlyReadOnlyIdentityAndRejectsMixedOrAnonymousCookies()
    {
        var context = new FakePluginHostContext("game-check-in");
        context.Http.ResponseFactory = request => new(HttpStatusCode.OK) { Content = new StringContent(request.RequestUri!.AbsolutePath.EndsWith("/info")
            ? "{\"retcode\":0,\"data\":{\"is_sign\":false}}" : "{\"retcode\":0,\"data\":{\"list\":[{\"game_uid\":\"123456789\"}]}}") };
        var provider = new HoyoLabLoginProvider(context.Http);
        PluginBrowserCapture capture = new([new(".hoyolab.com", "/", "ltuid_v2", "123"), new(".hoyolab.com", "/", "ltoken_v2", "token-secret")], [], DateTimeOffset.UtcNow);
        var result = await provider.ValidateAsync(capture, CancellationToken.None);
        Assert.Equal("browser", result.Source);Assert.DoesNotContain("123456789", result.MaskedAccount!);
        Assert.Equal(2, context.Http.Requests.Count);Assert.All(context.Http.Requests, request => Assert.Equal(HttpMethod.Get, request.Method));
        Assert.Equal("/binding/api/getUserGameRolesByLtoken", context.Http.Requests[0].RequestUri!.AbsolutePath);
        Assert.Equal("/event/sol/info", context.Http.Requests[1].RequestUri!.AbsolutePath);
        Error("credential_fields_missing", () => HoyoLabLoginProvider.Normalize(new([], [], DateTimeOffset.UtcNow)));
        Error("credential_capture_ambiguous", () => HoyoLabLoginProvider.Normalize(capture with { Cookies = [.. capture.Cookies, new(".hoyolab.com", "/", "ltuid", "456")] }));
        context.Http.ResponseFactory = _ => new(HttpStatusCode.OK) { Content = new StringContent("{\"retcode\":-100}") };
        Assert.Equal("credential_not_authenticated", (await Assert.ThrowsAsync<CredentialException>(() => provider.ValidateAsync(capture, CancellationToken.None))).Code);
        Assert.True(GameCheckInLoginFlows.IsReady("os"));
        Assert.All(GameCheckInLoginFlows.Readiness.Where(platform => platform.Platform != "os"), platform => Assert.Equal("not_run", platform.Status));
    }

    private sealed class Clock : TimeProvider
    {
        private long _ticks;private DateTimeOffset _utc = new(2026, 10, 10, 0, 0, 0, TimeSpan.Zero);
        public override long TimestampFrequency => TimeSpan.TicksPerSecond;
        public override long GetTimestamp() => _ticks;
        public override DateTimeOffset GetUtcNow() => _utc;
        internal void Advance(TimeSpan monotonic, TimeSpan wall) { _ticks += monotonic.Ticks;_utc += wall; }
    }
}
