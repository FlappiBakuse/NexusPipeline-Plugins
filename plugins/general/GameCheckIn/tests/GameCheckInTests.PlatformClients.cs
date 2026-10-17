using System.Net;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using NexusPipeline.Plugin.Abstractions;
using NexusPipeline.Plugin.TestKit;
using NexusPipeline.Plugin.GameCheckIn.Credentials;
using Xunit;

namespace NexusPipeline.Plugin.GameCheckIn.Tests;

public sealed partial class GameCheckInTests
{
    [Fact]
    public async Task HoyoLabClient_QueriesInfoBeforeSigning()
    {
        var factory = new QueueHttpClientFactory(
            "{\"retcode\":0,\"data\":{\"is_sign\":false}}",
            "{\"retcode\":0}",
            "{\"retcode\":0,\"data\":{\"is_sign\":true}}");
        var client = new HoyoLabClient(factory);

        CheckInResult result = await client.SignAsync(GameDefinitions.All[0], "ltuid=1; ltoken=secret", CancellationToken.None);

        Assert.Equal("success", result.Code);
        Assert.Equal(3, factory.Requests.Count);
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
            "{\"retcode\":0}",
            "{\"retcode\":0,\"data\":{\"is_sign\":true}}");
        var client = new MiyousheClient(factory);

        CheckInResult result = await client.SignAsync(GameDefinitions.All[0], "stuid=1;stoken=secret", "device-id", CancellationToken.None);

        Assert.Equal("success", result.Code);
        Assert.Equal(4, factory.Requests.Count);
        Assert.Equal("cn_gf01", factory.Requests[1].RequestUri!.Query.Contains("region=cn_gf01", StringComparison.Ordinal) ? "cn_gf01" : "");
        Assert.True(factory.Requests[1].Headers.Contains("DS"));
        Assert.Equal("miyousheluodi", factory.Requests[0].Headers.GetValues("x-rpc-channel").Single());
        Assert.Equal("device-id", factory.Requests[2].Headers.GetValues("x-rpc-device_id").Single());
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
        Assert.Equal("c270d1d23e69e0fbf1a439a3f6d4a89b",
            SklandClient.ComputeSign("sign-token", "/web/v1/user", "", "1700000000", "Bopaque/device+id==", "3", "1.0.0"));
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
        Assert.Equal("", factory.Requests[0].Headers.GetValues("dId").Single());
        Assert.Equal("", factory.Requests[1].Headers.GetValues("dId").Single());
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
            new[] { HttpStatusCode.OK, HttpStatusCode.Forbidden },
            "{\"code\":200,\"data\":[{\"gameId\":\"3\",\"roleId\":\"role\",\"serverId\":\"server\",\"userId\":\"user\"}]}",
            "{\"code\":1511,\"msg\":\"already\"}");

        CheckInResult result = await new KuroClient(
            factory,
            () => AtLocalTime(2026, 9, 15, 12, 0)).SignAsync(
            KuroGameDefinitions.Find("ww")!,
            "kuro-token",
            "dev-code",
            "00000000000000000000000000000001",
            CancellationToken.None);

        Assert.Equal("already", result.Code);
        Assert.Equal("kuro-token", factory.Requests[0].Headers.GetValues("token").Single());
        string body = factory.Bodies[1];
        Assert.Contains("gameId=3", body, StringComparison.Ordinal);
        Assert.Contains("roleId=role", body, StringComparison.Ordinal);
        Assert.Contains("serverId=server", body, StringComparison.Ordinal);
        Assert.Contains("userId=user", body, StringComparison.Ordinal);
        Assert.Contains("reqMonth=09", body, StringComparison.Ordinal);
        Assert.Equal(
            "00000000-0000-0000-0000-000000000001",
            factory.Requests[0].Headers.GetValues("distinct_id").Single());
    }
}
