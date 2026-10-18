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
    private async Task<PluginWebApiResponse?> StartRunAsync(
        Guid taskId,
        string trigger,
        CancellationToken cancellationToken,
        IReadOnlyCollection<string>? dueScheduleIds = null,
        string? occurrence = null, bool diagnostics = false)
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
            var credentialValues = new Dictionary<string, CredentialRecord?>(StringComparer.OrdinalIgnoreCase);
            foreach (string platform in PlatformOrder)
            {
                credentialValues[platform] = CredentialRecord.Decode(await _context.Secrets
                    .GetAsync(SecretKey(taskId, "credential-" + platform), cancellationToken)
                    .ConfigureAwait(false));
            }

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

            RunSnapshot runSnapshot = new(snapshot, run.Id, credentialValues, diagnostics ? new CheckInDiagnostics() : null);
            _ = Task.Run(() => ExecuteRunAsync(runSnapshot, handle), CancellationToken.None);
            return Json(new { runId = run.Id, status = "running" }, 202);
        }
        finally
        {
            _storeGate.Release();
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
                var credential = snapshot.Secrets.GetValueOrDefault(platform);
                string fingerprint = CredentialFingerprint(credential?.Value);
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
                            cancellationToken, snapshot.Diagnostics)
                        .ConfigureAwait(false);
                    results.Add(result);
                }
            }

            int successfulCount = results.Count(result => result.Success);
            runStatus = successfulCount == results.Count && results.Count > 0
                ? "success"
                : successfulCount == 0 ? "failed" : "partial";
            await FinishRunAsync(task.Id, handle.RunId, runStatus).ConfigureAwait(false);
            if (results.Count > 0 && task.Notification.Enabled)
            {
                string title = _context.I18n.T(
                    runStatus == "success" ? "notification.success" : "notification.failed",
                    runStatus == "success" ? "游戏自动签到成功" : "游戏自动签到有失败");
                string body = BuildSummary(task.Name, results);
                try
                {
                    await _context.Notifications.SendAsync(
                        new PluginNotification(title, body)
                        {
                            NotificationTaskIds = task.Notification.NotificationTaskIds.ToArray(),
                        },
                        cancellationToken).ConfigureAwait(false);
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
        CredentialRecord? record,
        string fingerprint,
        string runId,
        CancellationToken cancellationToken, CheckInDiagnostics? diagnostics)
    {
        string? credential = record?.Value;
        var web = record?.WebContext;
        string flightKey = platform + "/" + gameCode + "/" + fingerprint;
        int lockIndex = (int)((uint)StringComparer.Ordinal.GetHashCode(flightKey) % (uint)_credentialGameLocks.Length);
        SemaphoreSlim flight = _credentialGameLocks[lockIndex];
        await flight.WaitAsync(cancellationToken).ConfigureAwait(false);
        try
        {
            CheckInResult result;
            string localDate = _clock().ToLocalTime().ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
            if (!IsValidCredential(credential) || (web is not null && web.Platform != platform))
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
                        "cn" => await _cnClient.SignAsync(GameDefinitions.Find(gameCode)!, credential!, task.CnDeviceId, cancellationToken, diagnostics).ConfigureAwait(false),
                        "os" => await _osClient.SignAsync(GameDefinitions.Find(gameCode)!, credential!, cancellationToken, diagnostics).ConfigureAwait(false),
                        "skland" => await _sklandClient.SignAsync(SklandGameDefinitions.Find(gameCode)!, credential!, cancellationToken, web).ConfigureAwait(false),
                        "skport" => await _skportClient.SignAsync(SkportGameDefinitions.Find(gameCode)!, credential!, cancellationToken, web).ConfigureAwait(false),
                        "kuro" => await _kuroClient.SignAsync(
                            KuroGameDefinitions.Find(gameCode)!, credential!, task.KuroDevCode, task.KuroDistinctId, cancellationToken, web).ConfigureAwait(false),
                        "tajiduo" => await new TajiduoClient(_context.Http).SignAsync(credential!, async updated =>
                        {
                            var replacement = record! with { Value = updated };
                            if (!await ReplaceTajiduoCredentialAsync(task.Id, record!, replacement)) return false;
                            credential = updated;
                            fingerprint = CredentialFingerprint(updated);
                            return true;
                        }, cancellationToken).ConfigureAwait(false),
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
                    CancellationToken.None, diagnostics)
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
        CancellationToken cancellationToken = default, CheckInDiagnostics? diagnostics = null)
    {
        await _storeGate.WaitAsync(cancellationToken).ConfigureAwait(false);
        try
        {
            CheckInTaskStore store = await ReadStoreAsync(cancellationToken).ConfigureAwait(false);
            CheckInTask? task = store.Tasks.FirstOrDefault(item => item.Id == taskId);
            if (task is not null && currentRunId is not null)
            {
                CheckInRun? run = task.Runs.FirstOrDefault(item => item.Id == currentRunId);
                if (run is not null)
                {
                    run.Results.Add(result);
                    if (diagnostics is not null)
                    {
                        run.Diagnostics = diagnostics.Entries.ToList();
                        run.DiagnosticsVersion = typeof(CheckInTaskService).Assembly.GetName().Version?.ToString();
                    }
                }
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

    private async Task<bool> ReplaceTajiduoCredentialAsync(Guid taskId, CredentialRecord expected, CredentialRecord replacement)
    {
        await _storeGate.WaitAsync(CancellationToken.None).ConfigureAwait(false);
        try
        {
            var store = await ReadStoreAsync(CancellationToken.None).ConfigureAwait(false);
            if (!store.Tasks.Any(t => t.Id == taskId)) return false;
            string key = SecretKey(taskId, SecretName("tajiduo"));
            var current = CredentialRecord.Decode(await _context.Secrets.GetAsync(key, CancellationToken.None).ConfigureAwait(false));
            if (current != expected) return false;
            await _context.Secrets.SetAsync(key, replacement.Encode(), CancellationToken.None).ConfigureAwait(false);
            return true;
        }
        finally { _storeGate.Release(); }
    }

    internal static string CredentialFingerprint(string? credential)
    {
        if (!IsValidCredential(credential)) return "";
        return Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(credential!))).ToLowerInvariant();
    }
    private sealed record RunSnapshot(CheckInTask Task, string RunId, Dictionary<string, CredentialRecord?> Secrets, CheckInDiagnostics? Diagnostics);

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
