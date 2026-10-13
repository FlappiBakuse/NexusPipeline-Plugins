using System.IO.Compression;
using System.Reflection;
using System.Security.Cryptography;
using System.Text.Json;

namespace NexusPipeline.Plugin.MaaFrameworkDriver;

public sealed record NativeDependencyFile(string Path, long SizeBytes, string Sha256);
public sealed record NativeDependencyRecipe(string DependencyId, string Kind, string Version, string Platform,
    string Repository, string SourceCommit, long ReleaseId, long AssetId, string Url, long SizeBytes,
    string Sha256, string ArchivePrefix, string InstallPolicy, string License, string BindingVersion, NativeDependencyFile[] Files);
public sealed record NativeDependencyLock(int SchemaVersion, string ProjectName, string ProjectVersion, string RootIdentity,
    string InstallTarget, NativeDependencyRecipe Native, string[] Dependencies, string LockHash,
    [property: System.Text.Json.Serialization.JsonIgnore(Condition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull)]
    PythonDependencyLock? Python = null);

public static class NativeDependencies
{
    private sealed record Registry(int SchemaVersion, NativeDependencyRecipe[] Recipes);
    private static readonly Registry RegistryData = ReadRegistry();
    private const string Marker = "dependency.lock.json";
    private static Registry ReadRegistry()
    {
        using var stream = Assembly.GetExecutingAssembly().GetManifestResourceStream("MaaFrameworkDriver.NativeRecipes.json")
            ?? throw new InvalidDataException("dependency.recipe.missing");
        var registry = JsonSerializer.Deserialize<Registry>(stream, DriverJson.Options) ?? throw new InvalidDataException("dependency.recipe.invalid");
        if (registry.SchemaVersion != 1 || registry.Recipes.Length != 3) throw new InvalidDataException("dependency.recipe.schema");
        foreach (var recipe in registry.Recipes)
            if (recipe.Repository != "MaaXYZ/MaaFramework" || recipe.Platform != "win-x64" || recipe.Kind != "native"
                || recipe.InstallPolicy != "owned_directory" || recipe.ArchivePrefix != "bin/" || recipe.BindingVersion != "5.10.0"
                || !recipe.Url.StartsWith("https://github.com/MaaXYZ/MaaFramework/releases/download/v" + recipe.Version + "/", StringComparison.Ordinal)
                || !Digest(recipe.Sha256) || recipe.SizeBytes is < 1 or > 256 * 1024 * 1024
                || recipe.Files.Length is < 3 or > 128 || recipe.Files.Select(file => file.Path).Distinct(StringComparer.OrdinalIgnoreCase).Count() != recipe.Files.Length
                || recipe.Files.Any(file => Path.GetFileName(file.Path) != file.Path || !file.Path.EndsWith(".dll", StringComparison.OrdinalIgnoreCase)
                    || !Digest(file.Sha256) || file.SizeBytes is < 1 or > 256 * 1024 * 1024)) throw new InvalidDataException("dependency.recipe.identity");
        return registry;
    }
    private static bool Digest(string value) => value.Length == 64 && value.All(char.IsAsciiHexDigit);
    private static string Hash(byte[] bytes) => Convert.ToHexString(SHA256.HashData(bytes)).ToLowerInvariant();
    private static string FileHash(string path, CancellationToken token)
    {
        token.ThrowIfCancellationRequested();
        using var input = File.OpenRead(path);
        return Convert.ToHexString(SHA256.HashData(input)).ToLowerInvariant();
    }

    public static DriverProfile Bind(DriverProfile profile, string projectName, string projectVersion, CancellationToken token)
    {
        var compiler = new ProjectCompiler(profile.PackageRoot, profile.InterfacePath, profile.Language, token);
        NativeDependencyRecipe? recipe = null;
        string? directory = null;
        string[] candidates = profile.NativeDirectory.Length != 0 ? [profile.NativeDirectory]
            : ["maafw", "runtimes/win-x64/native", "bin", "", "assets/MaaFramework/bin"];
        foreach (string candidate in candidates)
        {
            string full = compiler.Scope(profile.PackageRoot, candidate);
            string main = compiler.Scope(full, "MaaFramework.dll");
            if (!File.Exists(main)) continue;
            if (new FileInfo(main).Length > 32 * 1024 * 1024) throw new InvalidDataException("dependency.native.oversized");
            string digest = FileHash(main, token);
            var matched = RegistryData.Recipes.SingleOrDefault(item => item.Files.Any(file => file.Path == "MaaFramework.dll" && file.Sha256 == digest));
            if (matched is null) throw new InvalidDataException("dependency.native.unsupported_version");
            if (recipe is not null) throw new InvalidDataException("dependency.native.explicit_selection_required");
            if (profile.NativeVersion.Length != 0 && profile.NativeVersion.TrimStart('v') != matched.Version)
                throw new InvalidDataException("dependency.native.declared_version_changed");
            recipe = matched; directory = candidate;
        }
        if (recipe is null)
        {
            string version = profile.NativeVersion.TrimStart('v');
            if (version.Length == 0)
                version = (projectName, projectVersion.TrimStart('v')) switch {
                    ("MaaEnd", "2.32.0") or ("MaaStellaSora", "1.6.0") => "5.14.2",
                    _ => throw new InvalidDataException("dependency.native.project_recipe_required") };
            recipe = RegistryData.Recipes.SingleOrDefault(item => item.Version == version)
                ?? throw new InvalidDataException("dependency.native.unsupported_version");
        }
        bool reusable = directory is not null && VerifyFiles(compiler, directory, recipe, token);
        directory = reusable ? directory! : ".nexus/maa-framework/deps/win-x64/" + recipe.Sha256;
        string rootIdentity = DirectoryIdentity.Read(Path.GetFullPath(profile.PackageRoot));
        var dependency = new NativeDependencyLock(1, projectName, projectVersion, rootIdentity, directory, recipe, [], "");
        dependency = dependency with { LockHash = Hash(JsonSerializer.SerializeToUtf8Bytes(dependency, DriverJson.Options)) };
        return profile with { NativeDirectory = directory, NativeVersion = recipe.Version, DependencyLock = dependency };
    }

