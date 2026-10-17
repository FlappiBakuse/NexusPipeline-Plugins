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
    private async ValueTask PollSchedulesAsync(CancellationToken cancellationToken)
    {
        if (_stopped || !await _pollGate.WaitAsync(0, cancellationToken).ConfigureAwait(false)) return;
        try
        {
            var dueTasks = new Dictionary<Guid, HashSet<string>>();
            DateTimeOffset now = _clock().ToLocalTime();
            string localDate = now.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
            string time = now.ToString("HH:mm", CultureInfo.InvariantCulture);
            bool changed = false;
            await _storeGate.WaitAsync(cancellationToken).ConfigureAwait(false);
            try
            {
                if (_stopped) return;
                CheckInTaskStore store = await ReadStoreAsync(cancellationToken).ConfigureAwait(false);
                int oldSuccessCount = store.SuccessfulCheckIns.Count;
                store.SuccessfulCheckIns.RemoveAll(entry =>
                    !DateOnly.TryParseExact(entry.LocalDate, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out DateOnly date)
                    || date < DateOnly.FromDateTime(now.DateTime).AddDays(-14));
                changed = store.SuccessfulCheckIns.Count != oldSuccessCount;

                foreach (CheckInTask task in store.Tasks.Where(item => item.Enabled))
                {
                    foreach (CheckInSchedule schedule in task.Schedules.Where(item => item.Enabled))
                    {
                        if (!schedule.Days.Contains(now.DayOfWeek)
                            || !string.Equals(schedule.Time, time, StringComparison.Ordinal)) continue;
                        string occurrence = localDate + "/" + schedule.Time;
                        if (string.Equals(schedule.LastFiredOccurrence, occurrence, StringComparison.Ordinal)) continue;
                        schedule.LastFiredOccurrence = occurrence;
                        if (!dueTasks.TryGetValue(task.Id, out HashSet<string>? scheduleIds))
                        {
                            scheduleIds = new HashSet<string>(StringComparer.Ordinal);
                            dueTasks[task.Id] = scheduleIds;
                        }
                        scheduleIds.Add(schedule.Id);
                        changed = true;
                    }
                }

                if (changed) await WriteStoreAsync(store, cancellationToken).ConfigureAwait(false);
            }
            finally
            {
                _storeGate.Release();
            }

            foreach ((Guid taskId, HashSet<string> scheduleIds) in dueTasks)
            {
                cancellationToken.ThrowIfCancellationRequested();
                try
                {
                    await StartRunAsync(taskId, "schedule", cancellationToken, scheduleIds, localDate + "/" + time).ConfigureAwait(false);
                }
                catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
                {
                    throw;
                }
                catch
                {
                    _context.Logger.Warn("签到任务到期启动失败；此时段不会补跑。");
                }
            }
        }
        finally
        {
            _pollGate.Release();
        }
    }

    private DateTimeOffset? GetNextRunAt(CheckInSchedule schedule, DateTimeOffset now)
    {
        if (!schedule.Enabled || schedule.Days.Count == 0 || !TimeOnly.TryParseExact(schedule.Time, "HH:mm", CultureInfo.InvariantCulture, DateTimeStyles.None, out TimeOnly time))
        {
            return null;
        }
        DateTime localNow = now.DateTime;
        for (int offset = 0; offset <= 7; offset++)
        {
            DateTime date = localNow.Date.AddDays(offset);
            if (!schedule.Days.Contains(date.DayOfWeek)) continue;
            DateTime candidateDate = date.Add(time.ToTimeSpan());
            string occurrence = candidateDate.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture) + "/" + schedule.Time;
            if (candidateDate < localNow || (candidateDate == localNow && schedule.LastFiredOccurrence == occurrence)) continue;
            try
            {
                return new DateTimeOffset(DateTime.SpecifyKind(candidateDate, DateTimeKind.Local));
            }
            catch (ArgumentException)
            {
                continue;
            }
        }
        return null;
    }
}
