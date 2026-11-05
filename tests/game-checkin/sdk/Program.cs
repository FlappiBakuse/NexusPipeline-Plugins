using System.Text;
using System.Text.Json;
using NexusPipeline.Extensions.GameCheckIn;
using NexusPipeline.Extensibility.Secrets;
using NexusPipeline.Extensibility.State;
using NexusPipeline.Extensibility.Notifications;

var cases = new List<object>();
async Task Run(string name, Func<Task> body)
{
    try { await body(); cases.Add(new { name, status = "PASS" }); }
    catch (Exception error) { cases.Add(new { name, status = "FAIL", error = error.ToString() }); }
}
void Assert(bool value) { if (!value) throw new InvalidOperationException("assertion_failed"); }
await Run("actual-sdk-six-field-atomic-save-and-owned-secret-memory", async () =>
{
    using var ports = new PersistencePorts(); var adapter = new SdkCheckInPersistence(ports, ports, ports); var id = Guid.NewGuid();
    using var material = new CredentialMaterial("synthetic-sensitive-canary", "manual");
    var changes = CheckInCatalog.Platforms.Select(platform => new CredentialMutation(platform.Id, 0, platform.Id == "kuro" ? "set" : "keep", platform.Id == "kuro" ? material : null)).ToArray();
    var store = new CheckInTaskStore { Tasks = [new() { Id = id, Revision = 1, Name = "one", Games = new() { ["kuro"] = ["ww"] } }] };
    var op = Guid.NewGuid(); var committed = await adapter.PublishAsync(op, 0, store, id, changes, default);
    Assert(committed.Revision == 1 && ports.AtomicWrites == 1 && ports.SingleWrites == 0 && ports.Applies == 0 && ports.Transferred.Count == 6);
    Assert(!Encoding.UTF8.GetString(ports.Document!.Json.Span).Contains("synthetic-sensitive-canary", StringComparison.Ordinal));
    try { ports.Transferred.Single(change => change.Kind == SecretChangeKind.Set).UseValue(_ => { }); throw new InvalidOperationException("transferred_not_cleared"); } catch (ObjectDisposedException) { }
    using var saved = await adapter.ReadCredentialAsync(id, "kuro", default); saved.Material!.Use(value => Assert(value.SequenceEqual("synthetic-sensitive-canary")));
    Assert(saved.Revision == 1 && saved.Configured && saved.Error is null && (await adapter.ReadPublicationAsync(op, default))?.Revision == 1);
});
await Run("atomic-rejection-disposes-every-sdk-change-without-ordinary-write", async () =>
{
    using var ports = new PersistencePorts { RejectAtomic = true }; var adapter = new SdkCheckInPersistence(ports, ports, ports);
    using var material = new CredentialMaterial("synthetic-sensitive-canary", "manual");
    try { await adapter.PublishAsync(Guid.NewGuid(), 0, new(), Guid.NewGuid(), [new("kuro", 0, "set", material)], default); throw new InvalidOperationException("rejection_expected"); }
    catch (IOException) { }
    Assert(ports.Document is null && ports.SingleWrites == 0 && ports.Applies == 0);
    try { ports.Transferred.Single().UseValue(_ => { }); throw new InvalidOperationException("rejected_memory_not_cleared"); } catch (ObjectDisposedException) { }
});
await Run("unknown-task-format-and-case-alias-preserve-original-document", async () =>
{
    foreach (var body in new[] { "{\"formatVersion\":2,\"tasks\":[]}", "{\"FormatVersion\":1,\"tasks\":[]}", "{\"formatVersion\":1,\"FormatVersion\":1,\"tasks\":[]}" })
    {
        using var ports = new PersistencePorts { Document = new(7, "fixture", Encoding.UTF8.GetBytes(body)) };
        var adapter = new SdkCheckInPersistence(ports, ports, ports);
        try { await adapter.ReadTasksAsync(default); throw new InvalidOperationException("format_rejection_expected"); } catch (Exception error) when (error is CheckInFailure or JsonException) { }
        Assert(Encoding.UTF8.GetString(ports.Document.Json.Span) == body && ports.AtomicWrites == 0 && ports.SingleWrites == 0);
    }
});
await Run("unknown-credential-format-is-readable-status-with-original-bytes-preserved", async () =>
{
    using var ports = new PersistencePorts(); var id = Guid.NewGuid(); ports.Put(id, "kuro", "{\"formatVersion\":9,\"value\":\"synthetic-canary\"}");
    var adapter = new SdkCheckInPersistence(ports, ports, ports); using var read = await adapter.ReadCredentialAsync(id, "kuro", default);
    Assert(read.Configured && read.Material is null && read.Error == "credential_format_unsupported" && ports.Applies == 0 && ports.AtomicWrites == 0);
});
await Run("credential-read-revision-race-does-not-bind-new-bytes-to-old-revision", async () =>
{
    using var ports = new PersistencePorts { RaceState = true }; var id = Guid.NewGuid(); ports.Put(id, "kuro", "synthetic");
    var adapter = new SdkCheckInPersistence(ports, ports, ports);
    try { using var read = await adapter.ReadCredentialAsync(id, "kuro", default); throw new InvalidOperationException("race_not_detected"); }
    catch (CheckInFailure error) when (error.Code == "credential_saved_conflict") { }
});
await Run("actual-notification-target-snapshot-preserves-disabled-and-unconfigured-identities", async () =>
{
    var ready = Guid.NewGuid(); var disabled = Guid.NewGuid(); var incomplete = Guid.NewGuid();
    var catalog = new SdkCheckInNotifications(new NotificationCatalog(new(7, [
        new(ready, 1, "ready", true, true, "smtp"), new(disabled, 2, "disabled", false, true, "smtp"),
        new(incomplete, 3, "incomplete", true, false, "webhook") ])));
    var targets = await catalog.ReadAsync(default);
    Assert(targets.Length == 3 && targets.Single(target => target.Id == disabled.ToString("D")).Enabled == false &&
        targets.Single(target => target.Id == incomplete.ToString("D")).Configured == false);
    var selected = new CheckInNotification { Enabled = true, NotificationTaskIds = [ready.ToString("D"), disabled.ToString("D"), incomplete.ToString("D"), Guid.NewGuid().ToString("D")] };
    Assert(SdkCheckInNotifications.Selected(selected, targets).SequenceEqual(new[] { ready.ToString("D") }));
    Assert(SdkCheckInNotifications.Selected(selected with { Enabled = false }, targets).Length == 0);
});
await WorkHandlerCases.RunAsync(Run);
await Run("notification-target-first-invalid-field-is-rejected-before-projection", async () =>
{
    var valid = new NotificationTargetInfo(Guid.NewGuid(), 1, "valid", true, true, "smtp");
    foreach (var first in new[] { valid with { TaskId = Guid.Empty }, valid with { Revision = 0 }, valid with { Name = " " } })
    {
        var catalog = new SdkCheckInNotifications(new NotificationCatalog(new(1, [first, valid])));
        try { await catalog.ReadAsync(default); throw new InvalidOperationException("invalid_first_target_accepted"); }
        catch (CheckInFailure error) when (error.Code == "checkin_notification_catalog_invalid") { }
    }
});
await RunPublicationCases.RunAsync(Run);
await WorkContextCases.RunAsync(Run);
await SubmissionCases.RunAsync(Run);
await ProjectionCases.RunAsync(Run);
await RuntimeCases.RunAsync(Run);
await EffectCases.RunAsync(Run);
await RotationCases.RunAsync(Run);
await HandlerRunCases.RunAsync(Run);
await FrontendCases.RunAsync(Run);
await ServiceCases.RunAsync(Run);
await NativePortCases.RunAsync(Run);
await CaptureCases.RunAsync(Run);
await RoleEpochCases.RunAsync(Run);
if (args.Length > 2) await EntryCases.RunAsync(Run, args[1], args[2]);
await File.WriteAllBytesAsync(args[0], JsonSerializer.SerializeToUtf8Bytes(cases, new JsonSerializerOptions { WriteIndented = true }));
Console.WriteLine($"{cases.Count} SDK adapter cases");
return cases.Count > 0 && cases.All(item => !JsonSerializer.Serialize(item).Contains("\"FAIL\"", StringComparison.Ordinal)) ? 0 : 1;

internal sealed class NotificationCatalog(NotificationTargets targets) : INotificationTargets
{
    public ValueTask<NotificationTargets> ReadAsync(CancellationToken cancellationToken) => ValueTask.FromResult(targets);
}
