using System.Diagnostics;

namespace NexusPipeline.Extensions.MaaFramework;

internal sealed record MaaAgentLaunch(string Identifier, long TimeoutMilliseconds,
    Func<string, CancellationToken, ValueTask<MaaProgramProcess>> Start);

internal sealed class MaaAgentSession(string library, long sizeBytes, string sha256,
    IReadOnlyList<MaaAgentLaunch> launches, Action requireCurrent)
{
    private readonly List<(MaaAgentNative Client, MaaProgramProcess? Process)> owned = [];
    private Task<bool>? connecting;
    private bool started, stopped;

    internal async Task StartAsync(MaaNative native, nint resource, nint controller, nint tasker, CancellationToken cancellation)
    {
        if (started || stopped || owned.Count != 0 || launches.Count is < 1 or > 16) throw new IOException("maa_agent_phase_invalid");
        foreach (var launch in launches)
        {
            cancellation.ThrowIfCancellationRequested(); requireCurrent();
            var client = new MaaAgentNative(native, library, sizeBytes, sha256, launch.Identifier, launch.TimeoutMilliseconds);
            owned.Add((client, null)); client.Bind(resource); client.RegisterSinks(resource, controller, tasker);
            var process = await launch.Start(client.Identifier, cancellation).ConfigureAwait(false);
            owned[^1] = (client, process);
            process.RequireRunning(); requireCurrent();
            connecting = Task.Run(client.Connect);
            if (!await connecting.WaitAsync(cancellation).ConfigureAwait(false) || !client.Connected)
                throw new IOException("maa_agent_connection_failed");
            connecting = null; process.RequireRunning();
        }
        started = true;
    }
    internal void RequireRunning()
    {
        requireCurrent();
        if (!started || stopped) throw new IOException("maa_agent_phase_invalid");
        foreach (var item in owned)
        {
            item.Process!.RequireRunning(); item.Client.RequireCurrent();
            if (!item.Client.Connected) throw new IOException("maa_agent_disconnected");
        }
    }
    internal async Task StopAsync(TimeSpan timeout)
    {
        if (stopped) return;
        var timer = Stopwatch.StartNew();
        if (connecting is { } pending)
        {
            try { _ = await pending.WaitAsync(Remaining(timer, timeout)).ConfigureAwait(false); }
            catch (Exception) when (pending.IsCompleted) { }
            connecting = null;
        }
        foreach (var item in owned.AsEnumerable().Reverse())
        {
            item.Client.BoundStop();
            var disconnect = Task.Run(item.Client.Disconnect);
            await disconnect.WaitAsync(Remaining(timer, timeout)).ConfigureAwait(false);
            if (item.Process is { } process)
            {
                try { _ = await process.WaitAsync(Minimum(Remaining(timer, timeout), TimeSpan.FromSeconds(1)), default).ConfigureAwait(false); }
                catch (TimeoutException) { await process.StopAsync(Remaining(timer, timeout)).ConfigureAwait(false); }
                await process.DisposeAsync().ConfigureAwait(false);
            }
            item.Client.Dispose();
        }
        owned.Clear(); stopped = true;
    }
    private static TimeSpan Minimum(TimeSpan left, TimeSpan right) => left <= right ? left : right;
    private static TimeSpan Remaining(Stopwatch timer, TimeSpan maximum) => maximum - timer.Elapsed is var remaining && remaining > TimeSpan.Zero
        ? remaining : throw new TimeoutException("maa_agent_drain_unverified");
}
