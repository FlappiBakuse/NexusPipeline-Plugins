using System.Net;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using NexusPipeline.Plugin.Abstractions;
using NexusPipeline.Plugin.GameCheckIn.BrowserLogin;
using NexusPipeline.Plugin.GameCheckIn.Credentials;
using NexusPipeline.Plugin.TestKit;
using Xunit;

namespace NexusPipeline.Plugin.GameCheckIn.Tests;

public sealed class TajiduoLoginTests
{
    private const string Sdk = "{\"code\":0,\"result\":{\"token\":\"sdk-secret\",\"userId\":987654321098765432}}";
    private const string Native = "{\"code\":0,\"data\":{\"accessToken\":\"native-access\",\"refreshToken\":\"native-refresh\",\"uid\":12345678}}";
    private static PluginClientSessionContext Client(string name = "owner") => new("host", name, "desktop", true);
    private static HttpResponseMessage Json(string value) => new(HttpStatusCode.OK) { Content = new StringContent(value, Encoding.UTF8, "application/json") };
    private static string Operation(LoginPreparation preparation) => preparation.Context["operation"]!.GetValue<string>();

    [Fact]
    public async Task PasswordLoginUsesOfficialProtocolAndPublishesOnlyMaskedDraft()
    {
        var context = new FakePluginHostContext("game-check-in");
        var requests = new List<(string Url, string Body)>();
        context.Http.ResponseFactory = request =>
        {
            string body = request.Content!.ReadAsStringAsync().GetAwaiter().GetResult();
            requests.Add((request.RequestUri!.AbsoluteUri, body));
            Assert.DoesNotContain("sample-password", body);
            Assert.DoesNotContain("13812345678", body);
            if (requests.Count == 1)
            {
                Assert.Equal("https://user.laohu.com/openApi/secureLogin", requests[^1].Url);
                var fields = body.Split('&').Select(p => p.Split('=', 2)).ToDictionary(p => Uri.UnescapeDataString(p[0]), p => Uri.UnescapeDataString(p[1].Replace('+', ' ')));
                string sign = fields["sign"]; fields.Remove("sign");
                Assert.Equal(Convert.ToHexString(MD5.HashData(Encoding.UTF8.GetBytes(string.Concat(fields.OrderBy(p => p.Key, StringComparer.Ordinal).Select(p => p.Value)) + "89155cc4e8634ec5b1b6364013b23e3e"))).ToLowerInvariant(), sign);
                using var aes = Aes.Create(); aes.Key = Encoding.ASCII.GetBytes("b1b6364013b23e3e");
                Assert.Equal("sample-password", Encoding.UTF8.GetString(aes.DecryptEcb(Convert.FromBase64String(fields["password"]), PaddingMode.PKCS7)));
                return Json(Sdk);
            }
            Assert.Equal("https://bbs-api.tajiduo.com/usercenter/api/login", requests[^1].Url);
            Assert.Contains("userIdentity=987654321098765432", body);
            Assert.Contains("appId=10551", body);
            return Json(Native);
        };
        using var drafts = new CredentialDraftService();
        using var login = new TajiduoLoginSessions(drafts, context.Http);
        var client = Client(); var editor = drafts.Create(client, null, new Dictionary<string, string?> { ["tajiduo"] = "old-secret" });
        var prep = login.Prepare(client, editor.EditorSessionId, 0);
        var result = (await login.Submit(client, editor.EditorSessionId, Operation(prep), "password", "13812345678", "sample-password", CancellationToken.None))!;
        var field = result.Fields["tajiduo"];
        Assert.Equal("browser", field.Source); Assert.NotNull(field.CandidateId);
        Assert.DoesNotContain("native-", JsonSerializer.Serialize(result));
        Assert.DoesNotContain("12345678", JsonSerializer.Serialize(result));
        Assert.Equal("reveal_confirmation_required", Assert.Throws<CredentialException>(() => drafts.Read(client, editor.EditorSessionId, "tajiduo", field.FieldGeneration)).Code);
        using var reservation = drafts.Reserve(client, editor.EditorSessionId, null,
            new Dictionary<string, CheckInSecretInput> { ["tajiduo"] = new() { Action = "set", CandidateId = field.CandidateId, FieldGeneration = field.FieldGeneration } },
            new Dictionary<string, string?> { ["tajiduo"] = "old-secret" });
        var saved = CredentialRecord.Decode(reservation.Changes["tajiduo"].Value)!;
        Assert.Equal("native-refresh", TajiduoCredential.Parse(saved.Value)!.RefreshToken);
        Assert.DoesNotContain("sdk-secret", saved.Encode()); Assert.DoesNotContain("sample-password", saved.Encode());
        Assert.Equal(2, requests.Count);
    }

