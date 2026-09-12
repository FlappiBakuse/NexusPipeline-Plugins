using System.Collections.Concurrent;
using System.Net;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using NexusPipeline.Plugin.Abstractions;

namespace NexusPipeline.Plugin.TestKit;

public sealed record PluginLogEntry(string Level, string Message);

public sealed class RecordingPluginLogger : IPluginLogger
{
    private readonly ConcurrentQueue<PluginLogEntry> _entries = new();
    public IReadOnlyList<PluginLogEntry> Entries => _entries.ToArray();
    public void Debug(string message) => Add("debug", message);
    public void Info(string message) => Add("info", message);
    public void Warn(string message) => Add("warn", message);
    public void Error(string message) => Add("error", message);
    private void Add(string level, string message) => _entries.Enqueue(new PluginLogEntry(level, message));
}

public sealed class InMemoryPluginConfigStore : IPluginConfigStore
{
    private JsonNode? _value;
    public ValueTask<T?> ReadAsync<T>(CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();
        return _value is null
            ? ValueTask.FromResult<T?>(default)
            : ValueTask.FromResult<T?>(_value.Deserialize<T>());
    }
    public ValueTask WriteAsync<T>(T value, CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();
        _value = JsonSerializer.SerializeToNode(value);
        return ValueTask.CompletedTask;
    }
}

public sealed class InMemoryPluginSecretStore : IPluginSecretStore
{
    private readonly Dictionary<string, string> _values = new(StringComparer.OrdinalIgnoreCase);
    public IReadOnlyDictionary<string, string> Values => new Dictionary<string, string>(_values, StringComparer.OrdinalIgnoreCase);
    public ValueTask<string?> GetAsync(string key, CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();
        return ValueTask.FromResult(_values.TryGetValue(key, out string? value) ? value : null);
    }
    public ValueTask SetAsync(string key, string? value, CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();
        if (string.IsNullOrWhiteSpace(value)) _values.Remove(key);
        else _values[key] = value;
        return ValueTask.CompletedTask;
    }
}

public sealed class InMemoryPluginUserDataStore : IPluginUserDataStore
{
    private readonly Dictionary<string, JsonNode?> _configs = new(StringComparer.OrdinalIgnoreCase);
    private readonly Dictionary<(string UserId, string Key), string> _secrets = new();
    public ValueTask<T?> ReadConfigAsync<T>(string userId, CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();
        if (!_configs.TryGetValue(userId, out JsonNode? value) || value is null) return ValueTask.FromResult<T?>(default);
        return ValueTask.FromResult<T?>(value.Deserialize<T>());
    }
    public ValueTask WriteConfigAsync<T>(string userId, T value, CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();
        _configs[userId] = JsonSerializer.SerializeToNode(value);
        return ValueTask.CompletedTask;
    }
    public ValueTask<string?> GetSecretAsync(string userId, string key, CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();
        return ValueTask.FromResult(_secrets.TryGetValue((userId, key), out string? value) ? value : null);
    }
    public ValueTask SetSecretAsync(string userId, string key, string? value, CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();
        if (string.IsNullOrWhiteSpace(value)) _secrets.Remove((userId, key));
        else _secrets[(userId, key)] = value;
        return ValueTask.CompletedTask;
    }
    public bool HasConfig(string userId) => _configs.ContainsKey(userId);
    public bool HasSecret(string userId, string key) => _secrets.ContainsKey((userId, key));
}

