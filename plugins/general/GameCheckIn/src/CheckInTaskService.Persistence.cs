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
        if (store.SchemaVersion != 2 || store.Tasks is null || store.SuccessfulCheckIns is null)
        {
            throw new InvalidOperationException("Unsupported task store format");
        }
        foreach (CheckInRun run in store.Tasks.SelectMany(task => task.Runs).Where(run => run.StartedAt < _clock().AddDays(-7)))
        {
            run.Diagnostics = null;
            run.DiagnosticsVersion = null;
        }
        return store;
    }

    private ValueTask WriteStoreAsync(CheckInTaskStore store, CancellationToken cancellationToken) =>
        _context.ScopedData.WriteAsync(StoreScope, store, cancellationToken);

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
                SecretKey(taskId, name),
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
                .GetAsync(SecretKey(taskId, name), cancellationToken)
                .ConfigureAwait(false);
        }
        return snapshot;
    }

    private async Task<bool> RestoreSecretsAsync(Guid taskId, IReadOnlyDictionary<string, string?> snapshot)
    {
        bool restored = true;
        foreach ((string name, string? value) in snapshot)
        {
            try
            {
                await _context.Secrets.SetAsync(SecretKey(taskId, name), value, CancellationToken.None)
                    .ConfigureAwait(false);
            }
            catch
            {
                restored = false;
                _context.Logger.Warn("签到任务保存回滚未能恢复全部凭据。");
            }
        }
        return restored;
    }

    private static string SecretName(string field) => field.ToLowerInvariant() switch
    {
        "cn" => "credential-cn",
        "os" => "credential-os",
        "skland" => "credential-skland",
        "skport" => "credential-skport",
        "kuro" => "credential-kuro",
        "tajiduo" => "credential-tajiduo",
        _ => throw new InvalidOperationException("Unknown task secret field"),
    };

    private static readonly string[] SecretNames =
    {
        "credential-cn", "credential-os", "credential-skland", "credential-skport", "credential-kuro", "credential-tajiduo",
    };

    internal static string SecretKey(Guid taskId, string name) =>
        $"tasks-v2/{taskId:N}/{name}";
}
