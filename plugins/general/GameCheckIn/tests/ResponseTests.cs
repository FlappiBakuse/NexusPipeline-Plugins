using System.Net;
using System.Text;
using System.Text.Json;
using NexusPipeline.Plugin.Abstractions;
using Xunit;

namespace NexusPipeline.Plugin.GameCheckIn.Tests;

public sealed class ResponseTests
{
    [Theory]
    [InlineData("{\"retcode\":0,\"data\":{\"risk_code\":0,\"is_risk\":false,\"gt\":\"\",\"challenge\":\"\"}}", null)]
    [InlineData("{\"retcode\":0,\"data\":{\"gt_result\":{\"risk_code\":1,\"is_risk\":true,\"gt\":\"synthetic\",\"challenge\":\"synthetic\"}}}", "captcha_required")]
    [InlineData("{\"retcode\":0,\"risk_code\":1,\"gt\":\"synthetic\",\"challenge\":\"synthetic\"}", "captcha_required")]
    [InlineData("{\"retcode\":0,\"data\":{\"is_risk\":true}}", "challenge_incomplete")]
    [InlineData("{\"retcode\":0,\"data\":{\"risk_code\":0,\"is_risk\":true}}", "verification_state_unknown")]
    [InlineData("{\"retcode\":0,\"data\":{\"gt\":null}}", "verification_state_unknown")]
    [InlineData("{\"retcode\":0,\"data\":{\"gt_result\":[]}}", "verification_state_unknown")]
    [InlineData("{\"retcode\":0,\"data\":{\"risk_code\":\"0\"}}", "verification_state_unknown")]
    [InlineData("{\"retcode\":0,\"data\":{\"gt\":\"synthetic\",\"challenge\":\"synthetic\"}}", "verification_state_unknown")]
    [InlineData("{\"retcode\":-100,\"message\":\"身份验证失败\",\"data\":{\"gt\":\"synthetic\"}}", "invalid_cookie")]
    [InlineData("{\"retcode\":-500,\"message\":\"captcha\"}", "rate_limited")]
    [InlineData("{\"retcode\":0,\"retcode\":0}", "verification_state_unknown")]
    [InlineData("{\"retcode\":\"0\"}", "verification_state_unknown")]
    [InlineData("[]", "verification_state_unknown")]
    public void SharedResponseClassifiesKnownScopesWithoutGuessing(string json, string? expected)
    {
        using JsonDocument document = JsonDocument.Parse(json);
        foreach (string platform in new[] { "os", "cn" })
        {
            CheckInResult? result = HoyoLabClient.ReadCommonResponse(document, platform, "gi");
            Assert.Equal(expected, result?.Code);
            Assert.False(result?.Success ?? false);
        }
    }

    [Theory]
    [InlineData("{\"retcode\":0,\"data\":{\"is_sign\":true}}", true)]
    [InlineData("{\"retcode\":0,\"data\":{\"is_sign\":false}}", false)]
    [InlineData("{\"retcode\":0,\"data\":{\"is_sign\":\"true\"}}", null)]
    [InlineData("{\"retcode\":0,\"data\":{\"is_sign\":true,\"isSign\":false}}", null)]
    public void SignedStateRequiresAnUnambiguousBoolean(string json, bool? expected)
    {
        using JsonDocument document = JsonDocument.Parse(json);
        Assert.Equal(expected, CheckInResponse.Signed(document));
    }

    [Fact]
    public async Task PostSuccessRequiresReadOnlyConfirmationAndNeverRetriesPost()
    {
        foreach (string confirmation in new[] { "{\"retcode\":0,\"data\":{\"is_sign\":true}}", "{\"retcode\":0,\"data\":{\"is_sign\":false}}", "not-json" })
        {
            var http = new Responses("{\"retcode\":0,\"data\":{\"is_sign\":false}}", "{\"retcode\":0}", confirmation);
            CheckInResult result = await new HoyoLabClient(http).SignAsync(GameDefinitions.All[0], "synthetic-cookie", CancellationToken.None);
            Assert.Equal(confirmation.Contains("true") ? "success" : "success_unconfirmed", result.Code);
            Assert.Equal(confirmation.Contains("true"), result.Success);
            Assert.Equal(new[] { HttpMethod.Get, HttpMethod.Post, HttpMethod.Get }, http.Methods);
        }
    }

