using NexusPipeline.Extensibility.Secrets;

namespace NexusPipeline.Extensions.GameCheckIn;

internal static class SdkCheckInIdentity
{
    internal static bool CanRotate(string field, SecretDraft before, SecretDraft after)
    {
        char[]? previous = null; var allowed = false;
        try
        {
            before.Use(value => previous = value.ToArray());
            after.Use(value => allowed = CredentialRotation.CanRotate(field, previous!, value));
            return allowed;
        }
        finally { if (previous is not null) Array.Clear(previous); }
    }
    internal static SecretDraft Project(string field, SecretDraft actualStoredMaterial)
    {
        char[]? projected = null;
        try
        {
            actualStoredMaterial.Use(value => projected = CredentialIdentity.Project(field, value));
            return new SecretDraft(projected!);
        }
        finally { if (projected is not null) Array.Clear(projected); }
    }
}
