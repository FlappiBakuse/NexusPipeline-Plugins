using System.Net;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using NexusPipeline.Plugin.Abstractions;
using NexusPipeline.Plugin.TestKit;
using Xunit;

namespace NexusPipeline.Plugin.GameCheckIn.Tests;

public sealed class GameCheckInTests
{
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
        string first = CheckInTaskService.CredentialFingerprint("token-value");
        string second = CheckInTaskService.CredentialFingerprint("token-value");

        Assert.Equal(first, second);
        Assert.Matches("^[0-9a-f]{64}$", first);
        Assert.NotEqual("token-value", first);
        Assert.Equal("", CheckInTaskService.CredentialFingerprint("token\nvalue"));
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
    public async Task HoyoLabClient_MapsInfoAlreadySignedResponse()
    {
        var factory = new QueueHttpClientFactory("{\"retcode\":0,\"data\":{\"is_sign\":true}}");

        CheckInResult result = await new HoyoLabClient(factory).SignAsync(
            GameDefinitions.All[0],
            "ltuid=1; ltoken=secret",
            CancellationToken.None);

        Assert.True(result.Success);
        Assert.Equal("already", result.Code);
        Assert.Single(factory.Requests);
    }

    [Fact]
    public async Task HoyoLabClient_MapsForbiddenAlreadySignedResponse()
    {
        var factory = new QueueHttpClientFactory(
            new[] { HttpStatusCode.OK, HttpStatusCode.Forbidden },
            "{\"retcode\":0,\"data\":{\"is_sign\":false}}",
            "{\"retcode\":-5003,\"message\":\"already\"}");

        CheckInResult result = await new HoyoLabClient(factory).SignAsync(
            GameDefinitions.All[0],
            "ltuid=1; ltoken=secret",
            CancellationToken.None);

        Assert.True(result.Success);
        Assert.Equal("already", result.Code);
        Assert.Equal(2, factory.Requests.Count);
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
    public async Task MiyousheClient_MapsInfoAlreadySignedResponse()
    {
        var factory = new QueueHttpClientFactory(
            "{\"retcode\":0,\"data\":{\"list\":[{\"game_uid\":\"1001\",\"region\":\"cn_gf01\"}]}}",
            "{\"retcode\":0,\"data\":{\"isSign\":true}}");

        CheckInResult result = await new MiyousheClient(factory).SignAsync(
            GameDefinitions.All[0],
            "stuid=1; stoken=secret",
            "device-id",
            CancellationToken.None);

        Assert.True(result.Success);
        Assert.Equal("already", result.Code);
        Assert.Equal(2, factory.Requests.Count);
    }

    [Fact]
    public async Task MiyousheClient_MapsForbiddenAlreadySignedResponse()
    {
        var factory = new QueueHttpClientFactory(
            new[] { HttpStatusCode.OK, HttpStatusCode.OK, HttpStatusCode.Forbidden },
            "{\"retcode\":0,\"data\":{\"list\":[{\"game_uid\":\"1001\",\"region\":\"cn_gf01\"}]}}",
            "{\"retcode\":0,\"data\":{\"is_sign\":false}}",
            "{\"retcode\":-5003,\"message\":\"already\"}");

        CheckInResult result = await new MiyousheClient(factory).SignAsync(
            GameDefinitions.All[0],
            "stuid=1; stoken=secret",
            "device-id",
            CancellationToken.None);

        Assert.True(result.Success);
        Assert.Equal("already", result.Code);
        Assert.Equal(3, factory.Requests.Count);
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

    [Fact]
    public async Task KuroClient_ReturnsTransportErrorForInvalidNonSuccessBody()
    {
        var factory = new QueueHttpClientFactory(
            new[] { HttpStatusCode.BadRequest },
            "<html>bad request</html>");

        CheckInResult result = await new KuroClient(factory).SignAsync(
            KuroGameDefinitions.Find("ww")!,
            "kuro-token",
            "dev-code",
            "distinct-id",
            CancellationToken.None);

        Assert.False(result.Success);
        Assert.Equal("transport_error", result.Code);
    }

    [Fact]
    public async Task EntryPoint_ExposesTaskRoutesWithoutUserSettingsOrRunHooks()
    {
        var context = new FakePluginHostContext("game-check-in");
        var entryPoint = new EntryPoint();

        await entryPoint.InitializeAsync(context, CancellationToken.None);
        await entryPoint.StartAsync(CancellationToken.None);

        Assert.Equal(
            new[] { ("GET", "state"), ("DELETE", "tasks"), ("POST", "tasks"), ("PUT", "tasks"), ("PUT", "tasks/order"), ("POST", "tasks/run") },
            context.WebApi.Routes.Select(route => (route.Method, route.Route)).OrderBy(route => route.Route).ThenBy(route => route.Method));
        Assert.Empty(context.UserGlobalManagement.Contributions);
        Assert.Empty(context.UserListBadges.Contributions);
        Assert.Empty(context.Ui.Contributions);
        Assert.Equal(0, context.ExecutionEvents.SubscriptionCount);
        Assert.DoesNotContain(context.Scheduler.Definitions.Keys, key => key.Contains("user", StringComparison.OrdinalIgnoreCase));

        await entryPoint.StopAsync(CancellationToken.None);
        Assert.Empty(context.WebApi.Routes);
        Assert.Empty(context.Scheduler.Definitions);
    }

    [Fact]
    public async Task TaskApi_SavesPlatformSecretsMaskedAndDeletesItsV2Scope()
    {
        var context = new FakePluginHostContext("game-check-in");
        var service = new CheckInTaskService(context, () => AtLocalTime(2026, 9, 14, 10, 0));
        string[] platforms = { "cn", "os", "skland", "skport", "kuro" };
        string[] secretValues = { "cn-cookie", "os-cookie", "skland-token", "skport-token", "kuro-token" };
        JsonObject body = NewTaskInput("Daily", "11:30", DayOfWeek.Monday);
        body["games"] = new JsonObject
        {
            ["cn"] = new JsonArray(JsonValue.Create("gi")),
            ["os"] = new JsonArray(JsonValue.Create("gi")),
            ["skland"] = new JsonArray(JsonValue.Create("ak")),
            ["skport"] = new JsonArray(JsonValue.Create("endfield")),
            ["kuro"] = new JsonArray(JsonValue.Create("ww")),
        };
        var secretChanges = new JsonObject();
        for (int index = 0; index < platforms.Length; index++)
        {
            secretChanges[platforms[index]] = new JsonObject { ["action"] = "set", ["value"] = secretValues[index] };
        }
        body["secrets"] = secretChanges;

        PluginWebApiResponse created = await InvokeAsync(context, "POST", "tasks", body);

        Assert.Equal(201, created.StatusCode);
        JsonObject view = created.JsonBody!.AsObject();
        Guid id = Guid.Parse(view["id"]!.GetValue<string>());
        Assert.All(platforms, platform => Assert.True(view["credentials"]![platform]!.GetValue<bool>()));
        Assert.Equal("", view["remark"]!.GetValue<string>());
        Assert.False(view["notification"]!["enabled"]!.GetValue<bool>());
        Assert.Equal("", view["notification"]!["smtpTo"]!.GetValue<string>());
        Assert.Null(view["webhookSecrets"]);
        Assert.Null(view["smtpSecrets"]);
        string serialized = view.ToJsonString();
        foreach (string secret in secretValues) Assert.DoesNotContain(secret, serialized, StringComparison.Ordinal);
        Assert.DoesNotContain("cnDeviceId", serialized, StringComparison.Ordinal);
        Assert.DoesNotContain("kuroDevCode", serialized, StringComparison.Ordinal);
        Assert.DoesNotContain("kuroDistinctId", serialized, StringComparison.Ordinal);
        for (int index = 0; index < platforms.Length; index++)
        {
            string secretKey = CheckInTaskService.SecretKey(id, "credential-" + platforms[index]);
            Assert.Equal($"tasks-v2/{id:N}/credential-{platforms[index]}", secretKey);
            Assert.Equal(secretValues[index], await context.Secrets.GetAsync(secretKey));
        }
        Assert.False(context.UserData.HasConfig("game-check-in"));
        Assert.Empty(context.Notifications.Notifications);
        Assert.True(context.ScopedData.Contains("tasks-v2/task-store"));

        PluginWebApiResponse deleted = await InvokeAsync(context, "DELETE", "tasks", new JsonObject { ["taskId"] = id.ToString() });

        Assert.Equal(204, deleted.StatusCode);
        foreach (string platform in platforms)
        {
            Assert.Null(await context.Secrets.GetAsync(CheckInTaskService.SecretKey(id, "credential-" + platform)));
        }
        await service.StopAsync(CancellationToken.None);
    }

    [Fact]
    public async Task TaskApi_ReordersTasksOnlyForACompleteUniquePermutation()
    {
        var context = new FakePluginHostContext("game-check-in");
        var service = new CheckInTaskService(context);
        Guid first = await CreateKuroTaskAsync(context, "First", "first-token");
        Guid second = await CreateKuroTaskAsync(context, "Second", "second-token");
        Guid third = await CreateKuroTaskAsync(context, "Third", "third-token");
        Guid[] expected = { third, first, second };

        PluginWebApiResponse reordered = await InvokeAsync(context, "PUT", "tasks/order", OrderBody(expected));

        Assert.Equal(200, reordered.StatusCode);
        Assert.Equal(expected, reordered.JsonBody!["taskIds"]!.AsArray().Select(item => Guid.Parse(item!.GetValue<string>())));
        Assert.Equal(expected, (await GetStateAsync(context))["tasks"]!.AsArray()
            .Select(item => Guid.Parse(item!["id"]!.GetValue<string>())));
        foreach (Guid[] invalid in new[]
        {
            new[] { first, first, third },
            new[] { first, second },
            new[] { first, second, Guid.NewGuid() },
        })
        {
            Assert.Equal(400, (await InvokeAsync(context, "PUT", "tasks/order", OrderBody(invalid))).StatusCode);
            Assert.Equal(expected, (await GetStateAsync(context))["tasks"]!.AsArray()
                .Select(item => Guid.Parse(item!["id"]!.GetValue<string>())));
        }
        await service.StopAsync(CancellationToken.None);
    }

    [Fact]
    public async Task ScheduledTask_ClaimsOneLocalOccurrenceAndCredentialChangeResetsDailyDeduplication()
    {
        var context = new FakePluginHostContext("game-check-in");
        DateTimeOffset now = AtLocalTime(2026, 9, 14, 10, 30);
        var service = new CheckInTaskService(context, () => now);
        context.Http.ResponseFactory = request => new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent(
                request.RequestUri!.AbsolutePath.EndsWith("findRoleList", StringComparison.Ordinal)
                    ? "{\"code\":200,\"data\":[{\"gameId\":\"3\",\"roleId\":\"role\",\"serverId\":\"server\",\"userId\":\"user\"}]}"
                    : "{\"code\":200}",
                Encoding.UTF8,
                "application/json"),
        };
        await service.StartAsync(CancellationToken.None);
        JsonObject taskBody = NewTaskInput("Scheduled", "10:30", DayOfWeek.Monday);
        taskBody["games"] = new JsonObject { ["kuro"] = new JsonArray(JsonValue.Create("ww")) };
        taskBody["secrets"] = new JsonObject { ["kuro"] = new JsonObject { ["action"] = "set", ["value"] = "token-a" } };
        string scheduleId = taskBody["schedules"]![0]!["id"]!.GetValue<string>();
        PluginWebApiResponse created = await InvokeAsync(context, "POST", "tasks", taskBody);
        Guid id = Guid.Parse(created.JsonBody!["id"]!.GetValue<string>());

        await context.Scheduler.TriggerAsync(CheckInTaskService.PollerJobId);
        JsonObject state = await WaitForStateAsync(context, id, runCount: 1);
        JsonObject task = state;
        Assert.Equal("schedule", task["runs"]![0]!["trigger"]!.GetValue<string>());
        Assert.Equal("success", task["runs"]![0]!["status"]!.GetValue<string>());
        Assert.Single(task["runs"]![0]!["results"]!.AsArray());
        Assert.Equal(2, context.Http.Requests.Count);

        await context.Scheduler.TriggerAsync(CheckInTaskService.PollerJobId);
        await Task.Delay(30);
        Assert.Single((await GetTaskStateAsync(context, id))["runs"]!.AsArray());
        Assert.Equal(2, context.Http.Requests.Count);

        JsonObject update = NewTaskInput("Scheduled", "10:30", DayOfWeek.Monday);
        update["id"] = id.ToString();
        update["games"] = new JsonObject { ["kuro"] = new JsonArray(JsonValue.Create("ww")) };
        update["schedules"]![0]!["id"] = scheduleId;
        update["secrets"] = new JsonObject { ["kuro"] = new JsonObject { ["action"] = "set", ["value"] = "token-b" } };
        Assert.Equal(200, (await InvokeAsync(context, "PUT", "tasks", update)).StatusCode);

        await InvokeAsync(context, "POST", "tasks/run", new JsonObject { ["taskId"] = id.ToString() });
        JsonObject afterCredentialChange = await WaitForStateAsync(context, id, runCount: 2);
        Assert.Equal("success", afterCredentialChange["runs"]![0]!["status"]!.GetValue<string>());
        Assert.Equal(4, context.Http.Requests.Count);
        await service.StopAsync(CancellationToken.None);

        var restarted = new CheckInTaskService(context, () => now);
        await restarted.StartAsync(CancellationToken.None);
        await context.Scheduler.TriggerAsync(CheckInTaskService.PollerJobId);
        await Task.Delay(30);
        Assert.Equal(2, (await GetTaskStateAsync(context, id))["runs"]!.AsArray().Count);
        Assert.Equal(4, context.Http.Requests.Count);
        await restarted.StopAsync(CancellationToken.None);
    }

    [Fact]
    public async Task ConcurrentTasksWithSameCredential_PersistSuccessBeforeReleasingCredentialFlight()
    {
        var context = new FakePluginHostContext("game-check-in");
        using var store = new ControlledScopedDataStore(context.ScopedData);
        using var firstRequestEntered = new ManualResetEventSlim(false);
        using var releaseFirstRequest = new ManualResetEventSlim(false);
        var host = new ScopedDataHostContext(context, store);
        DateTimeOffset now = AtLocalTime(2026, 9, 14, 10, 30);
        var service = new CheckInTaskService(host, () => now);
        int gatedRequest = 0;
        context.Http.ResponseFactory = request => new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent(
                request.RequestUri!.AbsolutePath.EndsWith("findRoleList", StringComparison.Ordinal)
                    && Interlocked.Exchange(ref gatedRequest, 1) == 0
                    ? WaitForFirstRequestRelease(firstRequestEntered, releaseFirstRequest)
                    : request.RequestUri.AbsolutePath.EndsWith("findRoleList", StringComparison.Ordinal)
                    ? "{\"code\":200,\"data\":[{\"gameId\":\"3\",\"roleId\":\"role\",\"serverId\":\"server\",\"userId\":\"user\"}]}"
                    : "{\"code\":200}",
                Encoding.UTF8,
                "application/json"),
        };
        await service.StartAsync(CancellationToken.None);

        Guid firstId = await CreateKuroTaskAsync(context, "First", "shared-kuro-token");
        Guid secondId = await CreateKuroTaskAsync(context, "Second", "shared-kuro-token");
        await InvokeAsync(context, "POST", "tasks/run", new JsonObject { ["taskId"] = firstId.ToString() });
        Assert.True(firstRequestEntered.Wait(TimeSpan.FromSeconds(4)), "首个任务没有进入平台请求屏障");
        JsonObject update = NewKuroTaskInput("First", "shared-kuro-token");
        update["id"] = firstId.ToString();
        Assert.Equal(409, (await InvokeAsync(context, "PUT", "tasks", update)).StatusCode);
        Assert.Equal(409, (await InvokeAsync(context, "DELETE", "tasks", new JsonObject { ["taskId"] = firstId.ToString() })).StatusCode);

        await InvokeAsync(context, "POST", "tasks/run", new JsonObject { ["taskId"] = secondId.ToString() });
        await Task.Delay(80);
        store.GateNextSuccessfulWrite();
        releaseFirstRequest.Set();
        Assert.True(store.SuccessfulWriteEntered.Wait(TimeSpan.FromSeconds(4)), "首个任务没有进入成功记录持久化屏障");
        int requestsAfterFirstSign = context.Http.Requests.Count;
        Assert.Equal(2, requestsAfterFirstSign);
        await Task.Delay(80);
        Assert.Equal(requestsAfterFirstSign, context.Http.Requests.Count);

        store.ReleaseSuccessfulWrite();
        JsonObject first = await WaitForStateAsync(context, firstId, runCount: 1);
        JsonObject second = await WaitForStateAsync(context, secondId, runCount: 1);
        Assert.Equal("success", first["runs"]![0]!["status"]!.GetValue<string>());
        Assert.Equal("success", second["runs"]![0]!["status"]!.GetValue<string>());
        Assert.Equal("success", first["runs"]![0]!["results"]![0]!["code"]!.GetValue<string>());
        Assert.Equal("already", second["runs"]![0]!["results"]![0]!["code"]!.GetValue<string>());
        Assert.Equal(requestsAfterFirstSign, context.Http.Requests.Count);
        await service.StopAsync(CancellationToken.None);
    }

