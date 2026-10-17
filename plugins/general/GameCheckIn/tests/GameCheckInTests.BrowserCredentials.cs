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
    public async Task BrowserWebContextIsSavedReloadedAndUsedByTaskExecution()
    {
        foreach (string platform in new[] { "skland", "kuro" })
        {
            var context = new FakePluginHostContext("game-check-in");
            context.Http.ResponseFactory = request =>
            {
                string path = request.RequestUri!.AbsolutePath;
                string body;
                if (platform == "kuro")
                {
                    Assert.Equal("h5", request.Headers.GetValues("source").Single());
                    Assert.Equal("browser-distinct", request.Headers.GetValues("distinct_id").Single());
                    body = path == "/user/mineV2" ? "{\"code\":200,\"data\":{\"mine\":{\"userId\":12345678}}}"
                        : path == "/user/role/findRoleList" ? "{\"code\":200,\"data\":[{\"roleId\":\"role\",\"serverId\":\"server\",\"userId\":\"12345678\"}]}"
                        : path == "/encourage/signIn/v2" ? "{\"code\":200}" : throw new InvalidOperationException();
                }
                else
                {
                    Assert.Equal("Bbrowser_device", request.Headers.GetValues("dId").Single());
                    Assert.Equal("3", request.Headers.GetValues("platform").Single());
                    Assert.False(request.Headers.Contains("X-Requested-With"));
                    body = path.EndsWith("/grant") ? "{\"status\":0,\"data\":{\"code\":\"grant\"}}"
                        : path.EndsWith("/generate_cred_by_code") ? "{\"code\":0,\"data\":{\"cred\":\"cred\",\"token\":\"sign\"}}"
                        : path.EndsWith("/user") ? "{\"code\":0,\"data\":{\"user\":{\"id\":\"12345678\"}}}"
                        : path.EndsWith("/binding") ? "{\"code\":0,\"data\":{\"list\":[{\"appCode\":\"arknights\",\"bindingList\":[{\"uid\":\"uid\",\"channelMasterId\":\"1\"}]}]}}"
                        : path.EndsWith("/attendance") ? "{\"code\":0}" : throw new InvalidOperationException();
                    if (request.Headers.Contains("sign"))
                    {
                        string timestamp = request.Headers.GetValues("timestamp").Single();
                        string payload = request.Content?.ReadAsStringAsync().GetAwaiter().GetResult() ?? "";
                        Assert.Equal(SklandClient.ComputeSign("sign", path, payload, timestamp, "Bbrowser_device", "3", "1.0.0"), request.Headers.GetValues("sign").Single());
                    }
                }
                return new(HttpStatusCode.OK) { Content = new StringContent(body) };
            };
            var service = new CheckInTaskService(context);
            Guid taskId = await CreateKuroTaskAsync(context, "Web context", "old-secret");
            var client = new PluginClientSessionContext("host", "owner", "desktop", true);
            var editor = await InvokeAsync(context, "POST", "credentials/editors", new JsonObject { ["taskId"] = taskId }, client);
            string editorId = editor.JsonBody!["editorSessionId"]!.GetValue<string>();
            var preparation = await InvokeAsync(context, "POST", "credentials/login/prepare", new JsonObject { ["editorSessionId"] = editorId, ["platform"] = platform, ["expectedFieldGeneration"] = 0 }, client);
            long generation = preparation.JsonBody!["fieldGeneration"]!.GetValue<long>();
            var invocation = new PluginBrowserInvocation(Guid.NewGuid().ToString("N"), editorId, generation, preparation.JsonBody["context"]!.AsObject(), client);
            PluginBrowserCapture capture = platform == "kuro"
                ? new([], [new("https://www.kurobbs.com", "localStorage", "auth_token", "web-token"), new("https://www.kurobbs.com", "localStorage", "distinct_id", "browser-distinct")], DateTimeOffset.UtcNow)
                : new([], [new("https://www.skland.com", "localStorage", "SK_SHUMEI_DEVICE_ID_KEY", "{\"id\":\"Bbrowser_device\",\"timestamp\":123}")], DateTimeOffset.UtcNow) { JsonValues = [new("passport-token", "web-token")] };
            var flow = context.BrowserLogin.Flows[platform];
            var candidate = await flow.Complete(capture, invocation, CancellationToken.None);
            Assert.True(candidate.Success);
            await flow.Terminal(invocation, PluginBrowserLoginTerminal.Completed, CancellationToken.None);
            var active = await InvokeAsync(context, "POST", "credentials/editors/state", new JsonObject { ["editorSessionId"] = editorId }, client);
            generation = active.JsonBody!["fields"]![platform]!["fieldGeneration"]!.GetValue<long>();
            var update = NewKuroTaskInput("Web context", "unused");
            update["id"] = taskId; update["editorSessionId"] = editorId;
            update["games"] = new JsonObject { [platform] = new JsonArray(JsonValue.Create(platform == "kuro" ? "ww" : "ak")) };
            update["secrets"] = new JsonObject { [platform] = new JsonObject { ["action"] = "set", ["candidateId"] = candidate.CandidateId, ["fieldGeneration"] = generation } };
            Assert.Equal(200, (await InvokeAsync(context, "PUT", "tasks", update, client)).StatusCode);
            var record = CredentialRecord.Decode(await context.Secrets.GetAsync(CheckInTaskService.SecretKey(taskId, "credential-" + platform)))!;
            Assert.Equal(platform, record.WebContext!.Platform);
            string view = (await GetTaskStateAsync(context, taskId)).ToJsonString();
            Assert.DoesNotContain("browser-distinct", view); Assert.DoesNotContain("Bbrowser_device", view);
            await service.StopAsync(CancellationToken.None);
            var restarted = new CheckInTaskService(context);
            try
            {
                Assert.Equal(202, (await InvokeAsync(context, "POST", "tasks/run", new JsonObject { ["taskId"] = taskId })).StatusCode);
                var state = await WaitForStateAsync(context, taskId, 1);
                Assert.Equal("success", state["runs"]![0]!["status"]!.GetValue<string>());
            }
            finally { await restarted.StopAsync(CancellationToken.None); }
        }
    }

    [Fact]
    public async Task TaskApi_BrowserCandidateSurvivesRollbackAndCommitsOnlyForOwner()
    {
        var context = new FakePluginHostContext("game-check-in");
        using var store = new ControlledScopedDataStore(context.ScopedData);
        var service = new CheckInTaskService(new ScopedDataHostContext(context, store), browserLoginReady: platform => platform == "os");
        try
        {
            Guid taskId = await CreateKuroTaskAsync(context, "Browser candidate", "old-manual-secret");
            var client = new PluginClientSessionContext("host", "owner", "desktop", true);
            var opened = await InvokeAsync(context, "POST", "credentials/editors", new JsonObject { ["taskId"] = taskId }, client);
            string editorId = opened.JsonBody!["editorSessionId"]!.GetValue<string>();
            var prepared = await InvokeAsync(context, "POST", "credentials/login/prepare", new JsonObject
            {
                ["editorSessionId"] = editorId, ["platform"] = "os", ["expectedFieldGeneration"] = 0,
            }, client);
            Assert.Equal(200, prepared.StatusCode);
            long generation = prepared.JsonBody!["fieldGeneration"]!.GetValue<long>();
            var invocation = new PluginBrowserInvocation("operation", editorId, generation, prepared.JsonBody["context"]!.AsObject(), client);
            context.Http.ResponseFactory = request => new(HttpStatusCode.OK)
            {
                Content = new StringContent(request.RequestUri!.AbsolutePath.EndsWith("/info")
                    ? "{\"retcode\":0,\"data\":{\"is_sign\":false}}"
                    : "{\"retcode\":0,\"data\":{\"list\":[{\"game_uid\":\"123456789\"}]}}"),
            };
            var flow = context.BrowserLogin.Flows["os"];
            flow.ValidateInvocation(invocation);
            var candidate = await flow.Complete(new([new(".hoyolab.com", "/", "ltuid_v2", "123"), new(".hoyolab.com", "/", "ltoken_v2", "synthetic-token")], [], DateTimeOffset.UtcNow), invocation, CancellationToken.None);
            Assert.True(candidate.Success);
            await flow.Terminal(invocation, PluginBrowserLoginTerminal.Completed, CancellationToken.None);
            var update = NewKuroTaskInput("Browser committed", "unused");
            update["id"] = taskId; update["editorSessionId"] = editorId;
            update["secrets"] = new JsonObject { ["os"] = new JsonObject { ["action"] = "set", ["candidateId"] = candidate.CandidateId, ["fieldGeneration"] = generation } };
            var foreign = client with { ClientSessionId = "other" };
            Assert.Equal(403, (await InvokeAsync(context, "PUT", "tasks", update, foreign)).StatusCode);
            Assert.Equal(409, (await InvokeAsync(context, "PUT", "tasks", update, client)).StatusCode);
            var active = await InvokeAsync(context, "POST", "credentials/editors/state", new JsonObject { ["editorSessionId"] = editorId }, client);
            update["secrets"]!["os"]!["fieldGeneration"] = active.JsonBody!["fields"]!["os"]!["fieldGeneration"]!.GetValue<long>();
            string key = CheckInTaskService.SecretKey(taskId, "credential-os");
            store.FailNextWrite();
            Assert.Equal(500, (await InvokeAsync(context, "PUT", "tasks", update, client)).StatusCode);
            Assert.Null(await context.Secrets.GetAsync(key));
            var retained = await InvokeAsync(context, "POST", "credentials/editors/state", new JsonObject { ["editorSessionId"] = editorId }, client);
            Assert.Equal(candidate.CandidateId, retained.JsonBody!["fields"]!["os"]!["candidateId"]!.GetValue<string>());
            Assert.Equal(200, (await InvokeAsync(context, "PUT", "tasks", update, client)).StatusCode);
            var record = CredentialRecord.Decode(await context.Secrets.GetAsync(key))!;
            Assert.Equal("browser", record.Source); Assert.Contains("synthetic-token", record.Value);
            Assert.Equal("old-manual-secret", CredentialRecord.Decode(await context.Secrets.GetAsync(CheckInTaskService.SecretKey(taskId, "credential-kuro")))!.Value);
            Assert.Equal(400, (await InvokeAsync(context, "POST", "credentials/editors/state", new JsonObject { ["editorSessionId"] = editorId }, client)).StatusCode);
            var state = await GetTaskStateAsync(context, taskId);
            Assert.Equal("browser", state["credentialStates"]!["os"]!["source"]!.GetValue<string>());
            Assert.DoesNotContain("synthetic-token", state.ToJsonString());
            Assert.Equal(403, (await InvokeAsync(context, "POST", "tasks/credential/read", new JsonObject { ["taskId"] = taskId, ["platform"] = "os" })).StatusCode);
            var reopened = await InvokeAsync(context, "POST", "credentials/editors", new JsonObject { ["taskId"] = taskId }, client);
            var read = new JsonObject { ["editorSessionId"] = reopened.JsonBody!["editorSessionId"]!.GetValue<string>(), ["platform"] = "os", ["fieldGeneration"] = 0 };
            Assert.Equal(403, (await InvokeAsync(context, "POST", "tasks/credential/read", read, client)).StatusCode);
            Assert.Equal(200, (await InvokeAsync(context, "POST", "tasks/credential/reveal/confirm", new JsonObject { ["confirm"] = true }, client)).StatusCode);
            Assert.Equal(record.Value, (await InvokeAsync(context, "POST", "tasks/credential/read", read, client)).JsonBody!["value"]!.GetValue<string>());
        }
        finally { await service.StopAsync(CancellationToken.None); }
    }
}
