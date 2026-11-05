using System.Text.Json;
using NexusPipeline.Extensibility.Protocol;

namespace NexusPipeline.Extensions.MaaFramework;

internal static class MaaWorkerFacts
{
    internal static async Task WriteAsync(ExecutionProviderBootstrap bootstrap, MaaWorkerProject project,
        IReadOnlyList<MaaNativeTaskFact> facts)
    {
        var tasks = project.Tasks.ToDictionary(task => task.OccurrenceId, StringComparer.Ordinal);
        long sequence = 0, previous = 0;
        foreach (var fact in facts)
        {
            if (!tasks.TryGetValue(fact.OccurrenceId, out var task) || fact.SourceId != task.SourceId ||
                fact.Repetition < 1 || fact.Repetition > task.RepeatCount || fact.Status is not (3000 or 4000) ||
                fact.NativeTaskId <= previous || fact.NativeTaskId > 9007199254740991) throw new IOException("maa_native_fact_invalid");
            previous = fact.NativeTaskId;
            var text = JsonSerializer.Serialize(new { format = "nexus.maa.native-fact", version = 1,
                runId = bootstrap.Identity.RunId, attemptId = bootstrap.Identity.AttemptId, planDigest = bootstrap.Identity.PlanDigest,
                projectFingerprint = bootstrap.Project!.Fingerprint, consumerExtensionId = project.ConsumerExtensionId,
                taskId = project.BusinessId(fact.OccurrenceId), executionTaskId = fact.OccurrenceId, repetition = fact.Repetition,
                nativeTaskId = fact.NativeTaskId, status = fact.Status, sequence = ++sequence });
            if (text.Length > 2048) throw new IOException("maa_native_fact_budget");
            await Console.Out.WriteLineAsync(text).ConfigureAwait(false);
        }
        await Console.Out.FlushAsync().ConfigureAwait(false);
    }
}
