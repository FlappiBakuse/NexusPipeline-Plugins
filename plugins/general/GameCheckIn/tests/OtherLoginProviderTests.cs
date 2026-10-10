using System.Net;
using System.Text;
using System.Text.Json;
using NexusPipeline.Plugin.Abstractions;
using NexusPipeline.Plugin.GameCheckIn.BrowserLogin;
using NexusPipeline.Plugin.GameCheckIn.Credentials;
using NexusPipeline.Plugin.TestKit;
using Xunit;

namespace NexusPipeline.Plugin.GameCheckIn.Tests;

public sealed class OtherLoginProviderTests
{
    private static PluginBrowserCapture Cn() => new([
        new(".mihoyo.com", "/", "cookie_token_v2", "cookie-secret"),
        new(".mihoyo.com", "/", "account_id_v2", "123456")], [], DateTimeOffset.UtcNow);
    private static PluginBrowserCapture Kuro() => new([], [new("https://www.kurobbs.com", "localStorage", "auth_token", "raw-token")], DateTimeOffset.UtcNow);
    private static HttpResponseMessage Json(string body, HttpStatusCode status = HttpStatusCode.OK) => new(status) { Content = new StringContent(body) };
    private static void Error(string code, Action action) => Assert.Equal(code, Assert.Throws<CredentialException>(action).Code);
    private static async Task ErrorAsync(string code, Func<Task> action) => Assert.Equal(code, (await Assert.ThrowsAsync<CredentialException>(action)).Code);
    private static string Roles(string user = "12345678") => "{\"code\":200,\"data\":[{\"roleId\":\"98765432\",\"serverId\":\"1000\",\"userId\":\"" + user + "\"}]}";

    [Fact]
    public void MiyousheCaptureKeepsOnlyCompleteCookieProfilesAndRejectsMixedAccounts()
    {
        Assert.Equal("cookie_token_v2=cookie-secret; account_id_v2=123456", MiyousheLoginProvider.Normalize(Cn()));
        var legacy = Cn() with { Cookies = [new(".miyoushe.com", "/", "cookie_token", "legacy"), new(".miyoushe.com", "/", "account_id", "123456")] };
        Assert.Equal("cookie_token=legacy; account_id=123456", MiyousheLoginProvider.Normalize(legacy));
        Error("credential_fields_missing", () => MiyousheLoginProvider.Normalize(Cn() with { Cookies = [Cn().Cookies[0]] }));
        Error("credential_fields_missing", () => MiyousheLoginProvider.Normalize(Cn() with { Cookies = [Cn().Cookies[0], Cn().Cookies[1] with { Domain = ".miyoushe.com" }] }));
        Error("credential_capture_ambiguous", () => MiyousheLoginProvider.Normalize(Cn() with { Cookies = [.. Cn().Cookies, new(".miyoushe.com", "/", "account_id", "999999")] }));
        Error("credential_capture_ambiguous", () => MiyousheLoginProvider.Normalize(Cn() with { Cookies = [.. Cn().Cookies, new(".miyoushe.com", "/", "cookie_token_v2", "other-token")] }));
        Error("credential_capture_invalid", () => MiyousheLoginProvider.Normalize(Cn() with { Cookies = [.. Cn().Cookies, Cn().Cookies[0]] }));
        foreach (var invalid in new[] { "secret; injected=value", "secret\r\nheader", new string('x', 16385) })
            Error("secret_value_invalid", () => MiyousheLoginProvider.Normalize(Cn() with { Cookies = [Cn().Cookies[0] with { Value = invalid }, Cn().Cookies[1]] }));
        Error("credential_capture_invalid", () => MiyousheLoginProvider.Normalize(Cn() with { Cookies = [Cn().Cookies[0] with { Domain = ".hoyolab.com" }, Cn().Cookies[1]] }));
    }

