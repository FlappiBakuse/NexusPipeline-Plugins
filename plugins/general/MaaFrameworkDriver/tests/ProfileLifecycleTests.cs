using System.Text.Json;
using System.Text.Json.Nodes;
using NexusPipeline.Plugin.Abstractions;
using Xunit;

namespace NexusPipeline.Plugin.MaaFrameworkDriver.Tests;

public sealed class ProfileLifecycleTests
{
    [Fact]
    public async Task SharedAndUserProfilesRequireCasAuthorizationAndCurrentParent()
    {
        using var fixture = new Fixture();
        var preview = await fixture.Call("preview", fixture.Profile);
        Assert.Equal(200, preview.StatusCode);
        Assert.Empty(fixture.Host.Data.Values);
        var shared = await fixture.Authorize(fixture.Profile);
        Assert.NotEmpty(shared.Revision);
        Assert.NotEmpty(shared.AuthorizedFingerprint);
        var draft = (await fixture.Call("profile", shared, "user")).JsonBody!.Deserialize<DriverProfile>(DriverJson.Options)!;
        Assert.Equal(shared.Revision, draft.ParentRevision);
        Assert.Empty(draft.Revision); Assert.Empty(draft.AuthorizedFingerprint);
        var bound = await fixture.Authorize(draft, "user");
        var prepared = await fixture.Plugin.PrepareAsync(fixture.Request("user"), default);
        Assert.Equal(shared.Revision + ":" + bound.Revision, prepared.ConfigRevision);
        Assert.Equal(new[] { "T" }, prepared.Tasks.Select(task => task.Id));
        shared = await fixture.Authorize(shared with { Language = "en_us" });
        await Assert.ThrowsAsync<InvalidDataException>(async () => await fixture.Plugin.PrepareAsync(fixture.Request("user"), default));
        var stale = await fixture.Call("authorize", bound, "user");
        Assert.Equal(400, stale.StatusCode);
        draft = (await fixture.Call("profile", bound, "user")).JsonBody!.Deserialize<DriverProfile>(DriverJson.Options)!;
        Assert.Equal(shared.Revision, draft.ParentRevision);
        Assert.Empty(draft.AuthorizedFingerprint);
        await fixture.Authorize(draft, "user");
        Assert.NotNull(await fixture.Plugin.PrepareAsync(fixture.Request("user"), default));
    }

    [Fact]
    public async Task TwoSimultaneousWritesWithSameRevisionCannotBothCommit()
    {
        using var fixture = new Fixture();
        var answers = await Task.WhenAll(fixture.Call("save", fixture.Profile), fixture.Call("save", fixture.Profile));
        Assert.Equal(new[] { 200, 409 }, answers.Select(answer => answer.StatusCode).Order());
        Assert.Single(fixture.Host.Data.Values);
    }

    [Fact]
    public async Task BusyOrQuarantinedConfigurationCannotWriteProfileOrSecret()
    {
        using var fixture = new Fixture();
        fixture.Host.Registry.Available = false;
        Assert.Equal(409, (await fixture.Call("save", fixture.Profile)).StatusCode);
        Assert.Equal(409, (await fixture.Call("secret", fixture.Profile, extra: new() { ["name"] = "Password", ["value"] = "fixture-private" })).StatusCode);
        Assert.Empty(fixture.Host.Data.Values); Assert.Empty(fixture.Host.Secret.Values);
        Assert.Equal(200, (await fixture.Call("preview", fixture.Profile)).StatusCode);
    }

    [Fact]
    public async Task SecretFromAnotherProfileIsRefusedBeforeReadingStoreOrStartingWorker()
    {
        using var fixture = new Fixture();
        var shared = await fixture.Authorize(fixture.Profile with { Options = new() { ["Password"] = new JsonObject { ["P"] = "secret:driver-other--Password" } } });
        var plan = await fixture.Plugin.PrepareAsync(fixture.Request(""), default);
        var worker = new Worker();
        var context = new PluginProviderRunContext("execution", "record", 1, "", "script", plan, worker, _ => ValueTask.CompletedTask);
        var error = await Assert.ThrowsAsync<InvalidDataException>(() => fixture.Plugin.RunAsync(context, default));
        Assert.Contains("secret_scope_mismatch", error.Message);
        Assert.Equal(0, fixture.Host.Secret.ReadCount); Assert.False(worker.Started);
    }

