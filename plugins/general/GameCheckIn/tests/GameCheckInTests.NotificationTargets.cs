using System.Text.Json.Nodes;
using NexusPipeline.Plugin.Abstractions;
using NexusPipeline.Plugin.TestKit;
using Xunit;

namespace NexusPipeline.Plugin.GameCheckIn.Tests;

public sealed partial class GameCheckInTests
{
    [Fact]
    public async Task NotificationTargetsAllowDisabledAndRetainDeletedButRejectUnknownIds()
    {
        var context = new FakePluginHostContext("game-checkin");
        context.Notifications.Tasks.Add(new PluginNotificationTask("saved-target", "mail", "smtp", false, false));
        var service = new CheckInTaskService(context);
        try
        {
            var input = NewTaskInput("notification selection", "09:00", DayOfWeek.Monday);
            input["notification"] = new JsonObject { ["enabled"] = true, ["notificationTaskIds"] = new JsonArray("saved-target", "saved-target") };
            var created = await InvokeAsync(context, "POST", "tasks", input);
            Assert.Equal(201, created.StatusCode);
            Assert.Single(created.JsonBody!["notification"]!["notificationTaskIds"]!.AsArray());
            input["id"] = created.JsonBody!["id"]!.DeepClone();
            context.Notifications.Tasks.Clear();
            input["remark"] = "retained deleted target";
            Assert.Equal(200, (await InvokeAsync(context, "PUT", "tasks", input)).StatusCode);
            input["notification"]!["notificationTaskIds"] = new JsonArray("unknown");
            Assert.Equal(400, (await InvokeAsync(context, "PUT", "tasks", input)).StatusCode);
            input["notification"]!["notificationTaskIds"] = new JsonArray();
            var cleared = await InvokeAsync(context, "PUT", "tasks", input);
            Assert.Equal(200, cleared.StatusCode);
            Assert.Empty(cleared.JsonBody!["notification"]!["notificationTaskIds"]!.AsArray());
        }
        finally { await service.StopAsync(CancellationToken.None); }
    }
}
