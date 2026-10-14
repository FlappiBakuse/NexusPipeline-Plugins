using System.Net;
using System.Text;
using NexusPipeline.Plugin.Abstractions;
using Xunit;

namespace NexusPipeline.Plugin.GameCheckIn.Tests;

public sealed class TajiduoTests
{
    private const string Credential = "{\"accessToken\":\"access.old=value\",\"refreshToken\":\"refresh.old=value\",\"uid\":\"100\",\"deviceId\":\"device\"}";
    private const string Refresh = "{\"code\":0,\"data\":{\"accessToken\":\"access.new=value\",\"refreshToken\":\"refresh.new=value\",\"uid\":\"100\"}}";
    private const string Roles = "{\"code\":0,\"data\":{\"roles\":[{\"roleId\":9007199254740993}]}}";
    private const string Before = "{\"code\":0,\"data\":{\"todaySign\":false,\"days\":2}}";
    private const string After = "{\"code\":0,\"data\":{\"todaySign\":true,\"days\":3}}";

    [Fact]
    public async Task SignsSelectedGameAfterDurableRefreshAndConfirmsState()
    {
        var transport = new Responses(Refresh, Roles, Before, "{\"code\":0}", After);
        string? saved = null;
        var result = await new TajiduoClient(transport).SignAsync(Credential, value =>
        {
            Assert.Single(transport.Requests);
            saved = value;
            return Task.FromResult(true);
        }, CancellationToken.None);
        Assert.True(result.Success);
        Assert.Equal("success", result.Code);
        Assert.Equal("refresh.new=value", TajiduoCredential.Parse(saved!)!.RefreshToken);
        Assert.Equal("refresh.old=value", transport.Requests[0].Authorization);
        Assert.All(transport.Requests.Skip(1), r => Assert.Equal("access.new=value", r.Authorization));
        Assert.Equal("gameId=1289&roleId=9007199254740993", transport.Requests[3].Body);
        Assert.Equal("/apihub/awapi/sign", transport.Requests[3].Path);
        Assert.Equal(HttpMethod.Get, transport.Requests[4].Method);
    }

    [Theory]
    [InlineData("{\"code\":0,\"data\":{\"todaySign\":true}}", "already", true)]
    [InlineData("{\"code\":0,\"data\":{\"todaySign\":\"false\"}}", "verification_state_unknown", false)]
    [InlineData("{\"code\":0,\"data\":{\"days\":5}}", "verification_state_unknown", false)]
    public async Task DoesNotSubmitWithoutExplicitUnsignedState(string state, string code, bool success)
    {
        var transport = new Responses(Refresh, Roles, state);
        var result = await new TajiduoClient(transport).SignAsync(Credential, _ => Task.FromResult(true), CancellationToken.None);
        Assert.Equal(code, result.Code);
        Assert.Equal(success, result.Success);
        Assert.DoesNotContain(transport.Requests, r => r.Path == "/apihub/awapi/sign");
    }

    [Theory]
    [InlineData("{\"code\":0,\"data\":{\"todaySign\":false}}")]
    [InlineData("{\"code\":0,\"data\":{\"todaySign\":true,\"todaySign\":false}}")]
    [InlineData("not-json")]
    public async Task AcceptedPostWithoutConfirmationIsNotSuccess(string after)
    {
        var transport = new Responses(Refresh, Roles, Before, "{\"code\":0}", after);
        var result = await new TajiduoClient(transport).SignAsync(Credential, _ => Task.FromResult(true), CancellationToken.None);
        Assert.False(result.Success);
        Assert.Equal("success_unconfirmed", result.Code);
        Assert.Single(transport.Requests, r => r.Path == "/apihub/awapi/sign");
    }

    [Fact]
    public async Task FailedCredentialWritePreventsGameRequests()
    {
        var transport = new Responses(Refresh);
        var result = await new TajiduoClient(transport).SignAsync(Credential, _ => Task.FromResult(false), CancellationToken.None);
        Assert.Equal("credential_changed", result.Code);
        Assert.Single(transport.Requests);
    }

    [Fact]
    public async Task AmbiguousRoleRequiresSelection()
    {
        var transport = new Responses(Refresh, "{\"code\":0,\"data\":{\"roles\":[{\"roleId\":\"1\"},{\"roleId\":\"2\"}]}}");
        var result = await new TajiduoClient(transport).SignAsync(Credential, _ => Task.FromResult(true), CancellationToken.None);
        Assert.Equal("role_selection_required", result.Code);
        Assert.Equal(2, transport.Requests.Count);
    }

    [Theory]
    [InlineData("tjd_token=web-cookie")]
    [InlineData("{\"accessToken\":\"a\",\"accessToken\":\"b\"}")]
    [InlineData("{\"accessToken\":\"a\\r\\nInjected\",\"refreshToken\":\"r\",\"uid\":\"1\",\"deviceId\":\"d\"}")]
    public async Task InvalidCredentialsNeverLeaveMachine(string value)
    {
        var transport = new Responses();
        var result = await new TajiduoClient(transport).SignAsync(value, _ => throw new Exception(), CancellationToken.None);
        Assert.Equal("invalid_credential", result.Code);
        Assert.Empty(transport.Requests);
    }

    private sealed class Responses(params string[] values) : IPluginHttpClientFactory
    {
        private readonly Queue<string> _values = new(values);
        internal List<(string Path, HttpMethod Method, string Authorization, string Body)> Requests { get; } = [];
        public HttpClient CreateClient(Uri? destination = null, TimeSpan? timeout = null, bool allowAutoRedirect = false)
        {
            Assert.Equal("bbs-api.tajiduo.com", destination!.Host);
            Assert.False(allowAutoRedirect);
            return new HttpClient(new Handler(this));
        }
        private sealed class Handler(Responses owner) : HttpMessageHandler
        {
            protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken token)
            {
                token.ThrowIfCancellationRequested();
                owner.Requests.Add((request.RequestUri!.AbsolutePath, request.Method, request.Headers.GetValues("Authorization").Single(), request.Content is null ? "" : await request.Content.ReadAsStringAsync(token)));
                return new(HttpStatusCode.OK) { Content = new StringContent(owner._values.Dequeue(), Encoding.UTF8, "application/json") };
            }
        }
    }
}
