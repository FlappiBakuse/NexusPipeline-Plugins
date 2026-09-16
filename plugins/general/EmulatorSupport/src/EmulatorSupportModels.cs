using NexusPipeline.Plugin.Abstractions;

namespace NexusPipeline.Plugin.EmulatorSupport;

internal enum EmulatorVendor
{
    LdPlayer,
    Nox,
    BlueStacks,
}

internal enum EmulatorKind
{
    LdPlayer,
    Nox,
    BlueStacks,
}

internal sealed record EmulatorTarget(
    EmulatorKind Kind,
    string Endpoint,
    string? VendorControlPath = null,
    string? VendorInstanceId = null,
    string? VendorAdbExecutable = null,
    int? VendorProcessId = null,
    string? VendorInstallRoot = null,
    string? VendorControlName = null,
    int? VendorInstanceIndex = null);

internal enum VendorProbeState
{
    Match,
    NotApplicable,
    Error,
}

internal sealed record VendorProbeResult(
    VendorProbeState State,
    EmulatorTarget? Target = null,
    string? Error = null)
{
    internal static VendorProbeResult Match(EmulatorTarget target) => new(VendorProbeState.Match, target);

    internal static VendorProbeResult NotApplicable() => new(VendorProbeState.NotApplicable);

    internal static VendorProbeResult ErrorResult(string message) => new(VendorProbeState.Error, Error: message);
}

internal sealed record EmulatorVendorPaths(
    string ControlPath,
    string? InstallRoot,
    string? AdbPath,
    string? ConfigPath,
    string? ConfigRoot);

internal sealed record LdPlayerInstance(string Index, string Name, int? ProcessId);

internal sealed record NoxInstance(
    string Identity,
    string? ControlName,
    int? NumericIndex,
    int? ProcessId);

internal sealed record BlueStacksInstance(string Id, int AdbPort);
