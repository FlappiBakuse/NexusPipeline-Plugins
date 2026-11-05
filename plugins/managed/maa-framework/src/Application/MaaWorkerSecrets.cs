using System.Security.Cryptography;
using System.Text;
using System.Text.Json.Nodes;
using NexusPipeline.Extensibility.Execution;
using NexusPipeline.Extensibility.Secrets;

namespace NexusPipeline.Extensions.MaaFramework;

internal sealed class MaaWorkerSecrets(ExecutionProjectReader reader)
{
    internal async ValueTask<MaaTaskPayload> PayloadAsync(MaaSessionItem task, CancellationToken cancellation)
    {
        using var payload = await ToJsonAsync(MaaJson.Read(Encoding.UTF8.GetBytes(task.Pipeline)), task.OccurrenceId, cancellation).ConfigureAwait(false);
        MaaTaskPayload? result = null;
        payload.Use(bytes => result = new MaaTaskPayload(bytes));
        return result ?? throw new MaaInputFailure("maa_password_payload_unavailable");
    }

    internal async ValueTask<MaaSecretPayload> ToJsonAsync(JsonObject template, string occurrenceId, CancellationToken cancellation)
    {
        var secrets = new Dictionary<string, SecretDraft>(StringComparer.Ordinal);
        byte[]? bytes = null;
        try
        {
            foreach (var key in MaaProtectedInput.Keys(template))
            {
                cancellation.ThrowIfCancellationRequested();
                secrets.Add(key, await reader.ReadSecretAsync(key, occurrenceId, cancellation).ConfigureAwait(false));
            }
            cancellation.ThrowIfCancellationRequested();
            var expanded = MaaProtectedPipeline.Resolve(template, key =>
            {
                cancellation.ThrowIfCancellationRequested();
                if (!secrets.TryGetValue(key, out var value)) throw new MaaInputFailure("maa_password_binding_unbound");
                string? text = null;
                value.Use(material => text = new string(material));
                return text ?? throw new MaaInputFailure("maa_password_unavailable");
            });
            bytes = MaaCompilationBundle.Serialize(expanded, MaaCompilationBundle.MaximumBundleBytes);
            cancellation.ThrowIfCancellationRequested();
            var payload = new MaaSecretPayload(bytes); bytes = null;
            return payload;
        }
        finally
        {
            foreach (var value in secrets.Values) value.Dispose();
            if (bytes is not null) CryptographicOperations.ZeroMemory(bytes);
        }
    }
}
