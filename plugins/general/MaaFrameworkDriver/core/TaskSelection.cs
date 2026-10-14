namespace NexusPipeline.Plugin.MaaFrameworkDriver;

internal static class TaskSelection
{
    internal static CompiledProject Apply(CompiledProject plan, IReadOnlyList<string> selected)
    {
        if (selected.Distinct(StringComparer.Ordinal).Count() != selected.Count
            || !plan.Tasks.Select(task => task.Id).Where(selected.Contains).SequenceEqual(selected))
            throw new InvalidDataException("driver.task_selection_invalid");
        return plan with { Tasks = plan.Tasks.Where(task => selected.Contains(task.Id)).ToArray() };
    }
}
