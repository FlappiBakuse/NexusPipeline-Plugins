namespace NexusPipeline.Extensions.GameCheckIn;

internal sealed record CheckInRevealed(string Value, double RemainingSeconds)
{ public override string ToString() => "[revealed check-in credential]"; }
internal sealed class CheckInCredentials(ICheckInPersistence persistence, CheckInEditors editors, CredentialRevealGrants grants)
{
    internal void Confirm(CheckInClient client, string editorId)
    { _ = editors.Get(client, editorId); grants.Confirm(client); }
    internal async ValueTask<CheckInRevealed> RevealAsync(CheckInClient client, string editorId, string platform, CancellationToken cancellationToken)
    {
        var editor = editors.Get(client, editorId); var remaining = grants.RemainingSeconds(client);
        var view = editor.View(client);
        if (!view.Fields.TryGetValue(platform, out var metadata)) throw new CheckInFailure("credential_platform_invalid");
        using var candidate = editor.Candidate(client, platform, metadata.FieldGeneration);
        if (candidate is not null) return Reveal(candidate, remaining);
        if (editor.TaskId is not { } taskId) throw new CheckInFailure("credential_not_configured");
        var snapshot = await persistence.ReadTasksAsync(cancellationToken);
        if (!snapshot.Store.Tasks.Any(task => task.Id == taskId)) throw new CheckInFailure("checkin_task_not_found");
        using var saved = await persistence.ReadCredentialAsync(taskId, platform, cancellationToken);
        if (saved.Error is { } error) throw new CheckInFailure(error);
        if (saved.Material is null) throw new CheckInFailure("credential_not_configured");
        remaining = grants.RemainingSeconds(client); _ = editor.View(client);
        return Reveal(saved.Material, remaining);
    }
    private static CheckInRevealed Reveal(CredentialMaterial material, double remaining)
    {
        string? value = null; material.Use(characters => value = characters.ToString());
        return new(value!, remaining);
    }
}
