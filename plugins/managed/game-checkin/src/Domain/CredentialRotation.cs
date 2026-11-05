using System.Text;

namespace NexusPipeline.Extensions.GameCheckIn;

internal static class CredentialRotation
{
    internal static bool CanRotate(string field, ReadOnlySpan<char> before, ReadOnlySpan<char> after)
    {
        if (field != "tajiduo") return false;
        var previousBytes = new byte[Encoding.UTF8.GetByteCount(before)]; Encoding.UTF8.GetBytes(before, previousBytes);
        var replacementBytes = new byte[Encoding.UTF8.GetByteCount(after)]; Encoding.UTF8.GetBytes(after, replacementBytes);
        try
        {
            using var previous = CredentialMaterial.Decode(previousBytes); using var replacement = CredentialMaterial.Decode(replacementBytes);
            if (previous.Source != replacement.Source || previous.MaskedAccount != replacement.MaskedAccount || previous.Web != replacement.Web || previous.Web is not null) return false;
            var old = Read(previous); var next = Read(replacement);
            return old.SdkToken is not null && old.SdkUid is not null && old.Uid == next.Uid && old.DeviceId == next.DeviceId && old.RoleId == next.RoleId &&
                old.SdkToken == next.SdkToken && old.SdkUid == next.SdkUid;
        }
        catch (Exception error) when (error is CheckInFailure or System.Text.Json.JsonException or InvalidOperationException or FormatException or OverflowException or ArgumentException) { return false; }
        finally { Array.Clear(previousBytes); Array.Clear(replacementBytes); }
    }
    private static TajiduoCredential Read(CredentialMaterial material)
    {
        TajiduoCredential? credential = null;
        material.Use(value => {
            var bytes = new byte[Encoding.UTF8.GetByteCount(value)]; Encoding.UTF8.GetBytes(value, bytes);
            try { credential = TajiduoCredential.Parse(bytes); } finally { Array.Clear(bytes); }
        });
        return credential!;
    }
}
