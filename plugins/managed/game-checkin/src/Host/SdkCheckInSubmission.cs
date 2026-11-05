using NexusPipeline.Extensibility.Notifications;
using NexusPipeline.Extensibility.Protocol;

namespace NexusPipeline.Extensions.GameCheckIn;

internal sealed class SdkCheckInSubmission(INotificationSubmissionPort submissions, SdkCheckInNotifications targets)
{
    internal async ValueTask<NotificationAcceptance?> SubmitAsync(CheckInTask task, CheckInRun run, ScheduledInvocation invocation, CancellationToken cancellationToken)
    {
        if (run.Id != invocation.RunId || run.AttemptId != invocation.AttemptId || run.TaskRevision != task.Revision ||
            !Guid.TryParseExact(invocation.NotificationOperationId, "D", out var operationId) || operationId == Guid.Empty)
            throw new CheckInFailure("checkin_notification_identity_invalid");
        var current = await targets.ReadAsync(cancellationToken);
        var selected = SdkCheckInNotifications.Selected(task.Notification, current)
            .Where(id => invocation.NotificationTaskIds.Contains(id, StringComparer.Ordinal)).ToArray();
        if (selected.Length == 0) return null;
        var summary = CheckInSummary.Create(task, run);
        var accepted = await submissions.SubmitAsync(new() { Format = "nexus.notification.submission", Version = 1, Invocation = invocation,
            OperationId = operationId.ToString("D"), NotificationTaskIds = selected, Title = summary.Title, Body = summary.Body }, cancellationToken);
        if (accepted.OperationId != operationId || accepted.AcceptanceId == Guid.Empty) throw new CheckInFailure("checkin_notification_acceptance_unknown");
        return accepted;
    }
}
