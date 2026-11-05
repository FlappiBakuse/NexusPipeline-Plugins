using NexusPipeline.Extensions.EmulatorSupport;
using static Fixtures;

internal static class SessionCases
{
    internal static void Run(Action<string, Action> run)
    {
        foreach (var vendor in Enum.GetValues<EmulatorVendor>())
        {
            run("vendor-start-probe-capture-and-explicit-close/" + vendor, () => {
                var target = Target(vendor); var host = new Host(target); var session = new EmulatorSession(host, target);
                session.StartAsync(default).GetAwaiter().GetResult(); session.StartAsync(default).GetAwaiter().GetResult();
                Assert(host.Commands.Count == 1 && host.Commands[0].ToolId == target.Installation.Control.Id);
                var expected = vendor switch { EmulatorVendor.LdPlayer => new[] { "launch", "--index", "0" }, EmulatorVendor.Nox => new[] { "launch", "-name:NoxPlayer" }, _ => new[] { "--instance", "Pie64" } };
                Assert(host.Commands[0].Arguments.SequenceEqual(expected)); Assert(session.CaptureAsync(default).GetAwaiter().GetResult().MediaId == "host-media");
                session.CloseAsync(true, default).GetAwaiter().GetResult(); Assert(host.OfflineCalls > 0 && host.Stops.Count == 0);
                if (vendor == EmulatorVendor.BlueStacks) Assert(host.Commands.Count == 1 && host.Shutdowns == 1);
                else Assert(host.Commands[1].Arguments[0] == "quit" && host.Commands[1].Arguments.SequenceEqual(vendor == EmulatorVendor.LdPlayer ? new[] { "quit", "--index", "0" } : new[] { "quit", "-name:NoxPlayer" }));
            });
            run("cancel-only-host-owned-action-and-never-unowned-selected-vm/" + vendor, () => {
                var target = Target(vendor); var host = new Host(target) { Owned = false }; var session = new EmulatorSession(host, target);
                session.StartAsync(default).GetAwaiter().GetResult(); session.CancelAsync(default).GetAwaiter().GetResult();
                Assert(host.Cancelled == "host-action" && host.Shutdowns == 0 && host.Stops.Count == 0);
                Reject(() => session.CloseAsync(false, default).GetAwaiter().GetResult(), "emulator_instance_not_owned");
            });
            run("shutdown-fallback-needs-same-frozen-host-process/" + vendor, () => {
                var target = Target(vendor); var host = new Host(target) { Offline = false }; var session = new EmulatorSession(host, target);
                session.StartAsync(default).GetAwaiter().GetResult(); host.Current = host.Current with { Processes = [host.Process with { StartedAt = host.Process.StartedAt.AddSeconds(1) }] };
                Reject(() => session.CloseAsync(true, default).GetAwaiter().GetResult(), "emulator_shutdown_unconfirmed"); Assert(host.Stops.Count == 0);
                host.Current = host.Current with { Processes = [host.Process] }; host.StoppedGoesOffline = true;
                session.CloseAsync(true, default).GetAwaiter().GetResult(); Assert(host.Stops.Single() == host.Process.EvidenceId);
            });
        }
        foreach (var state in new[] { "offline", "unauthorized", "reconnected" })
            run("adb-state-is-observable/" + state, () => {
                var target = Target(EmulatorVendor.LdPlayer); var host = new Host(target); var session = new EmulatorSession(host, target);
                session.StartAsync(default).GetAwaiter().GetResult(); host.ProbeState = state;
                Reject(() => session.CaptureAsync(default).GetAwaiter().GetResult(), state == "reconnected" ? "emulator_adb_reconnected" : "emulator_adb_" + state);
                Assert(host.Captures == 0);
            });
        foreach (var state in new[] { "timeout", "failed", "exit" })
            run("launch-failure-does-not-claim-ready/" + state, () => {
                var target = Target(EmulatorVendor.LdPlayer); var host = new Host(target) { Launch = state }; var session = new EmulatorSession(host, target);
                Reject(() => session.StartAsync(default).GetAwaiter().GetResult(), state == "timeout" ? "emulator_launch_timeout" : "emulator_launch_failed"); Assert(host.Connects == 0);
            });
        run("screenshot-failure-is-not-empty-success", () => {
            var target = Target(EmulatorVendor.BlueStacks); var host = new Host(target) { Image = new("failed", "", "", 0, 0) }; var session = new EmulatorSession(host, target);
            session.StartAsync(default).GetAwaiter().GetResult(); Reject(() => session.CaptureAsync(default).GetAwaiter().GetResult(), "emulator_screenshot_failed");
        });
        run("changed-tools-block-control-and-capture-before-command", () => {
            var target = Target(EmulatorVendor.LdPlayer); var host = new Host(target); host.Current = host.Current with { Installation = target.Installation with { Control = target.Installation.Control with { Sha256 = new string('b', 64) } } };
            Reject(() => new EmulatorSession(host, target).StartAsync(default).GetAwaiter().GetResult(), "emulator_target_changed"); Assert(host.Commands.Count == 0);
        });
        run("missing-host-instance-generation-proof-blocks-launch", () => {
            var target = Target(EmulatorVendor.LdPlayer); var host = new Host(target); host.Current = host.Current with { InstanceEvidenceId = "" };
            Reject(() => new EmulatorSession(host, target).StartAsync(default).GetAwaiter().GetResult(), "emulator_instance_proof_missing"); Assert(host.Commands.Count == 0);
        });
        run("reused-instance-selector-cannot-replace-frozen-physical-generation", () => {
            var target = Target(EmulatorVendor.LdPlayer); var host = new Host(target); var session = new EmulatorSession(host, target);
            session.StartAsync(default).GetAwaiter().GetResult(); host.Current = host.Current with { InstanceEvidenceId = "new-vm-generation" };
            Reject(() => session.CaptureAsync(default).GetAwaiter().GetResult(), "emulator_instance_replaced"); Assert(host.Captures == 0);
        });
    }
    private sealed class Host : IEmulatorHost
    {
        internal readonly EmulatorTarget Target;
        internal readonly EmulatorProcess Process;
        internal EmulatorRefresh Current;
        internal readonly List<EmulatorCommand> Commands = [];
        internal readonly List<string> Stops = [];
        internal string? Cancelled;
        internal string ProbeState = "online", Launch = "completed";
        internal bool Owned = true, Offline = true, StoppedGoesOffline;
        internal int Shutdowns, Captures, Connects, OfflineCalls;
        internal EmulatorCapture Image = new("captured", "host-media", "image/png", 1280, 720);
        internal Host(EmulatorTarget target) { Target = target; Process = Fixtures.Process(target); Current = new(target.Installation, target.Instance, [Process], "host-instance-generation"); }
        public ValueTask<EmulatorCommandResult> RunAsync(EmulatorTarget target, EmulatorCommand command, CancellationToken cancellationToken)
        { Commands.Add(command); return ValueTask.FromResult(new EmulatorCommandResult(Launch == "exit" ? "completed" : Launch, Launch == "exit" ? 9 : 0, "", "", "host-action")); }
        public ValueTask<EmulatorRefresh> RefreshAsync(EmulatorTarget target, CancellationToken cancellationToken) => ValueTask.FromResult(Current);
        public ValueTask<EmulatorAdbSession> ConnectAsync(EmulatorTarget target, CancellationToken cancellationToken)
        { Connects++; return ValueTask.FromResult(new EmulatorAdbSession("host-session", target.Id, target.Endpoint, "host-device", Owned, Process, Current.InstanceEvidenceId)); }
        public ValueTask<EmulatorProbe> ProbeAsync(EmulatorAdbSession session, CancellationToken cancellationToken) =>
            ValueTask.FromResult(new EmulatorProbe(ProbeState == "reconnected" ? "online" : ProbeState, session.Id, ProbeState == "reconnected" ? "other-device" : session.DeviceIdentity));
        public ValueTask<EmulatorCapture> CaptureAsync(EmulatorAdbSession session, CancellationToken cancellationToken) { Captures++; return ValueTask.FromResult(Image); }
        public ValueTask<bool> ShutdownAsync(EmulatorAdbSession session, CancellationToken cancellationToken) { Shutdowns++; return ValueTask.FromResult(true); }
        public ValueTask<bool> OfflineAsync(EmulatorAdbSession session, CancellationToken cancellationToken) { OfflineCalls++; return ValueTask.FromResult(Offline); }
        public ValueTask<bool> StopAsync(EmulatorTarget target, string processEvidenceId, CancellationToken cancellationToken)
        { Stops.Add(processEvidenceId); if (StoppedGoesOffline) Offline = true; return ValueTask.FromResult(true); }
        public ValueTask CancelAsync(string actionId, CancellationToken cancellationToken) { Cancelled = actionId; return ValueTask.CompletedTask; }
    }
}
