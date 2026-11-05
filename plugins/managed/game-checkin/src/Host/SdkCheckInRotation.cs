using System.Security.Cryptography;
using System.Text;
using NexusPipeline.Extensibility.Scheduling;

namespace NexusPipeline.Extensions.GameCheckIn;

internal sealed class SdkCheckInRotation(IWorkTasks tasks, ICheckInPersistence persistence, Guid taskId,
    long expectedTaskRevision, long expectedSecretRevision) : ICheckInCredentialRotation
{
    private bool attempted;
    public async ValueTask<bool> PersistAsync(CredentialMaterial expected, CredentialMaterial replacement, CancellationToken cancellationToken)
    {
        if (attempted) return false;
        attempted = true;
        var before = expected.Encode(); var after = replacement.Encode();
        try
        {
            if (!Allowed(before, after)) return false;
            var current = await tasks.ReadCurrentAsync(cancellationToken);
            if (current.TaskId != taskId || current.TaskRevision != expectedTaskRevision || current.RunId == Guid.Empty || current.AttemptId == Guid.Empty) return false;
            var snapshot = await persistence.ReadTasksAsync(cancellationToken);
            if (!snapshot.Store.Tasks.Any(task => task.Id == taskId && task.Revision == expectedTaskRevision &&
                task.Games.GetValueOrDefault("tajiduo")?.Contains("nte") == true)) return false;
            using var actual = await persistence.ReadCredentialAsync(taskId, "tajiduo", cancellationToken);
            if (actual.Revision != expectedSecretRevision || actual.Material is null || actual.Error is not null) return false;
            var stored = actual.Material.Encode();
            try { if (!CryptographicOperations.FixedTimeEquals(before, stored)) return false; }
            finally { Array.Clear(stored); }
            var operationId = Operation(current);
            var json = CheckInJson.Bytes(snapshot.Store);
            var publication = await persistence.PublishAsync(operationId, snapshot.Revision, snapshot.Store, taskId,
                [new("tajiduo", expectedSecretRevision, "set", replacement)], cancellationToken);
            return publication.OperationId == operationId && publication.Revision == snapshot.Revision + 1 &&
                publication.Sha256 == Convert.ToHexStringLower(SHA256.HashData(json));
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested) { throw; }
        catch (Exception error) when (error is not OutOfMemoryException) { return false; }
        finally { Array.Clear(before); Array.Clear(after); }
    }
    private static bool Allowed(byte[] before, byte[] after)
    {
        var old = Encoding.UTF8.GetChars(before); var next = Encoding.UTF8.GetChars(after);
        try { return CredentialRotation.CanRotate("tajiduo", old, next); }
        finally { Array.Clear(old); Array.Clear(next); }
    }
    private static Guid Operation(WorkInvocation current)
    {
        var digest = SHA256.HashData(Encoding.UTF8.GetBytes("nexus.game-checkin.rotation/1\n" + current.RunId.ToString("D") + "\n" + current.AttemptId.ToString("D") + "\ntajiduo"));
        digest[6] = (byte)((digest[6] & 15) | 128); digest[8] = (byte)((digest[8] & 63) | 128);
        return new(digest.AsSpan(0, 16), bigEndian: true);
    }
}