    [Fact]
    public async Task ProtectedSecretsUseUnambiguousProfileUserAndScriptScopes()
    {
        using var fixture = new Fixture();
        var shared = await fixture.Authorize(fixture.Profile);
        string sharedRef = (await fixture.Call("secret", shared, extra: new() {
            ["name"] = "P", ["value"] = "shared-owned-value" })).JsonBody!["reference"]!.GetValue<string>();
        async Task<string> Set(string user, string name, string script)
        {
            var profile = shared with { ParentRevision = shared.Revision, Revision = "" };
            var response = await fixture.Call("secret", profile, user, new() {
                ["scriptId"] = script, ["name"] = name, ["value"] = "owned-value-" + user });
            Assert.Equal(200, response.StatusCode);
            return response.JsonBody!["reference"]!.GetValue<string>();
        }
        string first = await Set("a-b", "c", "script");
        string second = await Set("a", "b-c", "script");
        string otherScript = await Set("a-b", "c", "other-script");
        Assert.NotEqual(first, second); Assert.NotEqual(first, otherScript); Assert.NotEqual(first, sharedRef);
        Assert.All(fixture.Host.Secret.Values.Keys, key => Assert.InRange(key.Length, 1, 128));
        var draft = (await fixture.Call("profile", shared, "a-b")).JsonBody!.Deserialize<DriverProfile>(DriverJson.Options)!;
        draft = await fixture.Authorize(draft with { Options = new() { ["Password"] = new JsonObject { ["P"] = sharedRef } } }, "a-b");
        var plan = await fixture.Plugin.PrepareAsync(fixture.Request("a-b"), default);
        var worker = new Worker();
        await fixture.Plugin.RunAsync(new("execution", "record", 1, "a-b", "script", plan, worker, _ => ValueTask.CompletedTask), default);
        Assert.True(worker.Started); Assert.Equal(1, fixture.Host.Secret.ReadCount);
        var alien = await fixture.Authorize(draft with { Options = new() { ["Password"] = new JsonObject { ["P"] = otherScript } } }, "a-b");
        plan = await fixture.Plugin.PrepareAsync(fixture.Request("a-b"), default);
        worker = new Worker();
        await Assert.ThrowsAsync<InvalidDataException>(() => fixture.Plugin.RunAsync(
            new("execution", "record", 1, "a-b", "script", plan, worker, _ => ValueTask.CompletedTask), default));
        Assert.False(worker.Started); Assert.Equal(1, fixture.Host.Secret.ReadCount);
    }

    [Fact]
    public async Task ChangingAuthorizedNativeBytesRefusesRunAndKeepsOriginalProfile()
    {
        using var fixture = new Fixture();
        var saved = await fixture.Authorize(fixture.Profile);
        var plan = await fixture.Plugin.PrepareAsync(fixture.Request(""), default);
        File.WriteAllText(Path.Combine(fixture.Root, "native", "MaaFramework.dll"), "changed owned bytes");
        var worker = new Worker();
        var context = new PluginProviderRunContext("execution", "record", 1, "", "script", plan, worker, _ => ValueTask.CompletedTask);
        var error = await Assert.ThrowsAsync<InvalidDataException>(() => fixture.Plugin.RunAsync(context, default));
        Assert.Contains("authorization_required", error.Message); Assert.False(worker.Started);
        Assert.Equal(saved.Revision, (await fixture.Host.Data.ReadAsync<DriverProfile>("profile/p"))!.Revision);
    }

    private sealed class Fixture : IDisposable
    {
        internal string Root { get; } = Path.Combine(Path.GetTempPath(), "nxp-maa-profile-" + Guid.NewGuid().ToString("N"));
        internal Context Host { get; } = new();
        internal EntryPoint Plugin { get; } = new();
        internal DriverProfile Profile => new() { ProfileId = "p", PackageRoot = Root, Controller = "PC", Resource = "R",
            NativeDirectory = "native", NativeVersion = "v5.14.0", SelectedTasks = ["T"],
            Options = new() { ["Password"] = new JsonObject { ["P"] = "secret:driver-p--Password" } } };
        internal Fixture()
        {
            Directory.CreateDirectory(Path.Combine(Root, "native")); Directory.CreateDirectory(Path.Combine(Root, "resource"));
            File.WriteAllText(Path.Combine(Root, "native", "MaaFramework.dll"), "fixture only; not executable");
            File.WriteAllText(Path.Combine(Root, "interface.json"), """
                {"interface_version":2,"name":"Fixture","controller":[{"name":"PC","type":"Win32"}],
                 "resource":[{"name":"R","path":["resource"]}],"task":[{"name":"T","entry":"Entry","option":["Password"]}],
                 "option":{"Password":{"type":"input","inputs":[{"name":"P","password":true}],"pipeline_override":{"Entry":{"text":"{P}"}}}}}
                """);
            Plugin.InitializeAsync(Host, default).GetAwaiter().GetResult();
        }
        internal PluginProviderPrepareRequest Request(string user) => new("p", user, "script", Root, "interface.json", "", new());
        internal async Task<PluginWebApiResponse> Call(string route, DriverProfile profile, string user = "", JsonObject? extra = null)
        {
            var body = new JsonObject { ["scriptId"] = "script", ["profileId"] = "p", ["userId"] = user,
                ["expectedRevision"] = profile.Revision, ["profile"] = JsonSerializer.SerializeToNode(profile, DriverJson.Options) };
            if (route == "authorize")
                body["confirmedFingerprint"] = new ProjectCompiler(Root, "interface.json").Compile(profile).ExecutionFingerprint;
            if (extra is not null) foreach (var pair in extra) body[pair.Key] = pair.Value?.DeepClone();
            return await Host.Routes.Routes[route].Handler(new("POST", route, new Dictionary<string, string>(), body.ToJsonString()), default);
        }
        internal async Task<DriverProfile> Authorize(DriverProfile profile, string user = "")
        {
            var response = await Call("authorize", profile, user);
            Assert.True(response.StatusCode == 200, response.JsonBody?.ToJsonString());
            return response.JsonBody!.Deserialize<DriverProfile>(DriverJson.Options)!;
        }
        public void Dispose() { Plugin.StopAsync(default).GetAwaiter().GetResult(); Directory.Delete(Root, true); }
    }

