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