    [Fact]
    public async Task AlreadySignedAndUnknownStatusNeverSubmit()
    {
        foreach ((string data, string code) in new[] { ("{\"is_sign\":true}", "already"), ("{}", "verification_state_unknown") })
        {
            var http = new Responses("{\"retcode\":0,\"data\":" + data + "}");
            CheckInResult result = await new HoyoLabClient(http).SignAsync(GameDefinitions.All[0], "synthetic-cookie", CancellationToken.None);
            Assert.Equal(code, result.Code);
            Assert.Equal(new[] { HttpMethod.Get }, http.Methods);
        }
    }

    [Fact]
    public async Task HttpContentSizeAndDuplicateFieldsFailClosed()
    {
        foreach (var input in new[]
        {
            (HttpStatusCode.Forbidden, "application/json", "{\"retcode\":0}"),
            (HttpStatusCode.OK, "text/html", "{\"retcode\":0}"),
            (HttpStatusCode.OK, "application/json", "{\"retcode\":0,\"data\":{\"is_sign\":true,\"is_sign\":false}}"),
            (HttpStatusCode.OK, "application/json", new string(' ', 262145)),
        })
        {
            using var response = new HttpResponseMessage(input.Item1) { Content = new StringContent(input.Item3, Encoding.UTF8, input.Item2) };
            await Assert.ThrowsAnyAsync<Exception>(async () => { using var _ = await CheckInResponse.ReadAsync(response, CancellationToken.None); });
        }
    }

    [Fact]
    public async Task DiagnosticsAreBoundedAndContainOnlyWhitelistedShapes()
    {
        const string sensitive = "synthetic-sensitive-canary";
        var diagnostics = new CheckInDiagnostics();
        using var root = JsonDocument.Parse("{\"retcode\":0,\"message\":\"" + sensitive + "\",\"cookie\":\"" + sensitive + "\",\"data\":{\"is_risk\":true,\"gt\":\"" + sensitive + "\",\"challenge\":\"" + sensitive + "\"}}");
        for (int i = 0; i < 100; i++) diagnostics.Response("os", "hsr", "sign", 200, root.RootElement, 12);
        Assert.Equal(32, diagnostics.Entries.Count);
        string json = JsonSerializer.Serialize(diagnostics.Entries);
        Assert.DoesNotContain(sensitive, json);
        Assert.Contains("captcha_required", json);
        Assert.All(diagnostics.Entries, item => Assert.Equal(1, item.Attempt));
        var http = new Responses("{\"retcode\":0,\"data\":{\"is_sign\":false}}", "{\"retcode\":0}", "{\"retcode\":0,\"data\":{\"is_sign\":true}}");
        var run = new CheckInDiagnostics();
        Assert.True((await new HoyoLabClient(http).SignAsync(GameDefinitions.All[0], sensitive, CancellationToken.None, run)).Success);
        Assert.Equal(new[] { "info", "sign", "confirm" }, run.Entries.Select(item => item.Phase));
        Assert.DoesNotContain(sensitive, JsonSerializer.Serialize(run.Entries));
    }

    private sealed class Responses(params string[] responses) : IPluginHttpClientFactory
    {
        private readonly Queue<string> _responses = new(responses);
        internal List<HttpMethod> Methods { get; } = [];
        public HttpClient CreateClient(Uri? destination = null, TimeSpan? timeout = null, bool allowAutoRedirect = false) => new(new Handler(this));
        private sealed class Handler(Responses owner) : HttpMessageHandler
        {
            protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
            {
                cancellationToken.ThrowIfCancellationRequested();
                owner.Methods.Add(request.Method);
                return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)
                {
                    Content = new StringContent(owner._responses.Dequeue(), Encoding.UTF8, "application/json"),
                });
            }
        }
    }
}