    [Fact]
    public async Task MiyousheValidationRequiresAuthenticatedRoleAndExistingClientInfoWithoutSigning()
    {
        var context = new FakePluginHostContext("game-check-in");
        context.Http.ResponseFactory = request =>
        {
            Assert.Equal(HttpMethod.Get, request.Method);
            Assert.Contains("cookie_token_v2=cookie-secret", request.Headers.GetValues("Cookie").Single());
            Assert.True(request.Headers.Contains("DS"));
            return Json(request.RequestUri!.AbsolutePath.EndsWith("/info") ? "{\"retcode\":0,\"data\":{\"is_sign\":false}}"
                : "{\"retcode\":0,\"data\":{\"list\":[{\"game_uid\":\"987654321\",\"region\":\"cn_gf01\"}]}}");
        };
        var provider = new MiyousheLoginProvider(context.Http);
        var result = await provider.ValidateAsync(Cn(), CancellationToken.None);
        Assert.Equal("browser", result.Source);
        Assert.Equal(MiyousheLoginProvider.Normalize(Cn()), result.Value);
        Assert.Equal("hk4e_cn · 98*****21", result.MaskedAccount);
        Assert.Equal(2, context.Http.Requests.Count);
        Assert.Equal("/binding/api/getUserGameRolesByCookie", context.Http.Requests[0].RequestUri!.AbsolutePath);
        Assert.Contains("uid=987654321", context.Http.Requests[1].RequestUri!.Query);
        context.Http.ResponseFactory = _ => Json("{\"retcode\":0,\"data\":{\"list\":[]}}");
        await ErrorAsync("readonly_identity_unverified", () => provider.ValidateAsync(Cn(), CancellationToken.None));
        context.Http.ResponseFactory = _ => Json("{\"retcode\":-100}");
        await ErrorAsync("credential_not_authenticated", () => provider.ValidateAsync(Cn(), CancellationToken.None));
        context.Http.ResponseFactory = _ => Json("{\"retcode\":0,\"retcode\":-100,\"data\":{\"list\":[]}}");
        await ErrorAsync("readonly_validation_failed", () => provider.ValidateAsync(Cn(), CancellationToken.None));
    }

    [Fact]
    public void KuroCaptureRejectsCookieAccountCenterTokensAndMalformedStorage()
    {
        Assert.Equal("raw-token", KuroLoginProvider.Normalize(Kuro()));
        Error("credential_fields_missing", () => KuroLoginProvider.Normalize(Kuro() with { Storage = [] }));
        foreach (var invalid in new[] { "{\"token\":\"raw-token\"}", "token=raw-token", "raw token", "raw\ntoken", "=", "raw===", new string('x', 16385) })
            Error("secret_value_invalid", () => KuroLoginProvider.Normalize(Kuro() with { Storage = [Kuro().Storage[0] with { Value = invalid }] }));
        Error("credential_capture_invalid", () => KuroLoginProvider.Normalize(Kuro() with { Cookies = [new(".kurobbs.com", "/", "token", "raw-token")] }));
        Error("credential_capture_invalid", () => KuroLoginProvider.Normalize(Kuro() with { Storage = [Kuro().Storage[0] with { Key = "accessToken" }] }));
        Error("credential_capture_invalid", () => KuroLoginProvider.Normalize(Kuro() with { Storage = [Kuro().Storage[0] with { Origin = "https://www.skland.com" }] }));
        Error("credential_capture_invalid", () => KuroLoginProvider.Normalize(Kuro() with { Storage = [Kuro().Storage[0], Kuro().Storage[0]] }));
    }