    [Fact]
    public async Task ScheduledTask_DoesNotBackfillMissedLocalTime()
    {
        var context = new FakePluginHostContext("game-check-in");
        DateTimeOffset now = AtLocalTime(2026, 9, 14, 10, 30);
        var service = new CheckInTaskService(context, () => now);
        await service.StartAsync(CancellationToken.None);
        JsonObject taskBody = NewTaskInput("Missed", "10:29", DayOfWeek.Monday);
        taskBody["games"] = new JsonObject { ["kuro"] = new JsonArray(JsonValue.Create("ww")) };
        taskBody["secrets"] = new JsonObject { ["kuro"] = new JsonObject { ["action"] = "set", ["value"] = "missed-token" } };
        PluginWebApiResponse created = await InvokeAsync(context, "POST", "tasks", taskBody);
        Guid id = Guid.Parse(created.JsonBody!["id"]!.GetValue<string>());

        await context.Scheduler.TriggerAsync(CheckInTaskService.PollerJobId);
        await Task.Delay(30);
        JsonObject task = await GetTaskStateAsync(context, id);
        Assert.Empty(task["runs"]!.AsArray());
        Assert.Empty(context.Http.Requests);
        await service.StopAsync(CancellationToken.None);
    }

    [Fact]
    public async Task TaskApi_RejectsExplicitNullCollectionsAndEntries()
    {
        var context = new FakePluginHostContext("game-check-in");
        var service = new CheckInTaskService(context);
        JsonObject nullGames = NewTaskInput("Null games", "10:30", DayOfWeek.Monday);
        nullGames["games"] = null;
        JsonObject nullPlatformGames = NewTaskInput("Null game list", "10:30", DayOfWeek.Monday);
        nullPlatformGames["games"]!["cn"] = null;
        JsonObject nullSchedules = NewTaskInput("Null schedules", "10:30", DayOfWeek.Monday);
        nullSchedules["schedules"] = null;
        JsonObject nullScheduleEntry = NewTaskInput("Null schedule item", "10:30", DayOfWeek.Monday);
        nullScheduleEntry["schedules"]![0] = null;
        JsonObject nullNotification = NewTaskInput("Null notification", "10:30", DayOfWeek.Monday);
        nullNotification["notification"] = null;
        JsonObject nullRecipient = NewTaskInput("Null recipient", "10:30", DayOfWeek.Monday);
        nullRecipient["notification"]!["smtpTo"] = null;
        JsonObject nullSecrets = NewTaskInput("Null secrets", "10:30", DayOfWeek.Monday);
        nullSecrets["secrets"] = null;

        foreach (JsonObject body in new[] { nullGames, nullPlatformGames, nullSchedules, nullScheduleEntry, nullNotification, nullRecipient, nullSecrets })
        {
            Assert.Equal(400, (await InvokeAsync(context, "POST", "tasks", body)).StatusCode);
        }
        await service.StopAsync(CancellationToken.None);
    }

