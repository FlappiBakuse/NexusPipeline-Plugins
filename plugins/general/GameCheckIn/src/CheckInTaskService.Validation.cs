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
    private CheckInTask BuildTask(CheckInTaskSaveRequest input, Guid id, CheckInTask? existing)
    {
        string cnDeviceId = Guid.TryParse(existing?.CnDeviceId, out Guid cnGuid)
            ? cnGuid.ToString("D")
            : Guid.NewGuid().ToString("D");
        string kuroDevCode = string.IsNullOrWhiteSpace(existing?.KuroDevCode)
            ? Guid.NewGuid().ToString("N")
            : existing!.KuroDevCode;
        string kuroDistinctId = Guid.TryParse(existing?.KuroDistinctId, out Guid kuroGuid)
            ? kuroGuid.ToString("D")
            : Guid.NewGuid().ToString("D");
        var oldSchedules = existing?.Schedules.ToDictionary(item => item.Id, StringComparer.Ordinal) ?? new Dictionary<string, CheckInSchedule>();
        List<CheckInSchedule> schedules = input.Schedules.Select(scheduleInput =>
        {
            string scheduleId = Guid.TryParse(scheduleInput.Id, out Guid parsed) ? parsed.ToString("N") : Guid.NewGuid().ToString("N");
            oldSchedules.TryGetValue(scheduleId, out CheckInSchedule? old);
            bool sameRule = old is not null
                && old.Time == scheduleInput.Time
                && old.Days.Order().SequenceEqual(scheduleInput.Days.Distinct().Order())
                && old.Enabled == scheduleInput.Enabled;
            return new CheckInSchedule
            {
                Id = scheduleId,
                Days = scheduleInput.Days.Distinct().Order().ToList(),
                Enabled = scheduleInput.Enabled,
                Time = scheduleInput.Time,
                LastFiredOccurrence = sameRule ? old!.LastFiredOccurrence : null,
            };
        }).ToList();

        return new CheckInTask
        {
            Id = id,
            Name = input.Name.Trim(),
            Remark = input.Remark.Trim(),
            Enabled = input.Enabled,
            Games = NormalizeGames(input.Games),
            CnDeviceId = cnDeviceId,
            KuroDevCode = kuroDevCode,
            KuroDistinctId = kuroDistinctId,
            Schedules = schedules,
            Notification = new CheckInNotification
            {
                Enabled = input.Notification.Enabled,
                SmtpTo = input.Notification.SmtpTo?.Trim() ?? "",
            },
            Runs = existing?.Runs ?? new List<CheckInRun>(),
        };
    }

    private static string? Validate(CheckInTaskSaveRequest input)
    {
        if (input is null
            || input.Games is null
            || input.Schedules is null
            || input.Secrets is null
            || input.Notification is null
            || input.Notification.SmtpTo is null) return "task_fields_invalid";
        if (string.IsNullOrWhiteSpace(input.Name) || input.Name.Trim().Length > 100) return "task_name_invalid";
        if (input.Remark is null || Encoding.UTF8.GetByteCount(input.Remark) > 512) return "task_remark_invalid";
        if (input.Notification.SmtpTo.Length > 4096) return "smtp_recipient_invalid";
        if (input.Schedules.Count > 30) return "schedule_limit";
        foreach ((string platform, List<string> games) in input.Games)
        {
            if (platform is null || games is null) return "games_invalid";
            Func<string, bool>? isKnown = platform.ToLowerInvariant() switch
            {
                "cn" or "os" => GameDefinitions.IsKnown,
                "skland" => SklandGameDefinitions.IsKnown,
                "skport" => SkportGameDefinitions.IsKnown,
                "kuro" => KuroGameDefinitions.IsKnown,
                "tajiduo" => game => game.Equals("nte", StringComparison.OrdinalIgnoreCase),
                _ => null,
            };
            if (isKnown is null || games.Any(game => string.IsNullOrWhiteSpace(game) || !isKnown(game))) return "games_invalid";
        }
        var ids = new HashSet<string>(StringComparer.Ordinal);
        foreach (CheckInScheduleInput? schedule in input.Schedules)
        {
            if (schedule is null || schedule.Days is null || string.IsNullOrWhiteSpace(schedule.Time)) return "schedule_settings_invalid";
            if (!TimeOnly.TryParseExact(schedule.Time, "HH:mm", CultureInfo.InvariantCulture, DateTimeStyles.None, out _)) return "schedule_time_invalid";
            if (schedule.Days.Count == 0 || schedule.Days.Any(day => (int)day is < 0 or > 6)) return "schedule_days_invalid";
            if (schedule.Id is not null && Guid.TryParse(schedule.Id, out Guid id) && !ids.Add(id.ToString("N"))) return "schedule_id_duplicate";
        }
        foreach ((string field, CheckInSecretInput value) in input.Secrets)
        {
            if (field is null || value is null || field.ToLowerInvariant() is not ("cn" or "os" or "skland" or "skport" or "kuro" or "tajiduo")) return "secret_field_invalid";
            if (value.Action is null || value.Action.ToLowerInvariant() is not ("keep" or "set" or "clear")) return "secret_action_invalid";
            if (value.Action.Equals("set", StringComparison.OrdinalIgnoreCase)
                && ((value.Value is null) == (value.CandidateId is null) || value.Value is not null && !IsValidCredential(value.Value)
                    || value.CandidateId is { Length: < 1 or > 64 })) return "secret_value_invalid";
            if (!value.Action.Equals("set", StringComparison.OrdinalIgnoreCase) && (value.Value is not null || value.CandidateId is not null)) return "secret_action_invalid";
            value.Action = value.Action.ToLowerInvariant();
        }
        return null;
    }

    private static Dictionary<string, List<string>> NormalizeGames(Dictionary<string, List<string>> values)
    {
        var result = new Dictionary<string, List<string>>(StringComparer.OrdinalIgnoreCase);
        foreach (string platform in PlatformOrder)
        {
            if (!values.TryGetValue(platform, out List<string>? games)) continue;
            result[platform] = games.Distinct(StringComparer.OrdinalIgnoreCase).Select(value => value.ToLowerInvariant()).ToList();
        }
        return result;
    }

    private static bool IsValidCredential(string? credential) =>
        !string.IsNullOrWhiteSpace(credential)
        && Encoding.UTF8.GetByteCount(credential) <= 16 * 1024
        && credential.IndexOfAny(new[] { '\r', '\n' }) < 0;
}