    [Fact]
    public async Task KuroValidationUsesBothRoleQueriesAndRejectsAnonymousOrConflictingIdentity()
    {
        var context = new FakePluginHostContext("game-check-in");
        var gameIds = new HashSet<string>();
        context.Http.ResponseFactory = request =>
        {
            Assert.Equal(HttpMethod.Post, request.Method);
            Assert.Equal("/user/role/findRoleList", request.RequestUri!.AbsolutePath);
            Assert.Equal("raw-token", request.Headers.GetValues("token").Single());
            gameIds.Add(request.Content!.ReadAsStringAsync().GetAwaiter().GetResult());
            return Json(Roles());
        };
        var provider = new KuroLoginProvider(context.Http);
        var result = await provider.ValidateAsync(Kuro(), CancellationToken.None);
        Assert.Equal("raw-token", result.Value);
        Assert.Equal("kuro · 12****78", result.MaskedAccount);
        Assert.Equal(2, gameIds.Count);
        context.Http.ResponseFactory = _ => Json("{\"code\":200,\"data\":[]}");
        await ErrorAsync("readonly_identity_unverified", () => provider.ValidateAsync(Kuro(), CancellationToken.None));
        int count = 0;
        context.Http.ResponseFactory = _ => Json(Roles(++count == 1 ? "12345678" : "88888888"));
        await ErrorAsync("credential_capture_ambiguous", () => provider.ValidateAsync(Kuro(), CancellationToken.None));
        context.Http.ResponseFactory = _ => Json("{\"code\":220}");
        await ErrorAsync("credential_not_authenticated", () => provider.ValidateAsync(Kuro(), CancellationToken.None));
        context.Http.ResponseFactory = _ => Json("{\"code\":200,\"data\":{}}");
        await ErrorAsync("readonly_validation_failed", () => provider.ValidateAsync(Kuro(), CancellationToken.None));
    }

    [Fact]
    public async Task PassportValidationSeparatesRegionsExchangesRawTokenAndOnlyReadsIdentityAndBindings()
    {
        foreach (string platform in new[] { "skland", "skport" })
        {
            var context = new FakePluginHostContext("game-check-in");
            context.Http.ResponseFactory = request =>
            {
                string host = request.RequestUri!.Host;
                string path = request.RequestUri.AbsolutePath;
                if (path == "/user/oauth2/v2/grant")
                {
                    Assert.Equal(platform == "skland" ? "as.hypergryph.com" : "as.gryphline.com", host);
                    using var body = JsonDocument.Parse(request.Content!.ReadAsStringAsync().GetAwaiter().GetResult());
                    Assert.Equal("raw-passport", body.RootElement.GetProperty("token").GetString());
                    Assert.Equal(platform == "skland" ? "4ca99fa6b56cc2ba" : "6eb76d4e13aa36e6", body.RootElement.GetProperty("appCode").GetString());
                    return Json("{\"status\":0,\"data\":{\"code\":\"auth-code\"}}");
                }
                Assert.Equal("zonai." + platform + ".com", host);
                if (path.EndsWith("/generate_cred_by_code")) return Json("{\"code\":0,\"data\":{\"cred\":\"derived-cred\",\"token\":\"derived-sign-token\"}}");
                Assert.Equal(HttpMethod.Get, request.Method);
                Assert.Equal("derived-cred", request.Headers.GetValues("cred").Single());
                Assert.True(request.Headers.Contains("sign"));
                return path == "/web/v1/user" ? Json("{\"code\":0,\"data\":{\"user\":{\"id\":\"12345678\"}}}")
                    : path == "/api/v1/game/player/binding" ? Json("{\"code\":0,\"data\":{\"list\":[]}}") : throw new InvalidOperationException("Unexpected business write");
            };
            var client = new SklandClient(context.Http, platform, _ => Task.FromResult("test-device"));
            Assert.Equal(platform + " · 12****78", await client.ValidateCredentialAsync("raw-passport", CancellationToken.None));
            Assert.Equal(4, context.Http.Requests.Count);
        }
    }