public sealed class InMemoryPluginScopedDataStore : IPluginScopedDataStore
{
    private readonly Dictionary<string, JsonNode?> _values = new(StringComparer.OrdinalIgnoreCase);
    public ValueTask<T?> ReadAsync<T>(string scope, CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();
        if (!_values.TryGetValue(scope, out JsonNode? value) || value is null) return ValueTask.FromResult<T?>(default);
        return ValueTask.FromResult<T?>(value.Deserialize<T>());
    }
    public ValueTask WriteAsync<T>(string scope, T value, CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();
        _values[scope] = JsonSerializer.SerializeToNode(value);
        return ValueTask.CompletedTask;
    }
    public ValueTask<JsonObject?> ReadJsonAsync(string scope, CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();
        return ValueTask.FromResult(_values.TryGetValue(scope, out JsonNode? value) ? value?.AsObject() : null);
    }
    public ValueTask WriteJsonAsync(string scope, JsonObject value, CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();
        _values[scope] = value.DeepClone();
        return ValueTask.CompletedTask;
    }
    public ValueTask DeleteAsync(string scope, CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();
        _values.Remove(scope);
        return ValueTask.CompletedTask;
    }
    public bool Contains(string scope) => _values.ContainsKey(scope);
}

public sealed class InMemoryPluginAssetStore : IPluginAssetStore
{
    private sealed record Entry(byte[] Content, string Extension, DateTimeOffset CreatedAt);

    private readonly Dictionary<string, Dictionary<string, Entry>> _scopes = new(StringComparer.OrdinalIgnoreCase);
    private readonly object _sync = new();

    public int WriteCount { get; private set; }
    public int DeleteCount { get; private set; }

    public async ValueTask<PluginAssetInfo> WriteAsync(string scope, string extension, Stream content, CancellationToken cancellationToken = default)
    {
        using var buffer = new MemoryStream();
        await content.CopyToAsync(buffer, cancellationToken);
        byte[] bytes = buffer.ToArray();
        string id = Convert.ToHexString(SHA256.HashData(bytes)).ToLowerInvariant();
        string normalizedExtension = extension.Trim().TrimStart('.').ToLowerInvariant();
        lock (_sync)
        {
            WriteCount += 1;
            if (!_scopes.TryGetValue(scope, out Dictionary<string, Entry>? entries))
            {
                entries = new Dictionary<string, Entry>(StringComparer.OrdinalIgnoreCase);
                _scopes[scope] = entries;
            }
            if (entries.TryGetValue(id, out Entry? existing))
            {
                return new PluginAssetInfo(id, scope, existing.Extension, existing.Content.LongLength, existing.CreatedAt);
            }
            var entry = new Entry(bytes, normalizedExtension, DateTimeOffset.UtcNow);
            entries[id] = entry;
            return new PluginAssetInfo(id, scope, entry.Extension, entry.Content.LongLength, entry.CreatedAt);
        }
    }

    public ValueTask<PluginAssetContent?> OpenAsync(string scope, string assetId, CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();
        lock (_sync)
        {
            if (!_scopes.TryGetValue(scope, out Dictionary<string, Entry>? entries)
                || !entries.TryGetValue(assetId, out Entry? entry))
            {
                return ValueTask.FromResult<PluginAssetContent?>(null);
            }
            var info = new PluginAssetInfo(assetId, scope, entry.Extension, entry.Content.LongLength, entry.CreatedAt);
            return ValueTask.FromResult<PluginAssetContent?>(new PluginAssetContent(info, new MemoryStream(entry.Content, writable: false)));
        }
    }

    public ValueTask<bool> DeleteAsync(string scope, string assetId, CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();
        lock (_sync)
        {
            bool removed = _scopes.TryGetValue(scope, out Dictionary<string, Entry>? entries) && entries.Remove(assetId);
            if (removed)
            {
                DeleteCount += 1;
            }
            return ValueTask.FromResult(removed);
        }
    }

    public ValueTask<IReadOnlyList<PluginAssetInfo>> ListAsync(string scope, CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();
        lock (_sync)
        {
            IReadOnlyList<PluginAssetInfo> items = _scopes.TryGetValue(scope, out Dictionary<string, Entry>? entries)
                ? entries.Select(pair => new PluginAssetInfo(pair.Key, scope, pair.Value.Extension, pair.Value.Content.LongLength, pair.Value.CreatedAt))
                    .OrderBy(item => item.CreatedAt)
                    .ToArray()
                : Array.Empty<PluginAssetInfo>();
            return ValueTask.FromResult(items);
        }
    }
}

