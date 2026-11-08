namespace NexusPipeline.Extensions.EmulatorSupport;

internal static class EmulatorVendors
{
    // Captured installation identities include this spelling; saved selections use lowercase.
    internal const string LdPlayer = "LdPlayer";
    internal const string Nox = "Nox";
    internal const string BlueStacks = "BlueStacks";
    internal static readonly string[] All = [LdPlayer, Nox, BlueStacks];
    internal static int EvidenceCode(string vendor) => vendor switch
    {
        LdPlayer => 0, Nox => 1, BlueStacks => 2,
        _ => throw new EmulatorFailure("emulator_installation_identity_invalid")
    };
}
