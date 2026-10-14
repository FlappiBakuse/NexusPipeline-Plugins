using System.Text.Json.Nodes;

namespace NexusPipeline.Plugin.MaaFrameworkDriver;

public sealed record ConfigurationSourceCandidate(string Id, string Kind, string RelativePath, string InstanceId, string Name);
public sealed record ConfigurationSourceDiscovery(string InterfacePath, JsonObject Schema, ConfigurationSourceCandidate[] Candidates)
{
    public string[] InterfaceCandidates { get; init; } = [];
}

public static class SourceDiscovery
{
    public static ConfigurationSourceDiscovery Discover(string root, string interfacePath = "", CancellationToken token = default)
    {
        root = Path.GetFullPath(root).TrimEnd('\\', '/');
        string[] interfaces = interfacePath.Length != 0 ? [interfacePath] : new[] { "interface.json", "interface.jsonc", "assets/interface.json", "assets/interface.jsonc" }
            .Where(path => File.Exists(ProjectCompiler.ResolveScopedPath(root, root, path))).ToArray();
        if (interfaces.Length == 0) throw new InvalidDataException("maa.project.not_found");
        if (interfaces.Length != 1) return new("", new(), []) { InterfaceCandidates = interfaces };
        var compiler = new ProjectCompiler(root, interfaces[0], cancellationToken: token);
        var candidates = new List<ConfigurationSourceCandidate>();
        void Add(string kind, string file, string id, string name)
        {
            if (candidates.Count >= 64 || id.Length is < 1 or > 128 || !id.All(c => char.IsAsciiLetterOrDigit(c) || c is '-' or '_'))
                throw new InvalidDataException("source.candidates.limit_or_invalid_identity");
            candidates.Add(new(ProfileMigration.Identity(kind, file, id), kind, file, id, name.Length <= 256 ? name : name[..256]));
        }
        string config = compiler.Scope(root, "config");
        if (Directory.Exists(config))
        {
            if (File.Exists(compiler.Scope(root, "config/multi_config.json")))
            {
                var main = compiler.ReadScopedFile("config/multi_config.json");
                foreach (var idNode in main["config_list"]?.AsArray() ?? throw new InvalidDataException("import.cfa.config_list_required"))
                {
                    string id = idNode?.GetValue<string>() ?? throw new InvalidDataException("import.cfa.instance_identity");
                    Add("cfa", "config/configs/" + id + ".json", id, id);
                    var saved = compiler.ReadScopedFile("config/configs/" + id + ".json");
                    string name = saved["name"]?.GetValue<string>() ?? id;
                    candidates[^1] = candidates[^1] with { Name = name.Length <= 256 ? name : name[..256] };
                }
            }
            string[] mxuFiles = Directory.EnumerateFiles(config, "mxu-*.json", SearchOption.TopDirectoryOnly).Take(65).ToArray();
            if (mxuFiles.Length > 64) throw new InvalidDataException("source.candidates.file_limit");
            foreach (string file in mxuFiles.Order(StringComparer.OrdinalIgnoreCase))
            {
                token.ThrowIfCancellationRequested();
                string relative = Path.GetRelativePath(root, file).Replace('\\', '/');
                var source = compiler.ReadScopedFile(relative);
                foreach (var item in ConfigurationImporter.Instances(source)["instances"]!.AsArray().OfType<JsonObject>())
                    Add("mxu", relative, item["id"]!.GetValue<string>(), item["name"]?.GetValue<string>() ?? "MXU");
            }
            string instances = compiler.Scope(root, "config/instances");
            if (File.Exists(compiler.Scope(root, "appsettings.json")) && Directory.Exists(instances))
            {
                string[] mfaFiles = Directory.EnumerateFiles(instances, "*.json", SearchOption.TopDirectoryOnly).Take(65).ToArray();
                if (mfaFiles.Length > 64) throw new InvalidDataException("source.candidates.file_limit");
                foreach (string file in mfaFiles.Order(StringComparer.OrdinalIgnoreCase))
                {
                    token.ThrowIfCancellationRequested();
                    string relative = Path.GetRelativePath(root, file).Replace('\\', '/');
                    var source = compiler.ReadScopedFile(relative);
                    Add("mfa", relative, Path.GetFileNameWithoutExtension(file), source["InstanceName"]?.GetValue<string>() ?? "MFA");
                }
            }
            if (File.Exists(compiler.Scope(root, "appsettings.json")))
            {
                var settings = compiler.ReadScopedFile("appsettings.json");
                foreach (string id in ConfigurationSources.MfaFlatInstances(settings))
                {
                    if (candidates.Any(candidate => candidate.Kind == "mfa" && candidate.InstanceId == id)) continue;
                    string path = ConfigurationSources.MfaFlatPath(settings, id);
                    if (!File.Exists(compiler.Scope(root, path))) continue;
                    var source = compiler.ReadScopedFile(path);
                    if (source["Instance." + id + ".TaskItems"] is not JsonArray && source["TaskItems"] is not JsonArray) continue;
                    Add("mfa", path, id, settings["Instance." + id + ".Name"]?.GetValue<string>() ?? id);
                }
            }
            if (File.Exists(compiler.Scope(root, "config/maa_pi_config.json")))
            {
                compiler.ReadScopedFile("config/maa_pi_config.json");
                Add("maapicli-v5.14.0", "config/maa_pi_config.json", "cli", "MaaPiCli");
            }
        }
        if (candidates.Select(item => item.Id).Distinct(StringComparer.Ordinal).Count() != candidates.Count)
            throw new InvalidDataException("source.candidates.duplicate_identity");
        compiler.VerifyReadSnapshot();
        return new(interfaces[0], compiler.Inspect(), candidates.ToArray());
    }