public sealed class RecordingPluginLocalization : IPluginLocalization
{
    private readonly Dictionary<string, string> _resources = new(StringComparer.Ordinal);
    public string Locale { get; init; } = "zh-CN";
    public string DefaultLocale { get; init; } = "zh-CN";
    public void Set(string key, string value) => _resources[key] = value;
    public string T(string key, string fallback = "", IReadOnlyDictionary<string, object?>? args = null)
    {
        string template = _resources.TryGetValue(key, out string? value) ? value : fallback;
        return args is null
            ? template
            : args.Aggregate(template, (current, pair) => current.Replace("{" + pair.Key + "}", pair.Value?.ToString() ?? "", StringComparison.Ordinal));
    }
    public string FormatNumber(double value) => value.ToString("0.##", System.Globalization.CultureInfo.InvariantCulture);
    public string FormatDate(DateTimeOffset value) => value.ToString("yyyy-MM-dd", System.Globalization.CultureInfo.InvariantCulture);
    public string FormatTime(DateTimeOffset value) => value.ToString("HH:mm", System.Globalization.CultureInfo.InvariantCulture);
}

public sealed class RecordingPluginNotificationService : IPluginNotificationService
{
    private readonly List<PluginNotification> _notifications = new();
    public IReadOnlyList<PluginNotification> Notifications => _notifications;
    public ValueTask SendAsync(PluginNotification notification, CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();
        _notifications.Add(notification);
        return ValueTask.CompletedTask;
    }
}

public sealed class RecordingPluginUiRegistry : IPluginUiContributionRegistry
{
    private readonly List<PluginUiContribution> _contributions = new();
    public IReadOnlyList<PluginUiContribution> Contributions => _contributions.ToArray();
    public IDisposable Register(PluginUiContribution contribution)
    {
        _contributions.Add(contribution);
        return new CallbackDisposable(() => _contributions.Remove(contribution));
    }
}

public sealed class RecordingPluginWebApiRegistry : IPluginWebApiRegistry
{
    private readonly List<PluginWebApiRoute> _routes = new();
    public IReadOnlyList<PluginWebApiRoute> Routes => _routes.ToArray();
    public IDisposable Register(PluginWebApiRoute route)
    {
        _routes.Add(route);
        return new CallbackDisposable(() => _routes.Remove(route));
    }
}

public sealed class RecordingPluginHistoryRegistry : IPluginHistoryContributionRegistry
{
    private readonly List<PluginHistoryContribution> _contributions = new();
    public IReadOnlyList<PluginHistoryContribution> Contributions => _contributions.ToArray();
    public IDisposable Register(PluginHistoryContribution contribution)
    {
        _contributions.Add(contribution);
        return new CallbackDisposable(() => _contributions.Remove(contribution));
    }
}

public sealed class RecordingPluginUserGlobalRegistry : IPluginUserGlobalManagementRegistry
{
    private readonly List<PluginUserGlobalManagementContribution> _contributions = new();
    public IReadOnlyList<PluginUserGlobalManagementContribution> Contributions => _contributions.ToArray();
    public IDisposable Register(PluginUserGlobalManagementContribution contribution)
    {
        _contributions.Add(contribution);
        return new CallbackDisposable(() => _contributions.Remove(contribution));
    }
}

public sealed class RecordingPluginUserBadgeRegistry : IPluginUserListBadgeRegistry
{
    private readonly List<PluginUserListBadgeContribution> _contributions = new();
    public IReadOnlyList<PluginUserListBadgeContribution> Contributions => _contributions.ToArray();
    public IDisposable Register(PluginUserListBadgeContribution contribution)
    {
        _contributions.Add(contribution);
        return new CallbackDisposable(() => _contributions.Remove(contribution));
    }
}

