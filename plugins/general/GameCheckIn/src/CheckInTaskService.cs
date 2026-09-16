using System.Collections.Concurrent;
using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using NexusPipeline.Plugin.Abstractions;

namespace NexusPipeline.Plugin.GameCheckIn;

internal sealed class CheckInTaskService
{
    internal const string PollerJobId = "scheduled-check-in-poll";
    private const string StoreScope = "tasks-v1/task-store";
    private const int MaxTasks = 100;
    private const int MaxRunHistory = 20;
    private static readonly TimeSpan PollInterval = TimeSpan.FromSeconds(15);
    private static readonly TimeSpan StopDrainTimeout = TimeSpan.FromSeconds(16);
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);
    private static readonly string[] PlatformOrder = { "cn", "os", "skland", "skport", "kuro" };

    private readonly IPluginHostContextV1_4 _context;
    private readonly Func<DateTimeOffset> _clock;
    private readonly CheckInTaskNotifications _notifications;
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

    public CheckInTaskService(
        IPluginHostContextV1_4 context,
        Func<DateTimeOffset>? clock = null,
        CheckInTaskNotifications? notifications = null)
    {
        _context = context;
        _clock = clock ?? (() => DateTimeOffset.Now);
        _notifications = notifications ?? new CheckInTaskNotifications(context);
        _osClient = new HoyoLabClient(context.Http);
        _cnClient = new MiyousheClient(context.Http);
        _sklandClient = new SklandClient(context.Http, "skland");
        _skportClient = new SklandClient(context.Http, "skport");
        _kuroClient = new KuroClient(context.Http);
        RegisterRoutes();
    }

    public async ValueTask StartAsync(CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        await _storeGate.WaitAsync(cancellationToken).ConfigureAwait(false);
        try
        {
            if (_stopped) throw new InvalidOperationException("签到任务服务已停止");
            CheckInTaskStore store = await ReadStoreAsync(cancellationToken).ConfigureAwait(false);
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

    private void RegisterRoutes()
    {
        _routes.Add(_context.WebApi.Register(new PluginWebApiRoute("GET", "state", GetStateAsync)));
        _routes.Add(_context.WebApi.Register(new PluginWebApiRoute("POST", "tasks", CreateTaskAsync)));
        _routes.Add(_context.WebApi.Register(new PluginWebApiRoute("PUT", "tasks", UpdateTaskAsync)));
        _routes.Add(_context.WebApi.Register(new PluginWebApiRoute("DELETE", "tasks", DeleteTaskAsync)));
        _routes.Add(_context.WebApi.Register(new PluginWebApiRoute("POST", "tasks/run", RunTaskAsync)));
    }

    private async ValueTask<PluginWebApiResponse> GetStateAsync(PluginWebApiRequest request, CancellationToken cancellationToken)
    {
        try
        {
            CheckInTaskStore store = await ReadStoreWithGateAsync(cancellationToken).ConfigureAwait(false);
            var tasks = new List<CheckInTaskView>(store.Tasks.Count);
            foreach (CheckInTask task in store.Tasks)
            {
                tasks.Add(await ToViewAsync(task, cancellationToken).ConfigureAwait(false));
            }
            var response = new
            {
                tasks,
                platforms = BuildPlatformOptions(),
                webhookTypes = new[] { "generic", "feishu", "dingtalk", "wecom", "discord", "slack" },
                timeZoneId = TimeZoneInfo.Local.Id,
                localTime = _clock().ToLocalTime(),
            };
            return Json(response);
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch
        {
            return Error(500, "state_unavailable");
        }
    }

    private ValueTask<PluginWebApiResponse> CreateTaskAsync(PluginWebApiRequest request, CancellationToken cancellationToken) =>
        SaveTaskAsync(request, cancellationToken, create: true);

    private ValueTask<PluginWebApiResponse> UpdateTaskAsync(PluginWebApiRequest request, CancellationToken cancellationToken) =>
        SaveTaskAsync(request, cancellationToken, create: false);

    private async ValueTask<PluginWebApiResponse> SaveTaskAsync(
        PluginWebApiRequest request,
        CancellationToken cancellationToken,
        bool create)
    {
        if (!TryDeserialize(request.JsonBody, out CheckInTaskSaveRequest? input)) return Error(400, "invalid_task");
        string? validation = Validate(input!);
        if (validation is not null) return Error(400, validation);

        await _storeGate.WaitAsync(cancellationToken).ConfigureAwait(false);
        try
        {
            if (_stopped) return Error(503, "service_stopping");
            CheckInTaskStore store = await ReadStoreAsync(cancellationToken).ConfigureAwait(false);
            CheckInTask? existing = null;
            Guid id;
            if (create)
            {
                if (store.Tasks.Count >= MaxTasks) return Error(400, "task_limit");
                id = Guid.NewGuid();
            }
            else
            {
                if (input!.Id is not Guid requestedId || requestedId == Guid.Empty) return Error(400, "task_id_required");
                if (_activeRuns.ContainsKey(requestedId)) return Error(409, "task_running");
                existing = store.Tasks.FirstOrDefault(task => task.Id == requestedId);
                if (existing is null) return Error(404, "task_not_found");
                id = requestedId;
            }

            CheckInTask task = BuildTask(input!, id, existing);
            Dictionary<string, string?>? secretSnapshot = null;
            try
            {
                secretSnapshot = await CaptureSecretChangesAsync(id, input!.Secrets, cancellationToken).ConfigureAwait(false);
                await ApplySecretChangesAsync(id, input!.Secrets, cancellationToken).ConfigureAwait(false);
                if (existing is null) store.Tasks.Add(task);
                else store.Tasks[store.Tasks.IndexOf(existing)] = task;
                await WriteStoreAsync(store, cancellationToken).ConfigureAwait(false);
            }
            catch
            {
                if (secretSnapshot is not null) await RestoreSecretsAsync(id, secretSnapshot).ConfigureAwait(false);
                if (cancellationToken.IsCancellationRequested) throw new OperationCanceledException(cancellationToken);
                return Error(500, "task_save_failed");
            }

            CheckInTaskView view = await ToViewAsync(task, cancellationToken).ConfigureAwait(false);
            return Json(view, create ? 201 : 200);
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch
        {
            return Error(500, "task_save_failed");
        }
        finally
        {
            _storeGate.Release();
        }
    }

    private async ValueTask<PluginWebApiResponse> DeleteTaskAsync(PluginWebApiRequest request, CancellationToken cancellationToken)
    {
        if (!TryDeserialize(request.JsonBody, out DeleteTaskRequest? input) || input!.TaskId == Guid.Empty)
        {
            return Error(400, "task_id_required");
        }

        await _storeGate.WaitAsync(cancellationToken).ConfigureAwait(false);
        try
        {
            if (_stopped) return Error(503, "service_stopping");
            if (_activeRuns.ContainsKey(input.TaskId)) return Error(409, "task_running");
            CheckInTaskStore store = await ReadStoreAsync(cancellationToken).ConfigureAwait(false);
            CheckInTask? task = store.Tasks.FirstOrDefault(item => item.Id == input.TaskId);
            if (task is null) return Error(404, "task_not_found");
            store.Tasks.Remove(task);
            try
            {
                await WriteStoreAsync(store, cancellationToken).ConfigureAwait(false);
                foreach (string secretName in SecretNames)
                {
                    await _context.Secrets.SetAsync(CheckInTaskNotifications.SecretKey(task.Id, secretName), null, cancellationToken)
                        .ConfigureAwait(false);
                }
            }
            catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
            {
                throw;
            }
            catch
            {
                _context.Logger.Warn("已删除签到任务，但部分任务凭据清理失败。");
                return Error(500, "task_delete_failed");
            }
            return PluginWebApiResponse.Empty();
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch
        {
            return Error(500, "task_delete_failed");
        }
        finally
        {
            _storeGate.Release();
        }
    }

    private async ValueTask<PluginWebApiResponse> RunTaskAsync(PluginWebApiRequest request, CancellationToken cancellationToken)
    {
        if (!TryDeserialize(request.JsonBody, out RunTaskRequest? input) || input!.TaskId == Guid.Empty)
        {
            return Error(400, "task_id_required");
        }

        try
        {
            PluginWebApiResponse? response = await StartRunAsync(input.TaskId, "manual", cancellationToken).ConfigureAwait(false);
            return response ?? Error(404, "task_not_found");
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch
        {
            return Error(500, "run_start_failed");
        }
    }

    private async Task<PluginWebApiResponse?> StartRunAsync(
        Guid taskId,
        string trigger,
        CancellationToken cancellationToken,
        IReadOnlyCollection<string>? dueScheduleIds = null,
        string? occurrence = null)
    {
        RunHandle? handle = null;
        await _storeGate.WaitAsync(cancellationToken).ConfigureAwait(false);
        try
        {
            if (_stopped || _lifetime.IsCancellationRequested) return Error(503, "service_stopping");
            if (_activeRuns.TryGetValue(taskId, out RunHandle? active))
            {
                return Json(new { runId = active.RunId, status = "running" }, 202);
            }

            CheckInTaskStore store = await ReadStoreAsync(cancellationToken).ConfigureAwait(false);
            CheckInTask? task = store.Tasks.FirstOrDefault(item => item.Id == taskId);
            if (task is null) return null;
            if (trigger == "schedule")
            {
                if (!task.Enabled || dueScheduleIds is null || occurrence is null) return Error(409, "schedule_changed");
                if (!task.Schedules.Any(schedule =>
                    dueScheduleIds.Contains(schedule.Id, StringComparer.Ordinal)
                    && schedule.Enabled
                    && string.Equals(schedule.LastFiredOccurrence, occurrence, StringComparison.Ordinal)))
                {
                    return Error(409, "schedule_changed");
                }
            }
            CheckInTask snapshot = Clone(task);
            var credentialValues = new Dictionary<string, string?>(StringComparer.OrdinalIgnoreCase);
            foreach (string platform in PlatformOrder)
            {
                credentialValues[platform] = await _context.Secrets
                    .GetAsync(CheckInTaskNotifications.SecretKey(taskId, "credential-" + platform), cancellationToken)
                    .ConfigureAwait(false);
            }
            credentialValues["webhook-url"] = await _context.Secrets
                .GetAsync(CheckInTaskNotifications.SecretKey(taskId, "webhook-url"), cancellationToken).ConfigureAwait(false);
            credentialValues["webhook-signing-secret"] = await _context.Secrets
                .GetAsync(CheckInTaskNotifications.SecretKey(taskId, "webhook-signing-secret"), cancellationToken).ConfigureAwait(false);
            credentialValues["smtp-user"] = await _context.Secrets
                .GetAsync(CheckInTaskNotifications.SecretKey(taskId, "smtp-user"), cancellationToken).ConfigureAwait(false);
            credentialValues["smtp-password"] = await _context.Secrets
                .GetAsync(CheckInTaskNotifications.SecretKey(taskId, "smtp-password"), cancellationToken).ConfigureAwait(false);

            var run = new CheckInRun
            {
                Id = Guid.NewGuid().ToString("N"),
                Trigger = trigger,
                StartedAt = _clock(),
                Status = "running",
            };
            task.Runs.Insert(0, run);
            if (task.Runs.Count > MaxRunHistory) task.Runs.RemoveRange(MaxRunHistory, task.Runs.Count - MaxRunHistory);
            await WriteStoreAsync(store, cancellationToken).ConfigureAwait(false);

            handle = new RunHandle(taskId, run.Id, _lifetime.Token);
            if (!_activeRuns.TryAdd(taskId, handle))
            {
                handle.Cancellation.Dispose();
                return Error(409, "task_running");
            }

            RunSnapshot runSnapshot = new(snapshot, run.Id, credentialValues);
            _ = Task.Run(() => ExecuteRunAsync(runSnapshot, handle), CancellationToken.None);
            return Json(new { runId = run.Id, status = "running" }, 202);
        }
        finally
        {
            _storeGate.Release();
        }
    }

    private async ValueTask PollSchedulesAsync(CancellationToken cancellationToken)
    {
        if (_stopped || !await _pollGate.WaitAsync(0, cancellationToken).ConfigureAwait(false)) return;
        try
        {
            var dueTasks = new Dictionary<Guid, HashSet<string>>();
            DateTimeOffset now = _clock().ToLocalTime();
            string localDate = now.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
            string time = now.ToString("HH:mm", CultureInfo.InvariantCulture);
            bool changed = false;
            await _storeGate.WaitAsync(cancellationToken).ConfigureAwait(false);
            try
            {
                if (_stopped) return;
                CheckInTaskStore store = await ReadStoreAsync(cancellationToken).ConfigureAwait(false);
                int oldSuccessCount = store.SuccessfulCheckIns.Count;
                store.SuccessfulCheckIns.RemoveAll(entry =>
                    !DateOnly.TryParseExact(entry.LocalDate, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out DateOnly date)
                    || date < DateOnly.FromDateTime(now.DateTime).AddDays(-14));
                changed = store.SuccessfulCheckIns.Count != oldSuccessCount;

                foreach (CheckInTask task in store.Tasks.Where(item => item.Enabled))
                {
                    foreach (CheckInSchedule schedule in task.Schedules.Where(item => item.Enabled))
                    {
                        if (!schedule.Days.Contains(now.DayOfWeek)
                            || !string.Equals(schedule.Time, time, StringComparison.Ordinal)) continue;
                        string occurrence = localDate + "/" + schedule.Time;
                        if (string.Equals(schedule.LastFiredOccurrence, occurrence, StringComparison.Ordinal)) continue;
                        schedule.LastFiredOccurrence = occurrence;
                        if (!dueTasks.TryGetValue(task.Id, out HashSet<string>? scheduleIds))
                        {
                            scheduleIds = new HashSet<string>(StringComparer.Ordinal);
                            dueTasks[task.Id] = scheduleIds;
                        }
                        scheduleIds.Add(schedule.Id);
                        changed = true;
                    }
                }

                if (changed) await WriteStoreAsync(store, cancellationToken).ConfigureAwait(false);
            }
            finally
            {
                _storeGate.Release();
            }

            foreach ((Guid taskId, HashSet<string> scheduleIds) in dueTasks)
            {
                cancellationToken.ThrowIfCancellationRequested();
                try
                {
                    await StartRunAsync(taskId, "schedule", cancellationToken, scheduleIds, localDate + "/" + time).ConfigureAwait(false);
                }
                catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
                {
                    throw;
                }
                catch
                {
                    _context.Logger.Warn("签到任务到期启动失败；此时段不会补跑。");
                }
            }
        }
        finally
        {
            _pollGate.Release();
        }
    }

    private async Task ExecuteRunAsync(RunSnapshot snapshot, RunHandle handle)
    {
        string runStatus = "failed";
        var results = new List<CheckInResult>();
        try
        {
            CancellationToken cancellationToken = handle.Cancellation.Token;
            CheckInTask task = snapshot.Task;
            foreach (string platform in PlatformOrder)
            {
                if (!task.Games.TryGetValue(platform, out List<string>? games)) continue;
                string? credential = snapshot.Secrets.GetValueOrDefault(platform);
                string fingerprint = CredentialFingerprint(credential);
                foreach (string gameCode in games)
                {
                    cancellationToken.ThrowIfCancellationRequested();
                    CheckInResult result = await SignGameAsync(
                            task,
                            platform,
                            gameCode,
                            credential,
                            fingerprint,
                            handle.RunId,
                            cancellationToken)
                        .ConfigureAwait(false);
                    results.Add(result);
                }
            }

            int successfulCount = results.Count(result => result.Success);
            runStatus = successfulCount == results.Count && results.Count > 0
                ? "success"
                : successfulCount == 0 ? "failed" : "partial";
            await FinishRunAsync(task.Id, handle.RunId, runStatus).ConfigureAwait(false);
            if (results.Count > 0)
            {
                string title = _context.I18n.T(
                    runStatus == "success" ? "notification.success" : "notification.failed",
                    runStatus == "success" ? "游戏自动签到成功" : "游戏自动签到有失败");
                string body = BuildSummary(task.Name, results);
                try
                {
                    await _notifications.SendAsync(task.Id, title, body, task.Notifications, cancellationToken).ConfigureAwait(false);
                }
                catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
                {
                    // The check-in run is already durable; shutdown may skip outbound notification delivery.
                }
                catch
                {
                    _context.Logger.Warn("签到任务通知失败；签到结果已保留。");
                }
            }
        }
        catch (OperationCanceledException) when (handle.Cancellation.IsCancellationRequested)
        {
            runStatus = "cancelled";
            try { await FinishRunAsync(handle.TaskId, handle.RunId, runStatus).ConfigureAwait(false); }
            catch { _context.Logger.Warn("签到运行结束状态保存失败；此前已保存的单游戏结果仍保留。"); }
        }
        catch
        {
            _context.Logger.Warn("签到任务运行失败；已经完成的平台结果已保存。");
            int successfulCount = results.Count(result => result.Success);
            runStatus = successfulCount == 0 ? "failed" : "partial";
            try { await FinishRunAsync(handle.TaskId, handle.RunId, runStatus).ConfigureAwait(false); }
            catch { _context.Logger.Warn("签到运行结束状态保存失败；此前已保存的单游戏结果仍保留。"); }
        }
        finally
        {
            _activeRuns.TryRemove(new KeyValuePair<Guid, RunHandle>(handle.TaskId, handle));
            handle.Cancellation.Dispose();
            handle.Completion.TrySetResult();
        }
    }

    private async Task<CheckInResult> SignGameAsync(
        CheckInTask task,
        string platform,
        string gameCode,
        string? credential,
        string fingerprint,
        string runId,
        CancellationToken cancellationToken)
    {
        string flightKey = platform + "/" + gameCode + "/" + fingerprint;
        int lockIndex = (int)((uint)StringComparer.Ordinal.GetHashCode(flightKey) % (uint)_credentialGameLocks.Length);
        SemaphoreSlim flight = _credentialGameLocks[lockIndex];
        await flight.WaitAsync(cancellationToken).ConfigureAwait(false);
        try
        {
            CheckInResult result;
            string localDate = _clock().ToLocalTime().ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
            if (!IsValidCredential(credential))
            {
                result = new CheckInResult(platform, gameCode, "invalid_credential", _context.I18n.T("result.invalid_credential", "凭据未配置或格式无效"), false);
            }
            else if (await HasSuccessfulCheckInAsync(platform, gameCode, fingerprint, localDate, cancellationToken).ConfigureAwait(false))
            {
                result = new CheckInResult(platform, gameCode, "already", _context.I18n.T("result.already", "今日已签到"), true);
            }
            else
            {
                try
                {
                    result = platform switch
                    {
                        "cn" => await _cnClient.SignAsync(GameDefinitions.Find(gameCode)!, credential!, task.CnDeviceId, cancellationToken).ConfigureAwait(false),
                        "os" => await _osClient.SignAsync(GameDefinitions.Find(gameCode)!, credential!, cancellationToken).ConfigureAwait(false),
                        "skland" => await _sklandClient.SignAsync(SklandGameDefinitions.Find(gameCode)!, credential!, cancellationToken).ConfigureAwait(false),
                        "skport" => await _skportClient.SignAsync(SkportGameDefinitions.Find(gameCode)!, credential!, cancellationToken).ConfigureAwait(false),
                        "kuro" => await _kuroClient.SignAsync(
                            KuroGameDefinitions.Find(gameCode)!, credential!, task.KuroDevCode, task.KuroDistinctId, cancellationToken).ConfigureAwait(false),
                        _ => new CheckInResult(platform, gameCode, "invalid_game", "签到游戏无效", false),
                    };
                }
                catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
                {
                    throw;
                }
                catch
                {
                    result = new CheckInResult(platform, gameCode, "transport_error", _context.I18n.T("result.request_failed", "请求失败"), false);
                }
            }

            result = LocalizeResult(result);
            await PersistGameResultAsync(
                    task.Id,
                    runId,
                    result,
                    result.Success && IsValidCredential(credential)
                        ? new SuccessfulCheckIn(platform, gameCode, fingerprint, localDate)
                        : null,
                    CancellationToken.None)
                .ConfigureAwait(false);
            return result;
        }
        finally
        {
            flight.Release();
        }
    }

    private async Task<bool> HasSuccessfulCheckInAsync(
        string platform,
        string gameCode,
        string fingerprint,
        string localDate,
        CancellationToken cancellationToken)
    {
        await _storeGate.WaitAsync(cancellationToken).ConfigureAwait(false);
        try
        {
            CheckInTaskStore store = await ReadStoreAsync(cancellationToken).ConfigureAwait(false);
            return store.SuccessfulCheckIns.Any(entry =>
                entry.Platform == platform
                && entry.GameCode == gameCode
                && entry.LocalDate == localDate
                && string.Equals(entry.CredentialFingerprint, fingerprint, StringComparison.Ordinal));
        }
        finally
        {
            _storeGate.Release();
        }
    }

    private async Task PersistGameResultAsync(
        Guid taskId,
        string? currentRunId,
        CheckInResult result,
        SuccessfulCheckIn? successfulCheckIn = null,
        CancellationToken cancellationToken = default)
    {
        await _storeGate.WaitAsync(cancellationToken).ConfigureAwait(false);
        try
        {
            CheckInTaskStore store = await ReadStoreAsync(cancellationToken).ConfigureAwait(false);
            CheckInTask? task = store.Tasks.FirstOrDefault(item => item.Id == taskId);
            if (task is not null && currentRunId is not null)
            {
                CheckInRun? run = task.Runs.FirstOrDefault(item => item.Id == currentRunId);
                if (run is not null) run.Results.Add(result);
            }
            if (successfulCheckIn is not null
                && !store.SuccessfulCheckIns.Any(entry =>
                    entry.Platform == successfulCheckIn.Platform
                    && entry.GameCode == successfulCheckIn.GameCode
                    && entry.LocalDate == successfulCheckIn.LocalDate
                    && entry.CredentialFingerprint == successfulCheckIn.CredentialFingerprint))
            {
                store.SuccessfulCheckIns.Add(successfulCheckIn);
            }
            await WriteStoreAsync(store, cancellationToken).ConfigureAwait(false);
        }
        finally
        {
            _storeGate.Release();
        }
    }

    private async Task FinishRunAsync(Guid taskId, string runId, string status)
    {
        await _storeGate.WaitAsync(CancellationToken.None).ConfigureAwait(false);
        try
        {
            CheckInTaskStore store = await ReadStoreAsync(CancellationToken.None).ConfigureAwait(false);
            CheckInTask? task = store.Tasks.FirstOrDefault(item => item.Id == taskId);
            CheckInRun? run = task?.Runs.FirstOrDefault(item => item.Id == runId);
            if (run is null) return;
            run.Status = status;
            run.CompletedAt = _clock();
            await WriteStoreAsync(store, CancellationToken.None).ConfigureAwait(false);
        }
        finally
        {
            _storeGate.Release();
        }
    }

    private async Task<CheckInTaskStore> ReadStoreWithGateAsync(CancellationToken cancellationToken)
    {
        await _storeGate.WaitAsync(cancellationToken).ConfigureAwait(false);
        try { return await ReadStoreAsync(cancellationToken).ConfigureAwait(false); }
        finally { _storeGate.Release(); }
    }

    private async Task<CheckInTaskStore> ReadStoreAsync(CancellationToken cancellationToken)
    {
        CheckInTaskStore? store = await _context.ScopedData.ReadAsync<CheckInTaskStore>(StoreScope, cancellationToken).ConfigureAwait(false);
        if (store is null) return new CheckInTaskStore();
        if (store.SchemaVersion != 1 || store.Tasks is null || store.SuccessfulCheckIns is null)
        {
            throw new InvalidOperationException("Unsupported task store format");
        }
        return store;
    }

    private ValueTask WriteStoreAsync(CheckInTaskStore store, CancellationToken cancellationToken) =>
        _context.ScopedData.WriteAsync(StoreScope, store, cancellationToken);

    private async Task<CheckInTaskView> ToViewAsync(CheckInTask task, CancellationToken cancellationToken)
    {
        var credentials = new Dictionary<string, bool>(StringComparer.OrdinalIgnoreCase);
        foreach (string platform in PlatformOrder)
        {
            string? value = await _context.Secrets
                .GetAsync(CheckInTaskNotifications.SecretKey(task.Id, "credential-" + platform), cancellationToken)
                .ConfigureAwait(false);
            credentials[platform] = !string.IsNullOrWhiteSpace(value);
        }
        string? webhookUrl = await _context.Secrets.GetAsync(CheckInTaskNotifications.SecretKey(task.Id, "webhook-url"), cancellationToken).ConfigureAwait(false);
        string? webhookSecret = await _context.Secrets.GetAsync(CheckInTaskNotifications.SecretKey(task.Id, "webhook-signing-secret"), cancellationToken).ConfigureAwait(false);
        string? smtpUser = await _context.Secrets.GetAsync(CheckInTaskNotifications.SecretKey(task.Id, "smtp-user"), cancellationToken).ConfigureAwait(false);
        string? smtpPassword = await _context.Secrets.GetAsync(CheckInTaskNotifications.SecretKey(task.Id, "smtp-password"), cancellationToken).ConfigureAwait(false);
        DateTimeOffset now = _clock().ToLocalTime();
        DateTimeOffset? nextAt = task.Enabled
            ? task.Schedules.Where(schedule => schedule.Enabled)
                .Select(schedule => GetNextRunAt(schedule, now))
                .Where(value => value.HasValue)
                .Min()
            : null;
        return new CheckInTaskView
        {
            Id = task.Id,
            Name = task.Name,
            Enabled = task.Enabled,
            Games = Clone(task.Games),
            CnDeviceId = task.CnDeviceId,
            KuroDevCode = task.KuroDevCode,
            KuroDistinctId = task.KuroDistinctId,
            Schedules = task.Schedules.Select(schedule => new CheckInSchedule
            {
                Id = schedule.Id,
                Days = schedule.Days.ToList(),
                Enabled = schedule.Enabled,
                Time = schedule.Time,
            }).ToList(),
            Notifications = Clone(task.Notifications),
            Runs = task.Runs.Take(MaxRunHistory).Select(Clone).ToList(),
            Credentials = credentials,
            WebhookSecrets = new CheckInWebhookSecretView
            {
                UrlConfigured = !string.IsNullOrWhiteSpace(webhookUrl),
                SigningSecretConfigured = !string.IsNullOrWhiteSpace(webhookSecret),
            },
            SmtpSecrets = new CheckInSmtpSecretView
            {
                UserConfigured = !string.IsNullOrWhiteSpace(smtpUser),
                PasswordConfigured = !string.IsNullOrWhiteSpace(smtpPassword),
            },
            IsRunning = _activeRuns.ContainsKey(task.Id),
            NextRunAt = nextAt,
            RecentRun = task.Runs.FirstOrDefault() is { } recent ? Clone(recent) : null,
        };
    }

    private object[] BuildPlatformOptions() => PlatformOrder.Select(platform =>
    {
        IReadOnlyList<(string Code, string Name)> games = platform switch
        {
            "cn" or "os" => GameDefinitions.All.Select(game => (game.Code, game.DisplayName)).ToArray(),
            "skland" => SklandGameDefinitions.All.Select(game => (game.Code, game.DisplayName)).ToArray(),
            "skport" => SkportGameDefinitions.All.Select(game => (game.Code, game.DisplayName)).ToArray(),
            "kuro" => KuroGameDefinitions.All.Select(game => (game.Code, game.DisplayName)).ToArray(),
            _ => Array.Empty<(string Code, string Name)>(),
        };
        return new
        {
            id = platform,
            name = _context.I18n.T("platform." + platform, platform),
            games = games.Select(game => new
            {
                id = game.Code,
                name = _context.I18n.T("game." + game.Code, game.Name),
            }),
        };
    }).Cast<object>().ToArray();

    private DateTimeOffset? GetNextRunAt(CheckInSchedule schedule, DateTimeOffset now)
    {
        if (!schedule.Enabled || schedule.Days.Count == 0 || !TimeOnly.TryParseExact(schedule.Time, "HH:mm", CultureInfo.InvariantCulture, DateTimeStyles.None, out TimeOnly time))
        {
            return null;
        }
        DateTime localNow = now.DateTime;
        for (int offset = 0; offset <= 7; offset++)
        {
            DateTime date = localNow.Date.AddDays(offset);
            if (!schedule.Days.Contains(date.DayOfWeek)) continue;
            DateTime candidateDate = date.Add(time.ToTimeSpan());
            string occurrence = candidateDate.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture) + "/" + schedule.Time;
            if (candidateDate < localNow || (candidateDate == localNow && schedule.LastFiredOccurrence == occurrence)) continue;
            try
            {
                return new DateTimeOffset(DateTime.SpecifyKind(candidateDate, DateTimeKind.Local));
            }
            catch (ArgumentException)
            {
                continue;
            }
        }
        return null;
    }

    private CheckInTask BuildTask(CheckInTaskSaveRequest input, Guid id, CheckInTask? existing)
    {
        string cnDeviceId = Guid.TryParse(input.CnDeviceId, out Guid cnGuid) ? cnGuid.ToString("D") : Guid.NewGuid().ToString("D");
        string kuroDevCode = string.IsNullOrWhiteSpace(input.KuroDevCode) ? Guid.NewGuid().ToString("N") : input.KuroDevCode.Trim();
        string kuroDistinctId = Guid.TryParse(input.KuroDistinctId, out Guid kuroGuid) ? kuroGuid.ToString("D") : Guid.NewGuid().ToString("D");
        var oldSchedules = existing?.Schedules.ToDictionary(item => item.Id, StringComparer.Ordinal) ?? new Dictionary<string, CheckInSchedule>();
        List<CheckInSchedule> schedules = input.Schedules.Select(scheduleInput =>
        {
            string scheduleId = Guid.TryParse(scheduleInput.Id, out Guid parsed) ? parsed.ToString("N") : Guid.NewGuid().ToString("N");
            oldSchedules.TryGetValue(scheduleId, out CheckInSchedule? old);
            bool sameRule = old is not null
                && old.Time == scheduleInput.Time
                && old.Days.Order().SequenceEqual(scheduleInput.Days.Distinct().Order())
                && old.Enabled == scheduleInput.Enabled;
            return new CheckInSchedule
            {
                Id = scheduleId,
                Days = scheduleInput.Days.Distinct().Order().ToList(),
                Enabled = scheduleInput.Enabled,
                Time = scheduleInput.Time,
                LastFiredOccurrence = sameRule ? old!.LastFiredOccurrence : null,
            };
        }).ToList();

        return new CheckInTask
        {
            Id = id,
            Name = input.Name.Trim(),
            Enabled = input.Enabled,
            Games = NormalizeGames(input.Games),
            CnDeviceId = cnDeviceId,
            KuroDevCode = kuroDevCode,
            KuroDistinctId = kuroDistinctId,
            Schedules = schedules,
            Notifications = new CheckInNotificationSettings
            {
                Webhook = new CheckInWebhookSettings
                {
                    Enabled = input.Notifications.Webhook.Enabled,
                    Type = input.Notifications.Webhook.Type.ToLowerInvariant(),
                    Template = input.Notifications.Webhook.Template,
                },
                Smtp = new CheckInSmtpSettings
                {
                    Enabled = input.Notifications.Smtp.Enabled,
                    Host = input.Notifications.Smtp.Host?.Trim() ?? "",
                    Port = input.Notifications.Smtp.Port,
                    Secure = input.Notifications.Smtp.Secure.ToLowerInvariant(),
                    From = input.Notifications.Smtp.From?.Trim() ?? "",
                    To = input.Notifications.Smtp.To?.Trim() ?? "",
                    SubjectPrefix = input.Notifications.Smtp.SubjectPrefix?.Trim() ?? "",
                },
            },
            Runs = existing?.Runs ?? new List<CheckInRun>(),
        };
    }

    private async Task ApplySecretChangesAsync(
        Guid taskId,
        IReadOnlyDictionary<string, CheckInSecretInput> changes,
        CancellationToken cancellationToken)
    {
        foreach ((string field, CheckInSecretInput input) in changes)
        {
            string name = SecretName(field);
            if (input.Action.Equals("keep", StringComparison.OrdinalIgnoreCase)) continue;
            await _context.Secrets.SetAsync(
                CheckInTaskNotifications.SecretKey(taskId, name),
                input.Action.Equals("clear", StringComparison.OrdinalIgnoreCase) ? null : input.Value,
                cancellationToken).ConfigureAwait(false);
        }
    }

    private async Task<Dictionary<string, string?>> CaptureSecretChangesAsync(
        Guid taskId,
        IReadOnlyDictionary<string, CheckInSecretInput> changes,
        CancellationToken cancellationToken)
    {
        var snapshot = new Dictionary<string, string?>(StringComparer.Ordinal);
        foreach ((string field, CheckInSecretInput input) in changes)
        {
            if (input.Action.Equals("keep", StringComparison.OrdinalIgnoreCase)) continue;
            string name = SecretName(field);
            snapshot[name] = await _context.Secrets
                .GetAsync(CheckInTaskNotifications.SecretKey(taskId, name), cancellationToken)
                .ConfigureAwait(false);
        }
        return snapshot;
    }

    private async Task RestoreSecretsAsync(Guid taskId, IReadOnlyDictionary<string, string?> snapshot)
    {
        foreach ((string name, string? value) in snapshot)
        {
            try
            {
                await _context.Secrets.SetAsync(CheckInTaskNotifications.SecretKey(taskId, name), value, CancellationToken.None)
                    .ConfigureAwait(false);
            }
            catch
            {
                _context.Logger.Warn("签到任务保存回滚未能恢复全部凭据。");
            }
        }
    }

    private static string SecretName(string field) => field.ToLowerInvariant() switch
    {
        "cn" => "credential-cn",
        "os" => "credential-os",
        "skland" => "credential-skland",
        "skport" => "credential-skport",
        "kuro" => "credential-kuro",
        "webhookurl" => "webhook-url",
        "webhooksecret" => "webhook-signing-secret",
        "smtpuser" => "smtp-user",
        "smtppassword" => "smtp-password",
        _ => throw new InvalidOperationException("Unknown task secret field"),
    };

    private static readonly string[] SecretNames =
    {
        "credential-cn", "credential-os", "credential-skland", "credential-skport", "credential-kuro",
        "webhook-url", "webhook-signing-secret", "smtp-user", "smtp-password",
    };

    private static string? Validate(CheckInTaskSaveRequest input)
    {
        if (input is null
            || input.Games is null
            || input.Schedules is null
            || input.Secrets is null
            || input.Notifications is null
            || input.Notifications.Webhook is null
            || input.Notifications.Smtp is null) return "task_fields_invalid";
        if (string.IsNullOrWhiteSpace(input.Name) || input.Name.Trim().Length > 100) return "task_name_invalid";
        if (input.Schedules.Count > 30) return "schedule_limit";
        foreach ((string platform, List<string> games) in input.Games)
        {
            if (platform is null || games is null) return "games_invalid";
            Func<string, bool>? isKnown = platform.ToLowerInvariant() switch
            {
                "cn" or "os" => GameDefinitions.IsKnown,
                "skland" => SklandGameDefinitions.IsKnown,
                "skport" => SkportGameDefinitions.IsKnown,
                "kuro" => KuroGameDefinitions.IsKnown,
                _ => null,
            };
            if (isKnown is null || games.Any(game => string.IsNullOrWhiteSpace(game) || !isKnown(game))) return "games_invalid";
        }
        var ids = new HashSet<string>(StringComparer.Ordinal);
        foreach (CheckInScheduleInput? schedule in input.Schedules)
        {
            if (schedule is null || schedule.Days is null || string.IsNullOrWhiteSpace(schedule.Time)) return "schedule_settings_invalid";
            if (!TimeOnly.TryParseExact(schedule.Time, "HH:mm", CultureInfo.InvariantCulture, DateTimeStyles.None, out _)) return "schedule_time_invalid";
            if (schedule.Days.Count == 0 || schedule.Days.Any(day => (int)day is < 0 or > 6)) return "schedule_days_invalid";
            if (schedule.Id is not null && Guid.TryParse(schedule.Id, out Guid id) && !ids.Add(id.ToString("N"))) return "schedule_id_duplicate";
        }
        if (string.IsNullOrWhiteSpace(input.Notifications.Webhook.Type)
            || !CheckInTaskNotifications.SupportedWebhookTypes.Contains(input.Notifications.Webhook.Type.ToLowerInvariant())) return "webhook_type_invalid";
        if (input.Notifications.Webhook.Template is null || input.Notifications.Webhook.Template.Length > 16384) return "webhook_template_invalid";
        if (input.Notifications.Webhook.Enabled && input.Notifications.Webhook.Type.Equals("generic", StringComparison.OrdinalIgnoreCase))
        {
            string template = input.Notifications.Webhook.Template;
            if (!template.Contains("{text}", StringComparison.Ordinal)) return "webhook_template_invalid";
            try { _ = JsonNode.Parse(template.Replace("{text}", "\"text\"", StringComparison.Ordinal)); }
            catch { return "webhook_template_invalid"; }
        }
        if (input.Notifications.Smtp.Port is < 1 or > 65535) return "smtp_port_invalid";
        if (input.Notifications.Smtp.Secure is null
            || input.Notifications.Smtp.Secure.ToLowerInvariant() is not ("auto" or "ssl" or "starttls" or "none")) return "smtp_secure_invalid";
        if (input.Notifications.Smtp.Host?.Length > 255
            || input.Notifications.Smtp.From?.Length > 320
            || input.Notifications.Smtp.To?.Length > 4096
            || input.Notifications.Smtp.SubjectPrefix?.Length > 120) return "smtp_settings_invalid";
        try
        {
            string[] recipients = CheckInTaskNotifications.SplitRecipients(input.Notifications.Smtp.To ?? "");
            if (recipients.Length > 50) return "smtp_recipients_invalid";
            foreach (string recipient in recipients) _ = MimeKit.MailboxAddress.Parse(recipient);
            if (!string.IsNullOrWhiteSpace(input.Notifications.Smtp.From)) _ = MimeKit.MailboxAddress.Parse(input.Notifications.Smtp.From);
        }
        catch { return "smtp_recipients_invalid"; }
        foreach ((string field, CheckInSecretInput value) in input.Secrets)
        {
            if (field is null || value is null || field.ToLowerInvariant() is not ("cn" or "os" or "skland" or "skport" or "kuro" or "webhookurl" or "webhooksecret" or "smtpuser" or "smtppassword")) return "secret_field_invalid";
            if (value.Action is null || value.Action.ToLowerInvariant() is not ("keep" or "set" or "clear")) return "secret_action_invalid";
            if (value.Action.Equals("set", StringComparison.OrdinalIgnoreCase) && !IsValidCredential(value.Value)) return "secret_value_invalid";
            if (value.Action.Equals("set", StringComparison.OrdinalIgnoreCase) && field.Equals("webhookUrl", StringComparison.OrdinalIgnoreCase)
                && (!Uri.TryCreate(value.Value, UriKind.Absolute, out Uri? uri) || uri.Scheme is not ("http" or "https"))) return "webhook_url_invalid";
        }
        return null;
    }

    private static Dictionary<string, List<string>> NormalizeGames(Dictionary<string, List<string>> values)
    {
        var result = new Dictionary<string, List<string>>(StringComparer.OrdinalIgnoreCase);
        foreach (string platform in PlatformOrder)
        {
            if (!values.TryGetValue(platform, out List<string>? games)) continue;
            result[platform] = games.Distinct(StringComparer.OrdinalIgnoreCase).Select(value => value.ToLowerInvariant()).ToList();
        }
        return result;
    }

    private string BuildSummary(string taskName, IReadOnlyList<CheckInResult> results)
    {
        string taskLabel = _context.I18n.T("task.notification_name", "签到任务：{name}", new Dictionary<string, object?> { ["name"] = taskName });
        return taskLabel + "\n" + string.Join("\n", results.Select(result =>
        {
            string platform = _context.I18n.T("platform." + result.Platform, result.Platform);
            string gameName = GameName(result.Platform, result.GameCode);
            string label = _context.I18n.T(result.Success ? "result.success" : "result.failed", result.Success ? "成功" : "失败");
            return $"{platform} · {gameName}：{label}（{result.Message}）";
        }));
    }

    private string GameName(string platform, string code)
    {
        string fallback = platform switch
        {
            "cn" or "os" => GameDefinitions.Find(code)?.DisplayName ?? code,
            "skland" => SklandGameDefinitions.Find(code)?.DisplayName ?? code,
            "skport" => SkportGameDefinitions.Find(code)?.DisplayName ?? code,
            "kuro" => KuroGameDefinitions.Find(code)?.DisplayName ?? code,
            _ => code,
        };
        return _context.I18n.T("game." + code, fallback);
    }

    private CheckInResult LocalizeResult(CheckInResult result) => result with
    {
        Message = _context.I18n.T("result." + result.Code, result.Message),
    };

    internal static string CredentialFingerprint(string? credential)
    {
        if (!IsValidCredential(credential)) return "";
        return Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(credential!))).ToLowerInvariant();
    }

    private static bool IsValidCredential(string? credential) =>
        !string.IsNullOrWhiteSpace(credential)
        && Encoding.UTF8.GetByteCount(credential) <= 16 * 1024
        && credential.IndexOfAny(new[] { '\r', '\n' }) < 0;

    private static CheckInTask Clone(CheckInTask value) => JsonSerializer.Deserialize<CheckInTask>(JsonSerializer.Serialize(value, JsonOptions), JsonOptions)!;
    private static CheckInRun Clone(CheckInRun value) => JsonSerializer.Deserialize<CheckInRun>(JsonSerializer.Serialize(value, JsonOptions), JsonOptions)!;
    private static Dictionary<string, List<string>> Clone(Dictionary<string, List<string>> value) => value.ToDictionary(pair => pair.Key, pair => pair.Value.ToList(), StringComparer.OrdinalIgnoreCase);
    private static T Clone<T>(T value) => JsonSerializer.Deserialize<T>(JsonSerializer.Serialize(value, JsonOptions), JsonOptions)!;

    private static bool TryDeserialize<T>(string? json, out T? value)
    {
        try
        {
            value = string.IsNullOrWhiteSpace(json) ? default : JsonSerializer.Deserialize<T>(json, JsonOptions);
            return value is not null;
        }
        catch (JsonException)
        {
            value = default;
            return false;
        }
    }

    private static PluginWebApiResponse Json<T>(T value, int statusCode = 200) =>
        PluginWebApiResponse.Json(JsonSerializer.SerializeToNode(value, JsonOptions), statusCode);

    private static PluginWebApiResponse Error(int statusCode, string code) =>
        PluginWebApiResponse.Json(new JsonObject { ["error"] = code }, statusCode);

    private sealed record DeleteTaskRequest(Guid TaskId);
    private sealed record RunTaskRequest(Guid TaskId);
    private sealed record RunSnapshot(CheckInTask Task, string RunId, Dictionary<string, string?> Secrets);

    private sealed class RunHandle
    {
        public RunHandle(Guid taskId, string runId, CancellationToken lifetime)
        {
            TaskId = taskId;
            RunId = runId;
            Cancellation = CancellationTokenSource.CreateLinkedTokenSource(lifetime);
        }

        public Guid TaskId { get; }
        public string RunId { get; }
        public CancellationTokenSource Cancellation { get; }
        public TaskCompletionSource Completion { get; } = new(TaskCreationOptions.RunContinuationsAsynchronously);
    }
}
