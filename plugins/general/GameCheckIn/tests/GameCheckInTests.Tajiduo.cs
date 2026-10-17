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
    public async Task TajiduoLoginApiSavesCandidateWithoutReturningTokens()
    {
        var context = new FakePluginHostContext("game-check-in");
        var service = new CheckInTaskService(context);
        try
        {
            var responses = new Queue<string>(new[] { "{\"code\":0,\"result\":{\"token\":\"sdk-secret\",\"userId\":\"12345678\"}}",
                "{\"code\":0,\"data\":{\"accessToken\":\"access-secret\",\"refreshToken\":\"refresh-secret\",\"uid\":\"12345678\"}}" });
            context.Http.ResponseFactory = _ => new(HttpStatusCode.OK) { Content = new StringContent(responses.Dequeue(), Encoding.UTF8, "application/json") };
            var client = new PluginClientSessionContext("host", "owner", "desktop", true);
            var opened = await InvokeAsync(context, "POST", "credentials/editors", new JsonObject(), client);
            string editor = opened.JsonBody!["editorSessionId"]!.GetValue<string>();
            var prepared = await InvokeAsync(context, "POST", "credentials/login/prepare", new JsonObject { ["editorSessionId"] = editor, ["platform"] = "tajiduo", ["expectedFieldGeneration"] = 0 }, client);
            Assert.Equal(200, prepared.StatusCode);
            var input = new JsonObject { ["editorSessionId"] = editor, ["operation"] = prepared.JsonBody!["context"]!["operation"]!.GetValue<string>(), ["mode"] = "password", ["phone"] = "13812345678", ["value"] = "password" };
            Assert.Equal(403, (await InvokeAsync(context, "POST", "credentials/login/tajiduo", input, client with { ClientSessionId = "other" })).StatusCode);
            var login = await InvokeAsync(context, "POST", "credentials/login/tajiduo", input, client);
            Assert.Equal(200, login.StatusCode);
            Assert.DoesNotContain("secret", login.JsonBody!.ToJsonString());
            input["mode"] = "accept"; input.Remove("phone"); input.Remove("value");
            login = await InvokeAsync(context, "POST", "credentials/login/tajiduo", input, client);
            Assert.Equal(200, login.StatusCode);
            Assert.Empty(context.Secrets.Values);
            var field = login.JsonBody!["editor"]!["fields"]!["tajiduo"]!;
            var body = NewTaskInput("Tajiduo browser", "10:30", DayOfWeek.Monday);
            body["games"] = new JsonObject { ["tajiduo"] = new JsonArray("nte") };
            body["editorSessionId"] = editor;
            body["secrets"] = new JsonObject { ["tajiduo"] = new JsonObject { ["action"] = "set", ["candidateId"] = field["candidateId"]!.GetValue<string>(), ["fieldGeneration"] = field["fieldGeneration"]!.GetValue<long>() } };
            var saved = await InvokeAsync(context, "POST", "tasks", body, client);
            Assert.Equal(201, saved.StatusCode);
            Guid id = Guid.Parse(saved.JsonBody!["id"]!.GetValue<string>());
            var record = CredentialRecord.Decode(await context.Secrets.GetAsync(CheckInTaskService.SecretKey(id, "credential-tajiduo")))!;
            Assert.Equal("browser", record.Source);
            Assert.Equal("refresh-secret", TajiduoCredential.Parse(record.Value)!.RefreshToken);
            Assert.DoesNotContain("password", record.Encode());
            Assert.Empty(responses);
        }
        finally { await service.StopAsync(CancellationToken.None); }
    }

    [Fact]
    public async Task TajiduoTaskPersistsRotatedCredentialAndDeduplicatesAfterRestart()
    {
        var context = new FakePluginHostContext("game-check-in");
        var service = new CheckInTaskService(context);
        var credential = new TajiduoCredential("access-old", "refresh-old", "100", "device");
        var responses = new Queue<string>(new[]
        {
            "{\"code\":0,\"data\":{\"accessToken\":\"access-new\",\"refreshToken\":\"refresh-new\"}}",
            "{\"code\":0,\"data\":{\"roles\":[{\"roleId\":\"1\"}]}}",
            "{\"code\":0,\"data\":{\"todaySign\":false}}", "{\"code\":0}",
            "{\"code\":0,\"data\":{\"todaySign\":true}}",
        });
        int requests = 0;
        context.Http.ResponseFactory = _ =>
        {
            requests++;
            return new(HttpStatusCode.OK) { Content = new StringContent(responses.Dequeue(), Encoding.UTF8, "application/json") };
        };
        var body = NewTaskInput("Tajiduo", "10:30", DayOfWeek.Monday);
        body["games"] = new JsonObject { ["tajiduo"] = new JsonArray("nte") };
        body["secrets"] = new JsonObject { ["tajiduo"] = new JsonObject { ["action"] = "set", ["value"] = credential.Encode() } };
        var created = await InvokeAsync(context, "POST", "tasks", body);
        Assert.Equal(201, created.StatusCode);
        Guid id = Guid.Parse(created.JsonBody!["id"]!.GetValue<string>());
        Assert.Equal(202, (await InvokeAsync(context, "POST", "tasks/run", new JsonObject { ["taskId"] = id.ToString() })).StatusCode);
        var completed = await WaitForStateAsync(context, id, 1);
        Assert.True(completed["runs"]![0]!["results"]![0]!["success"]!.GetValue<bool>());
        var saved = CredentialRecord.Decode(await context.Secrets.GetAsync(CheckInTaskService.SecretKey(id, "credential-tajiduo")))!;
        Assert.Equal("refresh-new", TajiduoCredential.Parse(saved.Value)!.RefreshToken);
        Assert.DoesNotContain("refresh-new", completed.ToJsonString());
        await service.StopAsync(CancellationToken.None);
        var restarted = new CheckInTaskService(context);
        Assert.Equal(202, (await InvokeAsync(context, "POST", "tasks/run", new JsonObject { ["taskId"] = id.ToString() })).StatusCode);
        completed = await WaitForStateAsync(context, id, 2);
        Assert.Equal("already", completed["runs"]![0]!["results"]![0]!["code"]!.GetValue<string>());
        Assert.Equal(5, requests);
        await restarted.StopAsync(CancellationToken.None);
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
}