    public static DriverProfile Read(DriverProfile profile, ConfigurationSourceCandidate candidate, CancellationToken token = default)
    {
        var compiler = new ProjectCompiler(profile.PackageRoot, profile.InterfacePath, profile.Language, token);
        DriverProfile mapped;
        if (candidate.Kind == "cfa") mapped = CfaConfigurationMapper.Read(compiler, profile, candidate.InstanceId);
        else if (candidate.Kind == "mfa") mapped = ConfigurationSources.ReadMfa(compiler, profile, candidate.RelativePath, candidate.InstanceId);
        else if (candidate.Kind is "mxu" or "maapicli-v5.14.0")
        {
            var source = compiler.ReadScopedFile(candidate.RelativePath);
            mapped = ConfigurationSources.Bind(compiler, ConfigurationImporter.Map(candidate.Kind, source, compiler.Inspect(), profile, candidate.InstanceId),
                candidate.Kind, candidate.Kind == "mxu" ? "1.0" : "maapicli-v5.14.0", candidate.InstanceId, [candidate.RelativePath]);
        }
        else throw new InvalidDataException("source.kind.unsupported");
        compiler.CompileSemantics(mapped, token);
        compiler.VerifyReadSnapshot();
        return mapped;
    }

    public static void RequireCurrent(DriverProfile profile, CancellationToken token)
    {
        if (profile.SourceBinding is not { } binding) return;
        if (profile.SourceSnapshot is not { } snapshot || binding.SourceFiles.Length == 0)
            throw new InvalidDataException("source.snapshot.missing");
        var candidate = new ConfigurationSourceCandidate("", binding.SourceKind, binding.SourceFiles[0], binding.SourceInstanceId, "");
        var current = Read(profile, candidate, token);
        // User overrides change the effective profile without changing the bound GUI source.
        if (current.SourceBinding!.TrustScopeId != binding.TrustScopeId || current.SourceSnapshot!.SourceHash != snapshot.SourceHash
            || current.SourceSnapshot.PiHash != snapshot.PiHash || current.SourceSnapshot.DependencyHash != snapshot.DependencyHash)
            throw new InvalidDataException("source.sync_pending: source changed; synchronize before scheduling");
    }
}
