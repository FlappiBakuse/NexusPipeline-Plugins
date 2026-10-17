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

    private static async Task<PluginWebApiResponse> InvokeAsync(
        FakePluginHostContext context,
        string method,
        string route,
        JsonObject? body = null,
        PluginClientSessionContext? client = null,
        CancellationToken cancellationToken = default)
    {
        PluginWebApiRoute registration = context.WebApi.Routes.Single(item => item.Method == method && item.Route == route);
        var request = new PluginWebApiRequest(method, route, new Dictionary<string, string>(), body?.ToJsonString(), PluginClientConnectionKind.Local) { ClientSession = client };
        return await registration.Handler(request, cancellationToken);
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

    private sealed class ScopedDataHostContext : IPluginHostContext
    {
        private readonly FakePluginHostContext _inner;

        public ScopedDataHostContext(FakePluginHostContext inner, IPluginScopedDataStore scopedData, IPluginSecretStore? secrets = null)
        {
            _inner = inner;
            ScopedData = scopedData;
            Secrets = secrets ?? inner.Secrets;
        }

        public string PluginName => _inner.PluginName;
        public IPluginLogger Logger => _inner.Logger;
        public IPluginConfigStore Config => _inner.Config;
        public IPluginSecretStore Secrets { get; }
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
        public IPluginExecutionProviderRegistry ExecutionProviders => _inner.ExecutionProviders;
        public IPluginDashboardCardRegistry DashboardCards => _inner.DashboardCards;
        public IPluginBrowserLoginRegistry BrowserLogin => _inner.BrowserLogin;
    }

    private sealed class ControlledSecrets(IPluginSecretStore inner) : IPluginSecretStore
    {
        public int? FailDeleteAt { get; set; }
        public int DeleteCount { get; private set; }
        public CancellationTokenSource? CancelOnDelete { get; set; }
        public string? FailSetValue { get; set; }
        public bool FailReadsAfterSet { get; set; }
        public bool ReadFailure { get; set; }

        public ValueTask<string?> GetAsync(string key, CancellationToken cancellationToken = default) =>
            ReadFailure ? throw new IOException("Injected secret read failure") : inner.GetAsync(key, cancellationToken);

        public async ValueTask SetAsync(string key, string? value, CancellationToken cancellationToken = default)
        {
            if (value is null && ++DeleteCount == FailDeleteAt) throw new IOException("Injected secret deletion failure");
            if (value is null && CancelOnDelete is { } cancellation) { cancellation.Cancel(); cancellationToken.ThrowIfCancellationRequested(); }
            if (value is not null && value == FailSetValue) throw new IOException("Injected secret rollback failure");
            await inner.SetAsync(key, value, cancellationToken);
            if (FailReadsAfterSet) ReadFailure = true;
        }
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
