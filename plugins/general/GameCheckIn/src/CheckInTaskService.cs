using System.Collections.Concurrent;
using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using NexusPipeline.Plugin.Abstractions;
using NexusPipeline.Plugin.GameCheckIn.Credentials;

namespace NexusPipeline.Plugin.GameCheckIn;

internal sealed partial class CheckInTaskService
{
    internal const string PollerJobId = "scheduled-check-in-poll";
    private const string StoreScope = "tasks-v2/task-store";
    private const int MaxTasks = 100;
    private const int MaxRunHistory = 20;
    private static readonly TimeSpan PollInterval = TimeSpan.FromSeconds(15);
    private static readonly TimeSpan StopDrainTimeout = TimeSpan.FromSeconds(16);
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);
    private static readonly string[] PlatformOrder = { "cn", "os", "skland", "skport", "kuro", "tajiduo" };

    private readonly IPluginHostContext _context;
    private readonly Func<DateTimeOffset> _clock;
    private readonly HoyoLabClient _osClient;
    private readonly MiyousheClient _cnClient;
    private readonly SklandClient _sklandClient;
    private readonly SklandClient _skportClient;
    private readonly KuroClient _kuroClient;
    private readonly SemaphoreSlim _storeGate = new(1, 1);
    private readonly SemaphoreSlim _pollGate = new(1, 1);
    private readonly ConcurrentDictionary<Guid, RunHandle> _activeRuns = new();
    private readonly SemaphoreSlim[] _credentialGameLocks = Enumerable.Range(0, 128).Select(_ => new SemaphoreSlim(1, 1)).ToArray();
    private readonly CancellationTokenSource _lifetime = new();
    private readonly List<IDisposable> _routes = new();
    private IDisposable? _pollerRegistration;
    private bool _stopped;
    private readonly CredentialDraftService _credentials = new();
    private readonly BrowserLogin.GameCheckInLoginFlows _loginFlows;
    private readonly BrowserLogin.TajiduoLoginSessions _tajiduoLogin;

    public CheckInTaskService(
        IPluginHostContext context,
        Func<DateTimeOffset>? clock = null,
        Func<string, bool>? browserLoginReady = null)
    {
        _context = context;
        _clock = clock ?? (() => DateTimeOffset.Now);
        _osClient = new HoyoLabClient(context.Http);
        _cnClient = new MiyousheClient(context.Http);
        _sklandClient = new SklandClient(context.Http, "skland");
        _skportClient = new SklandClient(context.Http, "skport");
        _kuroClient = new KuroClient(context.Http);
        _tajiduoLogin = new(_credentials, context.Http);
        RegisterRoutes();
        RegisterCredentialRoutes();
        _loginFlows = new(context, _credentials, browserLoginReady);
    }

    public async ValueTask StartAsync(CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        await _storeGate.WaitAsync(cancellationToken).ConfigureAwait(false);
        try
        {
            if (_stopped) throw new InvalidOperationException("签到任务服务已停止");
            CheckInTaskStore store = await ReadStoreAsync(cancellationToken).ConfigureAwait(false);
            foreach (Guid taskId in store.PendingSecretDeletions.ToArray())
                await CompleteSecretDeletionAsync(store, taskId, cancellationToken).ConfigureAwait(false);
            bool recovered = false;
            foreach (CheckInRun run in store.Tasks.SelectMany(task => task.Runs).Where(run => run.Status == "running"))
            {
                run.Status = "interrupted";
                run.CompletedAt = _clock();
                recovered = true;
            }
            if (recovered) await WriteStoreAsync(store, cancellationToken).ConfigureAwait(false);
            _pollerRegistration = _context.Scheduler.Register(
                new PluginJobDefinition(
                    PollerJobId,
                    Interval: PollInterval,
                    Timeout: TimeSpan.FromSeconds(8)),
                (_, token) => PollSchedulesAsync(token));
        }
        finally
        {
            _storeGate.Release();
        }
    }

    public async ValueTask StopAsync(CancellationToken cancellationToken)
    {
        RunHandle[] active;
        await _storeGate.WaitAsync(CancellationToken.None).ConfigureAwait(false);
        try
        {
            if (_stopped) return;
            _stopped = true;
            _lifetime.Cancel();
            _loginFlows.Dispose();
            _tajiduoLogin.Dispose();
            _credentials.Dispose();
            active = _activeRuns.Values.ToArray();
            foreach (RunHandle run in active) run.Cancellation.Cancel();
        }
        finally
        {
            _storeGate.Release();
        }
        _pollerRegistration?.Dispose();
        _pollerRegistration = null;

        try
        {
            await Task.WhenAll(active.Select(run => run.Completion.Task))
                .WaitAsync(StopDrainTimeout, CancellationToken.None)
                .ConfigureAwait(false);
        }
        catch (TimeoutException)
        {
            _context.Logger.Warn("签到任务正在停止；已完成的平台结果均已逐项保存。");
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            _context.Logger.Warn("签到任务停止等待被宿主取消；已完成的平台结果均已逐项保存。");
        }

        foreach (IDisposable route in _routes) route.Dispose();
        _routes.Clear();
        _lifetime.Dispose();
    }
}