    [Fact]
    public async Task TaskApi_RestoresSecretsWhenTaskStoreWriteFails()
    {
        var context = new FakePluginHostContext("game-check-in");
        using var store = new ControlledScopedDataStore(context.ScopedData);
        var service = new CheckInTaskService(new ScopedDataHostContext(context, store));
        JsonObject create = NewKuroTaskInput("Rollback", "rollback-token-old");
        PluginWebApiResponse created = await InvokeAsync(context, "POST", "tasks", create);
        Guid id = Guid.Parse(created.JsonBody!["id"]!.GetValue<string>());
        string secretKey = CheckInTaskService.SecretKey(id, "credential-kuro");
        Assert.Equal("rollback-token-old", await context.Secrets.GetAsync(secretKey));

        JsonObject update = NewKuroTaskInput("Rollback Updated", "rollback-token-new");
        update["id"] = id.ToString();
        store.FailNextWrite();
        PluginWebApiResponse response = await InvokeAsync(context, "PUT", "tasks", update);

        Assert.Equal(500, response.StatusCode);
        Assert.Equal("rollback-token-old", await context.Secrets.GetAsync(secretKey));
        Assert.Equal("Rollback", (await GetTaskStateAsync(context, id))["name"]!.GetValue<string>());
        await service.StopAsync(CancellationToken.None);
    }

