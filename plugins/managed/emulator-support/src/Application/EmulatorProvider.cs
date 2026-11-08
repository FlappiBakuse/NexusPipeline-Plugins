namespace NexusPipeline.Extensions.EmulatorSupport;

internal sealed class EmulatorProvider : IEmulatorProvider
{
    public IReadOnlyList<EmulatorLayout> Layouts => EmulatorLayouts.All;
    public EmulatorTargetDescription Describe(EmulatorTarget target) => EmulatorTargetPolicy.Describe(target);
    public ValueTask<EmulatorDiscoveryResult> DiscoverAsync(IEmulatorInventory inventory, bool supportsAndroid,
        CancellationToken cancellationToken) => new EmulatorDiscovery(inventory).DiscoverAsync(supportsAndroid, cancellationToken);

    public EmulatorTarget Select(IReadOnlyList<EmulatorSource> sources, string targetId, string endpoint, bool supportsAndroid) =>
        EmulatorSelection.Select(sources.Select(item => (item.Installation, item.Enumeration)).ToArray(), targetId, endpoint, supportsAndroid);

    public IEmulatorSession Open(IEmulatorHost host, EmulatorTarget target)
    {
        ArgumentNullException.ThrowIfNull(host); ArgumentNullException.ThrowIfNull(target);
        EmulatorSelection.Verify(target, target.Installation, target.Instance);
        return new EmulatorSession(host, target);
    }
}