    public static void Verify(DriverProfile profile, CancellationToken token)
    {
        VerifyNative(profile, token);
        PythonDependencies.Verify(profile, token);
    }
    private static void VerifyNative(DriverProfile profile, CancellationToken token)
    {
        var dependency = VerifyIdentity(profile);
        var compiler = new ProjectCompiler(profile.PackageRoot, profile.InterfacePath, profile.Language, token);
        if (!VerifyFiles(compiler, dependency.InstallTarget, dependency.Native, token)) throw new InvalidDataException("dependency.lock.inputs_changed");
    }
    private static NativeDependencyLock VerifyIdentity(DriverProfile profile)
    {
        if (profile.DependencyLock is not { } dependency) throw new InvalidDataException("dependency.lock.missing");
        var official = RegistryData.Recipes.SingleOrDefault(item => item.Version == dependency.Native.Version);
        if (dependency.SchemaVersion != (dependency.Python is null ? 1 : 2) || official is null || dependency.RootIdentity != DirectoryIdentity.Read(Path.GetFullPath(profile.PackageRoot))
            || profile.NativeDirectory != dependency.InstallTarget || profile.NativeVersion.TrimStart('v') != dependency.Native.Version
            || dependency.LockHash != Hash(JsonSerializer.SerializeToUtf8Bytes(dependency with { LockHash = "" }, DriverJson.Options))
            || dependency.Python is null && dependency.Dependencies.Length != 0
            || JsonSerializer.Serialize(dependency.Native, DriverJson.Options) != JsonSerializer.Serialize(official, DriverJson.Options)) throw new InvalidDataException("dependency.lock.inputs_changed");
        if (dependency.Python is not null) PythonDependencies.RequireRecipe(profile);
        return dependency;
    }
    private static bool VerifyFiles(ProjectCompiler compiler, string directory, NativeDependencyRecipe recipe, CancellationToken token)
    {
        string full = compiler.Scope(compiler.Root, directory);
        foreach (var file in recipe.Files)
        {
            string path = compiler.Scope(full, file.Path);
            if (!File.Exists(path) || new FileInfo(path).Length != file.SizeBytes || FileHash(path, token) != file.Sha256) return false;
        }
        return true;
    }

