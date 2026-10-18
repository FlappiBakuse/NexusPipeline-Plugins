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
    public async Task TaskDeleteCancellationAndStoreFailurePreserveRetryAndTaskIsolation()
    {
        var context = new FakePluginHostContext("game-check-in");
        using var data = new ControlledScopedDataStore(context.ScopedData);
        var secrets = new ControlledSecrets(context.Secrets);
        var service = new CheckInTaskService(new ScopedDataHostContext(context, data, secrets));
        try
        {
            Guid id = await CreateKuroTaskAsync(context, "cancel-cleanup", "credential");
            Guid other = await CreateKuroTaskAsync(context, "preserve-other", "other-credential");
            var body = new JsonObject { ["taskId"] = id.ToString() };
            data.FailNextWrite();
            Assert.Equal(500, (await InvokeAsync(context, "DELETE", "tasks", body)).StatusCode);
            Assert.NotNull(await GetTaskStateAsync(context, id));
            Assert.NotNull(await context.Secrets.GetAsync(CheckInTaskService.SecretKey(id, "credential-kuro")));
            using var cancelled = new CancellationTokenSource();
            secrets.CancelOnDelete = cancelled;
            await Assert.ThrowsAnyAsync<OperationCanceledException>(() => InvokeAsync(context, "DELETE", "tasks", body, cancellationToken: cancelled.Token));
            Assert.Single((await GetStateAsync(context))["tasks"]!.AsArray());
            secrets.CancelOnDelete = null;
            Assert.Equal(204, (await InvokeAsync(context, "DELETE", "tasks", body)).StatusCode);
            Assert.Null(await context.Secrets.GetAsync(CheckInTaskService.SecretKey(id, "credential-kuro")));
            Assert.Equal("other-credential", CredentialRecord.Decode(await context.Secrets.GetAsync(CheckInTaskService.SecretKey(other, "credential-kuro")))!.Value);
        }
        finally { secrets.CancelOnDelete = null; await service.StopAsync(CancellationToken.None); }
    }

    [Fact]
    public async Task TaskDeleteRetriesPendingSecretCleanupAfterFailureAndServiceRestart()
    {
        var context = new FakePluginHostContext("game-check-in");
        using var data = new ControlledScopedDataStore(context.ScopedData);
        var secrets = new ControlledSecrets(context.Secrets);
        var host = new ScopedDataHostContext(context, data, secrets);
        var service = new CheckInTaskService(host);
        Guid id = await CreateKuroTaskAsync(context, "delete-retry", "credential");
        await context.Secrets.SetAsync("unrelated/account", "preserve");
        var body = new JsonObject { ["taskId"] = id.ToString() };
        try
        {
            secrets.FailDeleteAt = 2;
            Assert.Equal(500, (await InvokeAsync(context, "DELETE", "tasks", body)).StatusCode);
            Assert.Empty((await GetStateAsync(context))["tasks"]!.AsArray());
            secrets.FailDeleteAt = null;
            Assert.Equal(204, (await InvokeAsync(context, "DELETE", "tasks", body)).StatusCode);
            Assert.Null(await context.Secrets.GetAsync(CheckInTaskService.SecretKey(id, "credential-kuro")));

            Guid second = await CreateKuroTaskAsync(context, "delete-restart", "credential-two");
            secrets.FailDeleteAt = secrets.DeleteCount + 1;
            Assert.Equal(500, (await InvokeAsync(context, "DELETE", "tasks", new JsonObject { ["taskId"] = second.ToString() })).StatusCode);
            await service.StopAsync(CancellationToken.None);
            secrets.FailDeleteAt = null;
            service = new CheckInTaskService(host);
            await service.StartAsync(CancellationToken.None);
            Assert.Null(await context.Secrets.GetAsync(CheckInTaskService.SecretKey(second, "credential-kuro")));
            Assert.Equal("preserve", await context.Secrets.GetAsync("unrelated/account"));
        }
        finally { await service.StopAsync(CancellationToken.None); }
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
        Assert.Empty(view["notification"]!["notificationTaskIds"]!.AsArray());
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
            Assert.Equal(secretValues[index], CredentialRecord.Decode(await context.Secrets.GetAsync(secretKey))!.Value);
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
}