    [Fact]
    public async Task PassportValidationRejectsExpiredTokensAndUnverifiedIdentityBeforeBindingQueries()
    {
        foreach (string platform in new[] { "skland", "skport" })
        {
            var context = new FakePluginHostContext("game-check-in");
            var client = new SklandClient(context.Http, platform, _ => Task.FromResult("test-device"));
            context.Http.ResponseFactory = _ => Json("{\"status\":1}");
            await ErrorAsync("credential_not_authenticated", () => client.ValidateCredentialAsync("expired", CancellationToken.None));
            context.Http.Requests.Clear();
            context.Http.ResponseFactory = request => Json(request.RequestUri!.AbsolutePath.EndsWith("/grant")
                ? "{\"status\":0,\"data\":{\"code\":\"auth-code\"}}" : request.RequestUri.AbsolutePath.EndsWith("/generate_cred_by_code")
                ? "{\"code\":0,\"data\":{\"cred\":\"derived-cred\",\"token\":\"derived-sign-token\"}}" : "{\"code\":0,\"data\":{\"user\":{\"id\":\"invalid\"}}}");
            await ErrorAsync("readonly_identity_unverified", () => client.ValidateCredentialAsync("raw-passport", CancellationToken.None));
            Assert.Equal(3, context.Http.Requests.Count);
            await ErrorAsync("secret_value_invalid", () => client.ValidateCredentialAsync("cred=derived", CancellationToken.None));
        }
        Assert.Throws<ArgumentOutOfRangeException>(() => new SklandClient(new FakePluginHostContext("test").Http, "cn"));
    }

    [Fact]
    public async Task PassportValidationRejectsMalformedExchangeAndDuplicateAuthenticationFields()
    {
        foreach (string platform in new[] { "skland", "skport" })
        {
            var context = new FakePluginHostContext("game-check-in");
            var client = new SklandClient(context.Http, platform, _ => Task.FromResult("test-device"));
            foreach (string body in new[] { "{\"status\":0,\"status\":1}", "{\"status\":0,\"data\":{\"code\":42}}" })
            {
                context.Http.ResponseFactory = _ => Json(body);
                await ErrorAsync("readonly_validation_failed", () => client.ValidateCredentialAsync("raw-passport", CancellationToken.None));
            }
            context.Http.ResponseFactory = request => request.RequestUri!.AbsolutePath.EndsWith("/grant")
                ? Json("{\"status\":0,\"data\":{\"code\":\"auth-code\"}}") : Json("{\"code\":0,\"data\":{\"cred\":\"derived\",\"token\":\"header\\r\\ninjection\"}}");
            await ErrorAsync("secret_value_invalid", () => client.ValidateCredentialAsync("raw-passport", CancellationToken.None));
        }
    }

    [Fact]
    public async Task ProviderCallbacksKeepCandidatesProvisionalAndCancelWithoutChangingExistingCredentials()
    {
        foreach (string platform in new[] { "cn", "kuro" })
        {
            var context = new FakePluginHostContext("game-check-in");
            context.Http.ResponseFactory = request => Json(platform == "kuro" ? Roles()
                : request.RequestUri!.AbsolutePath.EndsWith("/info") ? "{\"retcode\":0,\"data\":{\"is_sign\":false}}"
                : "{\"retcode\":0,\"data\":{\"list\":[{\"game_uid\":\"987654321\",\"region\":\"cn_gf01\"}]}}");
            using var drafts = new CredentialDraftService();
            using var flows = new GameCheckInLoginFlows(context, drafts, _ => true);
            var client = new PluginClientSessionContext("host", "client", "desktop", true);
            var editor = drafts.Create(client, null, new Dictionary<string, string?> { [platform] = "old-secret" });
            var prepare = drafts.Prepare(client, editor.EditorSessionId, platform, 0);
            var invocation = new PluginBrowserInvocation("operation", editor.EditorSessionId, prepare.FieldGeneration, prepare.Context, client);
            var flow = context.BrowserLogin.Flows[platform];
            var result = await flow.Complete(platform == "cn" ? Cn() : Kuro(), invocation, CancellationToken.None);
            Assert.True(result.Success);
            Assert.Null(drafts.State(client, editor.EditorSessionId).Fields[platform].CandidateId);
            await flow.Terminal(invocation, PluginBrowserLoginTerminal.Cancelled, CancellationToken.None);
            drafts.Confirm(client);
            Assert.Equal("old-secret", drafts.Read(client, editor.EditorSessionId, platform, prepare.FieldGeneration).Value);
            var next = drafts.Prepare(client, editor.EditorSessionId, platform, prepare.FieldGeneration);
            invocation = invocation with { OperationId = "next", FieldGeneration = next.FieldGeneration, Context = next.Context };
            result = await flow.Complete(platform == "cn" ? Cn() : Kuro(), invocation, CancellationToken.None);
            await flow.Terminal(invocation, PluginBrowserLoginTerminal.Completed, CancellationToken.None);
            Assert.Equal(result.CandidateId, drafts.State(client, editor.EditorSessionId).Fields[platform].CandidateId);
            Assert.Equal("browser", drafts.State(client, editor.EditorSessionId).Fields[platform].Source);
        }
    }

