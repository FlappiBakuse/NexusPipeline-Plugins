using System.Net;
using System.Text;
using NexusPipeline.Plugin.Abstractions;
using NexusPipeline.Plugin.HoyoLabCheckIn;
using Xunit;

namespace NexusPipeline.Plugin.HoyoLabCheckIn.Tests;

public sealed class HoyoLabCheckInTests
{
    [Fact]
    public void CookieValidation_UsesUtf8ByteLimitAndRejectsLineBreaks()
    {
        Assert.True(CheckInService.IsValidCookie(new string('a', 16 * 1024)));
        Assert.False(CheckInService.IsValidCookie(new string('a', 16 * 1024 + 1)));
        Assert.False(CheckInService.IsValidCookie(new string('中', 6000)));
        Assert.False(CheckInService.IsValidCookie("ltuid=1\r\nltoken=2"));
        Assert.False(CheckInService.IsValidCookie("   "));
    }

    [Fact]
    public void UserSettingsNormalize_RemovesUnknownGamesAndNormalizesStateKeys()
    {
        var settings = new UserSettings
        {
            Games = new List<string> { "GI", "gi", "unknown", "zzz" },
            GameState = new Dictionary<string, GameState>(StringComparer.Ordinal)
            {
                ["GI"] = new GameState { LastSuccessDate = "2026-08-28" },
            },
        };

        settings.Normalize();

        Assert.Equal(new[] { "gi", "zzz" }, settings.Games);
        Assert.True(settings.GameState.ContainsKey("gi"));
        Assert.True(settings.GameState.ContainsKey("GI"));
    }

    [Theory]
    [InlineData(0, "success", true)]
    [InlineData(-5003, "already", true)]
    [InlineData(-100, "invalid_cookie", false)]
    [InlineData(-10002, "game_not_available", false)]
    [InlineData(12345, "api_error", false)]
    public async Task ClientMapsRetcodesAndSendsRequiredHeaders(int retcode, string expectedCode, bool success)
    {
        var factory = new TestHttpClientFactory($"{{\"retcode\":{retcode}}}");
        var client = new HoyoLabClient(factory);

        CheckInResult result = await client.SignAsync(
            GameDefinitions.All[0],
            "ltuid=1; ltoken=secret",
            CancellationToken.None);

        Assert.Equal(expectedCode, result.Code);
        Assert.Equal(success, result.Success);
        Assert.NotNull(factory.Request);
        Assert.Equal(HttpMethod.Post, factory.Request!.Method);
        Assert.Equal("https://act.hoyolab.com", factory.Request.Headers.GetValues("Origin").Single());
        Assert.Equal("https://act.hoyolab.com/", factory.Request.Headers.Referrer?.ToString());
        Assert.Equal("ltuid=1; ltoken=secret", factory.Request.Headers.GetValues("Cookie").Single());
        Assert.Equal("gi", factory.Request.Headers.GetValues("x-rpc-signgame").Single());
        Assert.Contains("Mozilla/5.0", factory.Request.Headers.UserAgent.ToString(), StringComparison.Ordinal);
    }

    private sealed class TestHttpClientFactory : IPluginHttpClientFactory
    {
        private readonly string _response;

        public TestHttpClientFactory(string response)
        {
            _response = response;
        }

        public HttpRequestMessage? Request { get; private set; }

        public HttpClient CreateClient(
            Uri? destination = null,
            TimeSpan? timeout = null,
            bool allowAutoRedirect = false)
        {
            return new HttpClient(new CaptureHandler(request => Request = request, _response));
        }
    }

    private sealed class CaptureHandler : HttpMessageHandler
    {
        private readonly Action<HttpRequestMessage> _capture;
        private readonly string _response;

        public CaptureHandler(Action<HttpRequestMessage> capture, string response)
        {
            _capture = capture;
            _response = response;
        }

        protected override Task<HttpResponseMessage> SendAsync(
            HttpRequestMessage request,
            CancellationToken cancellationToken)
        {
            _capture(request);
            var response = new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(_response, Encoding.UTF8, "application/json"),
            };
            return Task.FromResult(response);
        }
    }
}