public sealed class RecordingPluginExecutionEvents : IPluginExecutionEventService
{
    private readonly List<Func<PluginUserRunStartingEvent, ValueTask>> _handlers = new();
    public int SubscriptionCount => _handlers.Count;
    public IDisposable SubscribeUserRunStarting(Func<PluginUserRunStartingEvent, ValueTask> handler)
    {
        _handlers.Add(handler);
        return new CallbackDisposable(() => _handlers.Remove(handler));
    }
    public async ValueTask PublishAsync(PluginUserRunStartingEvent eventData)
    {
        foreach (Func<PluginUserRunStartingEvent, ValueTask> handler in _handlers.ToArray()) await handler(eventData);
    }
}

public sealed class RecordingPluginJobScheduler : IPluginJobScheduler
{
    private readonly Dictionary<string, Func<PluginJobContext, CancellationToken, ValueTask>> _handlers = new(StringComparer.OrdinalIgnoreCase);
    private readonly Dictionary<string, PluginJobDefinition> _definitions = new(StringComparer.OrdinalIgnoreCase);
    public IReadOnlyDictionary<string, PluginJobDefinition> Definitions => _definitions;
    public IDisposable Register(PluginJobDefinition definition, Func<PluginJobContext, CancellationToken, ValueTask> handler)
    {
        _definitions[definition.Id] = definition;
        _handlers[definition.Id] = handler;
        return new CallbackDisposable(() =>
        {
            _definitions.Remove(definition.Id);
            _handlers.Remove(definition.Id);
        });
    }
    public ValueTask TriggerAsync(string id, CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();
        return _handlers.TryGetValue(id, out Func<PluginJobContext, CancellationToken, ValueTask>? handler)
            ? handler(new PluginJobContext("test-plugin", id, DateTimeOffset.Now, DateTimeOffset.Now), cancellationToken)
            : ValueTask.CompletedTask;
    }
}

public sealed class RecordingPluginHttpClientFactory : IPluginHttpClientFactory
{
    private sealed class Handler : HttpMessageHandler
    {
        private readonly RecordingPluginHttpClientFactory _owner;
        public Handler(RecordingPluginHttpClientFactory owner) => _owner = owner;
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            _owner.Requests.Add(request);
            return Task.FromResult(_owner.ResponseFactory?.Invoke(request)
                ?? new HttpResponseMessage(HttpStatusCode.OK)
                {
                    Content = new StringContent("{}", Encoding.UTF8, "application/json"),
                });
        }
    }
    public List<HttpRequestMessage> Requests { get; } = new();
    public Func<HttpRequestMessage, HttpResponseMessage>? ResponseFactory { get; set; }
    public HttpClient CreateClient(Uri? destination = null, TimeSpan? timeout = null, bool allowAutoRedirect = false)
    {
        var client = new HttpClient(new Handler(this)) { Timeout = timeout ?? TimeSpan.FromSeconds(30) };
        if (destination is not null) client.BaseAddress = destination;
        return client;
    }
}

