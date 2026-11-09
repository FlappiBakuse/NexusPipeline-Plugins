using NexusPipeline.Extensions.GameCheckIn;
using NexusPipeline.Extensibility.Lifecycle;

internal static class NativePortCases
{
    internal static async Task RunAsync(Func<string, Func<Task>, Task> run)
    {
        static void Assert(bool value) { if (!value) throw new InvalidOperationException("assertion_failed"); }
        foreach (var (bound, capture) in new[] { (false, false), (true, false), (true, true), (false, true) })
            await run("actual-native-client-readiness-is-client-bound-without-require-or-global-presence/" + bound + "/" + capture, async () => {
                using var lifetime = new CancellationTokenSource(); var client = new CheckInClient(Guid.NewGuid(), Guid.NewGuid(), lifetime.Token);
                var host = new Desktop { State = new(bound, capture) }; var value = await new SdkCheckInNative(host).ReadAsync(client, default);
                Assert(value.NativeReady == bound && value.BrowserReady == (bound && capture) && host.Requires == 0);
            });
        await run("actual-native-action-requires-host-current-desktop-proof-not-readiness", async () => {
            using var lifetime = new CancellationTokenSource(); var client = new CheckInClient(Guid.NewGuid(), Guid.NewGuid(), lifetime.Token);
            var host = new Desktop(); await new SdkCheckInNative(host).RequireAsync(client, default); Assert(host.Requires > 0 && host.Reads == 0);
        });
        await run("unavailable-native-owner-does-not-fall-back-to-global-desktop-session", async () => {
            using var lifetime = new CancellationTokenSource(); var client = new CheckInClient(Guid.NewGuid(), Guid.NewGuid(), lifetime.Token); var host = new Desktop { Unsupported = true };
            try { await new SdkCheckInNative(host).RequireAsync(client, default); }
            catch (CheckInFailure failure) when (failure.Code == "client_not_supported") { Assert(host.Requires > 0 && host.Reads == 0); return; }
            throw new InvalidOperationException("native_unavailable_not_rejected");
        });
        await run("retired-private-client-never-reaches-native-port", async () => {
            using var lifetime = new CancellationTokenSource(); lifetime.Cancel(); var client = new CheckInClient(Guid.NewGuid(), Guid.NewGuid(), lifetime.Token); var host = new Desktop();
            try { await new SdkCheckInNative(host).ReadAsync(client, default); }
            catch (CheckInFailure failure) when (failure.Code == "client_session_required") { Assert(host.Reads == 0); return; }
            throw new InvalidOperationException("retired_client_accepted");
        });
        await run("client-retirement-during-native-read-suppresses-late-readiness", async () => {
            using var lifetime = new CancellationTokenSource(); var client = new CheckInClient(Guid.NewGuid(), Guid.NewGuid(), lifetime.Token);
            var host = new Desktop { State = new(true, true), ReadAction = lifetime.Cancel };
            try { await new SdkCheckInNative(host).ReadAsync(client, default); }
            catch (CheckInFailure failure) when (failure.Code == "client_session_required") { Assert(lifetime.IsCancellationRequested); return; }
            throw new InvalidOperationException("late_native_ready_accepted");
        });
        await run("headless-missing-native-owner-preserves-manual-only-without-login-authority", async () => {
            using var lifetime = new CancellationTokenSource(); var client = new CheckInClient(Guid.NewGuid(), Guid.NewGuid(), lifetime.Token);
            var adapter = new SdkCheckInNative(null); var availability = await adapter.ReadAsync(client, default);
            Assert(!availability.NativeReady && !availability.BrowserReady);
            try { await adapter.RequireAsync(client, default); }
            catch (CheckInFailure failure) when (failure.Code == "client_not_supported") { return; }
            throw new InvalidOperationException("headless_native_action_accepted");
        });
    }
    private sealed class Desktop : IExtensionDesktop
    {
        internal DesktopClientState State = new(false, false);
        internal int Reads, Requires;
        internal bool Unsupported;
        internal Action? ReadAction;
        public ValueTask<Guid?> ReadSessionAsync(CancellationToken cancellationToken) => throw new InvalidOperationException("global_process_presence_cannot_prove_client");
        public ValueTask<DesktopClientState> ReadClientAsync(CancellationToken cancellationToken) { Reads++; ReadAction?.Invoke(); return ValueTask.FromResult(State); }
        public ValueTask RequireClientAsync(CancellationToken cancellationToken) { Requires++; if (Unsupported) throw new NotSupportedException(); return ValueTask.CompletedTask; }
    }
}
