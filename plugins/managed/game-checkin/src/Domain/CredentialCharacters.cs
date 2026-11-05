namespace NexusPipeline.Extensions.GameCheckIn;

internal static class CredentialCharacters
{
    internal static bool Cookie(ReadOnlySpan<char> value)
    {
        if (value.IsEmpty) return false;
        foreach (var character in value)
            if (character is < '!' or > '~' or '"' or '\\' or ',' or ';') return false;
        return true;
    }
}
