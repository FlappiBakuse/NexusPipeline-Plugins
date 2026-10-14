using System.Security.Cryptography;
using System.Text;
using System.Text.Json.Nodes;

namespace NexusPipeline.Plugin.MaaFrameworkDriver;

public static class ProfileMigration
{
    internal static string Canonical(JsonNode node) => node switch {
        JsonObject obj => "{" + string.Join(",", obj.OrderBy(pair => pair.Key, StringComparer.Ordinal)
            .Select(pair => System.Text.Json.JsonSerializer.Serialize(pair.Key) + ":" + (pair.Value is null ? "null" : Canonical(pair.Value)))) + "}",
        JsonArray array => "[" + string.Join(",", array.Select(item => item is null ? "null" : Canonical(item))) + "]",
        _ => node.ToJsonString() };

    public static string Identity(params string[] parts) => "t_" + Convert.ToHexString(SHA256.HashData(
        Encoding.UTF8.GetBytes(System.Text.Json.JsonSerializer.Serialize(parts)))).ToLowerInvariant()[..32];

    public static DriverProfile Upgrade(DriverProfile profile)
    {
        if (profile.SchemaVersion == 3)
        {
            if (profile.SelectedTasks.Length != 0 || profile.TaskOptions.Count != 0)
                throw new InvalidDataException("driver.profile.parallel_task_formats");
            return profile;
        }
        if (profile.SchemaVersion != 2 || profile.TaskOccurrences.Length != 0)
            throw new InvalidDataException("driver.profile.schema mismatch");
        if (profile.SelectedTasks.Distinct(StringComparer.Ordinal).Count() != profile.SelectedTasks.Length)
            throw new InvalidDataException("driver.profile.legacy_duplicate_identity");
        string[] names = profile.SelectedTasks.Concat(profile.TaskOptions.Select(pair => pair.Key))
            .Distinct(StringComparer.Ordinal).ToArray();
        return profile with { SchemaVersion = 3, SelectedTasks = [], TaskOptions = new(), AuthorizedFingerprint = "",
            TaskOccurrences = names.Select((name, index) => new TaskOccurrence {
                OccurrenceId = Identity("profile-v2", profile.ProfileId, name), PiTaskName = name, Order = index,
                Enabled = profile.SelectedTasks.Contains(name, StringComparer.Ordinal),
                Options = profile.TaskOptions[name] is null ? new() : profile.TaskOptions[name]!.DeepClone().AsObject()
            }).ToArray() };
    }

    public static void Validate(TaskOccurrence[] entries)
    {
        if (entries.Length > 1000 || entries.Select(entry => entry.OccurrenceId).Distinct(StringComparer.Ordinal).Count() != entries.Length)
            throw new InvalidDataException("driver.taskOccurrences.duplicate_or_limit");
        for (int index = 0; index < entries.Length; index++)
        {
            var entry = entries[index];
            if (entry.Order != index || entry.OccurrenceId.Length is < 1 or > 64
                || !entry.OccurrenceId.All(c => char.IsAsciiLetterOrDigit(c) || c is '_' or '-')
                || string.IsNullOrWhiteSpace(entry.PiTaskName) || entry.RepeatCount is < 1 or > 100)
                throw new InvalidDataException("driver.taskOccurrences.invalid_identity_order_or_repeat");
        }
        if (entries.Where(entry => entry.Enabled).Sum(entry => entry.RepeatCount) > 1000)
            throw new InvalidDataException("driver.taskOccurrences.execution_limit");
    }
}
