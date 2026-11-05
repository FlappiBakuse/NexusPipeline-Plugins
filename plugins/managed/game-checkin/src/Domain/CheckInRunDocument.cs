using System.Text.Json.Serialization;

namespace NexusPipeline.Extensions.GameCheckIn;

internal sealed record CheckInRunDocument
{
    [JsonRequired] public int FormatVersion { get; init; } = 1;
    [JsonRequired] public CheckInRun Run { get; init; } = null!;
    internal CheckInRunDocument Validate()
    {
        if (FormatVersion != 1 || Run is null || !Guid.TryParse(Run.Id, out var id) || id == Guid.Empty ||
            !Guid.TryParse(Run.AttemptId, out var attempt) || attempt == Guid.Empty || Run.TaskRevision is < 1 or > 9007199254740991 ||
            Run.Trigger is not ("scheduled" or "manual") || Run.Status is not ("running" or "success" or "partial" or "failed" or "cancelled" or "interrupted" or "unknown") ||
            Run.Results is null || Run.Results.Length > 14 || Run.CompletedAt < Run.StartedAt ||
            Run.Status == "running" && Run.CompletedAt is not null || Run.Results.Any(result => result is null) ||
            Run.Results.Select(result => (result.Platform, result.GameCode)).Distinct().Count() != Run.Results.Length)
            throw new CheckInFailure("checkin_run_format_unsupported");
        foreach (var result in Run.Results)
        {
            _ = CheckInCatalog.Game(result.Platform, result.GameCode);
            if (string.IsNullOrWhiteSpace(result.Code) || result.Code.Length > 128 || result.Code.Any(character => !char.IsAsciiLetterOrDigit(character) && character != '_') ||
                result.Message is null || result.Message.Length > 512 || result.EffectState is not ("notSubmitted" or "unknown" or "confirmed") ||
                result.Success && result.EffectState == "unknown") throw new CheckInFailure("checkin_run_format_unsupported");
        }
        return this;
    }
}
