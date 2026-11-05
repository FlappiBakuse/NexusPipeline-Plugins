using System.Security.Cryptography;

namespace NexusPipeline.Extensions.EmulatorSupport;

internal sealed class EmulatorFailure(string code) : EmulatorException(code) { }

internal static class EmulatorValidation
{
    internal static void Validate(this EmulatorTool tool)
    {
        if (string.IsNullOrWhiteSpace(tool.Id) || string.IsNullOrWhiteSpace(tool.PhysicalId) || tool.Revision < 1 ||
            !EmulatorPaths.Absolute(tool.Path) || tool.Sha256.Length != 64 || tool.Sha256.Any(character => !char.IsAsciiHexDigitLower(character)))
            throw new EmulatorFailure("emulator_tool_identity_invalid");
    }
    internal static void Validate(this EmulatorConfig config)
    {
        if (string.IsNullOrEmpty(config.Id) || string.IsNullOrEmpty(config.PhysicalId) || config.Revision < 1 || !EmulatorPaths.Relative(config.RelativePath) ||
            config.Bytes.Length > 2097152 || config.Sha256 != Convert.ToHexStringLower(SHA256.HashData(config.Bytes.Span)))
            throw new EmulatorFailure("emulator_config_identity_invalid");
    }
    internal static void Validate(this EmulatorInstallation installation)
    {
        if (!Enum.IsDefined(installation.Vendor) || string.IsNullOrWhiteSpace(installation.Id) || !EmulatorPaths.Absolute(installation.RootPath) || string.IsNullOrWhiteSpace(installation.RootPhysicalId) ||
            installation.Configurations.Count > 4096 || installation.Configurations.Select(config => config.Id).Distinct(StringComparer.Ordinal).Count() != installation.Configurations.Count)
            throw new EmulatorFailure("emulator_installation_identity_invalid");
        if (installation.Configurations.Sum(config => (long)config.Bytes.Length) > 33554432 ||
            installation.Configurations.Select(config => config.RelativePath.Replace('\\', '/')).Distinct(StringComparer.OrdinalIgnoreCase).Count() != installation.Configurations.Count ||
            installation.Configurations.Select(config => config.PhysicalId).Distinct(StringComparer.Ordinal).Count() != installation.Configurations.Count)
            throw new EmulatorFailure("emulator_config_set_invalid");
        installation.Control.Validate(); installation.Adb?.Validate(); foreach (var config in installation.Configurations) config.Validate();
        var control = EmulatorPaths.Name(installation.Control.Path); var adb = installation.Adb is null ? null : EmulatorPaths.Name(installation.Adb.Path);
        var valid = installation.Vendor switch {
            EmulatorVendor.LdPlayer => control is "ldconsole.exe" or "dnconsole.exe" && (adb is null or "adb.exe"),
            EmulatorVendor.Nox => control == "noxconsole.exe" && (adb is null or "nox_adb.exe"),
            EmulatorVendor.BlueStacks => control == "hd-player.exe" && (adb is null or "hd-adb.exe"), _ => false };
        if (!valid || !EmulatorPaths.Within(installation.RootPath, installation.Control.Path) || installation.Adb is not null && !EmulatorPaths.Within(installation.RootPath, installation.Adb.Path))
            throw new EmulatorFailure("emulator_tool_location_invalid");
    }
}
