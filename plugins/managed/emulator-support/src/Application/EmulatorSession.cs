namespace NexusPipeline.Extensions.EmulatorSupport;

internal sealed class EmulatorSession(IEmulatorHost host, EmulatorTarget target) : IEmulatorSession
{
    private readonly SemaphoreSlim gate = new(1, 1);
    private EmulatorAdbSession? adb;
    private string? actionId;

    public async ValueTask<EmulatorAdbSession> StartAsync(CancellationToken cancellationToken)
    {
        await gate.WaitAsync(cancellationToken);
        try
        {
            await VerifyAsync(cancellationToken);
            if (adb is not null) { await ProbeAsync(cancellationToken); return adb; }
            var command = target.Installation.Vendor switch { EmulatorVendor.LdPlayer => LdPlayerPolicy.Control(target, true),
                EmulatorVendor.Nox => NoxPolicy.Control(target, true), EmulatorVendor.BlueStacks => BlueStacksPolicy.Launch(target), _ => throw new EmulatorFailure("emulator_vendor_invalid") };
            var started = await host.RunAsync(target, command, cancellationToken); actionId = started.ActionId;
            if (started.State == "timeout") throw new EmulatorFailure("emulator_launch_timeout");
            if (started.State != "completed" || (command.Detached ? started.ExitCode is not (null or 0) : started.ExitCode != 0) || string.IsNullOrWhiteSpace(actionId))
                throw new EmulatorFailure("emulator_launch_failed");
            cancellationToken.ThrowIfCancellationRequested();
            adb = await host.ConnectAsync(target, cancellationToken); Validate(adb);
            await ProbeAsync(cancellationToken); return adb;
        }
        finally { gate.Release(); }
    }
    public async ValueTask<EmulatorCapture> CaptureAsync(CancellationToken cancellationToken)
    {
        await gate.WaitAsync(cancellationToken);
        try
        {
            await VerifyAsync(cancellationToken); await ProbeAsync(cancellationToken);
            var image = await host.CaptureAsync(adb!, cancellationToken);
            if (image.State != "captured" || string.IsNullOrWhiteSpace(image.MediaId) || image.ContentType is not ("image/png" or "image/jpeg" or "image/webp") || image.Width <= 0 || image.Height <= 0)
                throw new EmulatorFailure("emulator_screenshot_failed");
            return image;
        }
        finally { gate.Release(); }
    }
    public async ValueTask CloseAsync(bool explicitSelection, CancellationToken cancellationToken)
    {
        await gate.WaitAsync(cancellationToken);
        try
        {
            if (adb is null) throw new EmulatorFailure("emulator_session_missing");
            Validate(adb);
            if (!explicitSelection && !adb.OwnedInstance) throw new EmulatorFailure("emulator_instance_not_owned");
            var current = await VerifyAsync(cancellationToken);
            if (target.Installation.Vendor != EmulatorVendor.BlueStacks)
            {
                var command = target.Installation.Vendor == EmulatorVendor.LdPlayer ? LdPlayerPolicy.Control(target, false) : NoxPolicy.Control(target, false);
                var result = await host.RunAsync(target, command, cancellationToken); actionId = result.ActionId;
                if (result.State == "completed" && result.ExitCode == 0 && await host.OfflineAsync(adb, cancellationToken)) return;
            }
            _ = await host.ShutdownAsync(adb, cancellationToken);
            if (await host.OfflineAsync(adb, cancellationToken)) return;
            current = await VerifyAsync(cancellationToken);
            var process = EmulatorSelection.Process(target, current.Instance, current.Processes, adb.Process);
            if (process is null || !await host.StopAsync(target, process.EvidenceId, cancellationToken) || !await host.OfflineAsync(adb, cancellationToken))
                throw new EmulatorFailure("emulator_shutdown_unconfirmed");
        }
        finally { gate.Release(); }
    }
    public async ValueTask CancelAsync(CancellationToken cancellationToken)
    {
        // The Host owns process families; cancel never promotes a process name or cached PID into shutdown authority.
        if (actionId is { Length: > 0 } id) await host.CancelAsync(id, cancellationToken);
    }
    private async ValueTask<EmulatorRefresh> VerifyAsync(CancellationToken cancellationToken)
    {
        var current = await host.RefreshAsync(target, cancellationToken);
        EmulatorSelection.Verify(target, current.Installation, current.Instance);
        if (string.IsNullOrWhiteSpace(current.InstanceEvidenceId) || current.InstanceEvidenceId.Length > 256 || current.InstanceEvidenceId.Any(char.IsControl))
            throw new EmulatorFailure("emulator_instance_proof_missing");
        if (target.InstanceEvidenceId is not null && target.InstanceEvidenceId != current.InstanceEvidenceId) throw new EmulatorFailure("emulator_instance_replaced");
        target = target with { InstanceEvidenceId = current.InstanceEvidenceId }; return current;
    }
    private async ValueTask ProbeAsync(CancellationToken cancellationToken)
    {
        if (adb is null) throw new EmulatorFailure("emulator_session_missing"); Validate(adb);
        var probe = await host.ProbeAsync(adb, cancellationToken);
        if (probe.SessionId != adb.Id || probe.DeviceIdentity != adb.DeviceIdentity) throw new EmulatorFailure("emulator_adb_reconnected");
        if (probe.State != "online") throw new EmulatorFailure(probe.State switch { "offline" => "emulator_adb_offline", "unauthorized" => "emulator_adb_unauthorized", _ => "emulator_adb_failed" });
    }
    private void Validate(EmulatorAdbSession session)
    {
        if (string.IsNullOrWhiteSpace(session.Id) || string.IsNullOrWhiteSpace(session.DeviceIdentity) || session.TargetId != target.Id || session.Endpoint != target.Endpoint ||
            target.InstanceEvidenceId is null || session.InstanceEvidenceId != target.InstanceEvidenceId)
            throw new EmulatorFailure("emulator_adb_binding_invalid");
    }
}
