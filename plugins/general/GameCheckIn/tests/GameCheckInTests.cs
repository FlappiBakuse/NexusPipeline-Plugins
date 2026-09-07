using System.Net;
using System.Text;
using NexusPipeline.Plugin.Abstractions;
using Xunit;

namespace NexusPipeline.Plugin.GameCheckIn.Tests;

public sealed class GameCheckInTests
{
    [Fact]
    public void Normalize_ValidatesCurrentGamesAndPrefixesStateKeys()
    {
        var settings = new UserSettings
        {
            CnGames = new List<string> { "GI" },
            OsGames = new List<string> { "zzz", "unknown" },
            GameState = new Dictionary<string, GameState>
            {
                ["CN:GI"] = new GameState { LastSuccessDate = "2026-08-28" },
            },
        };

        settings.Normalize();

        Assert.Equal(new[] { "gi" }, settings.CnGames);
        Assert.Equal(new[] { "zzz" }, settings.OsGames);
        Assert.True(settings.GameState.ContainsKey("cn:gi"));
        Assert.True(Guid.TryParse(settings.CnDeviceId, out _));
    }

    [Fact]
    public void Badge_SeparatesPlatformCookieConfiguration()
    {
        var settings = new UserSettings
        {
            CnGames = new List<string> { "gi" },
            OsGames = new List<string> { "hsr" },
        };

        PluginUserListBadge? badge = UserListBadgeContribution.Build(settings, "ltuid=1", null, "2026-08-28");

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

        PluginUserListBadge? badge = UserListBadgeContribution.Build(settings, null, "ltuid=1", "2026-08-28");

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

    private sealed class QueueHttpClientFactory : IPluginHttpClientFactory
    {
        private readonly Queue<string> _responses;

        public QueueHttpClientFactory(params string[] responses) { _responses = new Queue<string>(responses); }

        public List<HttpRequestMessage> Requests { get; } = new();

        public HttpClient CreateClient(Uri? destination = null, TimeSpan? timeout = null, bool allowAutoRedirect = false) =>
            new(new CaptureHandler(request => Requests.Add(request), () => _responses.Count > 0 ? _responses.Dequeue() : "{\"retcode\":0}"));
    }

    private sealed class CaptureHandler : HttpMessageHandler
    {
        private readonly Action<HttpRequestMessage> _capture;
        private readonly Func<string> _response;

        public CaptureHandler(Action<HttpRequestMessage> capture, Func<string> response)
        {
            _capture = capture;
            _response = response;
        }

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            _capture(request);
            return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(_response(), Encoding.UTF8, "application/json"),
            });
        }
    }
}
