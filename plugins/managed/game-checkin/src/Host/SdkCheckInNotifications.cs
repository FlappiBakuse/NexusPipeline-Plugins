using NexusPipeline.Extensibility.Notifications;

namespace NexusPipeline.Extensions.GameCheckIn;

internal sealed class SdkCheckInNotifications(INotificationTargets targets)
{
    internal async ValueTask<CheckInNotificationTarget[]> ReadAsync(CancellationToken cancellationToken)
    {
        var snapshot = await targets.ReadAsync(cancellationToken);
        if (snapshot.Items.Count > 4096 || snapshot.Items.Select(item => item.TaskId).Distinct().Count() != snapshot.Items.Count ||
            snapshot.Items.Any(item => item.TaskId == Guid.Empty || item.Revision < 1 || string.IsNullOrWhiteSpace(item.Name) || string.IsNullOrWhiteSpace(item.Kind)))
            throw new CheckInFailure("checkin_notification_catalog_invalid");
        return snapshot.Items.Select(item => new CheckInNotificationTarget(item.TaskId.ToString("D"), item.Name, item.Kind,
            item.IsEnabled, item.IsConfigured)).ToArray();
    }
    internal static string[] Selected(CheckInNotification choice, IReadOnlyList<CheckInNotificationTarget> current) => !choice.Enabled ? [] :
        choice.NotificationTaskIds.Where(id => current.Any(target => target.Id == id && target.Enabled && target.Configured)).ToArray();
}
