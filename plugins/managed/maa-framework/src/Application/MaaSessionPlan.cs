using System.Text;

namespace NexusPipeline.Extensions.MaaFramework;

internal sealed record MaaSessionItem(string OccurrenceId, string SourceId, string Entry, string Pipeline, int RepeatCount, int CompletedRepetitions);
internal static class MaaSessionPlan
{
    internal static MaaSessionItem[] Freeze(IReadOnlyList<MaaSessionTask> tasks, bool outputScope = false)
    {
        if (tasks.Count is < 1 or > 4096 || tasks.Any(task => task is null) || tasks.Sum(task => (long)task.Pipeline.Length) > 32 * 1024 * 1024 ||
            tasks.Sum(task => (long)task.RepeatCount) > 100000 || tasks.Select(task => task.OccurrenceId).Distinct(StringComparer.Ordinal).Count() != tasks.Count)
            throw new IOException("maa_session_task_budget");
        return tasks.Select(task => {
            if (!Identity(task.OccurrenceId, 120) || !Identity(task.SourceId, 120) || !Identity(task.Entry, 4096) || task.RepeatCount is < 1 or > 100 ||
                task.CompletedRepetitions < 0 || task.CompletedRepetitions >= task.RepeatCount ||
                task.Pipeline.Length is < 2 or > 32 * 1024 * 1024) throw new IOException("maa_session_task_invalid");
            var bytes = task.Pipeline.ToArray(); var pipeline = MaaJson.Read(bytes); MaaPipelineGuard.CheckRoot(pipeline, outputScope);
            if (MaaWaitPolicy.Supports(task.Entry)) _ = MaaWaitPolicy.Parameters(task.Entry, pipeline);
            return new MaaSessionItem(task.OccurrenceId, task.SourceId, task.Entry, new UTF8Encoding(false, true).GetString(bytes),
                task.RepeatCount, task.CompletedRepetitions);
        }).ToArray();
    }
    private static bool Identity(string value, int maximum) => !string.IsNullOrWhiteSpace(value) && value.Length <= maximum && !value.Any(char.IsControl);
}
