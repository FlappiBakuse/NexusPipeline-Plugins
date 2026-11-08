namespace NexusPipeline.Extensions.EmulatorSupport;

internal sealed class EmulatorDiscovery(IEmulatorInventory host)
{
    internal async ValueTask<EmulatorDiscoveryResult> DiscoverAsync(bool supportsAndroid, CancellationToken cancellationToken)
    {
        if (!supportsAndroid) return new("notApplicable", [], []);
        var sources = new List<EmulatorSource>(); var diagnostics = new List<EmulatorDiagnostic>(); var ids = new HashSet<string>(StringComparer.Ordinal); long rawBytes = 0;
        foreach (var layout in EmulatorLayouts.All)
        {
            cancellationToken.ThrowIfCancellationRequested();
            IReadOnlyList<EmulatorInstallation> installations;
            try { installations = await host.DiscoverAsync(layout, cancellationToken); }
            catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested) { throw; }
            catch (Exception error) when (error is not OutOfMemoryException)
            { diagnostics.Add(new(layout.Vendor, null, "emulator_inventory_unavailable")); continue; }
            if (installations.Count > 128) throw new EmulatorFailure("emulator_installation_limit");
            if (installations.Count == 0) diagnostics.Add(new(layout.Vendor, null, "emulator_vendor_not_installed"));
            foreach (var installation in installations)
            {
                if (installation.Vendor != layout.Vendor || !ids.Add(installation.Id) || ids.Count > 128) throw new EmulatorFailure("emulator_installations_ambiguous");
                rawBytes += installation.Configurations.Sum(config => (long)config.Bytes.Length);
                if (rawBytes > 33554432) throw new EmulatorFailure("emulator_inventory_size_limit");
                try
                {
                    installation.Validate(); var enumeration = await EnumerateAsync(installation, cancellationToken);
                    enumeration = enumeration with { Instances = enumeration.Instances.Select(instance => instance with
                        { TargetId = EmulatorSelection.Identity(installation, instance) }).ToArray() };
                    sources.Add(new(installation, enumeration));
                    if (enumeration.State == "empty") diagnostics.Add(new(layout.Vendor, installation.Id, "emulator_instance_list_empty"));
                    if (installation.Adb is null) diagnostics.Add(new(layout.Vendor, installation.Id, "emulator_bundled_adb_missing"));
                    if (enumeration.Instances.Any(instance => instance.CandidatePorts.Count == 0)) diagnostics.Add(new(layout.Vendor, installation.Id, "emulator_adb_mapping_missing"));
                }
                catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested) { throw; }
                catch (EmulatorException failure) { diagnostics.Add(new(layout.Vendor, installation.Id, failure.Code)); }
                catch (Exception error) when (error is not OutOfMemoryException) { diagnostics.Add(new(layout.Vendor, installation.Id, "emulator_enumeration_failed")); }
            }
        }
        return new(sources.Any(source => source.Enumeration.Instances.Count > 0) ? "discovered" : "unavailable", sources, diagnostics);
    }
    private async ValueTask<EmulatorEnumeration> EnumerateAsync(EmulatorInstallation installation, CancellationToken cancellationToken)
    {
        if (installation.Vendor == EmulatorVendors.BlueStacks)
        {
            var configs = installation.Configurations.Where(config => EmulatorPaths.Name(config.RelativePath) == "bluestacks.conf").ToArray();
            if (configs.Length != 1) throw new EmulatorFailure(configs.Length == 0 ? "bluestacks_config_missing" : "bluestacks_config_ambiguous");
            return BlueStacksPolicy.Parse(configs[0]);
        }
        var command = installation.Vendor == EmulatorVendors.LdPlayer ? LdPlayerPolicy.List(installation) : NoxPolicy.List(installation);
        var result = await host.EnumerateAsync(installation, command, cancellationToken);
        if (result.State == "timeout") throw new EmulatorFailure("emulator_enumeration_timeout");
        if (result.State != "completed" || result.ExitCode != 0) throw new EmulatorFailure("emulator_enumeration_exit");
        return installation.Vendor == EmulatorVendors.LdPlayer ? LdPlayerPolicy.Parse(result.StandardOutput) : NoxPolicy.Parse(result.StandardOutput, installation.Configurations);
    }
}
