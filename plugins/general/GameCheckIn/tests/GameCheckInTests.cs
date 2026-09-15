using System.Net;
using System.Text;
using NexusPipeline.Plugin.Abstractions;
using Xunit;

namespace NexusPipeline.Plugin.GameCheckIn.Tests;

public sealed class GameCheckInTests
{
    [Fact]
    public void Normalize_UpgradesV2SettingsAndKeepsAllCurrentPlatformKeys()
    {
        var settings = new UserSettings
        {
            SchemaVersion = 2,
            CnGames = new List<string> { "GI" },
            OsGames = new List<string> { "zzz", "unknown" },
            SklandGames = new List<string> { "AK", "endfield" },
            SkportGames = new List<string> { "endfield", "ak" },
            KuroGames = new List<string> { "WW", "pgr", "unknown" },
            GameState = new Dictionary<string, GameState>
            {
                ["CN:GI"] = new GameState { LastSuccessDate = "2026-08-28" },
                ["OS:BH3"] = new GameState { LastResult = "already" },
                ["SKPORT:ENDFIELD"] = new GameState { LastResult = "credential_expired" },
                ["invalid:game"] = new GameState { LastResult = "success" },
            },
        };

        settings.Normalize();

        Assert.Equal(new[] { "gi" }, settings.CnGames);
        Assert.Equal(new[] { "zzz" }, settings.OsGames);
        Assert.Equal(new[] { "ak", "endfield" }, settings.SklandGames);
        Assert.Equal(new[] { "endfield" }, settings.SkportGames);
        Assert.Equal(new[] { "ww", "pgr" }, settings.KuroGames);
        Assert.Equal(3, settings.SchemaVersion);
        Assert.True(settings.GameState.ContainsKey("cn:gi"));
        Assert.True(settings.GameState.ContainsKey("os:bh3"));
        Assert.True(settings.GameState.ContainsKey("skport:endfield"));
        Assert.False(settings.GameState.ContainsKey("invalid:game"));
        Assert.True(Guid.TryParse(settings.CnDeviceId, out _));
        Assert.NotEmpty(settings.KuroDevCode);
        Assert.NotEmpty(settings.KuroDistinctId);
    }

    [Fact]
    public void Badge_SeparatesPlatformCookieConfiguration()
    {
        var settings = new UserSettings
        {
            CnGames = new List<string> { "gi" },
            OsGames = new List<string> { "hsr" },
        };

        PluginUserListBadge? badge = UserListBadgeContribution.Build(
            settings,
            "stuid=1",
            null,
            null,
            null,
            null,
            "2026-08-28");

        Assert.NotNull(badge);
        Assert.Equal("签到 · 部分未配置", badge!.Label);
    }

    [Fact]
    public void Badge_AllowsOnlyOnePlatformToBeConfigured()
    {
        var settings = new UserSettings
        {
            OsGames = new List<string> { "gi" },
        };

        PluginUserListBadge? badge = UserListBadgeContribution.Build(
            settings,
            null,
            "ltuid=1",
            null,
            null,
            null,
            "2026-08-28");

        Assert.NotNull(badge);
        Assert.Equal("签到 · 待签到", badge!.Label);
    }

    [Fact]
    public void DsHeader_UsesTimestampRandomAndMd5Fields()
    {
        string ds = MiyousheClient.GenerateDs();
        string[] parts = ds.Split(',');

        Assert.Equal(3, parts.Length);
        Assert.Equal(6, parts[1].Length);
        Assert.All(parts[1], character => Assert.Contains(character, "abcdefghijklmnopqrstuvwxyz0123456789"));
        Assert.Matches("^[0-9a-f]{32}$", parts[2]);
    }

    [Fact]
    public void CredentialFingerprint_IsStableWithoutExposingCredential()
    {
        string first = CheckInService.CredentialFingerprint("token-value");
        string second = CheckInService.CredentialFingerprint("token-value");

        Assert.Equal(first, second);
        Assert.Matches("^[0-9a-f]{64}$", first);
        Assert.NotEqual("token-value", first);
        Assert.Equal("", CheckInService.CredentialFingerprint("token\nvalue"));
    }

    [Fact]
    public async Task HoyoLabClient_QueriesInfoBeforeSigning()
    {
        var factory = new QueueHttpClientFactory(
            "{\"retcode\":0,\"data\":{\"is_sign\":false}}",
            "{\"retcode\":0}");
        var client = new HoyoLabClient(factory);

        CheckInResult result = await client.SignAsync(GameDefinitions.All[0], "ltuid=1; ltoken=secret", CancellationToken.None);

        Assert.Equal("success", result.Code);
        Assert.Equal(2, factory.Requests.Count);
        Assert.Equal(HttpMethod.Get, factory.Requests[0].Method);
        Assert.Contains("/info?", factory.Requests[0].RequestUri!.ToString(), StringComparison.Ordinal);
        Assert.Equal(HttpMethod.Post, factory.Requests[1].Method);
    }

