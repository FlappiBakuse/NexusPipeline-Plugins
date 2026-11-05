namespace NexusPipeline.Extensions.MaaFramework;

internal sealed class MaaWorkerProject
{
    private readonly string[] selected;
    private readonly string[] business;
    private readonly string[] native;
    private readonly string[] preparation;
    private readonly Dictionary<string, int> completed = new(StringComparer.Ordinal);
    internal MaaRuntimePlan Plan { get; }
    internal string ConsumerExtensionId { get; }
    internal Guid BindingId { get; }
    internal bool IsInitialization { get; }
    internal IReadOnlyList<string> InitializationOccurrences => IsInitialization ? selected.ToArray() : [];
    internal IReadOnlyList<string> PreparationOccurrences => IsInitialization ? [] : preparation.ToArray();
    internal MaaWorkerProject(MaaRuntimePlan plan, string consumerExtensionId, string bindingId, IReadOnlyList<string> selectedTaskIds,
        IReadOnlyList<string>? executionTaskIds = null, bool initialize = false,
        IReadOnlyDictionary<string, int>? repetitionOffsets = null)
    {
        if (consumerExtensionId is not { Length: > 0 and <= 80 } || consumerExtensionId[0] is not (>= 'a' and <= 'z') ||
            consumerExtensionId.Any(character => character is not (>= 'a' and <= 'z' or >= '0' and <= '9' or '-')) ||
            !Guid.TryParseExact(bindingId, "D", out var binding) || binding == Guid.Empty)
            throw new MaaInputFailure("maa_runtime_consumer_unbound");
        business = selectedTaskIds.ToArray(); selected = (executionTaskIds ?? selectedTaskIds).ToArray();
        if (business.Length != selected.Length || business.Length is < 1 or > 4096 ||
            business.Any(id => string.IsNullOrWhiteSpace(id) || id.Length > 120 || id.Any(char.IsControl)) ||
            business.Distinct(StringComparer.Ordinal).Count() != business.Length) throw new MaaInputFailure("maa_runtime_selection_invalid");
        Plan = plan; ConsumerExtensionId = consumerExtensionId; BindingId = binding;
        IsInitialization = initialize;
        var programs = plan.Programs.Where(program => program.Kind == "pretask").Select(program => program.OccurrenceId).ToArray();
        preparation = programs.Where(selected.Contains).ToArray();
        native = selected.Where(id => !programs.Contains(id, StringComparer.Ordinal)).ToArray();
        if (selected.Distinct(StringComparer.Ordinal).Count() != selected.Length)
            throw new MaaInputFailure("maa_runtime_selection_invalid");
        if (initialize)
        {
            var expected = plan.Programs.Where(program => program.Kind == "pretask").Select(program => program.OccurrenceId);
            if (!selected.SequenceEqual(expected) || !business.SequenceEqual(selected))
                throw new MaaInputFailure("maa_initialization_selection_unbound");
        }
        else
        {
            if (!selected.Take(preparation.Length).SequenceEqual(preparation))
                throw new MaaInputFailure("maa_runtime_preparation_order_invalid");
            _ = plan.Select(native);
        }
        foreach (var offset in repetitionOffsets ?? new Dictionary<string, int>())
        {
            var index = Array.IndexOf(business, offset.Key);
            var task = index < 0 ? null : Tasks.SingleOrDefault(task => task.OccurrenceId == selected[index]);
            if (initialize || task is null || offset.Value < 0 || offset.Value >= task.RepeatCount ||
                !completed.TryAdd(task.OccurrenceId, offset.Value)) throw new MaaInputFailure("maa_runtime_repetition_unbound");
        }
    }
    internal MaaCompiledTask[] Tasks => IsInitialization ? [] : Plan.Select(native);
    internal int CompletedRepetitions(string occurrenceId) => completed.GetValueOrDefault(occurrenceId);
    internal string BusinessId(string occurrenceId)
    {
        var index = Array.IndexOf(selected, occurrenceId);
        return index < 0 ? throw new MaaInputFailure("maa_runtime_selection_unmapped") : business[index];
    }
}
