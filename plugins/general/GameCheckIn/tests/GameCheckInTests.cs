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
            () => new DateTimeOffset(2026, 9, 15, 12, 0, 0, TimeSpan.FromHours(8))).SignAsync(
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
            new[] { ("GET", "state"), ("DELETE", "tasks"), ("POST", "tasks"), ("PUT", "tasks"), ("POST", "tasks/run") },
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
    public async Task TaskApi_SavesIndependentSecretsMaskedAndDeletesTheirScope()
    {
        var context = new FakePluginHostContext("game-check-in");
        var service = new CheckInTaskService(context, () => new DateTimeOffset(2026, 9, 14, 10, 0, 0, TimeSpan.FromHours(8)));
        string[] secrets = { "private-cookie", "https://hooks.example.test/private-token", "sign-key", "smtp-user", "smtp-password" };
        JsonObject body = NewTaskInput("Daily", "11:30", DayOfWeek.Monday);
        body["secrets"] = new JsonObject
        {
            ["cn"] = new JsonObject { ["action"] = "set", ["value"] = secrets[0] },
            ["webhookUrl"] = new JsonObject { ["action"] = "set", ["value"] = secrets[1] },
            ["webhookSecret"] = new JsonObject { ["action"] = "set", ["value"] = secrets[2] },
            ["smtpUser"] = new JsonObject { ["action"] = "set", ["value"] = secrets[3] },
            ["smtpPassword"] = new JsonObject { ["action"] = "set", ["value"] = secrets[4] },
        };

        PluginWebApiResponse created = await InvokeAsync(context, "POST", "tasks", body);

        Assert.Equal(201, created.StatusCode);
        JsonObject view = created.JsonBody!.AsObject();
        Guid id = Guid.Parse(view["id"]!.GetValue<string>());
        Assert.True(view["credentials"]!["cn"]!.GetValue<bool>());
        Assert.True(view["webhookSecrets"]!["urlConfigured"]!.GetValue<bool>());
        Assert.True(view["webhookSecrets"]!["signingSecretConfigured"]!.GetValue<bool>());
        Assert.True(view["smtpSecrets"]!["userConfigured"]!.GetValue<bool>());
        Assert.True(view["smtpSecrets"]!["passwordConfigured"]!.GetValue<bool>());
        string serialized = view.ToJsonString();
        Assert.DoesNotContain(secrets[0], serialized, StringComparison.Ordinal);
        Assert.DoesNotContain(secrets[1], serialized, StringComparison.Ordinal);
        Assert.DoesNotContain(secrets[2], serialized, StringComparison.Ordinal);
        Assert.DoesNotContain(secrets[3], serialized, StringComparison.Ordinal);
        Assert.DoesNotContain(secrets[4], serialized, StringComparison.Ordinal);
        Assert.All(new[] { "credential-cn", "webhook-url", "webhook-signing-secret", "smtp-user", "smtp-password" }, key =>
            Assert.Equal("tasks-v1/" + id.ToString("N") + "/" + key, CheckInTaskNotifications.SecretKey(id, key)));
        Assert.Equal(secrets[0], await context.Secrets.GetAsync(CheckInTaskNotifications.SecretKey(id, "credential-cn")));
        Assert.False(context.UserData.HasConfig("game-check-in"));
        Assert.Empty(context.Notifications.Notifications);
        Assert.True(context.ScopedData.Contains("tasks-v1/task-store"));

        PluginWebApiResponse deleted = await InvokeAsync(context, "DELETE", "tasks", new JsonObject { ["taskId"] = id.ToString() });

        Assert.Equal(204, deleted.StatusCode);
        foreach (string key in new[] { "credential-cn", "webhook-url", "webhook-signing-secret", "smtp-user", "smtp-password" })
        {
            Assert.Null(await context.Secrets.GetAsync(CheckInTaskNotifications.SecretKey(id, key)));
        }
        await service.StopAsync(CancellationToken.None);
    }

    [Fact]
    public async Task ScheduledTask_ClaimsOneLocalOccurrenceAndCredentialChangeResetsDailyDeduplication()
    {
        var context = new FakePluginHostContext("game-check-in");
        DateTimeOffset now = new(2026, 9, 14, 10, 30, 0, TimeSpan.FromHours(8));
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
        DateTimeOffset now = new(2026, 9, 14, 10, 30, 0, TimeSpan.FromHours(8));
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
        DateTimeOffset now = new(2026, 9, 14, 10, 30, 0, TimeSpan.FromHours(8));
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
        JsonObject nullNotifications = NewTaskInput("Null notifications", "10:30", DayOfWeek.Monday);
        nullNotifications["notifications"] = null;
        JsonObject nullWebhook = NewTaskInput("Null webhook", "10:30", DayOfWeek.Monday);
        nullWebhook["notifications"]!["webhook"] = null;
        JsonObject nullSecrets = NewTaskInput("Null secrets", "10:30", DayOfWeek.Monday);
        nullSecrets["secrets"] = null;

        foreach (JsonObject body in new[] { nullGames, nullPlatformGames, nullSchedules, nullScheduleEntry, nullNotifications, nullWebhook, nullSecrets })
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
        string secretKey = CheckInTaskNotifications.SecretKey(id, "credential-kuro");
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
        var service = new CheckInTaskService(context, () => new DateTimeOffset(2026, 9, 14, 10, 30, 0, TimeSpan.FromHours(8)));
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
    public void NotificationFormats_UseProviderBodiesAndIndependentSignatureAlgorithms()
    {
        Assert.Equal("{\"msgtype\":\"text\",\"text\":{\"content\":\"hello\"}}", CheckInTaskNotifications.BuildWebhookBody("dingtalk", "hello", ""));
        Assert.Equal("{\"msgtype\":\"text\",\"text\":{\"content\":\"hello\"}}", CheckInTaskNotifications.BuildWebhookBody("wecom", "hello", ""));
        Assert.Equal("{\"msg_type\":\"text\",\"content\":{\"text\":\"hello\"}}", CheckInTaskNotifications.BuildWebhookBody("feishu", "hello", ""));
        Assert.Equal("{\"text\":\"hello\"}", CheckInTaskNotifications.BuildWebhookBody("slack", "hello", ""));
        Assert.Equal("{\"content\":\"hello\"}", CheckInTaskNotifications.BuildWebhookBody("discord", "hello", ""));
        Assert.Equal("th4ptdjmwLp4vFIHjuqZPcQSQ/uOY3Z2BkO9m50fafo=", CheckInTaskNotifications.SignDingTalk("1712345678901", "SECtest-secret"));
        Assert.Equal("FlvAz19SaFj+YB5VHb5NOwV+BbcejqDGAAaYY7fsjoA=", CheckInTaskNotifications.SignFeishu("1712345678", "SECtest-secret"));
    }

    [Theory]
    [InlineData("generic", "provider accepted", true)]
    [InlineData("slack", "ok", true)]
    [InlineData("slack", "no_team", false)]
    [InlineData("feishu", "{\"code\":0}", true)]
    [InlineData("feishu", "{\"code\":19021}", false)]
    [InlineData("dingtalk", "{\"errcode\":0}", true)]
    [InlineData("wecom", "{\"errcode\":40001}", false)]
    public void NotificationFormats_ValidateProviderResponseSemantics(string type, string body, bool expected)
    {
        Assert.Equal(expected, CheckInTaskNotifications.IsWebhookResponseSuccessful(type, body));
    }

    [Fact]
    public void SmtpSettings_UseHostSecureModeDefaultsAndRecipientSeparators()
    {
        Assert.Equal(MailKit.Security.SecureSocketOptions.SslOnConnect, CheckInTaskNotifications.ResolveSecure(465, "auto"));
        Assert.Equal(MailKit.Security.SecureSocketOptions.StartTlsWhenAvailable, CheckInTaskNotifications.ResolveSecure(587, "auto"));
        Assert.Equal(new[] { "one@example.test", "two@example.test", "three@example.test" },
            CheckInTaskNotifications.SplitRecipients("one@example.test，two@example.test; three@example.test"));
    }

    [Fact]
    public async Task TaskNotifications_UseTaskSecretsForWebhookAndSmtp()
    {
        var context = new FakePluginHostContext("game-check-in");
        Guid taskId = Guid.NewGuid();
        await context.Secrets.SetAsync(CheckInTaskNotifications.SecretKey(taskId, "webhook-url"), "https://hooks.example.test/secret-path");
        await context.Secrets.SetAsync(CheckInTaskNotifications.SecretKey(taskId, "webhook-signing-secret"), "webhook-signature-key");
        await context.Secrets.SetAsync(CheckInTaskNotifications.SecretKey(taskId, "smtp-user"), "checkin@example.test");
        await context.Secrets.SetAsync(CheckInTaskNotifications.SecretKey(taskId, "smtp-password"), "smtp-password-value");
        string webhookBody = "";
        context.Http.ResponseFactory = request =>
        {
            webhookBody = request.Content!.ReadAsStringAsync().GetAwaiter().GetResult();
            return new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent("ok", Encoding.UTF8, "text/plain"),
            };
        };
        var smtp = new RecordingSmtpTransportFactory();
        var service = new CheckInTaskNotifications(context, smtp);
        var settings = new CheckInNotificationSettings
        {
            Webhook = new CheckInWebhookSettings { Enabled = true, Type = "slack" },
            Smtp = new CheckInSmtpSettings
            {
                Enabled = true,
                Host = "mail.example.test",
                Port = 587,
                Secure = "auto",
                From = "checkin@example.test",
                To = "one@example.test;two@example.test",
                SubjectPrefix = "[Check-in]",
            },
        };

        await service.SendAsync(taskId, "Result", "All games succeeded", settings, CancellationToken.None);

        Assert.Single(context.Http.Requests);
        Assert.Equal("https://hooks.example.test/secret-path", context.Http.Requests[0].RequestUri!.ToString());
        Assert.Contains("All games succeeded", webhookBody);
        Assert.Equal("checkin@example.test", smtp.User);
        Assert.Equal("smtp-password-value", smtp.Password);
        Assert.Equal("mail.example.test", smtp.Host);
        Assert.Equal(587, smtp.Port);
        Assert.Equal(MailKit.Security.SecureSocketOptions.StartTlsWhenAvailable, smtp.Secure);
        Assert.Equal(new[] { "one@example.test", "two@example.test" }, smtp.Recipients);
        Assert.Empty(context.Notifications.Notifications);
    }

    private static JsonObject NewTaskInput(string name, string time, DayOfWeek day) => new()
    {
        ["name"] = name,
        ["enabled"] = true,
            ["games"] = new JsonObject { ["cn"] = new JsonArray(JsonValue.Create("gi")) },
        ["schedules"] = new JsonArray(new JsonObject
        {
            ["id"] = Guid.NewGuid().ToString("N"),
            ["days"] = new JsonArray(JsonValue.Create((int)day)),
            ["enabled"] = true,
            ["time"] = time,
        }),
        ["notifications"] = new JsonObject
        {
            ["webhook"] = new JsonObject { ["enabled"] = false, ["type"] = "generic", ["template"] = "{\"text\":{text}}" },
            ["smtp"] = new JsonObject
            {
                ["enabled"] = false,
                ["host"] = "",
                ["port"] = 465,
                ["secure"] = "auto",
                ["from"] = "",
                ["to"] = "",
                ["subjectPrefix"] = "[NexusPipeline]",
            },
        },
        ["secrets"] = new JsonObject(),
    };

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

    private sealed class ScopedDataHostContext : IPluginHostContextV1_4
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

    private sealed class RecordingSmtpTransportFactory : ICheckInSmtpTransportFactory
    {
        private readonly RecordingSmtpTransport _transport = new();
        public string? Host => _transport.Host;
        public int Port => _transport.Port;
        public MailKit.Security.SecureSocketOptions Secure => _transport.Secure;
        public string? User => _transport.User;
        public string? Password => _transport.Password;
        public string[] Recipients => _transport.Recipients;
        public ICheckInSmtpTransport Create() => _transport;
    }

    private sealed class RecordingSmtpTransport : ICheckInSmtpTransport
    {
        public int TimeoutValue { get; private set; }
        public int Timeout { set => TimeoutValue = value; }
        public string? Host { get; private set; }
        public int Port { get; private set; }
        public MailKit.Security.SecureSocketOptions Secure { get; private set; }
        public string? User { get; private set; }
        public string? Password { get; private set; }
        public string[] Recipients { get; private set; } = Array.Empty<string>();
        public Task ConnectAsync(string host, int port, MailKit.Security.SecureSocketOptions options, CancellationToken cancellationToken)
        {
            cancellationToken.ThrowIfCancellationRequested();
            Host = host;
            Port = port;
            Secure = options;
            return Task.CompletedTask;
        }
        public Task AuthenticateAsync(string user, string password, CancellationToken cancellationToken)
        {
            cancellationToken.ThrowIfCancellationRequested();
            User = user;
            Password = password;
            return Task.CompletedTask;
        }
        public Task SendAsync(MimeKit.MimeMessage message, CancellationToken cancellationToken)
        {
            cancellationToken.ThrowIfCancellationRequested();
            Recipients = message.To.Mailboxes.Select(mailbox => mailbox.Address).ToArray();
            return Task.CompletedTask;
        }
        public Task DisconnectAsync(bool quit, CancellationToken cancellationToken)
        {
            cancellationToken.ThrowIfCancellationRequested();
            return Task.CompletedTask;
        }
        public void Dispose() { }
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
