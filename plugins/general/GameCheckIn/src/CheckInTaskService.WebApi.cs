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
    private void RegisterRoutes()
    {
        _routes.Add(_context.WebApi.Register(new PluginWebApiRoute("GET", "state", PluginOperationAccess.General, GetStateAsync)));
        _routes.Add(_context.WebApi.Register(new PluginWebApiRoute("POST", "tasks/credential/read", PluginOperationAccess.General, ReadCredentialAsync)));
        _routes.Add(_context.WebApi.Register(new PluginWebApiRoute("POST", "tasks", PluginOperationAccess.General, CreateTaskAsync)));
        _routes.Add(_context.WebApi.Register(new PluginWebApiRoute("PUT", "tasks", PluginOperationAccess.General, UpdateTaskAsync)));
        _routes.Add(_context.WebApi.Register(new PluginWebApiRoute("PUT", "tasks/order", PluginOperationAccess.General, ReorderTasksAsync)));
        _routes.Add(_context.WebApi.Register(new PluginWebApiRoute("DELETE", "tasks", PluginOperationAccess.General, DeleteTaskAsync)));
        _routes.Add(_context.WebApi.Register(new PluginWebApiRoute("POST", "tasks/run", PluginOperationAccess.General, RunTaskAsync)));
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

    private async ValueTask<PluginWebApiResponse> ReorderTasksAsync(
        PluginWebApiRequest request,
        CancellationToken cancellationToken)
    {
        if (!TryDeserialize(request.JsonBody, out CheckInTaskOrderRequest? input)
            || input!.TaskIds is null)
        {
            return Error(400, "task_order_invalid");
        }

        await _storeGate.WaitAsync(cancellationToken).ConfigureAwait(false);
        try
        {
            if (_stopped) return Error(503, "service_stopping");
            CheckInTaskStore store = await ReadStoreAsync(cancellationToken).ConfigureAwait(false);
            Guid[] currentIds = store.Tasks.Select(task => task.Id).ToArray();
            if (input.TaskIds.Count != currentIds.Length
                || input.TaskIds.Distinct().Count() != input.TaskIds.Count
                || !input.TaskIds.ToHashSet().SetEquals(currentIds))
            {
                return Error(400, "task_order_invalid");
            }

            Dictionary<Guid, CheckInTask> tasks = store.Tasks.ToDictionary(task => task.Id);
            store.Tasks = input.TaskIds.Select(id => tasks[id]).ToList();
            await WriteStoreAsync(store, cancellationToken).ConfigureAwait(false);
            return Json(new { taskIds = input.TaskIds });
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch
        {
            return Error(500, "task_order_save_failed");
        }
        finally
        {
            _storeGate.Release();
        }
    }

    private async ValueTask<PluginWebApiResponse> SaveTaskAsync(
        PluginWebApiRequest request,
        CancellationToken cancellationToken,
        bool create)
    {
        if (!TryDeserialize(request.JsonBody, out CheckInTaskSaveRequest? input)) return Error(400, "invalid_task");
        string? validation = Validate(input!);
        if (validation is not null) return Error(400, validation);

        await _storeGate.WaitAsync(cancellationToken).ConfigureAwait(false);
        bool committed = false;
        CredentialDraftService.Reservation? reservation = null;
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

            if (store.Tasks.Any(task => task.Id != id
                && string.Equals(task.Name, input!.Name.Trim(), StringComparison.OrdinalIgnoreCase)))
                return Error(409, "task_name_duplicate");

            CheckInTask task = BuildTask(input!, id, existing);
            var current = new Dictionary<string, string?>(StringComparer.Ordinal);
            foreach (string platform in input!.Secrets.Keys)
                current[platform] = existing is null ? null : await _context.Secrets.GetAsync(SecretKey(id, SecretName(platform)), cancellationToken).ConfigureAwait(false);
            Dictionary<string, CheckInSecretInput> changes;
            if (input.EditorSessionId is { } editorId)
            {
                reservation = _credentials.Reserve(Client(request), editorId, existing?.Id, input.Secrets, current);
                changes = reservation.Changes;
            }
            else
            {
                changes = new(StringComparer.Ordinal);
                foreach (var (platform, change) in input.Secrets)
                {
                    CredentialRecord? old = null;
                    if (change.Action != "clear") old = CredentialRecord.Decode(current[platform]);
                    if (change.Action == "set" && (change.CandidateId is not null || old?.Source == "browser")) throw new CredentialException("credential_editor_required");
                    changes[platform] = new() { Action = change.Action, Value = change.Action == "set" ? new CredentialRecord(1, change.Value!, "manual").Encode() : null };
                }
            }
            Dictionary<string, string?>? secretSnapshot = null;
            try
            {
                secretSnapshot = await CaptureSecretChangesAsync(id, changes, cancellationToken).ConfigureAwait(false);
                await ApplySecretChangesAsync(id, changes, cancellationToken).ConfigureAwait(false);
                if (existing is null) store.Tasks.Add(task);
                else store.Tasks[store.Tasks.IndexOf(existing)] = task;
                await WriteStoreAsync(store, cancellationToken).ConfigureAwait(false);
                committed = true;
                if (reservation is not null) reservation.Committed = true;
            }
            catch
            {
                bool restored = secretSnapshot is null || await RestoreSecretsAsync(id, secretSnapshot).ConfigureAwait(false);
                if (cancellationToken.IsCancellationRequested) throw new OperationCanceledException(cancellationToken);
                return Error(500, restored ? "task_save_failed" : "task_save_unconfirmed");
            }

            CheckInTaskView view = await ToViewAsync(task, cancellationToken).ConfigureAwait(false);
            return Json(view, create ? 201 : 200);
        }
        catch (CredentialException ex) { return CredentialError(ex); }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch
        {
            return Error(500, committed ? "task_save_unconfirmed" : "task_save_failed");
        }
        finally
        {
            reservation?.Dispose();
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
                _credentials.ReleaseTask(task.Id);
                foreach (string secretName in SecretNames)
                {
                    await _context.Secrets.SetAsync(SecretKey(task.Id, secretName), null, cancellationToken)
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
            PluginWebApiResponse? response = await StartRunAsync(input.TaskId, "manual", cancellationToken, diagnostics: input.Diagnostics).ConfigureAwait(false);
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
    private sealed record RunTaskRequest(Guid TaskId, bool Diagnostics = false);
}
