using System.Text.Json;
using NexusPipeline.Extensions.GameCheckIn;

internal static class CredentialCases
{
    internal static void Run(Action<string, Action> run)
    {
        void Assert(bool value) { if (!value) throw new InvalidOperationException("assertion_failed"); }
        void Reject(Action action)
        { try { action(); } catch (Exception error) when (error is CheckInFailure or ObjectDisposedException or NotSupportedException) { return; } throw new InvalidOperationException("expected_rejection"); }
        CheckInClient Client() => new(Guid.NewGuid(), Guid.NewGuid(), default);
        run("capture-cookie-domains-and-same-account-token-version", () =>
        {
            using var material = LoginCapture.Normalize("cn", new([
                new(".mihoyo.com", "/", "cookie_token_v2", "synthetic-token"), new(".mihoyo.com", "/", "account_id_v2", "123456"),
                new(".miyoushe.com", "/", "cookie_token_v2", "synthetic-token"), new(".miyoushe.com", "/", "account_id_v2", "123456")], [], []));
            material.Use(value => Assert(value.SequenceEqual("cookie_token_v2=synthetic-token; account_id_v2=123456")));
            Reject(() => LoginCapture.Normalize("cn", new([new("evil.test", "/", "cookie_token_v2", "synthetic")], [], [])));
            Reject(() => LoginCapture.Normalize("cn", new([
                new(".mihoyo.com", "/", "cookie_token_v2", "a"), new(".mihoyo.com", "/", "account_id_v2", "123456"),
                new(".miyoushe.com", "/", "cookie_token_v2", "b")], [], [])));
        });
        run("capture-header-injection-and-storage-overreach-rejected", () =>
        {
            Reject(() => LoginCapture.Normalize("os", new([new(".hoyolab.com", "/", "ltoken", "a;evil=b"), new(".hoyolab.com", "/", "ltuid", "1234")], [], [])));
            Reject(() => LoginCapture.Normalize("kuro", new([], [new("https://evil.test", "localStorage", "auth_token", "synthetic")], [])));
            Reject(() => LoginCapture.Normalize("skport", new([], [new("https://www.skland.com", "localStorage", "SK_SHUMEI_DEVICE_ID_KEY", "{}")], [new("passport-token", "synthetic")])));
        });
        foreach (var value in new[] { "has space", "\"quote", "back\\slash", "comma,value", "semi;value", "unicode雪", "tab\tvalue", "delete\u007f" })
            run("captured-cookie-shares-canonical-identity-character-boundary/" + value.Length + "/" + value[0], () => {
                Reject(() => LoginCapture.Normalize("cn", new([new(".mihoyo.com", "/", "cookie_token_v2", value), new(".mihoyo.com", "/", "account_id_v2", "123456")], [], [])));
            });
        run("captured-cookie-visible-punctuation-remains-exact-without-trimming", () => {
            const string token = "!#$%&'()*+-./:<=>?@[]^_`{|}~AZaz09";
            using var material = LoginCapture.Normalize("cn", new([new(".mihoyo.com", "/", "cookie_token_v2", token), new(".mihoyo.com", "/", "account_id_v2", "123456")], [], []));
            material.Use(value => Assert(value.SequenceEqual("cookie_token_v2=" + token + "; account_id_v2=123456")));
        });
        run("skland-device-bound-to-encrypted-material-and-generic-json-blocked", () =>
        {
            using var material = LoginCapture.Normalize("skland", new([], [new("https://www.skland.com", "localStorage", "SK_SHUMEI_DEVICE_ID_KEY", "{\"id\":\"synthetic-device\"}")], [new("passport-token", "synthetic") ]));
            var bytes = material.Encode();
            try { using var restored = CredentialMaterial.Decode(bytes); Assert(restored.Web?.DeviceId == "synthetic-device" && restored.Source == "browser"); }
            finally { Array.Clear(bytes); }
            Reject(() => JsonSerializer.Serialize(material)); Reject(() => JsonSerializer.Serialize(material.Web));
            Reject(() => LoginCapture.Normalize("skland", new([], [], [new("passport-token", "synthetic")])));
        });
        run("manual-edit-clears-web-helper-context", () =>
        {
            using var material = ManualCredentials.Prepare("kuro", "synthetic-new"); Assert(material.Web is null && material.Source == "manual");
            Reject(() => ManualCredentials.Prepare("kuro", "synthetic\r\nheader"));
        });
        run("tajiduo-native-json-only-no-password-or-cookie", () =>
        {
            const string value = "{\"accessToken\":\"synthetic-access\",\"refreshToken\":\"synthetic-refresh\",\"uid\":\"12345\",\"deviceId\":\"synthetic-device\",\"roleId\":\"6789\"}";
            using var valid = ManualCredentials.Prepare("tajiduo", value);
            Reject(() => ManualCredentials.Prepare("tajiduo", "cookie=synthetic"));
            Reject(() => ManualCredentials.Prepare("tajiduo", value[..^1] + ",\"password\":\"synthetic\"}"));
        });
        run("editor-client-binding-not-shared-by-account", () =>
        {
            var owner = Client(); using var editor = new CredentialEditor(owner, null, 0, new Dictionary<string, SavedCredentialField>(), new DraftClock());
            Assert(editor.View(owner).Fields.Count == 6);
            Reject(() => editor.View(owner with { ClientId = Guid.NewGuid() }));
            Reject(() => editor.View(owner with { ActivationScopeId = Guid.NewGuid() }));
        });
        run("login-cancel-rejects-late-candidate-without-touching-saved-state", () =>
        {
            var owner = Client(); var baseline = new Dictionary<string, SavedCredentialField> { ["kuro"] = new(3, true, "browser", "kuro · 12***34") };
            using var editor = new CredentialEditor(owner, Guid.NewGuid(), 7, baseline, new DraftClock());
            var binding = editor.Prepare(owner, "kuro", 0); editor.CancelLogin(owner, "kuro");
            var late = new CredentialMaterial("synthetic", "browser"); Reject(() => editor.Accept(owner, binding, late));
            Reject(() => late.Use(_ => { }));
            var field = editor.View(owner).Fields["kuro"]; Assert(field.Configured && field.Source == "browser" && field.Intent == "keep" && field.CandidateId is null);
        });
        run("cancel-after-capture-completes-restores-the-prior-staged-candidate", () =>
        {
            var owner = Client(); using var editor = new CredentialEditor(owner, null, 0, new Dictionary<string, SavedCredentialField>(), new DraftClock());
            var first = editor.Prepare(owner, "kuro", 0); var original = editor.Accept(owner, first, new("synthetic-first", "browser", "kuro · 12**56"));
            var previous = editor.View(owner);
            var second = editor.Prepare(owner, "kuro", previous.Fields["kuro"].FieldGeneration);
            var cancelled = new CredentialMaterial("synthetic-second", "browser", "kuro · 65**21"); editor.Accept(owner, second, cancelled);
            editor.CancelLogin(owner, "kuro"); var restored = editor.View(owner);
            Assert(restored.Revision > previous.Revision && restored.Fields["kuro"].CandidateId == original);
            Reject(() => cancelled.Use(_ => { }));
        });
        run("candidate-save-requires-id-generation-owner-and-current-secret-revision", () =>
        {
            var owner = Client(); var task = Guid.NewGuid(); var saved = new Dictionary<string, SavedCredentialField> { ["kuro"] = new(3, true, "manual", null) };
            using var editor = new CredentialEditor(owner, task, 7, saved, new DraftClock());
            var binding = editor.Prepare(owner, "kuro", 0); var candidate = editor.Accept(owner, binding, new("synthetic", "browser", "kuro · 12***34"));
            var field = editor.View(owner).Fields["kuro"];
            Reject(() => editor.Reserve(owner, task, new Dictionary<string, CredentialAction> { ["kuro"] = new("set", field.FieldGeneration - 1, CandidateId: candidate) }, saved));
            Reject(() => editor.Reserve(owner, task, new Dictionary<string, CredentialAction> { ["kuro"] = new("set", field.FieldGeneration, CandidateId: "wrong") }, saved));
            var edits = new Dictionary<string, CredentialAction> { ["kuro"] = new("set", field.FieldGeneration, CandidateId: candidate) };
            Reject(() => editor.Reserve(owner, task, edits, new Dictionary<string, SavedCredentialField> { ["kuro"] = new(4, true, "manual", null) }));
            using var reservation = editor.Reserve(owner, task, edits, saved);
            Assert(reservation.Changes.Length == 6 && reservation.Changes.Single(change => change.Platform == "kuro").Material?.Source == "browser");
        });
        run("clear-is-explicit-and-cancelled-reservation-retains-draft", () =>
        {
            var owner = Client(); var saved = new Dictionary<string, SavedCredentialField> { ["kuro"] = new(3, true, "manual", null) };
            using var editor = new CredentialEditor(owner, null, 0, saved, new DraftClock());
            using (var reservation = editor.Reserve(owner, null, new Dictionary<string, CredentialAction> { ["kuro"] = new("clear", 0) }, saved))
                Assert(reservation.Changes.Single(change => change.Platform == "kuro").Action == "clear" && reservation.Changes.All(change => change.Material is null));
            Assert(editor.View(owner).Fields["kuro"].Configured);
            Reject(() => editor.Reserve(owner, null, new Dictionary<string, CredentialAction> { ["kuro"] = new("keep", 0, Value: "") }, saved));
        });
        run("explicit-new-manual-value-replaces-without-reading-old-browser-secret", () =>
        {
            var owner = Client(); var saved = new Dictionary<string, SavedCredentialField> { ["kuro"] = new(3, true, "browser", null) };
            using var editor = new CredentialEditor(owner, null, 0, saved, new DraftClock());
            var edits = new Dictionary<string, CredentialAction> { ["kuro"] = new("set", 0, Value: "synthetic-new") };
            using var reservation = editor.Reserve(owner, null, edits, saved);
            Assert(reservation.Changes.Single(change => change.Platform == "kuro").Material is { Source: "manual", Web: null });
        });
        run("editor-idle-expiry-and-hard-expiry-cannot-be-extended", () =>
        {
            var owner = Client(); var clock = new DraftClock();
            using var editor = new CredentialEditor(owner, null, 0, new Dictionary<string, SavedCredentialField>(), clock);
            clock.Advance(TimeSpan.FromMinutes(29)); editor.Lease(owner); clock.Advance(TimeSpan.FromMinutes(29)); editor.Lease(owner);
            clock.Advance(TimeSpan.FromMinutes(29)); editor.Lease(owner); clock.Advance(TimeSpan.FromMinutes(29)); editor.Lease(owner);
            clock.Advance(TimeSpan.FromMinutes(4)); Reject(() => editor.View(owner));
            using var idle = new CredentialEditor(owner, null, 0, new Dictionary<string, SavedCredentialField>(), clock);
            clock.Advance(TimeSpan.FromMinutes(30)); Reject(() => idle.View(owner));
        });
        run("client-lifetime-and-committed-editor-cannot-be-reused", () =>
        {
            using var cancellation = new CancellationTokenSource(); var owner = Client() with { Lifetime = cancellation.Token };
            using var editor = new CredentialEditor(owner, null, 0, new Dictionary<string, SavedCredentialField>(), new DraftClock());
            using (var reserved = editor.Reserve(owner, null, new Dictionary<string, CredentialAction>(), new Dictionary<string, SavedCredentialField>())) reserved.Committed = true;
            Reject(() => editor.View(owner));
            using var second = new CredentialEditor(owner, null, 0, new Dictionary<string, SavedCredentialField>(), new DraftClock());
            cancellation.Cancel(); Reject(() => second.View(owner));
        });
        run("reveal-confirmation-binds-host-client-and-expires-without-extension", () =>
        {
            var clock = new DraftClock(); var owner = Client(); using var grants = new CredentialRevealGrants(clock);
            Reject(() => grants.RemainingSeconds(owner)); grants.Confirm(owner); Assert(grants.RemainingSeconds(owner) == 86400);
            Reject(() => grants.RemainingSeconds(owner with { ClientId = Guid.NewGuid() }));
            Reject(() => grants.RemainingSeconds(owner with { ActivationScopeId = Guid.NewGuid() }));
            clock.Advance(TimeSpan.FromHours(23)); grants.Confirm(owner); Assert(grants.RemainingSeconds(owner) == 3600);
            clock.Advance(TimeSpan.FromHours(1)); Reject(() => grants.RemainingSeconds(owner));
            using var restarted = new CredentialRevealGrants(clock); Reject(() => restarted.RemainingSeconds(owner));
        });
        run("unreadable-saved-format-preserves-keep-and-only-allows-explicit-clear", () =>
        {
            var owner = Client(); var saved = new Dictionary<string, SavedCredentialField> { ["kuro"] = new(3, true, null, null, "credential_format_unsupported") };
            using var editor = new CredentialEditor(owner, null, 0, saved, new DraftClock());
            Assert(editor.View(owner).Fields["kuro"].Error == "credential_format_unsupported");
            Reject(() => editor.Prepare(owner, "kuro", 0));
            Reject(() => editor.Reserve(owner, null, new Dictionary<string, CredentialAction> { ["kuro"] = new("set", 0, Value: "synthetic") }, saved));
            using (var keep = editor.Reserve(owner, null, new Dictionary<string, CredentialAction>(), saved))
                Assert(keep.Changes.All(change => change.Material is null && change.Action == "keep"));
            using var clear = editor.Reserve(owner, null, new Dictionary<string, CredentialAction> { ["kuro"] = new("clear", 0) }, saved);
            Assert(clear.Changes.Single(change => change.Platform == "kuro").Action == "clear");
        });
    }
}
internal sealed class DraftClock : TimeProvider
{
    private long timestamp;
    public override long TimestampFrequency => TimeSpan.TicksPerSecond;
    public override long GetTimestamp() => timestamp;
    internal void Advance(TimeSpan value) => timestamp += value.Ticks;
}
