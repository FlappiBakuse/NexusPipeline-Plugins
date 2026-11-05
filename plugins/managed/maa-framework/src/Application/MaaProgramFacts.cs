using System.Text.Json;
using NexusPipeline.Extensibility.Protocol;

namespace NexusPipeline.Extensions.MaaFramework;

internal sealed class MaaProgramFacts(ExecutionProviderBootstrap bootstrap, MaaWorkerProject project)
{
    private int sequence;
    internal async Task WriteAsync(string occurrence, bool succeeded)
    {
        if (sequence >= project.PreparationOccurrences.Count || project.PreparationOccurrences[sequence] != occurrence)
            throw new IOException("maa_program_fact_unbound");
        var text = JsonSerializer.Serialize(new { format = "nexus.maa.program-fact", version = 1,
            runId = bootstrap.Identity.RunId, attemptId = bootstrap.Identity.AttemptId, planDigest = bootstrap.Identity.PlanDigest,
            projectFingerprint = bootstrap.Project!.Fingerprint, consumerExtensionId = project.ConsumerExtensionId,
            taskId = project.BusinessId(occurrence), executionTaskId = occurrence, sequence = ++sequence,
            outcome = succeeded ? "succeeded" : "failed" });
        if (text.Length > 2048) throw new IOException("maa_program_fact_budget");
        await Console.Out.WriteLineAsync(text).ConfigureAwait(false);
        await Console.Out.FlushAsync().ConfigureAwait(false);
    }
}
