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
}
