using System.Security.Cryptography;
using System.Text;

namespace NexusPipeline.Extensions.GameCheckIn;

internal sealed record CheckInExecutionIdentity(Guid RunId, Guid AttemptId, string Trigger, DateOnly LocalDate);
internal sealed class CheckInRunner(ICheckInPersistence persistence, CheckInProtocols protocols, ICheckInExecutionPorts ports, TimeProvider clock)
{
    internal async Task<CheckInRun> ExecuteAsync(CheckInTask task, CheckInExecutionIdentity identity, CancellationToken cancellationToken)
    {
        if (identity.RunId == Guid.Empty || identity.AttemptId == Guid.Empty || identity.Trigger is not ("manual" or "scheduled"))
            throw new CheckInFailure("checkin_execution_identity_invalid");
        var taskId = task.Id;
        var selected = CheckInCatalog.Platforms.SelectMany(platform => platform.Games.Where(game => task.Games.GetValueOrDefault(platform.Id)?.Contains(game.Code) == true)
            .Select(game => (Platform: platform.Id, Game: game.Code))).ToArray();
        var results = selected.Select(game => CheckInResults.Result(game.Platform, game.Game, "pending")).ToArray();
        var run = new CheckInRun(identity.RunId.ToString("D"), identity.Trigger, "running", clock.GetUtcNow(), null, results,
            identity.AttemptId.ToString("D"), task.Revision);
        var previous = await persistence.ReadRunAsync(taskId, cancellationToken);
        if (previous.Run is { } old)
        {
            if (old.AttemptId == identity.AttemptId.ToString("D")) throw new CheckInFailure("checkin_attempt_already_recorded");
            if (!await ports.IsStoppedAsync(taskId, Guid.Parse(old.Id), Guid.Parse(old.AttemptId), cancellationToken))
                throw new CheckInFailure("checkin_run_writer_active");
        }
        var revision = previous.Revision;
        async Task SaveAsync(int stage)
        {
            cancellationToken.ThrowIfCancellationRequested();
            revision = await persistence.WriteRunAsync(Operation(identity.AttemptId, stage), taskId, revision, run with { Results = results.ToArray() }, cancellationToken);
        }
        // Keep the existing stage identity of every durable checkpoint that is still written.
        if (selected.Length == 0) await SaveAsync(0);
        for (var index = 0; index < selected.Length; index++)
        {
            var game = selected[index]; cancellationToken.ThrowIfCancellationRequested();
            results[index] = CheckInResults.Result(game.Platform, game.Game, "running");
            await SaveAsync(2 * index + 1);
            try
            {
                using var credential = await persistence.ReadCredentialAsync(taskId, game.Platform, cancellationToken);
                if (!credential.Configured || credential.Material is null || credential.Error is not null)
                    results[index] = CheckInResults.Result(game.Platform, game.Game, credential.Error ?? "credential_not_configured");
                else results[index] = await protocols.SignAsync(task, game.Platform, game.Game, credential, identity.LocalDate, cancellationToken);
            }
            catch (CheckInInterrupted interrupted)
            {
                results[index] = CheckInResults.Result(game.Platform, game.Game, "cancelled", effectState: interrupted.Unknown ? "unknown" : "notSubmitted");
                for (var pending = index + 1; pending < selected.Length; pending++) results[pending] = CheckInResults.Result(selected[pending].Platform, selected[pending].Game, "cancelled");
                return run with { Status = "cancelled", CompletedAt = clock.GetUtcNow(), Results = results };
            }
            if (index + 1 < selected.Length) await SaveAsync(2 * index + 2);
        }
        run = run with { Status = results.Any(result => result.EffectState == "unknown") ? "unknown" :
                results.All(result => result.Success) ? "success" : results.Any(result => result.Success) ? "partial" : "failed",
            CompletedAt = clock.GetUtcNow(), Results = results };
        await SaveAsync(2 * selected.Length + 1);
        return run;
    }
    private static Guid Operation(Guid attemptId, int stage)
    {
        var digest = SHA256.HashData(Encoding.UTF8.GetBytes("nexus.game-checkin.result/1\n" + attemptId.ToString("D") + "\n" + stage.ToString(System.Globalization.CultureInfo.InvariantCulture)));
        digest[6] = (byte)((digest[6] & 15) | 128); digest[8] = (byte)((digest[8] & 63) | 128); return new(digest.AsSpan(0, 16), bigEndian: true);
    }
}
