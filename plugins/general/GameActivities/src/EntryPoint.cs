using NexusPipeline.Plugin.Abstractions;

namespace NexusPipeline.Plugin.GameActivities;

public sealed class EntryPoint : INexusPlugin
{
    private ActivityCoordinator? _coordinator;
    private ActivityWebApi? _api;
    private IPluginHostContext? _context;
    private IDisposable? _card;
    private IDisposable? _schedule;

    public async ValueTask InitializeAsync(IPluginHostContext context, CancellationToken ct)
    {
        _context = context;
        _coordinator = new(context);
        await _coordinator.InitializeAsync(ct).ConfigureAwait(false);
        _api = new(_coordinator, context.Assets);
        _api.Register(context.WebApi);
    }
    public async ValueTask StartAsync(CancellationToken ct)
    {
        var coordinator = _coordinator ?? throw new InvalidOperationException("Activities not initialized");
        _card ??= _context!.DashboardCards.Register(new("carousel", "card.title", "card.description", true, 400));
        _schedule ??= _context!.Scheduler.Register(
            new("refresh-due", Interval: TimeSpan.FromMinutes(1), Timeout: TimeSpan.FromSeconds(5)),
            async (_, token) => { await coordinator.QueueAsync(false, token).ConfigureAwait(false); });
        await coordinator.QueueAsync(false, ct).ConfigureAwait(false);
    }
    public async ValueTask StopAsync(CancellationToken ct)
    {
        _card?.Dispose();
        _card = null;
        _schedule?.Dispose();
        _schedule = null;
        _api?.Dispose();
        _api = null;
        if (_coordinator is not null) await _coordinator.StopAsync(ct).ConfigureAwait(false);
        _coordinator = null;
        _context = null;
    }
}
