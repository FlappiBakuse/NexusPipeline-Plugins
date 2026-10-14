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
        var settings = compiler.ReadScopedFile("appsettings.json");
        if (!sourcePath.Replace('\\', '/').StartsWith("config/instances/", StringComparison.OrdinalIgnoreCase))
            return ReadFlatMfa(compiler, target, sourcePath, instanceId, settings);
        if (!sourcePath.Replace('\\', '/').Equals(expected, StringComparison.OrdinalIgnoreCase))
            throw new InvalidDataException("import.mfa.sourcePath: instance file identity mismatch");
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

    public static string MfaFlatPath(JsonObject settings, string instanceId)
    {
        string name = settings["Instance." + instanceId + ".Config"]?.GetValue<string>()
            ?? settings["DefaultConfig"]?.GetValue<string>() ?? "Default";
        if (name.Length is < 1 or > 128 || name.IndexOfAny(Path.GetInvalidFileNameChars()) >= 0 || name is "." or ".."
            || name.Contains('/') || name.Contains('\\')) throw new InvalidDataException("import.mfa.DefaultConfig: invalid identity");
        return name == "Default" ? "config/config.json" : "config/mfa_" + name + ".json";
    }

    public static string[] MfaFlatInstances(JsonObject settings)
    {
        var ids = (settings["Instances.List"]?.GetValue<string>() ?? "").Split(',', StringSplitOptions.RemoveEmptyEntries).ToList();
        string last = settings["Instances.LastActive"]?.GetValue<string>() ?? "";
        if (last.Length != 0 && !ids.Contains(last, StringComparer.Ordinal)) ids.Add(last);
        if (ids.Count > 64 || ids.Any(id => id.Length is < 1 or > 128 || !id.All(c => char.IsAsciiLetterOrDigit(c) || c is '-' or '_')))
            throw new InvalidDataException("import.mfa.instances: invalid identity");
        return ids.Distinct(StringComparer.Ordinal).ToArray();
    }

    private static DriverProfile ReadFlatMfa(ProjectCompiler compiler, DriverProfile target, string sourcePath, string instanceId, JsonObject settings)
    {
        string expected = MfaFlatPath(settings, instanceId);
        if (!MfaFlatInstances(settings).Contains(instanceId, StringComparer.Ordinal)
            || !sourcePath.Replace('\\', '/').Equals(expected, StringComparison.OrdinalIgnoreCase))
            throw new InvalidDataException("import.mfa.sourcePath: flat instance identity mismatch");
        var source = compiler.ReadScopedFile(expected);
        var instance = new JsonObject();
        string prefix = "Instance." + instanceId + ".";
        foreach (var (key, value) in source.Where(pair => pair.Key.StartsWith(prefix, StringComparison.Ordinal)))
        {
            string field = key[prefix.Length..];
            if (field.StartsWith("Timer.Timer", StringComparison.Ordinal) && field.EndsWith(".Schedule", StringComparison.Ordinal)
                && value?.GetValue<string>() == "0||") continue;
            instance[field] = value?.DeepClone();
        }
        // Flat MFA instances inherit unscoped values, never another instance's scoped values.
        var global = new JsonObject();
        foreach (var (key, value) in source.Where(pair => !pair.Key.StartsWith("Instance.", StringComparison.Ordinal)))
            global[key] = value?.DeepClone();
        var schema = compiler.Inspect();
        if (instance["CurrentControllerName"] is null && global["CurrentControllerName"] is null)
        {
            var selected = instance["CurrentController"] ?? global["CurrentController"];
            string type = selected?.ToString() ?? "Adb";
            type = type switch { "1" => "Win32", "2" => "Adb", _ => type };
            var controller = schema["controller"]!.AsArray().OfType<JsonObject>()
                .FirstOrDefault(item => item["type"]?.GetValue<string>() == type)
                ?? throw new InvalidDataException("import.mfa.CurrentController: unavailable");
            instance["CurrentControllerName"] = controller["name"]!.DeepClone();
        }
        if (MfaConfigurationMapper.Inherit(instance, global, instanceId, "TaskItems") is not JsonArray)
            throw new InvalidDataException("import.mfa.TaskItems: saved tasks required");
        var mapped = MfaConfigurationMapper.Map(instance, global, schema, target, instanceId);
        return Bind(compiler, mapped, "mfa", "mfa-flat-instance", instanceId, [expected, "appsettings.json"]);
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
            mapped.Options, mapped.ResourceOptions, mapped.ControllerOptions, mapped.ControllerConfiguration, mapped.AgentEmbedded, mapped.AdbPath, mapped.AdbSerial,
            mapped.HostLaunchConfiguration, mapped.WindowExecutable, mapped.NativeDirectory, mapped.NativeVersion,
            dependencyHash = mapped.RuntimeInputs?.LockHash ?? "" }, DriverJson.Options));
        return mapped with { SourceBinding = new(rootIdentity, mapped.InterfacePath, kind, schema, 1, instance,
            sourceFiles, Hash(rootIdentity + "\n" + kind + "\n" + instance)),
            SourceSnapshot = new(sourceHash, piHash, effective, DateTimeOffset.UtcNow, Hash(sourceHash + piHash + effective), mapped.RuntimeInputs?.LockHash ?? "") };
    }

    private static string Hash(string value) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(value))).ToLowerInvariant();
}