    [Fact]
    public async Task CheckInRun_ContinuesOtherPlatformsAndClassifiesAllFailureAndPartial()
    {
        var context = new FakePluginHostContext("game-check-in");
        var service = new CheckInTaskService(context, () => AtLocalTime(2026, 9, 14, 10, 30));
        context.Http.ResponseFactory = request => new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent(
                request.RequestUri!.AbsolutePath.EndsWith("findRoleList", StringComparison.Ordinal)
                    ? "{\"code\":200,\"data\":[{\"gameId\":\"3\",\"roleId\":\"role\",\"serverId\":\"server\",\"userId\":\"user\"}]}"
                    : request.RequestUri.AbsolutePath.EndsWith("signIn/v2", StringComparison.Ordinal)
                        ? "{\"code\":200}"
                        : "{\"retcode\":-1,\"message\":\"failed\"}",
                Encoding.UTF8,
                "application/json"),
        };
        await service.StartAsync(CancellationToken.None);

        JsonObject partialInput = NewKuroTaskInput("Partial", "partial-kuro-token");
        partialInput["games"]!["os"] = new JsonArray(JsonValue.Create("gi"));
        partialInput["secrets"]!["os"] = new JsonObject { ["action"] = "set", ["value"] = "ltuid=1; ltoken=valid" };
        Guid partialId = Guid.Parse((await InvokeAsync(context, "POST", "tasks", partialInput)).JsonBody!["id"]!.GetValue<string>());
        await InvokeAsync(context, "POST", "tasks/run", new JsonObject { ["taskId"] = partialId.ToString() });
        JsonObject partial = await WaitForStateAsync(context, partialId, 1);
        Assert.Equal("partial", partial["runs"]![0]!["status"]!.GetValue<string>());
        Assert.Equal(2, partial["runs"]![0]!["results"]!.AsArray().Count);
        Assert.Equal(3, context.Http.Requests.Count);

