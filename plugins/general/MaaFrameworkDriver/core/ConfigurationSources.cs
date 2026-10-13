using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace NexusPipeline.Plugin.MaaFrameworkDriver;

public static class ConfigurationSources
{
    public static DriverProfile ReadMfa(ProjectCompiler compiler, DriverProfile target, string sourcePath, string instanceId)
    {
        if (string.IsNullOrWhiteSpace(instanceId) || instanceId.Length > 128
            || !instanceId.All(c => char.IsAsciiLetterOrDigit(c) || c is '-' or '_'))
            throw new InvalidDataException("import.mfa.instanceId: explicit stable identity required");
        string expected = "config/instances/" + instanceId + ".json";
        if (!sourcePath.Replace('\\', '/').Equals(expected, StringComparison.OrdinalIgnoreCase))
            throw new InvalidDataException("import.mfa.sourcePath: instance file identity mismatch");
        var settings = compiler.ReadScopedFile("appsettings.json");
        string selected = settings["DefaultConfig"]?.GetValue<string>() ?? "Default";
        if (selected.Length > 128 || selected.IndexOfAny(Path.GetInvalidFileNameChars()) >= 0
            || selected is "." or ".." || selected.Contains('/') || selected.Contains('\\'))
            throw new InvalidDataException("import.mfa.DefaultConfig: invalid identity");
        string globalPath = selected == "Default" ? "config/config.json" : "config/mfa_" + selected + ".json";
        if (!File.Exists(compiler.Scope(target.PackageRoot, globalPath))) globalPath = "config/config.json";
        var global = compiler.ReadScopedFile(globalPath);
        var instance = compiler.ReadScopedFile(expected);
        var mapped = MfaConfigurationMapper.Map(instance, global, compiler.Inspect(), target, instanceId);
        compiler.VerifyReadSnapshot();
        return Bind(compiler, mapped, "mfa", "mfa-instance-2.16", instanceId, [expected, "appsettings.json", globalPath]);
    }

    public static DriverProfile Bind(ProjectCompiler compiler, DriverProfile mapped, string kind, string schema, string instance, string[] sourceFiles)
    {
        compiler.VerifyReadSnapshot();
        string root = Path.GetFullPath(mapped.PackageRoot).TrimEnd('\\', '/');
        string rootIdentity = Hash(root.ToUpperInvariant() + "\n" + DirectoryIdentity.Read(root));
        string sourceHash = Hash(JsonSerializer.Serialize(sourceFiles.Order(StringComparer.OrdinalIgnoreCase)
            .Select(file => new[] { file.Replace('\\', '/'), compiler.ReadFiles[file.Replace('/', Path.DirectorySeparatorChar)] })));
        string piHash = Hash(JsonSerializer.Serialize(compiler.ReadFiles.Where(pair => !sourceFiles.Contains(pair.Key.Replace('\\', '/'), StringComparer.OrdinalIgnoreCase))
            .OrderBy(pair => pair.Key, StringComparer.OrdinalIgnoreCase).Select(pair => new[] { pair.Key.Replace('\\', '/'), pair.Value })));
        string effective = Hash(JsonSerializer.Serialize(new { mapped.Controller, mapped.Resource, mapped.TaskOccurrences,
            mapped.Options, mapped.ResourceOptions, mapped.ControllerOptions, mapped.ControllerConfiguration, mapped.AdbPath, mapped.AdbSerial,
            mapped.HostLaunchConfiguration, mapped.WindowExecutable, mapped.NativeDirectory, mapped.NativeVersion,
            dependencyHash = mapped.DependencyLock?.LockHash ?? "" }, DriverJson.Options));
        return mapped with { SourceBinding = new(rootIdentity, mapped.InterfacePath, kind, schema, 1, instance,
            sourceFiles, Hash(rootIdentity + "\n" + kind + "\n" + instance)),
            SourceSnapshot = new(sourceHash, piHash, effective, DateTimeOffset.UtcNow, Hash(sourceHash + piHash + effective), mapped.DependencyLock?.LockHash ?? "") };
    }

    private static string Hash(string value) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(value))).ToLowerInvariant();
}