    [Fact]
    public async Task MiyousheClient_DiscoversRoleThenSendsDsAndSigns()
    {
        var factory = new QueueHttpClientFactory(
            "{\"retcode\":0,\"data\":{\"list\":[{\"game_uid\":\"1001\",\"region\":\"cn_gf01\"}]}}",
            "{\"retcode\":0,\"data\":{\"is_sign\":false}}",
            "{\"retcode\":0}");
        var client = new MiyousheClient(factory);

        CheckInResult result = await client.SignAsync(GameDefinitions.All[0], "stuid=1;stoken=secret", "device-id", CancellationToken.None);

        Assert.Equal("success", result.Code);
        Assert.Equal(3, factory.Requests.Count);
        Assert.Equal("cn_gf01", factory.Requests[1].RequestUri!.Query.Contains("region=cn_gf01", StringComparison.Ordinal) ? "cn_gf01" : "");
        Assert.True(factory.Requests[1].Headers.Contains("DS"));
        Assert.Equal("miyousheluodi", factory.Requests[0].Headers.GetValues("x-rpc-channel").Single());
        Assert.Equal("device-id", factory.Requests[2].Headers.GetValues("x-rpc-device_id").Single());
    }

    [Fact]
    public async Task HoyoLabClient_StopsWhenCaptchaIsReturned()
    {
        var factory = new QueueHttpClientFactory("{\"retcode\":0,\"data\":{\"gt\":\"challenge\"}}", "{\"retcode\":0}");
        CheckInResult result = await new HoyoLabClient(factory).SignAsync(GameDefinitions.All[0], "ltuid=1", CancellationToken.None);

        Assert.Equal("captcha_required", result.Code);
        Assert.Single(factory.Requests);
    }

    [Fact]
    public async Task HoyoLabClient_UsesManiEndpointForHonkaiImpact3rd()
    {
        var factory = new QueueHttpClientFactory(
            "{\"retcode\":0,\"data\":{\"is_sign\":false}}",
            "{\"retcode\":0}");

        CheckInResult result = await new HoyoLabClient(factory).SignAsync(
            GameDefinitions.Find("bh3")!,
            "ltuid=1; ltoken=secret",
            CancellationToken.None);

        Assert.Equal("success", result.Code);
        Assert.Contains("/event/mani/info", factory.Requests[0].RequestUri!.AbsolutePath, StringComparison.Ordinal);
        Assert.Equal("honkai3rd", factory.Requests[0].Headers.GetValues("x-rpc-signgame").Single());
    }

    [Fact]
    public void SklandSigner_MatchesKnownBodyAndHeaderVector()
    {
        string sign = SklandClient.ComputeSign(
            "sign-token",
            "/api/v1/game/attendance",
            "{\"gameId\":\"1\",\"uid\":\"u\"}",
            "1700000000",
            "device-1",
            "3",
            "1.0.0");

        Assert.Equal("5e3b1772dd282fa234eb98493d2a5be8", sign);
    }

    [Fact]
    public void SklandDeviceFingerprint_UsesNumberSmFieldMapping()
    {
        var fields = SklandDeviceFingerprintProvider.ObfuscateFields(
            new Dictionary<string, object?>
            {
                ["box"] = "",
                ["appId"] = "default",
                ["protocol"] = 102,
            },
            encryptValues: false);

        Assert.Equal("", fields["jf"]);
        Assert.Equal("default", fields["xx"]);
        Assert.Equal(102, fields["protocol"]);
        Assert.False(fields.ContainsKey("box"));
    }

    [Fact]
    public async Task SkportClient_UsesIndependentAuthAndEndfieldProfile()
    {
        var factory = new QueueHttpClientFactory(
            "{\"status\":0,\"data\":{\"code\":\"grant\"}}",
            "{\"code\":0,\"data\":{\"cred\":\"cred\",\"token\":\"sign\"}}",
            "{\"code\":0,\"data\":{\"list\":[{\"appCode\":\"endfield\",\"bindingList\":[{\"uid\":\"u\",\"channelMasterId\":\"3\",\"roles\":[{\"roleId\":\"role\",\"serverId\":\"server\"}]}]}]}}",
            "{\"code\":0}");
        var client = new SklandClient(factory, "skport", _ => Task.FromResult("Bdevice"));

        CheckInResult result = await client.SignAsync(
            SkportGameDefinitions.Find("endfield")!,
            "passport-token",
            CancellationToken.None);

        Assert.True(result.Success);
        Assert.Contains("as.gryphline.com", factory.Requests[0].RequestUri!.Host, StringComparison.Ordinal);
        Assert.Contains("zonai.skport.com", factory.Requests[1].RequestUri!.Host, StringComparison.Ordinal);
        Assert.Contains("zonai.skport.com", factory.Requests[2].RequestUri!.Host, StringComparison.Ordinal);
        Assert.Equal("Bdevice", factory.Requests[0].Headers.GetValues("dId").Single());
        Assert.Equal("Bdevice", factory.Requests[1].Headers.GetValues("dId").Single());
        Assert.Equal("", factory.Requests[2].Headers.GetValues("dId").Single());
        Assert.Equal("3", factory.Requests[2].Headers.GetValues("platform").Single());
        Assert.Equal("", factory.Requests[3].Headers.GetValues("dId").Single());
        Assert.Equal("3_role_server", factory.Requests[3].Headers.GetValues("sk-game-role").Single());
        HttpContent? attendanceContent = factory.Requests[3].Content;
        Assert.NotNull(attendanceContent);
        Assert.Equal("application/json", attendanceContent!.Headers.ContentType!.MediaType);
        Assert.Equal(0, attendanceContent.Headers.ContentLength);
        string grantBody = factory.Bodies[0];
        Assert.Contains("6eb76d4e13aa36e6", grantBody, StringComparison.Ordinal);
    }

