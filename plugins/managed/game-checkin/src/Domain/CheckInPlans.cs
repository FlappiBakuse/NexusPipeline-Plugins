using System.Security.Cryptography;
using System.Text;

namespace NexusPipeline.Extensions.GameCheckIn;

internal sealed record CheckInProjectedPlan(Guid PlanId, Guid BusinessTaskId, string ScheduleId, long TaskRevision, bool IsEnabled,
    string TimeZoneId, int[] Weekdays, int LocalMinute, int TimeoutSeconds, string[] NotificationTaskIds);
internal static class CheckInPlans
{
    internal static CheckInProjectedPlan[] Project(CheckInTaskStore store, string timeZoneId)
    {
        _ = TimeZoneInfo.FindSystemTimeZoneById(timeZoneId);
        var plans = store.Tasks.SelectMany(task => task.Schedules.Select(schedule => new CheckInProjectedPlan(
            Identity(task.Id, schedule.Id), task.Id, schedule.Id, task.Revision, task.Enabled && schedule.Enabled, timeZoneId,
            schedule.Days.ToArray(), schedule.LocalMinute, 1800, task.Notification.Enabled ? task.Notification.NotificationTaskIds.ToArray() : []))).ToArray();
        if (plans.Length > 4096 || plans.Select(plan => plan.PlanId).Distinct().Count() != plans.Length)
            throw new CheckInFailure("checkin_plan_limit");
        return plans;
    }
    internal static Guid Identity(Guid taskId, string scheduleId)
    {
        if (taskId == Guid.Empty || !Guid.TryParse(scheduleId, out var schedule) || schedule == Guid.Empty) throw new CheckInFailure("checkin_plan_identity_invalid");
        Span<byte> digest = stackalloc byte[32];
        SHA256.HashData(Encoding.UTF8.GetBytes("nexus.game-checkin.plan/1\n" + taskId.ToString("D") + "\n" + schedule.ToString("D")), digest);
        digest[6] = (byte)((digest[6] & 15) | 128); digest[8] = (byte)((digest[8] & 63) | 128);
        return new Guid(digest[..16], bigEndian: true);
    }
    internal static CheckInTask Resolve(CheckInTaskStore store, Guid planId, long expectedTaskRevision)
    {
        var matches = store.Tasks.Where(task => task.Schedules.Any(schedule => Identity(task.Id, schedule.Id) == planId)).ToArray();
        if (matches.Length != 1 || matches[0].Revision != expectedTaskRevision) throw new CheckInFailure("checkin_plan_stale");
        return matches[0];
    }
}
internal static class CheckInEdits
{
    internal static CheckInTaskStore Save(CheckInTaskStore current, CheckInTask proposed)
    {
        var existing = current.Tasks.SingleOrDefault(task => task.Id == proposed.Id);
        var saved = (proposed with { Revision = checked((existing?.Revision ?? 0) + 1), Protocol = existing?.Protocol ?? proposed.Protocol }).Validate();
        CheckInTask[] tasks = existing is null ? [.. current.Tasks, saved] : current.Tasks.Select(task => task.Id == saved.Id ? saved : task).ToArray();
        if (tasks.Length > 4096 || tasks.Sum(task => task.Schedules.Length) > 4096) throw new CheckInFailure("checkin_plan_limit");
        if (tasks.Select(task => task.Name).Distinct(StringComparer.OrdinalIgnoreCase).Count() != tasks.Length)
            throw new CheckInFailure("checkin_task_name_duplicate");
        return current with { Tasks = tasks };
    }
    internal static CheckInTaskStore Delete(CheckInTaskStore current, Guid taskId)
    {
        if (!current.Tasks.Any(task => task.Id == taskId)) throw new CheckInFailure("checkin_task_not_found");
        return current with { Tasks = current.Tasks.Where(task => task.Id != taskId).ToArray() };
    }
    internal static CheckInTaskStore Reorder(CheckInTaskStore current, Guid[] taskIds)
    {
        if (taskIds.Length != current.Tasks.Length || taskIds.Distinct().Count() != taskIds.Length || taskIds.Except(current.Tasks.Select(task => task.Id)).Any())
            throw new CheckInFailure("checkin_task_order_invalid");
        var byId = current.Tasks.ToDictionary(task => task.Id);
        return current with { Tasks = taskIds.Select(id => byId[id]).ToArray() };
    }
}