        JsonObject failedInput = NewTaskInput("All failed", "10:30", DayOfWeek.Monday);
        failedInput["games"] = new JsonObject { ["kuro"] = new JsonArray(JsonValue.Create("ww")) };
        Guid failedId = Guid.Parse((await InvokeAsync(context, "POST", "tasks", failedInput)).JsonBody!["id"]!.GetValue<string>());
        await InvokeAsync(context, "POST", "tasks/run", new JsonObject { ["taskId"] = failedId.ToString() });
        JsonObject failed = await WaitForStateAsync(context, failedId, 1);
        Assert.Equal("failed", failed["runs"]![0]!["status"]!.GetValue<string>());
        Assert.Equal("invalid_credential", failed["runs"]![0]!["results"]![0]!["code"]!.GetValue<string>());
        await service.StopAsync(CancellationToken.None);
    }

    [Fact]
    public async Task CheckInNotification_UsesHostServiceAndOptionalRecipientOverride()
    {
        var context = new FakePluginHostContext("game-check-in");
        var service = new CheckInTaskService(context, () => AtLocalTime(2026, 9, 14, 10, 30));
        context.Http.ResponseFactory = request => new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent(
                request.RequestUri!.AbsolutePath.EndsWith("findRoleList", StringComparison.Ordinal)
                    ? "{\"code\":200,\"data\":[{\"gameId\":\"3\",\"roleId\":\"role\",\"serverId\":\"server\",\"userId\":\"user\"}]}"
                    : "{\"code\":200}",
                Encoding.UTF8,
                "application/json"),
        };

        JsonObject create = NewKuroTaskInput("Notices", "notice-token-a");
        Guid id = Guid.Parse((await InvokeAsync(context, "POST", "tasks", create)).JsonBody!["id"]!.GetValue<string>());
        await InvokeAsync(context, "POST", "tasks/run", new JsonObject { ["taskId"] = id.ToString() });
        await WaitForStateAsync(context, id, 1);
        Assert.Empty(context.Notifications.Notifications);

        JsonObject overrideInput = NewKuroTaskInput("Notices", "notice-token-b");
        overrideInput["id"] = id.ToString();
        overrideInput["notification"] = new JsonObject { ["enabled"] = true, ["smtpTo"] = "  task@example.test  " };
        Assert.Equal(200, (await InvokeAsync(context, "PUT", "tasks", overrideInput)).StatusCode);
        await InvokeAsync(context, "POST", "tasks/run", new JsonObject { ["taskId"] = id.ToString() });
        await WaitForStateAsync(context, id, 2);
        PluginNotification firstNotification = Assert.Single(context.Notifications.Notifications);
        Assert.Equal("task@example.test", firstNotification.SmtpTo);

        JsonObject inheritedInput = NewKuroTaskInput("Notices", "notice-token-c");
        inheritedInput["id"] = id.ToString();
        inheritedInput["notification"] = new JsonObject { ["enabled"] = true, ["smtpTo"] = "" };
        Assert.Equal(200, (await InvokeAsync(context, "PUT", "tasks", inheritedInput)).StatusCode);
        await InvokeAsync(context, "POST", "tasks/run", new JsonObject { ["taskId"] = id.ToString() });
        await WaitForStateAsync(context, id, 3);
        Assert.Equal(2, context.Notifications.Notifications.Count);
        Assert.Null(context.Notifications.Notifications[1].SmtpTo);
        await service.StopAsync(CancellationToken.None);
    }

    private static JsonObject NewTaskInput(string name, string time, DayOfWeek day) => new()
    {
        ["name"] = name,
        ["remark"] = "",
        ["enabled"] = true,
        ["games"] = new JsonObject { ["cn"] = new JsonArray(JsonValue.Create("gi")) },
        ["schedules"] = new JsonArray(new JsonObject
        {
            ["id"] = Guid.NewGuid().ToString("N"),
            ["days"] = new JsonArray(JsonValue.Create((int)day)),
            ["enabled"] = true,
            ["time"] = time,
        }),
        ["notification"] = new JsonObject { ["enabled"] = false, ["smtpTo"] = "" },
        ["secrets"] = new JsonObject(),
    };

    private static JsonObject OrderBody(IEnumerable<Guid> taskIds)
    {
        var ids = new JsonArray();
        foreach (Guid id in taskIds) ids.Add(id.ToString());
        return new JsonObject { ["taskIds"] = ids };
    }

    private static DateTimeOffset AtLocalTime(int year, int month, int day, int hour, int minute) =>
        new(new DateTime(year, month, day, hour, minute, 0, DateTimeKind.Local));

    private static JsonObject NewKuroTaskInput(string name, string credential)
    {
        JsonObject input = NewTaskInput(name, "10:30", DayOfWeek.Monday);
        input["games"] = new JsonObject { ["kuro"] = new JsonArray(JsonValue.Create("ww")) };
        input["secrets"] = new JsonObject
        {
            ["kuro"] = new JsonObject { ["action"] = "set", ["value"] = credential },
        };
        return input;
    }

    private static async Task<Guid> CreateKuroTaskAsync(FakePluginHostContext context, string name, string credential)
    {
        PluginWebApiResponse created = await InvokeAsync(context, "POST", "tasks", NewKuroTaskInput(name, credential));
        Assert.Equal(201, created.StatusCode);
        return Guid.Parse(created.JsonBody!["id"]!.GetValue<string>());
    }

    private static string WaitForFirstRequestRelease(
        ManualResetEventSlim entered,
        ManualResetEventSlim release)
    {
        entered.Set();
        if (!release.Wait(TimeSpan.FromSeconds(8))) throw new TimeoutException("测试没有释放平台请求屏障");
        return "{\"code\":200,\"data\":[{\"gameId\":\"3\",\"roleId\":\"role\",\"serverId\":\"server\",\"userId\":\"user\"}]}";
    }

    private static async Task<PluginWebApiResponse> InvokeAsync(
        FakePluginHostContext context,
        string method,
        string route,
        JsonObject? body = null)
    {
        PluginWebApiRoute registration = context.WebApi.Routes.Single(item => item.Method == method && item.Route == route);
        var request = new PluginWebApiRequest(method, route, new Dictionary<string, string>(), body?.ToJsonString());
        return await registration.Handler(request, CancellationToken.None);
    }

    private static async Task<JsonObject> GetTaskStateAsync(FakePluginHostContext context, Guid id)
    {
        JsonObject root = (await InvokeAsync(context, "GET", "state")).JsonBody!.AsObject();
        return root["tasks"]!.AsArray().Select(item => item!.AsObject())
            .Single(item => Guid.Parse(item["id"]!.GetValue<string>()) == id);
    }

    private static async Task<JsonObject> GetStateAsync(FakePluginHostContext context) =>
        (await InvokeAsync(context, "GET", "state")).JsonBody!.AsObject();

    private static async Task<JsonObject> WaitForStateAsync(FakePluginHostContext context, Guid id, int runCount)
    {
        for (int attempt = 0; attempt < 100; attempt++)
        {
            JsonObject task = await GetTaskStateAsync(context, id);
            JsonArray runs = task["runs"]!.AsArray();
            if (runs.Count >= runCount
                && runs[0]!["status"]!.GetValue<string>() != "running"
                && !task["isRunning"]!.GetValue<bool>()) return task;
            await Task.Delay(25);
        }
        throw new TimeoutException("签到任务运行未在测试期限内结束");
    }

    private sealed class ControlledScopedDataStore : IPluginScopedDataStore, IDisposable
    {
        private readonly InMemoryPluginScopedDataStore _inner;
        private readonly ManualResetEventSlim _releaseWrite = new(false);
        private int _gateNextSuccessfulWrite;
        private int _failNextWrite;

        public ControlledScopedDataStore(InMemoryPluginScopedDataStore inner) => _inner = inner;

        public ManualResetEventSlim SuccessfulWriteEntered { get; } = new(false);

        public void GateNextSuccessfulWrite() => Interlocked.Exchange(ref _gateNextSuccessfulWrite, 1);

        public void ReleaseSuccessfulWrite() => _releaseWrite.Set();

        public void FailNextWrite() => Interlocked.Exchange(ref _failNextWrite, 1);

        public ValueTask<T?> ReadAsync<T>(string scope, CancellationToken cancellationToken = default) =>
            _inner.ReadAsync<T>(scope, cancellationToken);

        public async ValueTask WriteAsync<T>(string scope, T value, CancellationToken cancellationToken = default)
        {
            JsonNode? json = JsonSerializer.SerializeToNode(value);
            bool hasSuccessfulCheckIn = json?["successfulCheckIns"] is JsonArray entries && entries.Count > 0;
            if (hasSuccessfulCheckIn && Interlocked.Exchange(ref _gateNextSuccessfulWrite, 0) == 1)
            {
                SuccessfulWriteEntered.Set();
                if (!_releaseWrite.Wait(TimeSpan.FromSeconds(8))) throw new TimeoutException("测试没有释放签到成功记录屏障");
            }
            if (Interlocked.Exchange(ref _failNextWrite, 0) == 1) throw new IOException("Injected scoped store failure");
            await _inner.WriteAsync(scope, value, cancellationToken);
        }

        public ValueTask<JsonObject?> ReadJsonAsync(string scope, CancellationToken cancellationToken = default) =>
            _inner.ReadJsonAsync(scope, cancellationToken);

        public ValueTask WriteJsonAsync(string scope, JsonObject value, CancellationToken cancellationToken = default) =>
            _inner.WriteJsonAsync(scope, value, cancellationToken);

        public ValueTask DeleteAsync(string scope, CancellationToken cancellationToken = default) =>
            _inner.DeleteAsync(scope, cancellationToken);

        public void Dispose()
        {
            SuccessfulWriteEntered.Dispose();
            _releaseWrite.Dispose();
        }
    }

    private sealed class ScopedDataHostContext : IPluginHostContextV1_8
    {
        private readonly FakePluginHostContext _inner;

        public ScopedDataHostContext(FakePluginHostContext inner, IPluginScopedDataStore scopedData)
        {
            _inner = inner;
            ScopedData = scopedData;
        }

        public string PluginName => _inner.PluginName;
        public IPluginLogger Logger => _inner.Logger;
        public IPluginConfigStore Config => _inner.Config;
        public IPluginSecretStore Secrets => _inner.Secrets;
        public IPluginNotificationService Notifications => _inner.Notifications;
        public IPluginJobScheduler Scheduler => _inner.Scheduler;
        public IPluginUserDataStore UserData => _inner.UserData;
        public IPluginUserGlobalManagementRegistry UserGlobalManagement => _inner.UserGlobalManagement;
        public IPluginExecutionEventService ExecutionEvents => _inner.ExecutionEvents;
        public IPluginHttpClientFactory Http => _inner.Http;
        public IPluginUserListBadgeRegistry UserListBadges => _inner.UserListBadges;
        public IPluginUiContributionRegistry Ui => _inner.Ui;
        public IPluginScopedDataStore ScopedData { get; }
        public IPluginWebApiRegistry WebApi => _inner.WebApi;
        public IPluginHistoryContributionRegistry History => _inner.History;
        public IPluginLocalization I18n => _inner.I18n;
        public IPluginAssetStore Assets => _inner.Assets;
        public IPluginEmulatorSupportRegistry EmulatorSupport => _inner.EmulatorSupport;
        IPluginEmulatorSupportRegistry IPluginHostContextV1_7.EmulatorSupport => EmulatorSupport;
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