    [Fact]
    public async Task SklandClient_MapsForbiddenAlreadySignedResponse()
    {
        var factory = new QueueHttpClientFactory(
            new[]
            {
                HttpStatusCode.OK,
                HttpStatusCode.OK,
                HttpStatusCode.OK,
                HttpStatusCode.Forbidden,
            },
            "{\"status\":0,\"data\":{\"code\":\"grant\"}}",
            "{\"code\":0,\"data\":{\"cred\":\"cred\",\"token\":\"sign\"}}",
            "{\"code\":0,\"data\":{\"list\":[{\"appCode\":\"endfield\",\"bindingList\":[{\"uid\":\"u\",\"channelMasterId\":\"3\",\"roles\":[{\"roleId\":\"role\",\"serverId\":\"server\"}]}]}]}}",
            "{\"code\":10001,\"message\":\"请勿重复签到！\"}");

        CheckInResult result = await new SklandClient(
            factory,
            "skland",
            _ => Task.FromResult("device"))
            .SignAsync(
                SklandGameDefinitions.Find("endfield")!,
                "passport-token",
                CancellationToken.None);

        Assert.True(result.Success);
        Assert.Equal("already", result.Code);
    }

    [Fact]
    public async Task KuroClient_SubmitsFormEncodedGameSignAndMapsAlready()
    {
        var factory = new QueueHttpClientFactory(
            "{\"code\":200,\"data\":[{\"gameId\":\"3\",\"roleId\":\"role\",\"serverId\":\"server\",\"userId\":\"user\"}]}",
            "{\"code\":1511,\"msg\":\"already\"}");

        CheckInResult result = await new KuroClient(factory).SignAsync(
            KuroGameDefinitions.Find("ww")!,
            "kuro-token",
            "dev-code",
            "distinct-id",
            CancellationToken.None);

        Assert.Equal("already", result.Code);
        Assert.Equal("kuro-token", factory.Requests[0].Headers.GetValues("token").Single());
        string body = factory.Bodies[1];
        Assert.Contains("gameId=3", body, StringComparison.Ordinal);
        Assert.Contains("roleId=role", body, StringComparison.Ordinal);
        Assert.Contains("serverId=server", body, StringComparison.Ordinal);
        Assert.Contains("userId=user", body, StringComparison.Ordinal);
        Assert.Contains("reqMonth=", body, StringComparison.Ordinal);
    }

    private sealed class QueueHttpClientFactory : IPluginHttpClientFactory
    {
        private readonly Queue<string> _responses;
        private readonly Queue<HttpStatusCode> _statuses;

        public QueueHttpClientFactory(params string[] responses)
            : this(Enumerable.Repeat(HttpStatusCode.OK, responses.Length).ToArray(), responses)
        {
        }

        public QueueHttpClientFactory(HttpStatusCode[] statuses, params string[] responses)
        {
            _responses = new Queue<string>(responses);
            _statuses = new Queue<HttpStatusCode>(statuses);
            if (_statuses.Count != _responses.Count)
            {
                throw new ArgumentException("每个测试响应都必须提供一个 HTTP 状态码", nameof(statuses));
            }
        }

        public List<HttpRequestMessage> Requests { get; } = new();

        public List<string> Bodies { get; } = new();

        public HttpClient CreateClient(Uri? destination = null, TimeSpan? timeout = null, bool allowAutoRedirect = false) =>
            new(new CaptureHandler(
                request => Requests.Add(request),
                body => Bodies.Add(body),
                () => _responses.Count > 0 ? _responses.Dequeue() : "{\"retcode\":0}",
                () => _statuses.Count > 0 ? _statuses.Dequeue() : HttpStatusCode.OK));
    }

    private sealed class CaptureHandler : HttpMessageHandler
    {
        private readonly Action<HttpRequestMessage> _capture;
        private readonly Action<string> _captureBody;
        private readonly Func<string> _response;
        private readonly Func<HttpStatusCode> _status;

        public CaptureHandler(
            Action<HttpRequestMessage> capture,
            Action<string> captureBody,
            Func<string> response,
            Func<HttpStatusCode> status)
        {
            _capture = capture;
            _captureBody = captureBody;
            _response = response;
            _status = status;
        }

        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            _capture(request);
            if (request.Content is not null)
            {
                _captureBody(await request.Content.ReadAsStringAsync(cancellationToken));
            }
            return new HttpResponseMessage(_status())
            {
                Content = new StringContent(_response(), Encoding.UTF8, "application/json"),
            };
        }
    }
}
