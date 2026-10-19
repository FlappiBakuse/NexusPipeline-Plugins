using System.Text.Json.Nodes;
using NexusPipeline.Plugin.Abstractions;

namespace NexusPipeline.Plugin.GameCheckIn;

public sealed partial class EntryPoint : IPluginNotificationDataMigration
{
    public IReadOnlyList<string> NotificationDataScopes => ["tasks-v2/task-store"];

    public JsonObject MigrateNotificationData(string scope, JsonObject source, Func<string, IReadOnlyList<string>> resolveLegacyTargets)
    {
        if (scope != "tasks-v2/task-store" || source["schemaVersion"]?.GetValue<int>() is not (2 or 3)
            || source["tasks"] is not JsonArray tasks || source["successfulCheckIns"] is not JsonArray
            || source["pendingSecretDeletions"] is not JsonArray)
            throw new InvalidDataException("notification_migration_checkin_schema");
        var result = (JsonObject)source.DeepClone();
        if (source["schemaVersion"]!.GetValue<int>() == 3) return result;
        foreach (JsonObject task in ((JsonArray)result["tasks"]!).Select(node => node as JsonObject ?? throw new InvalidDataException()))
        {
            var notification = task["notification"] as JsonObject ?? throw new InvalidDataException();
            if (notification.ContainsKey("notificationTaskIds")) throw new InvalidDataException("notification_migration_checkin_mixed_schema");
            var ids = resolveLegacyTargets(notification["smtpTo"]?.GetValue<string>() ?? "");
            notification.Remove("smtpTo");
            notification["notificationTaskIds"] = new JsonArray(ids.Select(id => (JsonNode?)JsonValue.Create(id)).ToArray());
        }
        result["schemaVersion"] = 3;
        return result;
    }
}
