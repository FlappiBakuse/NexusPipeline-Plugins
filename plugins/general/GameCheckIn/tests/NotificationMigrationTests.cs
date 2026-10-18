using System.Text.Json.Nodes;
using NexusPipeline.Plugin.Abstractions;
using Xunit;

namespace NexusPipeline.Plugin.GameCheckIn.Tests;

public sealed class NotificationMigrationTests
{
    [Fact]
    public void V2ConversionPreservesSchedulesHistoryAndCredentialIdentity()
    {
        var source = JsonNode.Parse("""{"schemaVersion":2,"tasks":[{"id":"c64d304b-ea2b-4a99-8f9e-f2fa71ef8d54","name":"daily","enabled":false,"schedules":[{"time":"09:00","days":[1],"lastFiredOccurrence":"owned"}],"runs":[{"id":"history"}],"cnDeviceId":"device","notification":{"enabled":true,"smtpTo":"task@example.invalid"}}],"successfulCheckIns":[{"credentialFingerprint":"fingerprint"}],"pendingSecretDeletions":[]}""")!.AsObject();
        string before = source.ToJsonString();
        var converter = (IPluginNotificationDataMigration)new EntryPoint();
        string? recipient = null;
        var migrated = converter.MigrateNotificationData("tasks-v2/task-store", source, value => { recipient = value; return ["target"]; });
        Assert.Equal("task@example.invalid", recipient);
        Assert.Equal(before, source.ToJsonString());
        Assert.Equal(3, migrated["schemaVersion"]!.GetValue<int>());
        Assert.Equal(source["tasks"]![0]!["id"]!.ToJsonString(), migrated["tasks"]![0]!["id"]!.ToJsonString());
        Assert.Equal(source["tasks"]![0]!["schedules"]!.ToJsonString(), migrated["tasks"]![0]!["schedules"]!.ToJsonString());
        Assert.Equal(source["tasks"]![0]!["runs"]!.ToJsonString(), migrated["tasks"]![0]!["runs"]!.ToJsonString());
        Assert.Equal(source["successfulCheckIns"]!.ToJsonString(), migrated["successfulCheckIns"]!.ToJsonString());
        Assert.Null(migrated["tasks"]![0]!["notification"]!["smtpTo"]);
        Assert.Equal("target", migrated["tasks"]![0]!["notification"]!["notificationTaskIds"]![0]!.GetValue<string>());
        Assert.Equal(migrated.ToJsonString(), converter.MigrateNotificationData("tasks-v2/task-store", migrated, _ => throw new Exception()).ToJsonString());
    }

    [Fact]
    public void UnknownSchemaAndFailedTargetResolutionCannotAlterSource()
    {
        var converter = (IPluginNotificationDataMigration)new EntryPoint();
        var unknown = JsonNode.Parse("""{"schemaVersion":4,"tasks":[],"successfulCheckIns":[],"pendingSecretDeletions":[]}""")!.AsObject();
        string before = unknown.ToJsonString();
        Assert.Throws<InvalidDataException>(() => converter.MigrateNotificationData("tasks-v2/task-store", unknown, _ => []));
        Assert.Equal(before, unknown.ToJsonString());
        unknown["schemaVersion"] = 2;
        unknown["tasks"]!.AsArray().Add(new JsonObject { ["notification"] = new JsonObject { ["smtpTo"] = "test@example.invalid" } });
        before = unknown.ToJsonString();
        Assert.Throws<IOException>(() => converter.MigrateNotificationData("tasks-v2/task-store", unknown, _ => throw new IOException("blocked")));
        Assert.Equal(before, unknown.ToJsonString());
    }
}
