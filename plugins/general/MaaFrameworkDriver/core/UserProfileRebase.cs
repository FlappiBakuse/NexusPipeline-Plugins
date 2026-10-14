using System.Text.Json;
using System.Text.Json.Nodes;

namespace NexusPipeline.Plugin.MaaFrameworkDriver;

public static class UserProfileRebase
{
    private static readonly string[] Editable = ["controller", "resource", "adbPath", "adbSerial", "windowHandle",
        "windowProcessId", "windowExecutable", "windowStartedAtUtc", "windowSelection", "windowWaitMilliseconds",
        "language", "options", "resourceOptions", "controllerOptions", "controllerConfiguration", "taskOptions", "attachResourcePaths"];

    public static DriverProfile Apply(DriverProfile previous, DriverProfile current, DriverProfile user)
    {
        if (previous.ProfileId != current.ProfileId || user.ProfileId != current.ProfileId
            || previous.PackageRoot != current.PackageRoot || user.PackageRoot != current.PackageRoot
            || previous.SourceBinding?.TrustScopeId != current.SourceBinding?.TrustScopeId)
            throw new InvalidDataException("driver.binding_rebase_identity_changed");
        var before = JsonSerializer.SerializeToNode(previous, DriverJson.Options)!.AsObject();
        var after = JsonSerializer.SerializeToNode(current, DriverJson.Options)!.AsObject();
        var edits = JsonSerializer.SerializeToNode(user, DriverJson.Options)!.AsObject();
        foreach (string field in Editable) after[field] = Merge(before[field], after[field], edits[field]);
        var oldTasks = previous.TaskOccurrences.ToDictionary(task => task.OccurrenceId, StringComparer.Ordinal);
        var newTasks = current.TaskOccurrences.ToDictionary(task => task.OccurrenceId, StringComparer.Ordinal);
        var userTasks = user.TaskOccurrences.ToDictionary(task => task.OccurrenceId, StringComparer.Ordinal);
        var tasks = new List<TaskOccurrence>();
        foreach (var task in user.TaskOccurrences)
        {
            if (!oldTasks.TryGetValue(task.OccurrenceId, out var old)) { tasks.Add(task); continue; }
            if (!newTasks.TryGetValue(task.OccurrenceId, out var fresh))
            {
                if (!JsonNode.DeepEquals(JsonSerializer.SerializeToNode(old, DriverJson.Options), JsonSerializer.SerializeToNode(task, DriverJson.Options)))
                    throw new InvalidDataException("driver.binding_rebase_task_removed");
                continue;
            }
            tasks.Add(Merge(JsonSerializer.SerializeToNode(old, DriverJson.Options), JsonSerializer.SerializeToNode(fresh, DriverJson.Options),
                JsonSerializer.SerializeToNode(task, DriverJson.Options))!.Deserialize<TaskOccurrence>(DriverJson.Options)!);
        }
        foreach (var task in current.TaskOccurrences)
            if (!oldTasks.ContainsKey(task.OccurrenceId) && !userTasks.ContainsKey(task.OccurrenceId)) tasks.Add(task);
        if (previous.TaskOccurrences.Select(task => task.OccurrenceId).SequenceEqual(user.TaskOccurrences.Select(task => task.OccurrenceId)))
        {
            var byId = tasks.ToDictionary(task => task.OccurrenceId, StringComparer.Ordinal);
            tasks = current.TaskOccurrences.Where(task => byId.ContainsKey(task.OccurrenceId)).Select(task => byId[task.OccurrenceId]).ToList();
        }
        tasks = tasks.Select((task, order) => task with { Order = order }).ToList();
        var result = after.Deserialize<DriverProfile>(DriverJson.Options)!;
        return result with { Revision = user.Revision, ParentRevision = current.Revision, TaskOccurrences = tasks.ToArray(), AuthorizedFingerprint = "" };
    }

    private static JsonNode? Merge(JsonNode? before, JsonNode? after, JsonNode? edit)
    {
        if (JsonNode.DeepEquals(before, edit)) return after?.DeepClone();
        if (before is JsonObject original && after is JsonObject current && edit is JsonObject changed)
        {
            var merged = current.DeepClone().AsObject();
            foreach (string key in original.Select(item => item.Key).Concat(changed.Select(item => item.Key)).Distinct(StringComparer.Ordinal))
            {
                if (!changed.ContainsKey(key)) { merged.Remove(key); continue; }
                merged[key] = Merge(original[key], current[key], changed[key]);
            }
            return merged;
        }
        return edit?.DeepClone();
    }
}
