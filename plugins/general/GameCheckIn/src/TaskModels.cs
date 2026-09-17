using System.Text.Json.Serialization;

namespace NexusPipeline.Plugin.GameCheckIn;

internal sealed class CheckInTaskStore
{
    [JsonPropertyName("schemaVersion")]
    public int SchemaVersion { get; set; } = 2;

    [JsonPropertyName("tasks")]
    public List<CheckInTask> Tasks { get; set; } = new();

    [JsonPropertyName("successfulCheckIns")]
    public List<SuccessfulCheckIn> SuccessfulCheckIns { get; set; } = new();
}

internal sealed class CheckInTask
{
    [JsonPropertyName("id")]
    public Guid Id { get; set; }

    [JsonPropertyName("name")]
    public string Name { get; set; } = "";

    [JsonPropertyName("remark")]
    public string Remark { get; set; } = "";

    [JsonPropertyName("enabled")]
    public bool Enabled { get; set; } = true;

    [JsonPropertyName("games")]
    public Dictionary<string, List<string>> Games { get; set; } = new(StringComparer.OrdinalIgnoreCase);

    [JsonPropertyName("cnDeviceId")]
    public string CnDeviceId { get; set; } = "";

    [JsonPropertyName("kuroDevCode")]
    public string KuroDevCode { get; set; } = "";

    [JsonPropertyName("kuroDistinctId")]
    public string KuroDistinctId { get; set; } = "";

    [JsonPropertyName("schedules")]
    public List<CheckInSchedule> Schedules { get; set; } = new();

    [JsonPropertyName("notification")]
    public CheckInNotification Notification { get; set; } = new();

    [JsonPropertyName("runs")]
    public List<CheckInRun> Runs { get; set; } = new();
}

internal sealed class CheckInSchedule
{
    [JsonPropertyName("id")]
    public string Id { get; set; } = Guid.NewGuid().ToString("N");

    [JsonPropertyName("days")]
    public List<DayOfWeek> Days { get; set; } = new();

    [JsonPropertyName("enabled")]
    public bool Enabled { get; set; } = true;

    [JsonPropertyName("time")]
    public string Time { get; set; } = "09:00";

    [JsonPropertyName("lastFiredOccurrence")]
    public string? LastFiredOccurrence { get; set; }
}

internal sealed class CheckInNotification
{
    [JsonPropertyName("enabled")]
    public bool Enabled { get; set; }

    [JsonPropertyName("smtpTo")]
    public string SmtpTo { get; set; } = "";
}

internal sealed class CheckInRun
{
    [JsonPropertyName("id")]
    public string Id { get; set; } = Guid.NewGuid().ToString("N");

    [JsonPropertyName("trigger")]
    public string Trigger { get; set; } = "manual";

    [JsonPropertyName("startedAt")]
    public DateTimeOffset StartedAt { get; set; }

    [JsonPropertyName("completedAt")]
    public DateTimeOffset? CompletedAt { get; set; }

    [JsonPropertyName("status")]
    public string Status { get; set; } = "running";

    [JsonPropertyName("results")]
    public List<CheckInResult> Results { get; set; } = new();
}

internal sealed record SuccessfulCheckIn(
    [property: JsonPropertyName("platform")] string Platform,
    [property: JsonPropertyName("gameCode")] string GameCode,
    [property: JsonPropertyName("credentialFingerprint")] string CredentialFingerprint,
    [property: JsonPropertyName("localDate")] string LocalDate);

internal sealed class CheckInTaskSaveRequest
{
    [JsonPropertyName("id")]
    public Guid? Id { get; set; }

    [JsonPropertyName("name")]
    public string Name { get; set; } = "";

    [JsonPropertyName("remark")]
    public string Remark { get; set; } = "";

    [JsonPropertyName("enabled")]
    public bool Enabled { get; set; } = true;

    [JsonPropertyName("games")]
    public Dictionary<string, List<string>> Games { get; set; } = new(StringComparer.OrdinalIgnoreCase);

    [JsonPropertyName("schedules")]
    public List<CheckInScheduleInput> Schedules { get; set; } = new();

    [JsonPropertyName("notification")]
    public CheckInNotificationInput Notification { get; set; } = new();

    [JsonPropertyName("secrets")]
    public Dictionary<string, CheckInSecretInput> Secrets { get; set; } = new(StringComparer.OrdinalIgnoreCase);
}

internal sealed class CheckInScheduleInput
{
    [JsonPropertyName("id")]
    public string? Id { get; set; }

    [JsonPropertyName("days")]
    public List<DayOfWeek> Days { get; set; } = new();

    [JsonPropertyName("enabled")]
    public bool Enabled { get; set; } = true;

    [JsonPropertyName("time")]
    public string Time { get; set; } = "09:00";
}

internal sealed class CheckInNotificationInput
{
    [JsonPropertyName("enabled")]
    public bool Enabled { get; set; }

    [JsonPropertyName("smtpTo")]
    public string SmtpTo { get; set; } = "";
}

internal sealed class CheckInTaskOrderRequest
{
    [JsonPropertyName("taskIds")]
    public List<Guid> TaskIds { get; set; } = new();
}

internal sealed class CheckInSecretInput
{
    [JsonPropertyName("action")]
    public string Action { get; set; } = "keep";

    [JsonPropertyName("value")]
    public string? Value { get; set; }
}

internal sealed class CheckInTaskView
{
    public Guid Id { get; init; }
    public string Name { get; init; } = "";
    public string Remark { get; init; } = "";
    public bool Enabled { get; init; }
    public Dictionary<string, List<string>> Games { get; init; } = new(StringComparer.OrdinalIgnoreCase);
    public List<CheckInSchedule> Schedules { get; init; } = new();
    public CheckInNotification Notification { get; init; } = new();
    public List<CheckInRun> Runs { get; init; } = new();
    public Dictionary<string, bool> Credentials { get; init; } = new(StringComparer.OrdinalIgnoreCase);
    public bool IsRunning { get; init; }
    public DateTimeOffset? NextRunAt { get; init; }
    public CheckInRun? RecentRun { get; init; }
}