    public static async ValueTask InstallAsync(DriverProfile profile, string operationId, CancellationToken token)
    {
        token.ThrowIfCancellationRequested();
        var dependency = VerifyIdentity(profile);
        var compiler = new ProjectCompiler(profile.PackageRoot, profile.InterfacePath, profile.Language, token);
        if (dependency.RootIdentity != DirectoryIdentity.Read(Path.GetFullPath(profile.PackageRoot))) throw new InvalidDataException("dependency.root.changed");
        if (VerifyFiles(compiler, dependency.InstallTarget, dependency.Native, token)) { VerifyNative(profile, token); return; }
        string target = compiler.Scope(profile.PackageRoot, dependency.InstallTarget);
        if (Directory.Exists(target) || File.Exists(target)) throw new InvalidDataException("dependency.install.unknown_or_incomplete_target");
        string parent = Path.GetDirectoryName(target)!;
        compiler.Scope(profile.PackageRoot, Path.GetRelativePath(profile.PackageRoot, parent));
        Directory.CreateDirectory(parent);
        if (Directory.EnumerateFileSystemEntries(parent, Path.GetFileName(target) + ".*.partial").Any())
            throw new InvalidDataException("dependency.install.recovery_required");
        string stage = target + "." + operationId + ".partial";
        if (Directory.Exists(stage) || File.Exists(stage)) throw new InvalidDataException("dependency.install.existing_stage");
        byte[] marker = JsonSerializer.SerializeToUtf8Bytes(dependency, DriverJson.Options);
        Directory.CreateDirectory(stage);
        using (var receipt = new FileStream(Path.Combine(stage, Marker), FileMode.CreateNew, FileAccess.Write, FileShare.None))
        { receipt.Write(marker); receipt.Flush(true); }
        try
        {
            using var client = new HttpClient(new HttpClientHandler { AllowAutoRedirect = true, MaxAutomaticRedirections = 5 }) { Timeout = TimeSpan.FromMinutes(3) };
            client.DefaultRequestHeaders.UserAgent.ParseAdd("NexusPipeline-MaaFramework/0.17.3");
            using var response = await client.GetAsync(dependency.Native.Url, HttpCompletionOption.ResponseHeadersRead, token).ConfigureAwait(false);
            response.EnsureSuccessStatusCode();
            string host = response.RequestMessage!.RequestUri!.Host;
            if (host is not ("github.com" or "release-assets.githubusercontent.com" or "objects.githubusercontent.com")) throw new InvalidDataException("dependency.download.origin");
            if (response.Content.Headers.ContentLength is { } length && length != dependency.Native.SizeBytes) throw new InvalidDataException("dependency.download.size");
            string archivePath = Path.Combine(stage, "archive.zip");
            await using (var output = new FileStream(archivePath, FileMode.CreateNew, FileAccess.Write, FileShare.None))
            await using (var input = await response.Content.ReadAsStreamAsync(token).ConfigureAwait(false))
            {
                byte[] buffer = new byte[128 * 1024]; long size = 0;
                while (true)
                {
                    int count = await input.ReadAsync(buffer, token).ConfigureAwait(false); if (count == 0) break;
                    size = checked(size + count); if (size > dependency.Native.SizeBytes) throw new InvalidDataException("dependency.download.size");
                    await output.WriteAsync(buffer.AsMemory(0, count), token).ConfigureAwait(false);
                }
                if (size != dependency.Native.SizeBytes) throw new InvalidDataException("dependency.download.truncated");
            }
            if (FileHash(archivePath, token) != dependency.Native.Sha256) throw new InvalidDataException("dependency.download.digest");
            using (var archive = ZipFile.OpenRead(archivePath))
            {
                if (archive.Entries.Count > 10000) throw new InvalidDataException("dependency.archive.limit");
                var names = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
                foreach (var entry in archive.Entries)
                    if (!names.Add(entry.FullName) || entry.FullName.Contains('\\') || entry.FullName.StartsWith('/') || entry.FullName.Contains(':')
                        || entry.FullName.Split('/').Any(part => part is "." or "..") || (entry.ExternalAttributes >> 16 & 0xF000) == 0xA000)
                        throw new InvalidDataException("dependency.archive.path");
                foreach (var file in dependency.Native.Files)
                {
                    token.ThrowIfCancellationRequested();
                    var entry = archive.GetEntry(dependency.Native.ArchivePrefix + file.Path) ?? throw new InvalidDataException("dependency.archive.file_missing");
                    if (entry.Length != file.SizeBytes) throw new InvalidDataException("dependency.archive.size");
                    string destination = compiler.Scope(stage, file.Path);
                    await using var output = new FileStream(destination, FileMode.CreateNew, FileAccess.Write, FileShare.None);
                    await using var input = entry.Open();
                    await input.CopyToAsync(output, token).ConfigureAwait(false);
                }
            }
            File.Delete(archivePath);
            foreach (var file in dependency.Native.Files)
                if (FileHash(Path.Combine(stage, file.Path), token) != file.Sha256) throw new InvalidDataException("dependency.archive.digest");
            token.ThrowIfCancellationRequested();
            if (DirectoryIdentity.Read(Path.GetFullPath(profile.PackageRoot)) != dependency.RootIdentity) throw new InvalidDataException("dependency.root.changed");
            compiler.Scope(profile.PackageRoot, Path.GetRelativePath(profile.PackageRoot, stage));
            Directory.Move(stage, target);
            VerifyNative(profile, token);
        }
        finally
        {
            if (Directory.Exists(stage))
            {
                compiler.Scope(profile.PackageRoot, Path.GetRelativePath(profile.PackageRoot, stage));
                string receipt = compiler.Scope(stage, Marker);
                if (!File.ReadAllBytes(receipt).AsSpan().SequenceEqual(marker)) throw new InvalidDataException("dependency.stage.ownership_changed");
                var allowed = dependency.Native.Files.Select(file => file.Path).Append(Marker).Append("archive.zip").ToHashSet(StringComparer.OrdinalIgnoreCase);
                foreach (string file in Directory.EnumerateFileSystemEntries(stage))
                    if (!allowed.Contains(Path.GetFileName(file)) || !File.Exists(file) || (File.GetAttributes(file) & FileAttributes.ReparsePoint) != 0)
                        throw new InvalidDataException("dependency.stage.unknown_bytes");
                Directory.Delete(stage, true);
            }
        }
    }
}
