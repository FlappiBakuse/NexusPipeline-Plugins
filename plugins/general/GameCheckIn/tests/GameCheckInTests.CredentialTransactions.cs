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
    public async Task TaskApi_RestoresSecretsWhenTaskStoreWriteFails()
    {
        var context = new FakePluginHostContext("game-check-in");
        using var store = new ControlledScopedDataStore(context.ScopedData);
        var service = new CheckInTaskService(new ScopedDataHostContext(context, store));
        JsonObject create = NewKuroTaskInput("Rollback", "rollback-token-old");
        PluginWebApiResponse created = await InvokeAsync(context, "POST", "tasks", create);
        Guid id = Guid.Parse(created.JsonBody!["id"]!.GetValue<string>());
        string secretKey = CheckInTaskService.SecretKey(id, "credential-kuro");
        string? originalPayload = await context.Secrets.GetAsync(secretKey);
        Assert.Equal("rollback-token-old", CredentialRecord.Decode(originalPayload)!.Value);

        JsonObject update = NewKuroTaskInput("Rollback Updated", "rollback-token-new");
        update["id"] = id.ToString();
        store.FailNextWrite();
        PluginWebApiResponse response = await InvokeAsync(context, "PUT", "tasks", update);

        Assert.Equal(500, response.StatusCode);
        Assert.Equal(originalPayload, await context.Secrets.GetAsync(secretKey));
        Assert.Equal("Rollback", (await GetTaskStateAsync(context, id))["name"]!.GetValue<string>());
        await service.StopAsync(CancellationToken.None);
    }

    [Fact]
    public async Task TaskApi_ReportsUnknownWhenSecretRollbackFails()
    {
        var context = new FakePluginHostContext("game-check-in");
        using var store = new ControlledScopedDataStore(context.ScopedData);
        var secrets = new ControlledSecrets(context.Secrets);
        var service = new CheckInTaskService(new ScopedDataHostContext(context, store, secrets));
        PluginWebApiResponse created = await InvokeAsync(context, "POST", "tasks", NewKuroTaskInput("Rollback failure", "old-token"));
        Guid id = Guid.Parse(created.JsonBody!["id"]!.GetValue<string>());
        JsonObject update = NewKuroTaskInput("Uncommitted name", "new-token");
        update["id"] = id.ToString();
        secrets.FailSetValue = await context.Secrets.GetAsync(CheckInTaskService.SecretKey(id, "credential-kuro"));
        store.FailNextWrite();

        PluginWebApiResponse result = await InvokeAsync(context, "PUT", "tasks", update);

        Assert.Equal(500, result.StatusCode);
        Assert.Equal("task_save_unconfirmed", result.JsonBody!["error"]!.GetValue<string>());
        Assert.Equal("new-token", CredentialRecord.Decode(await context.Secrets.GetAsync(CheckInTaskService.SecretKey(id, "credential-kuro")))!.Value);
        Assert.Equal("Rollback failure", (await GetTaskStateAsync(context, id))["name"]!.GetValue<string>());
        await service.StopAsync(CancellationToken.None);
    }

    [Fact]
    public async Task TaskApi_ReportsUnknownWhenResponseProjectionFailsAfterCommit()
    {
        var context = new FakePluginHostContext("game-check-in");
        var secrets = new ControlledSecrets(context.Secrets);
        var service = new CheckInTaskService(new ScopedDataHostContext(context, context.ScopedData, secrets));
        PluginWebApiResponse created = await InvokeAsync(context, "POST", "tasks", NewKuroTaskInput("Before commit", "old-token"));
        Guid id = Guid.Parse(created.JsonBody!["id"]!.GetValue<string>());
        JsonObject update = NewKuroTaskInput("Committed name", "new-token");
        update["id"] = id.ToString();
        secrets.FailReadsAfterSet = true;

        PluginWebApiResponse result = await InvokeAsync(context, "PUT", "tasks", update);

        Assert.Equal(500, result.StatusCode);
        Assert.Equal("task_save_unconfirmed", result.JsonBody!["error"]!.GetValue<string>());
        Assert.Equal("new-token", CredentialRecord.Decode(await context.Secrets.GetAsync(CheckInTaskService.SecretKey(id, "credential-kuro")))!.Value);
        secrets.FailReadsAfterSet = false;
        secrets.ReadFailure = false;
        Assert.Equal("Committed name", (await GetTaskStateAsync(context, id))["name"]!.GetValue<string>());
        await service.StopAsync(CancellationToken.None);
    }

    [Fact]
    public async Task TaskApi_ReadCredentialIsScopedAndDoesNotModifyTaskOrSecrets()
    {
        var context = new FakePluginHostContext("game-check-in");
        var service = new CheckInTaskService(context, () => new DateTimeOffset(2026, 10, 8, 8, 0, 0, TimeSpan.FromHours(8)));
        Guid id = await CreateKuroTaskAsync(context, "Read", "saved-kuro");
        foreach (string platform in new[] { "cn", "os", "skland", "skport", "kuro" })
        {
            await context.Secrets.SetAsync(CheckInTaskService.SecretKey(id, "credential-" + platform), "saved-" + platform);
            PluginWebApiResponse response = await InvokeAsync(context, "POST", "tasks/credential/read", new JsonObject { ["taskId"] = id.ToString(), ["platform"] = platform });
            Assert.Equal(200, response.StatusCode);
            Assert.Equal("saved-" + platform, response.JsonBody!["value"]!.GetValue<string>());
            Assert.True(response.JsonBody["configured"]!.GetValue<bool>());
            Assert.Equal(4, response.JsonBody.AsObject().Count);
        }
        string state = (await GetStateAsync(context)).ToJsonString();
        Assert.DoesNotContain("saved-", state);
        Assert.Equal(400, (await InvokeAsync(context, "POST", "tasks/credential/read", new JsonObject { ["taskId"] = "invalid", ["platform"] = "kuro" })).StatusCode);
        Assert.Equal(400, (await InvokeAsync(context, "POST", "tasks/credential/read", new JsonObject { ["taskId"] = id.ToString(), ["platform"] = "../credential-kuro" })).StatusCode);
        Assert.Equal(404, (await InvokeAsync(context, "POST", "tasks/credential/read", new JsonObject { ["taskId"] = Guid.NewGuid().ToString(), ["platform"] = "kuro" })).StatusCode);
        Assert.Equal(state, (await GetStateAsync(context)).ToJsonString());
        await service.StopAsync(CancellationToken.None);
    }

    [Fact]
    public async Task TaskApi_ClearAndKeepCommitOnlyOnSaveAndSurviveServiceReload()
    {
        var context = new FakePluginHostContext("game-check-in");
        var service = new CheckInTaskService(context);
        Guid id = await CreateKuroTaskAsync(context, "Clear", "saved-kuro");
        await context.Secrets.SetAsync(CheckInTaskService.SecretKey(id, "credential-cn"), "saved-cn");
        JsonObject update = NewKuroTaskInput("Clear", "unused");
        update["id"] = id.ToString();
        update["secrets"] = new JsonObject { ["kuro"] = new JsonObject { ["action"] = "keep" }, ["cn"] = new JsonObject { ["action"] = "keep" } };
        Assert.Equal(200, (await InvokeAsync(context, "PUT", "tasks", update)).StatusCode);
        Assert.Equal("saved-kuro", CredentialRecord.Decode(await context.Secrets.GetAsync(CheckInTaskService.SecretKey(id, "credential-kuro")))!.Value);
        update["secrets"]!["kuro"]!["action"] = "clear";
        Assert.Equal("saved-kuro", CredentialRecord.Decode(await context.Secrets.GetAsync(CheckInTaskService.SecretKey(id, "credential-kuro")))!.Value);
        Assert.Equal(200, (await InvokeAsync(context, "PUT", "tasks", update)).StatusCode);
        await service.StopAsync(CancellationToken.None);
        var restarted = new CheckInTaskService(context);
        PluginWebApiResponse read = await InvokeAsync(context, "POST", "tasks/credential/read", new JsonObject { ["taskId"] = id.ToString(), ["platform"] = "kuro" });
        Assert.False(read.JsonBody!["configured"]!.GetValue<bool>());
        Assert.Null(read.JsonBody["value"]);
        Assert.Equal("saved-cn", await context.Secrets.GetAsync(CheckInTaskService.SecretKey(id, "credential-cn")));
        await restarted.StopAsync(CancellationToken.None);
    }

    [Fact]
    public async Task TaskApi_RunningSnapshotRejectsCredentialClear()
    {
        var context = new FakePluginHostContext("game-check-in");
        var service = new CheckInTaskService(context);
        using var entered = new ManualResetEventSlim(false);
        using var release = new ManualResetEventSlim(false);
        context.Http.ResponseFactory = request =>
        {
            entered.Set();
            if (!release.Wait(TimeSpan.FromSeconds(8))) throw new TimeoutException("run fixture was not released");
            return new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent("{\"code\":200,\"data\":[]}") };
        };
        Guid id = await CreateKuroTaskAsync(context, "Running", "run-snapshot");
        try
        {
            Assert.Equal(202, (await InvokeAsync(context, "POST", "tasks/run", new JsonObject { ["taskId"] = id.ToString() })).StatusCode);
            Assert.True(await Task.Run(() => entered.Wait(TimeSpan.FromSeconds(5))));
            JsonObject update = NewKuroTaskInput("Running", "unused");
            update["id"] = id.ToString();
            update["secrets"] = new JsonObject { ["kuro"] = new JsonObject { ["action"] = "clear" } };
            PluginWebApiResponse response = await InvokeAsync(context, "PUT", "tasks", update);
            Assert.Equal(409, response.StatusCode);
            Assert.Equal("task_running", response.JsonBody!["error"]!.GetValue<string>());
            Assert.Equal("run-snapshot", CredentialRecord.Decode(await context.Secrets.GetAsync(CheckInTaskService.SecretKey(id, "credential-kuro")))!.Value);
        }
        finally { release.Set(); await service.StopAsync(CancellationToken.None); }
    }
}
