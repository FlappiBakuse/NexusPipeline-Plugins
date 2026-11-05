using NexusPipeline.Extensibility.Lifecycle;

namespace NexusPipeline.Extensions.GameCheckIn;

internal sealed class SdkCheckInNative(IExtensionDesktop? desktop) : ICheckInNativeLogin
{
    public async ValueTask<CheckInNativeAvailability> ReadAsync(CheckInClient client, CancellationToken cancellationToken)
    {
        client.Require();
        if (desktop is null) return new(false, false);
        var actual = await desktop.ReadClientAsync(cancellationToken); client.Require();
        return new(actual.IsBound, actual.IsBound && actual.CanCapture);
    }
    public async ValueTask RequireAsync(CheckInClient client, CancellationToken cancellationToken)
    {
        client.Require();
        if (desktop is null) throw new CheckInFailure("client_not_supported");
        try { await desktop.RequireClientAsync(cancellationToken); }
        catch (NotSupportedException) { throw new CheckInFailure("client_not_supported"); }
        client.Require();
    }
}
