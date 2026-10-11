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
    private const string CnUser = "{\"retcode\":0,\"data\":{\"user_info\":{\"uid\":\"123456\"}}}";
    private const string KuroUser = "{\"code\":200,\"data\":{\"mine\":{\"userId\":12345678}}}";

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
            if (request.RequestUri!.AbsolutePath.EndsWith("/getUserFullInfo"))
            {
                Assert.Equal("?gids=2", request.RequestUri.Query);
                return Json(CnUser);
            }
            return Json(request.RequestUri.AbsolutePath.EndsWith("/info") ? "{\"retcode\":0,\"data\":{\"is_sign\":false}}"
                : "{\"retcode\":0,\"data\":{\"list\":[{\"game_uid\":\"987654321\",\"region\":\"cn_gf01\"}]}}");
        };
        var provider = new MiyousheLoginProvider(context.Http);
        var result = await provider.ValidateAsync(Cn(), CancellationToken.None);
        Assert.Equal("browser", result.Source);
        Assert.Equal(MiyousheLoginProvider.Normalize(Cn()), result.Value);
        Assert.Equal("cn · 12**56", result.MaskedAccount);
        Assert.Equal(3, context.Http.Requests.Count);
        Assert.Equal("/binding/api/getUserGameRolesByCookieToken", context.Http.Requests[1].RequestUri!.AbsolutePath);
        Assert.Contains("uid=987654321", context.Http.Requests[2].RequestUri!.Query);
        context.Http.ResponseFactory = r => Json(r.RequestUri!.AbsolutePath.EndsWith("/getUserFullInfo") ? CnUser : "{\"retcode\":0,\"data\":{\"list\":[]}}");
        Assert.Equal("cn · 12**56", (await provider.ValidateAsync(Cn(), CancellationToken.None)).MaskedAccount);
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
            Assert.Equal("raw-token", request.Headers.GetValues("token").Single());
            Assert.Equal("h5", request.Headers.GetValues("source").Single());
            Assert.False(request.Headers.Contains("x-requested-with"));
            if (request.RequestUri!.AbsolutePath == "/user/mineV2") return Json(KuroUser);
            Assert.Equal("/user/role/findRoleList", request.RequestUri.AbsolutePath);
            gameIds.Add(request.Content!.ReadAsStringAsync().GetAwaiter().GetResult());
            return Json(Roles());
        };
        var provider = new KuroLoginProvider(context.Http);
        var result = await provider.ValidateAsync(Kuro(), CancellationToken.None);
        Assert.Equal("raw-token", result.Value);
        Assert.Equal("kuro · 12****78", result.MaskedAccount);
        Assert.Equal(2, gameIds.Count);
        context.Http.ResponseFactory = r => Json(r.RequestUri!.AbsolutePath == "/user/mineV2" ? KuroUser : "{\"code\":200,\"data\":[]}");
        Assert.Equal(result.MaskedAccount, (await provider.ValidateAsync(Kuro(), CancellationToken.None)).MaskedAccount);
        int count = 0;
        context.Http.ResponseFactory = r => Json(r.RequestUri!.AbsolutePath == "/user/mineV2" ? KuroUser : Roles(++count == 1 ? "12345678" : "88888888"));
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
            string accountId = "12345678";
            context.Http.ResponseFactory = request =>
            {
                string host = request.RequestUri!.Host;
                string path = request.RequestUri.AbsolutePath;
                string device = request.Headers.GetValues("dId").SingleOrDefault() ?? "";
                if (platform == "skport")
                {
                    Assert.Equal("", device);
                    Assert.False(request.Headers.Contains("X-Requested-With"));
                    Assert.DoesNotContain("Android", request.Headers.UserAgent.ToString());
                }
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
                return path == (platform == "skland" ? "/web/v1/user" : "/web/v2/user") ? Json(PassportUser(platform, JsonSerializer.Serialize(new { id = accountId })))
                    : path == "/api/v1/game/player/binding" ? Json("{\"code\":0,\"data\":{\"list\":[]}}") : throw new InvalidOperationException("Unexpected business write");
            };
            var client = new SklandClient(context.Http, platform, _ => Task.FromResult("test-device"));
            Assert.Equal(platform + " · 12****78", await client.ValidateCredentialAsync("raw-passport", CancellationToken.None));
            Assert.Equal(4, context.Http.Requests.Count);
            var capture = new PluginBrowserCapture([], [], DateTimeOffset.UtcNow) { JsonValues = [new("passport-token", "raw-passport")] };
            if (platform == "skland") capture = capture with { Storage = [new("https://www.skland.com", "localStorage", "SK_SHUMEI_DEVICE_ID_KEY", "{\"id\":\"Btest_device\",\"timestamp\":123}")] };
            var provider = new PassportLoginProvider(context.Http, platform);
            var record = await provider.ValidateAsync(capture, CancellationToken.None);
            Assert.Equal("raw-passport", record.Value);
            Assert.Equal("browser", record.Source);
            Assert.Equal(platform + " · 12****78", record.MaskedAccount);
            Error("credential_fields_missing", () => PassportLoginProvider.Normalize(capture with { JsonValues = [] }));
            Error("credential_capture_invalid", () => PassportLoginProvider.Normalize(capture with { JsonValues = [.. capture.JsonValues, .. capture.JsonValues] }));
            Error("credential_capture_invalid", () => PassportLoginProvider.Normalize(capture with { JsonValues = [new("unapproved", "raw-passport")] }));
            var flow = PassportLoginProvider.Flow(platform, true);
            Assert.Equal("https://web-api." + platform + ".com", new Uri(flow.JsonRequests.Single().Uri).GetLeftPart(UriPartial.Authority));
            Assert.Empty(flow.Cookies);
            Assert.Equal(platform == "skland" ? 1 : 0, flow.Storage.Count);
            if (platform == "skland")
            {
                Assert.Equal("Btest_device", record.WebContext!.DeviceId);
                Assert.All(context.Http.Requests.Skip(4), r => Assert.Equal("Btest_device", r.Headers.GetValues("dId").Single()));
                foreach (string id in new[] { "Bopaque/device+id==", "Dopaque/device+id==", "B" + new string('a', 2048) })
                {
                    context.Http.Requests.Clear();
                    var opaque = capture with { Storage = [capture.Storage[0] with { Value = JsonSerializer.Serialize(new { id }) }] };
                    Assert.Equal(id, (await provider.ValidateAsync(opaque, CancellationToken.None)).WebContext!.DeviceId);
                    Assert.All(context.Http.Requests, r => Assert.Equal(id, r.Headers.GetValues("dId").Single()));
                }
                await ErrorAsync("credential_device_missing", () => provider.ValidateAsync(capture with { Storage = [] }, CancellationToken.None));
            }
            foreach (string id in new[] { "a8a27d50-02bb-4a52-aa8f-915f9419e02a", new string('a', 64), new string('1', 40) })
            {
                accountId = id;
                context.Http.Requests.Clear();
                var opaque = await provider.ValidateAsync(capture, CancellationToken.None);
                Assert.Equal(CredentialValidation.MaskPassportIdentity(platform, id), opaque.MaskedAccount);
                Assert.DoesNotContain(id, opaque.MaskedAccount!);
                Assert.Equal(4, context.Http.Requests.Count);
                Assert.Equal(PassportLoginProvider.FlowVersion(platform), opaque.FlowVersion);
            }
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
                ? "{\"code\":0,\"data\":{\"cred\":\"derived-cred\",\"token\":\"derived-sign-token\"}}" : PassportUser(platform, "{\"id\":\"\"}"));
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
            foreach (var (user, error) in new[]
            {
                ("{}", "readonly_validation_failed"),
                ("{\"id\":null}", "readonly_validation_failed"),
                ("{\"id\":123456}", "readonly_validation_failed"),
                ("{\"id\":\"first-id\",\"id\":\"second-id\"}", "readonly_validation_failed"),
                ("{\"id\":\"\"}", "readonly_identity_unverified"),
                ("{\"id\":\"bad id\"}", "readonly_identity_unverified"),
                (JsonSerializer.Serialize(new { id = new string('a', 129) }), "readonly_identity_unverified"),
            })
            {
                context.Http.Requests.Clear();
                context.Http.ResponseFactory = request => Json(request.RequestUri!.AbsolutePath.EndsWith("/grant")
                    ? "{\"status\":0,\"data\":{\"code\":\"auth-code\"}}" : request.RequestUri.AbsolutePath.EndsWith("/generate_cred_by_code")
                    ? "{\"code\":0,\"data\":{\"cred\":\"derived\",\"token\":\"sign-token\"}}" : PassportUser(platform, user));
                await ErrorAsync(error, () => client.ValidateCredentialAsync("raw-passport", CancellationToken.None));
                Assert.Equal(3, context.Http.Requests.Count);
            }
            foreach (string user in platform == "skport" ? new[]
            {
                "{\"id\":\"wrong-path-id\"}",
                "{\"basicUser\":null,\"id\":\"wrong-path-id\"}",
                "{\"basicUser\":[],\"id\":\"wrong-path-id\"}",
                "{\"basicUser\":{\"id\":\"first-id\"},\"basicUser\":{\"id\":\"second-id\"}}"
            } : new[] { "{\"basicUser\":{\"id\":\"wrong-path-id\"}}" })
            {
                context.Http.Requests.Clear();
                context.Http.ResponseFactory = request => Json(request.RequestUri!.AbsolutePath.EndsWith("/grant")
                    ? "{\"status\":0,\"data\":{\"code\":\"auth-code\"}}" : request.RequestUri.AbsolutePath.EndsWith("/generate_cred_by_code")
                    ? "{\"code\":0,\"data\":{\"cred\":\"derived\",\"token\":\"sign-token\"}}" : "{\"code\":0,\"data\":{\"user\":" + user + "}}");
                await ErrorAsync("readonly_validation_failed", () => client.ValidateCredentialAsync("raw-passport", CancellationToken.None));
                Assert.Equal(3, context.Http.Requests.Count);
            }
        }
    }

    private static string PassportUser(string platform, string account) => "{\"code\":0,\"data\":{\"user\":"
        + (platform == "skport" ? "{\"id\":\"unrelated-user-id\",\"basicUser\":" + account + "}" : account) + "}}";

    [Fact]
    public async Task ProviderCallbacksKeepCandidatesProvisionalAndCancelWithoutChangingExistingCredentials()
    {
        foreach (string platform in new[] { "cn", "kuro" })
        {
            var context = new FakePluginHostContext("game-check-in");
            context.Http.ResponseFactory = request => Json(platform == "kuro" ? request.RequestUri!.AbsolutePath == "/user/mineV2" ? KuroUser : Roles()
                : request.RequestUri!.AbsolutePath.EndsWith("/getUserFullInfo") ? CnUser
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
    public async Task ValidationDiagnosticsIdentifyStageWithoutSecretsAndFailuresDoNotPublishCandidates()
    {
        foreach (string platform in new[] { "cn", "kuro", "skland", "skport" })
        {
            var context = new FakePluginHostContext("game-check-in");
            context.Http.ResponseFactory = request => request.RequestUri!.AbsolutePath.EndsWith("/grant")
                ? Json("{\"status\":0,\"data\":{\"code\":\"private-grant\"}}")
                : request.RequestUri.AbsolutePath.EndsWith("/generate_cred_by_code")
                ? Json("{\"code\":0,\"data\":{\"cred\":\"private-derived\",\"token\":\"private-sign\"}}")
                : Json("private-response-account-12345678", HttpStatusCode.NotFound);
            using var drafts = new CredentialDraftService();
            using var flows = new GameCheckInLoginFlows(context, drafts);
            var client = new PluginClientSessionContext("host", "client", "desktop", true);
            var editor = drafts.Create(client, null, new Dictionary<string, string?> { [platform] = "old-secret" });
            var prepare = drafts.Prepare(client, editor.EditorSessionId, platform, 0);
            var invocation = new PluginBrowserInvocation(Guid.NewGuid().ToString("N"), editor.EditorSessionId, prepare.FieldGeneration, prepare.Context, client);
            PluginBrowserCapture capture = platform == "cn" ? Cn() : platform == "kuro" ? Kuro()
                : new([], [], DateTimeOffset.UtcNow) { JsonValues = [new("passport-token", "raw-passport")] };
            if (platform == "skland") capture = capture with { Storage = [new("https://www.skland.com", "localStorage", "SK_SHUMEI_DEVICE_ID_KEY", "{\"id\":\"Bprivate_device\"}")] };
            var result = await context.BrowserLogin.Flows[platform].Complete(capture, invocation, CancellationToken.None);
            Assert.False(result.Success);
            Assert.Equal("readonly_validation_failed", result.Error);
            Assert.Null(drafts.State(client, editor.EditorSessionId).Fields[platform].CandidateId);
            var entry = Assert.Single(context.Logger.Entries);
            Assert.Contains("platform=" + platform, entry.Message);
            Assert.Contains("stage=current_user http=404 business=- result=readonly_validation_failed", entry.Message);
            foreach (string secret in new[] { "cookie-secret", "raw-token", "raw-passport", "private", "12345678", "old-secret" }) Assert.DoesNotContain(secret, entry.Message);
        }
        var logger = new RecordingPluginLogger();
        var trace = new LoginValidationTrace("skland", "untrusted-operation\nsecret", logger);
        trace.Stage("credential_exchange"); trace.Response(HttpStatusCode.OK);
        using var rejected = JsonDocument.Parse("{\"code\":10002,\"message\":\"private-response\"}");
        trace.Body(rejected.RootElement); trace.Finish("credential_not_authenticated");
        Assert.Equal("browser_validation platform=skland operation=- stage=credential_exchange http=200 business=10002 result=credential_not_authenticated", Assert.Single(logger.Entries).Message);
    }

    [Fact]
    public void RegistrationEnablesQualifiedPlatformsAndDisposesBindings()
    {
        var context = new FakePluginHostContext("game-check-in");
        using var drafts = new CredentialDraftService();
        using (var flows = new GameCheckInLoginFlows(context, drafts))
        {
            Assert.Equal(new[] { "cn", "kuro", "os", "skland", "skport" }, context.BrowserLogin.Flows.Keys.Order().ToArray());
            Assert.All(context.BrowserLogin.Flows.Values, flow => Assert.True(flow.Spec.Ready));
            var starts = new Dictionary<string, string> { ["cn"] = "https://www.miyoushe.com/ys/", ["os"] = "https://www.hoyolab.com/",
                ["skland"] = "https://www.skland.com/", ["skport"] = "https://www.skport.com/", ["kuro"] = "https://www.kurobbs.com/mc/home/9" };
            foreach (var (platform, start) in starts)
            {
                var spec = context.BrowserLogin.Flows[platform].Spec;Assert.Equal(new Uri(start).AbsoluteUri, new Uri(spec.StartUri).AbsoluteUri);
                if (platform == "os") Assert.Null(spec.PageBootstrap);
                else { Assert.Equal(new Uri(start).GetLeftPart(UriPartial.Authority), spec.PageBootstrap!.Origin);
                    Assert.Equal(new Uri(start).AbsolutePath, spec.PageBootstrap.Path);Assert.NotEmpty(spec.PageBootstrap.Script); }
            }

            Assert.True(flows.Ready("skland"));
            Assert.True(flows.Ready("skport"));
            Assert.False(flows.Ready("unknown"));
            Assert.All(GameCheckInLoginFlows.Readiness, p => Assert.Equal("passed", p.Status));
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
