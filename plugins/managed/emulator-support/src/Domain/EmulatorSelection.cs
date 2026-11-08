using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace NexusPipeline.Extensions.EmulatorSupport;

internal static class EmulatorSelection
{
    internal static string Identity(EmulatorInstallation installation, EmulatorInstance instance) => Hash(new {
        format = "nexus.emulator.instance", version = 1, Vendor = EmulatorVendors.EvidenceCode(installation.Vendor), installation.RootPhysicalId, installation.Id,
        instance.Identity, instance.Index, instance.ControlName });
    internal static EmulatorTarget Select(IReadOnlyList<(EmulatorInstallation Installation, EmulatorEnumeration Enumeration)> sources,
        string selectedId, string endpoint, bool supportsAndroid)
    {
        if (!supportsAndroid) throw new EmulatorFailure("emulator_script_android_unsupported");
        if (sources.Count > 128 || sources.Select(source => source.Installation.Id).Distinct(StringComparer.Ordinal).Count() != sources.Count)
            throw new EmulatorFailure("emulator_installations_ambiguous");
        endpoint = EmulatorPaths.Endpoint(endpoint); var port = EmulatorPaths.Port(endpoint);
        var matches = new List<(EmulatorInstallation Installation, EmulatorInstance Instance)>();
        foreach (var source in sources)
        {
            source.Installation.Validate();
            foreach (var instance in source.Enumeration.Instances)
                if (Identity(source.Installation, instance) == selectedId) matches.Add((source.Installation, instance));
        }
        if (matches.Count != 1) throw new EmulatorFailure(matches.Count == 0 ? "emulator_instance_deleted" : "emulator_instance_ambiguous");
        var chosen = matches[0];
        if (chosen.Installation.Adb is null) throw new EmulatorFailure("emulator_bundled_adb_missing");
        if (chosen.Instance.CandidatePorts.Count == 0) throw new EmulatorFailure("emulator_adb_mapping_missing");
        if (!chosen.Instance.CandidatePorts.Contains(port)) throw new EmulatorFailure("emulator_endpoint_mismatch");
        if (sources.SelectMany(source => source.Enumeration.Instances.Select(instance => (source.Installation, Instance: instance)))
            .Count(row => row.Instance.CandidatePorts.Contains(port)) != 1) throw new EmulatorFailure("emulator_endpoint_ambiguous");
        var proof = Fingerprint(chosen.Installation, chosen.Instance, endpoint);
        return new(selectedId, chosen.Installation, chosen.Instance, endpoint, proof);
    }
    internal static string Fingerprint(EmulatorInstallation installation, EmulatorInstance instance, string endpoint)
    {
        installation.Validate();
        return Hash(new { format = "nexus.emulator.target", version = 1, installation.Id, Vendor = EmulatorVendors.EvidenceCode(installation.Vendor), installation.RootPath, installation.RootPhysicalId,
            installation.Control, installation.Adb, Configurations = installation.Configurations.OrderBy(config => config.Id, StringComparer.Ordinal)
                .Select(config => new { config.Id, config.RelativePath, config.PhysicalId, config.Sha256, config.Revision }),
            instance.Identity, instance.ControlName, instance.Index, CandidatePorts = instance.CandidatePorts.Order(), ConfigIds = instance.ConfigIds.Order(StringComparer.Ordinal), Endpoint = EmulatorPaths.Endpoint(endpoint) });
    }
    internal static void Verify(EmulatorTarget target, EmulatorInstallation current, EmulatorInstance instance)
    {
        if (target.Id != Identity(current, instance) || target.Fingerprint != Fingerprint(current, instance, target.Endpoint))
            throw new EmulatorFailure("emulator_target_changed");
    }
    internal static EmulatorProcess? Process(EmulatorTarget target, EmulatorInstance current, IReadOnlyList<EmulatorProcess> processes, EmulatorProcess? frozen)
    {
        if (frozen is null || frozen.InstallationId != target.Installation.Id) return null;
        if (target.Installation.Vendor == EmulatorVendors.BlueStacks)
        { var blue = BlueStacksPolicy.Process(target, processes); return blue is not null && Same(blue, frozen) ? blue : null; }
        if (current.Identity != target.Instance.Identity || current.Index != target.Instance.Index || current.ControlName != target.Instance.ControlName ||
            current.ProcessId is null || target.Instance.ProcessId is null || current.ProcessId != target.Instance.ProcessId) return null;
        var matches = processes.Where(process => process.InstallationId == target.Installation.Id && process.ProcessId == current.ProcessId && !string.IsNullOrWhiteSpace(process.EvidenceId) &&
            process.StartedAt != default && process.ImagePhysicalId.Length > 0 && process.ImageSha256.Length == 64).ToArray();
        return matches.Length == 1 && Same(matches[0], frozen) ? matches[0] : null;
    }
    private static bool Same(EmulatorProcess current, EmulatorProcess frozen) => current.EvidenceId == frozen.EvidenceId && current.ProcessId == frozen.ProcessId &&
        current.StartedAt == frozen.StartedAt && current.ImagePhysicalId == frozen.ImagePhysicalId && current.ImageSha256 == frozen.ImageSha256 &&
        current.Arguments.SequenceEqual(frozen.Arguments, StringComparer.Ordinal);
    private static string Hash<T>(T value) => Convert.ToHexStringLower(SHA256.HashData(JsonSerializer.SerializeToUtf8Bytes(value)));
}