    private sealed class Context : IPluginHostContextV1_9
    {
        internal DataStore Data { get; } = new();
        internal SecretStore Secret { get; } = new();
        internal RoutesStore Routes { get; } = new();
        internal ProviderRegistry Registry { get; } = new();
        public string PluginName => "maa-framework";
        public IPluginScopedDataStore ScopedData => Data;
        public IPluginSecretStore Secrets => Secret;
        public IPluginWebApiRegistry WebApi => Routes;
        public IPluginExecutionProviderRegistry ExecutionProviders => Registry;
        public IPluginLogger Logger => throw new NotSupportedException();
        public IPluginConfigStore Config => throw new NotSupportedException();
        public IPluginNotificationService Notifications => throw new NotSupportedException();
        public IPluginJobScheduler Scheduler => throw new NotSupportedException();
        public IPluginUserDataStore UserData => throw new NotSupportedException();
        public IPluginUserGlobalManagementRegistry UserGlobalManagement => throw new NotSupportedException();
        public IPluginExecutionEventService ExecutionEvents => throw new NotSupportedException();
        public IPluginHttpClientFactory Http => throw new NotSupportedException();
        public IPluginUserListBadgeRegistry UserListBadges => throw new NotSupportedException();
        public IPluginUiContributionRegistry Ui => throw new NotSupportedException();
        public IPluginHistoryContributionRegistry History => throw new NotSupportedException();
        public IPluginLocalization I18n => throw new NotSupportedException();
        public IPluginAssetStore Assets => throw new NotSupportedException();
        public IPluginEmulatorSupportRegistry EmulatorSupport => throw new NotSupportedException();
    }
    private sealed class Lease(Action? dispose = null) : IDisposable { public void Dispose() => dispose?.Invoke(); }
    private sealed class ProviderRegistry : IPluginExecutionProviderRegistry
    {
        internal bool Available = true;
        public IDisposable Register(IPluginExecutionProvider provider) => new Lease();
        public IDisposable? TryAcquireConfiguration(string scriptInstanceId, string userId, string packageRoot) => Available ? new Lease() : null;
    }
    private sealed class RoutesStore : IPluginWebApiRegistry
    {
        internal Dictionary<string, PluginWebApiRoute> Routes { get; } = new();
        public IDisposable Register(PluginWebApiRoute route) { Routes.Add(route.Route, route); return new Lease(() => Routes.Remove(route.Route)); }
    }
    private sealed class DataStore : IPluginScopedDataStore
    {
        internal Dictionary<string, JsonNode?> Values { get; } = new();
        public ValueTask<T?> ReadAsync<T>(string scope, CancellationToken cancellationToken = default) =>
            ValueTask.FromResult(Values.TryGetValue(scope, out var value) && value is not null ? value.Deserialize<T>(DriverJson.Options) : default);
        public ValueTask WriteAsync<T>(string scope, T value, CancellationToken cancellationToken = default)
        { Values[scope] = JsonSerializer.SerializeToNode(value, DriverJson.Options); return ValueTask.CompletedTask; }
        public ValueTask<JsonObject?> ReadJsonAsync(string scope, CancellationToken cancellationToken = default) => ReadAsync<JsonObject>(scope, cancellationToken);
        public ValueTask WriteJsonAsync(string scope, JsonObject value, CancellationToken cancellationToken = default) => WriteAsync(scope, value, cancellationToken);
        public ValueTask DeleteAsync(string scope, CancellationToken cancellationToken = default)
        { Values.Remove(scope); return ValueTask.CompletedTask; }
    }
    private sealed class SecretStore : IPluginSecretStore
    {
        internal Dictionary<string, string?> Values { get; } = new(); internal int ReadCount;
        public ValueTask<string?> GetAsync(string key, CancellationToken cancellationToken = default)
        { ReadCount++; return ValueTask.FromResult(Values.GetValueOrDefault(key)); }
        public ValueTask SetAsync(string key, string? value, CancellationToken cancellationToken = default)
        { Values[key] = value; return ValueTask.CompletedTask; }
    }
    private sealed class Worker : IPluginProviderWorkerPort
    {
        internal bool Started;
        public Task<PluginProviderWorkerResult> RunAsync(PluginProviderWorkerRequest request, Func<PluginProviderEvent, ValueTask> onEvent, CancellationToken cancellationToken)
        { Started = true; return Task.FromResult(new PluginProviderWorkerResult("completed", 0, true)); }
    }
}