public sealed class FakePluginHostContext : IPluginHostContextV1_6
{
    public FakePluginHostContext(string pluginName = "test-plugin")
    {
        PluginName = pluginName;
        Logger = new RecordingPluginLogger();
        Config = new InMemoryPluginConfigStore();
        Secrets = new InMemoryPluginSecretStore();
        Notifications = new RecordingPluginNotificationService();
        Scheduler = new RecordingPluginJobScheduler();
        UserData = new InMemoryPluginUserDataStore();
        UserGlobalManagement = new RecordingPluginUserGlobalRegistry();
        ExecutionEvents = new RecordingPluginExecutionEvents();
        Http = new RecordingPluginHttpClientFactory();
        UserListBadges = new RecordingPluginUserBadgeRegistry();
        Ui = new RecordingPluginUiRegistry();
        ScopedData = new InMemoryPluginScopedDataStore();
        WebApi = new RecordingPluginWebApiRegistry();
        History = new RecordingPluginHistoryRegistry();
        Assets = new InMemoryPluginAssetStore();
        I18n = new RecordingPluginLocalization();
    }
    public string PluginName { get; }
    public RecordingPluginLogger Logger { get; }
    IPluginLogger IPluginHostContext.Logger => Logger;
    public InMemoryPluginConfigStore Config { get; }
    IPluginConfigStore IPluginHostContext.Config => Config;
    public InMemoryPluginSecretStore Secrets { get; }
    IPluginSecretStore IPluginHostContext.Secrets => Secrets;
    public RecordingPluginNotificationService Notifications { get; }
    IPluginNotificationService IPluginHostContext.Notifications => Notifications;
    public RecordingPluginJobScheduler Scheduler { get; }
    IPluginJobScheduler IPluginHostContext.Scheduler => Scheduler;
    public InMemoryPluginUserDataStore UserData { get; }
    IPluginUserDataStore IPluginHostContextV1_1.UserData => UserData;
    public RecordingPluginUserGlobalRegistry UserGlobalManagement { get; }
    IPluginUserGlobalManagementRegistry IPluginHostContextV1_1.UserGlobalManagement => UserGlobalManagement;
    public RecordingPluginExecutionEvents ExecutionEvents { get; }
    IPluginExecutionEventService IPluginHostContextV1_1.ExecutionEvents => ExecutionEvents;
    public RecordingPluginHttpClientFactory Http { get; }
    IPluginHttpClientFactory IPluginHostContextV1_1.Http => Http;
    public RecordingPluginUserBadgeRegistry UserListBadges { get; }
    IPluginUserListBadgeRegistry IPluginHostContextV1_2.UserListBadges => UserListBadges;
    public RecordingPluginUiRegistry Ui { get; }
    IPluginUiContributionRegistry IPluginHostContextV1_3.Ui => Ui;
    public InMemoryPluginScopedDataStore ScopedData { get; }
    IPluginScopedDataStore IPluginHostContextV1_3.ScopedData => ScopedData;
    public RecordingPluginWebApiRegistry WebApi { get; }
    IPluginWebApiRegistry IPluginHostContextV1_3.WebApi => WebApi;
    public RecordingPluginHistoryRegistry History { get; }
    IPluginHistoryContributionRegistry IPluginHostContextV1_3.History => History;
    public RecordingPluginLocalization I18n { get; }
    IPluginLocalization IPluginHostContextV1_4.I18n => I18n;
    public InMemoryPluginAssetStore Assets { get; }
    IPluginAssetStore IPluginHostContextV1_6.Assets => Assets;
}

public sealed class PluginLifecycleHarness
{
    private readonly INexusPlugin _plugin;
    private readonly FakePluginHostContext _context;
    private bool _started;
    private bool _stopped;
    private PluginLifecycleHarness(INexusPlugin plugin, FakePluginHostContext context)
    {
        _plugin = plugin;
        _context = context;
    }
    public FakePluginHostContext Context => _context;
    public bool Started => _started;
    public bool Stopped => _stopped;
    public static async Task<PluginLifecycleHarness> StartAsync(INexusPlugin plugin, FakePluginHostContext? context = null, CancellationToken cancellationToken = default)
    {
        var harness = new PluginLifecycleHarness(plugin, context ?? new FakePluginHostContext());
        await plugin.InitializeAsync(harness._context, cancellationToken);
        await plugin.StartAsync(cancellationToken);
        harness._started = true;
        return harness;
    }
    public async Task StopAsync(CancellationToken cancellationToken = default)
    {
        if (_stopped) return;
        await _plugin.StopAsync(cancellationToken);
        _stopped = true;
    }
    public ValueTask DisposeAsync() => new(StopAsync());
}

internal sealed class CallbackDisposable : IDisposable
{
    private Action? _dispose;
    public CallbackDisposable(Action dispose) => _dispose = dispose;
    public void Dispose() => Interlocked.Exchange(ref _dispose, null)?.Invoke();
}