    [Fact]
    public void ReadinessAndRegistrationNeverEnableUnqualifiedOrUnsupportedCaptureFlows()
    {
        var context = new FakePluginHostContext("game-check-in");
        using var drafts = new CredentialDraftService();
        using (var flows = new GameCheckInLoginFlows(context, drafts))
        {
            Assert.Equal(new[] { "cn", "kuro", "os" }, context.BrowserLogin.Flows.Keys.Order().ToArray());
            Assert.All(context.BrowserLogin.Flows.Values, flow => Assert.Equal(flow.Spec.Id == "os", flow.Spec.Ready));
            Assert.False(flows.Ready("skland"));
            Assert.False(flows.Ready("skport"));
        }
        Assert.Empty(context.BrowserLogin.Flows);
        using var existing = context.BrowserLogin.Register(KuroLoginProvider.Flow(false), (_, _, _) => ValueTask.FromResult(new PluginBrowserLoginResult(false)),
            (_, _, _) => ValueTask.CompletedTask, _ => { });
        Assert.Throws<ArgumentException>(() => new GameCheckInLoginFlows(context, drafts));
        Assert.Equal(new[] { "kuro" }, context.BrowserLogin.Flows.Keys.ToArray());
    }

    [Fact]
    public async Task CredentialValidationRejectsHttpErrorsOversizedStreamingBodiesAndCancellation()
    {
        var context = new FakePluginHostContext("game-check-in");
        var provider = new KuroLoginProvider(context.Http);
        context.Http.ResponseFactory = _ => Json(Roles(), HttpStatusCode.Unauthorized);
        await ErrorAsync("credential_not_authenticated", () => provider.ValidateAsync(Kuro(), CancellationToken.None));
        context.Http.ResponseFactory = _ => new(HttpStatusCode.OK) { Content = new StreamingBody(new string(' ', 262145)) };
        await ErrorAsync("readonly_validation_failed", () => provider.ValidateAsync(Kuro(), CancellationToken.None));
        context.Http.ResponseFactory = _ => Json("not-json");
        await ErrorAsync("readonly_validation_failed", () => provider.ValidateAsync(Kuro(), CancellationToken.None));
        using var cancel = new CancellationTokenSource();
        cancel.Cancel();
        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => provider.ValidateAsync(Kuro(), cancel.Token));
    }

    private sealed class StreamingBody(string body) : HttpContent
    {
        protected override bool TryComputeLength(out long length) { length = 0; return false; }
        protected override Task SerializeToStreamAsync(Stream stream, TransportContext? context) => stream.WriteAsync(Encoding.UTF8.GetBytes(body)).AsTask();
        protected override Task<Stream> CreateContentReadStreamAsync() => Task.FromResult<Stream>(new MemoryStream(Encoding.UTF8.GetBytes(body)));
    }
}