    [Fact]
    public async Task SmsLoginRequiresExplicitSendAndThrottlesRepeatedMessages()
    {
        var context = new FakePluginHostContext("game-check-in");
        var paths = new List<string>();
        context.Http.ResponseFactory = request =>
        {
            paths.Add(request.RequestUri!.AbsolutePath);
            return Json(paths.Count is 1 or 2 ? "{\"code\":0}" : paths.Count == 3 ? Sdk : Native);
        };
        using var drafts = new CredentialDraftService(); using var login = new TajiduoLoginSessions(drafts, context.Http);
        var client = Client(); var editor = drafts.Create(client, null, new Dictionary<string, string?>());
        var prep = login.Prepare(client, editor.EditorSessionId, 0);
        Assert.Null(await login.Submit(client, editor.EditorSessionId, Operation(prep), "send", "13812345678", "", CancellationToken.None));
        Assert.Equal("tajiduo_sms_cooldown", (await Assert.ThrowsAsync<CredentialException>(() => login.Submit(client, editor.EditorSessionId, Operation(prep), "send", "13812345678", "", CancellationToken.None))).Code);
        Assert.NotNull(await login.Submit(client, editor.EditorSessionId, Operation(prep), "sms", "13812345678", "123456", CancellationToken.None));
        Assert.Equal(new[] { "/m/newApi/sendPhoneCaptchaWithOutLogin", "/m/newApi/checkPhoneCaptchaWithOutLogin", "/openApi/sms/new/login", "/usercenter/api/login" }, paths);
    }

    [Fact]
    public async Task ForeignCancelledAndInvalidLoginCannotReplaceExistingDraft()
    {
        var context = new FakePluginHostContext("game-check-in"); int calls = 0;
        context.Http.ResponseFactory = _ => { calls++; return Json("{\"code\":1}"); };
        using var drafts = new CredentialDraftService(); using var login = new TajiduoLoginSessions(drafts, context.Http);
        var client = Client(); var editor = drafts.Create(client, null, new Dictionary<string, string?> { ["tajiduo"] = "old-secret" });
        var prep = login.Prepare(client, editor.EditorSessionId, 0);
        async Task<CredentialException> Reject(PluginClientSessionContext owner, string phone) => await Assert.ThrowsAsync<CredentialException>(() => login.Submit(owner, editor.EditorSessionId, Operation(prep), "password", phone, "password", CancellationToken.None));
        Assert.Equal("credential_editor_owner_mismatch", (await Reject(Client("foreign"), "13812345678")).Code);
        Assert.Equal("tajiduo_login_input_invalid", (await Reject(client, "invalid")).Code); Assert.Equal(0, calls);
        Assert.Equal("credential_rejected", (await Reject(client, "13812345678")).Code); Assert.Equal(1, calls);
        login.CancelEditor(client, editor.EditorSessionId);
        Assert.Equal("credential_binding_stale", (await Reject(client, "13812345678")).Code); Assert.Equal(1, calls);
        var state = drafts.State(client, editor.EditorSessionId).Fields["tajiduo"];
        Assert.Equal("old-secret", drafts.Read(client, editor.EditorSessionId, "tajiduo", state.FieldGeneration).Value);
    }

    [Fact]
    public async Task CancellingUnacknowledgedLoginRestoresPriorCredential()
    {
        var context = new FakePluginHostContext("game-check-in"); int calls = 0;
        context.Http.ResponseFactory = _ => Json(++calls == 1 ? Sdk : Native);
        using var drafts = new CredentialDraftService(); using var login = new TajiduoLoginSessions(drafts, context.Http);
        var client = Client(); var editor = drafts.Create(client, null, new Dictionary<string, string?> { ["tajiduo"] = "old-secret" });
        var prep = login.Prepare(client, editor.EditorSessionId, 0);
        Assert.NotNull(await login.Submit(client, editor.EditorSessionId, Operation(prep), "password", "13812345678", "password", CancellationToken.None));
        login.CancelOperation(client, editor.EditorSessionId, Operation(prep));
        var field = drafts.State(client, editor.EditorSessionId).Fields["tajiduo"];
        Assert.Null(field.CandidateId); Assert.Equal("manual", field.Source);
        Assert.Equal("old-secret", drafts.Read(client, editor.EditorSessionId, "tajiduo", field.FieldGeneration).Value);
        Assert.Equal(2, calls);
    }

    [Fact]
    public async Task ClosingEditorDuringAuthenticationRejectsLateSuccess()
    {
        var context = new FakePluginHostContext("game-check-in");
        using var reached = new ManualResetEventSlim(); using var release = new ManualResetEventSlim();
        context.Http.ResponseFactory = _ => { reached.Set(); Assert.True(release.Wait(TimeSpan.FromSeconds(10))); return Json(Sdk); };
        using var drafts = new CredentialDraftService(); using var login = new TajiduoLoginSessions(drafts, context.Http);
        var client = Client(); var editor = drafts.Create(client, null, new Dictionary<string, string?> { ["tajiduo"] = "old-secret" });
        var prep = login.Prepare(client, editor.EditorSessionId, 0);
        var work = Task.Run(() => login.Submit(client, editor.EditorSessionId, Operation(prep), "password", "13812345678", "password", CancellationToken.None));
        try { Assert.True(reached.Wait(TimeSpan.FromSeconds(10))); login.CancelEditor(client, editor.EditorSessionId); drafts.Release(client, editor.EditorSessionId); }
        finally { release.Set(); }
        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => work);
        Assert.Equal("credential_editor_expired", Assert.Throws<CredentialException>(() => drafts.State(client, editor.EditorSessionId)).Code);
    }
}
