using System.IO.Compression;
using System.Reflection;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace NexusPipeline.Plugin.MaaFrameworkDriver;

public sealed record PythonDependencyFile(string ArchivePath, string Path, long SizeBytes, string Sha256);
public sealed record PythonDependencyComponent(string DependencyId, string Kind, string Name, string Version, string Url,
    long SizeBytes, string Sha256, string License, string[] Dependencies, PythonDependencyFile[] Files);
public sealed record PythonDependencyRecipe(string RecipeId, string ProjectName, string ProjectVersion, string Repository,
    string SourceCommit, string NativeVersion, string Platform, string InstallPolicy, string PythonVersion,
    string DeclaredExecutable, string GeneratedPathFile, PythonDependencyComponent[] Components);
public sealed record PythonDependencyLock(int SchemaVersion, string RecipeId, string RecipeHash, string RootIdentity,
    string InstallTarget, string[] ComponentIds, Dictionary<string, string> DeclarationHashes);

public static class PythonDependencies
{
    private sealed record Registry(int SchemaVersion, PythonDependencyRecipe[] Recipes);
    private static readonly Registry Data = ReadRegistry();
    private const string Marker = "python.dependency.lock.json";
    private static string Hash(byte[] bytes) => Convert.ToHexStringLower(SHA256.HashData(bytes));
    private static string RecipeHash(PythonDependencyRecipe recipe) => Hash(JsonSerializer.SerializeToUtf8Bytes(recipe, DriverJson.Options));
    private static string OwnedTarget(string hash) => ".nexus/maa-framework/py/" + hash[..32];
    public static string NormalizeExecutable(string value)
    {
        value = value.Replace('\\', '/');
        return value.StartsWith("./", StringComparison.Ordinal) ? value[2..] : value;
    }
    private static bool Digest(string value) => value.Length == 64 && value.All(char.IsAsciiHexDigit);
    private static bool SafeRelative(string value) => value.Length is > 0 and <= 512 && !Path.IsPathRooted(value)
        && !value.Contains('\\') && !value.Contains(':') && value.Split('/').All(part => part.Length > 0
            && part is not ("." or "..") && !part.EndsWith('.') && !part.EndsWith(' '));

    private static Registry ReadRegistry()
    {
        using var bytes = Assembly.GetExecutingAssembly().GetManifestResourceStream("MaaFrameworkDriver.PythonRecipes.json")
            ?? throw new InvalidDataException("dependency.python.recipe_missing");
        var registry = JsonSerializer.Deserialize<Registry>(bytes, DriverJson.Options) ?? throw new InvalidDataException("dependency.python.recipe_invalid");
        if (registry.SchemaVersion != 1 || registry.Recipes.Length is < 1 or > 16) throw new InvalidDataException("dependency.python.recipe_schema");
        foreach (var recipe in registry.Recipes)
        {
            if (recipe.Platform != "win-x64" || recipe.InstallPolicy != "owned_directory" || recipe.PythonVersion != "3.12.10"
                || recipe.Components.Length is < 2 or > 32 || !SafeRelative(recipe.DeclaredExecutable)
                || recipe.Components.Select(item => item.DependencyId).Distinct().Count() != recipe.Components.Length)
                throw new InvalidDataException("dependency.python.recipe_identity");
            var files = recipe.Components.SelectMany(item => item.Files).ToArray();
            if (files.Length is < 1 or > 5000 || files.Select(item => item.Path).Distinct(StringComparer.OrdinalIgnoreCase).Count() != files.Length
                || files.Sum(item => item.SizeBytes) > 512 * 1024 * 1024
                || files.Any(item => !SafeRelative(item.ArchivePath) || !SafeRelative(item.Path) || !Digest(item.Sha256) || item.SizeBytes < 0))
                throw new InvalidDataException("dependency.python.recipe_files");
            var components = recipe.Components.ToDictionary(item => item.DependencyId);
            var visiting = new HashSet<string>(); var done = new HashSet<string>();
            void Visit(string id)
            {
                if (done.Contains(id)) return;
                if (!components.TryGetValue(id, out var component) || !visiting.Add(id)) throw new InvalidDataException("dependency.python.recipe_dag");
                var uri = new Uri(component.Url);
                if (uri.Scheme != "https" || uri.UserInfo.Length != 0 || component.SizeBytes is < 1 or > 64 * 1024 * 1024
                    || !Digest(component.Sha256) || component.License.Length == 0
                    || component.Kind switch {
                        "python-embed" => uri.Host != "www.python.org" || uri.AbsolutePath != "/ftp/python/3.12.10/python-3.12.10-embed-amd64.zip",
                        "wheel" => uri.Host != "files.pythonhosted.org" || !uri.AbsolutePath.StartsWith("/packages/", StringComparison.Ordinal)
                            || !uri.AbsolutePath.EndsWith(".whl", StringComparison.Ordinal),
                        _ => true }) throw new InvalidDataException("dependency.python.recipe_origin");
                foreach (string dependency in component.Dependencies) Visit(dependency);
                visiting.Remove(id); done.Add(id);
            }
            foreach (string id in components.Keys) Visit(id);
        }
        return registry;
    }

    public static DriverProfile Bind(DriverProfile profile, CancellationToken token)
    {
        var compiler = new ProjectCompiler(profile.PackageRoot, profile.InterfacePath, profile.Language, token);
        var executables = compiler.DeclaredExecutables;
        var python = executables.Where(value => Path.GetFileNameWithoutExtension(value.Replace('/', Path.DirectorySeparatorChar))
            .StartsWith("python", StringComparison.OrdinalIgnoreCase)).ToArray();
        if (python.Length == 0) return profile;
        var schema = compiler.Inspect();
        var recipe = Data.Recipes.SingleOrDefault(item => item.ProjectName == schema["projectName"]!.GetValue<string>()
            && item.ProjectVersion == schema["projectVersion"]!.GetValue<string>().TrimStart('v') && item.NativeVersion == profile.NativeVersion);
        if (recipe is null || python.Any(value => NormalizeExecutable(value) != recipe.DeclaredExecutable))
            throw new InvalidDataException("dependency.python.unsupported_declaration");
        var declarations = new Dictionary<string, string>(StringComparer.Ordinal);
        foreach (string relative in new[] { "requirements.txt", "agent/requirements.txt" })
        {
            string path = compiler.Scope(profile.PackageRoot, relative);
            if (!File.Exists(path)) continue;
            if (new FileInfo(path).Length > 65536) throw new InvalidDataException("dependency.python.unsupported_declaration");
            declarations[relative] = Hash(File.ReadAllBytes(path));
            foreach (string line in File.ReadAllLines(path))
            {
                string declaration = line.Split('#')[0].Trim().ToLowerInvariant();
                if (declaration.Length != 0 && declaration is not ("maafw" or "json-with-comments"))
                    throw new InvalidDataException("dependency.python.unsupported_declaration");
            }
        }
        string hash = RecipeHash(recipe);
        string target = OwnedTarget(hash);
        string original = Path.GetDirectoryName(recipe.DeclaredExecutable)!.Replace('\\', '/');
        if (VerifyFiles(compiler, original, recipe, token)) target = original;
        var pythonLock = new PythonDependencyLock(1, recipe.RecipeId, hash, DirectoryIdentity.Read(profile.PackageRoot), target,
            recipe.Components.Select(item => item.DependencyId).ToArray(), declarations);
        var dependency = (profile.DependencyLock ?? throw new InvalidDataException("dependency.lock.missing")) with
        { SchemaVersion = 2, Python = pythonLock, Dependencies = pythonLock.ComponentIds, LockHash = "" };
        dependency = dependency with { LockHash = Hash(JsonSerializer.SerializeToUtf8Bytes(dependency, DriverJson.Options)) };
        compiler.VerifyReadSnapshot();
        return profile with { DependencyLock = dependency };
    }

    public static PythonDependencyRecipe RequireRecipe(DriverProfile profile)
    {
        var dependency = profile.DependencyLock?.Python ?? throw new InvalidDataException("dependency.python.lock_missing");
        var recipe = Data.Recipes.SingleOrDefault(item => item.RecipeId == dependency.RecipeId);
        if (recipe is null || dependency.SchemaVersion != 1 || dependency.RecipeHash != RecipeHash(recipe)
            || dependency.RootIdentity != DirectoryIdentity.Read(profile.PackageRoot) || recipe.NativeVersion != profile.NativeVersion
            || recipe.ProjectName != profile.DependencyLock!.ProjectName || recipe.ProjectVersion != profile.DependencyLock.ProjectVersion.TrimStart('v')
            || !dependency.ComponentIds.SequenceEqual(recipe.Components.Select(item => item.DependencyId))
            || !profile.DependencyLock!.Dependencies.SequenceEqual(dependency.ComponentIds)
            || dependency.InstallTarget != OwnedTarget(dependency.RecipeHash)
                && dependency.InstallTarget != Path.GetDirectoryName(recipe.DeclaredExecutable)!.Replace('\\', '/'))
            throw new InvalidDataException("dependency.python.lock_changed");
        if (dependency.DeclarationHashes.Count > 2 || dependency.DeclarationHashes.Keys.Any(path => path is not ("requirements.txt" or "agent/requirements.txt")))
            throw new InvalidDataException("dependency.python.declaration_changed");
        foreach (string relative in new[] { "requirements.txt", "agent/requirements.txt" })
        {
            string path = ProjectCompiler.ResolveScopedPath(profile.PackageRoot, profile.PackageRoot, relative);
            if (File.Exists(path) != dependency.DeclarationHashes.ContainsKey(relative)
                || File.Exists(path) && (new FileInfo(path).Length > 65536 || Hash(File.ReadAllBytes(path)) != dependency.DeclarationHashes[relative]))
                throw new InvalidDataException("dependency.python.declaration_changed");
        }
        return recipe;
    }

    public static void Verify(DriverProfile profile, CancellationToken token)
    {
        if (profile.DependencyLock?.Python is not { } dependency) return;
        var compiler = new ProjectCompiler(profile.PackageRoot, profile.InterfacePath, profile.Language, token);
        if (!VerifyFiles(compiler, dependency.InstallTarget, RequireRecipe(profile), token))
            throw new InvalidDataException("dependency.python.inputs_changed");
    }

    private static bool VerifyFiles(ProjectCompiler compiler, string target, PythonDependencyRecipe recipe, CancellationToken token)
    {
        string directory = compiler.Scope(compiler.Root, target);
        if (!Directory.Exists(directory)) return false;
        var expected = recipe.Components.SelectMany(item => item.Files).ToDictionary(item => item.Path, StringComparer.OrdinalIgnoreCase);
        foreach (var file in expected.Values)
        {
            token.ThrowIfCancellationRequested();
            string path = compiler.Scope(directory, file.Path);
            if (!File.Exists(path) || new FileInfo(path).Length != file.SizeBytes) return false;
            using var bytes = File.OpenRead(path);
            if (Convert.ToHexStringLower(SHA256.HashData(bytes)) != file.Sha256) return false;
        }
        string pth = compiler.Scope(directory, "python312._pth");
        if (!File.Exists(pth) || File.ReadAllText(pth) != recipe.GeneratedPathFile) return false;
        var pending = new Stack<string>(); pending.Push(directory); int count = 0;
        while (pending.TryPop(out string? current))
            foreach (string path in Directory.EnumerateFileSystemEntries(current))
            {
                if (++count > 10000) return false;
                compiler.Scope(directory, Path.GetRelativePath(directory, path));
                if (Directory.Exists(path)) pending.Push(path);
                else
                {
                    string relative = Path.GetRelativePath(directory, path).Replace('\\', '/');
                    if (!expected.ContainsKey(relative) && relative is not ("python312._pth" or Marker)) return false;
                }
            }
        return true;
    }

    public static async ValueTask InstallAsync(DriverProfile profile, string operationId, CancellationToken token)
    {
        token.ThrowIfCancellationRequested();
        if (profile.DependencyLock?.Python is not { } dependency) return;
        var recipe = RequireRecipe(profile);
        var compiler = new ProjectCompiler(profile.PackageRoot, profile.InterfacePath, profile.Language, token);
        if (VerifyFiles(compiler, dependency.InstallTarget, recipe, token)) return;
        string target = compiler.Scope(compiler.Root, dependency.InstallTarget);
        if (Directory.Exists(target) || File.Exists(target)) throw new InvalidDataException("dependency.python.unknown_or_incomplete_target");
        string parent = Path.GetDirectoryName(target)!; Directory.CreateDirectory(parent);
        compiler.Scope(compiler.Root, Path.GetRelativePath(compiler.Root, parent));
        if (Directory.EnumerateFileSystemEntries(parent, Path.GetFileName(target) + ".*.partial").Any())
            throw new InvalidDataException("dependency.python.recovery_required");
        string stage = target + "." + operationId + ".partial";
        if (Directory.Exists(stage) || File.Exists(stage)) throw new InvalidDataException("dependency.python.existing_stage");
        Directory.CreateDirectory(stage);
        byte[] receipt = JsonSerializer.SerializeToUtf8Bytes(new { owner = "NexusPipeline.MaaPython", operationId, dependency }, DriverJson.Options);
        using (var marker = new FileStream(Path.Combine(stage, Marker), FileMode.CreateNew, FileAccess.Write, FileShare.None))
        { marker.Write(receipt); marker.Flush(true); }
        var allowed = recipe.Components.SelectMany(item => item.Files).Select(item => item.Path)
            .Append(Marker).Append("python312._pth").Append("archive.zip").ToHashSet(StringComparer.OrdinalIgnoreCase);
        try
        {
            using var handler = new HttpClientHandler { AllowAutoRedirect = false };
            using var client = new HttpClient(handler) { Timeout = TimeSpan.FromMinutes(3) };
            client.DefaultRequestHeaders.UserAgent.ParseAdd("NexusPipeline/0.17.3");
            foreach (var component in recipe.Components)
            {
                string archivePath = Path.Combine(stage, "archive.zip");
                using var response = await client.GetAsync(component.Url, HttpCompletionOption.ResponseHeadersRead, token);
                response.EnsureSuccessStatusCode();
                if (response.Content.Headers.ContentLength is { } length && length != component.SizeBytes)
                    throw new InvalidDataException("dependency.python.download_size");
                await using (var output = new FileStream(archivePath, FileMode.CreateNew, FileAccess.Write, FileShare.None))
                await using (var input = await response.Content.ReadAsStreamAsync(token))
                    await CopyAsync(input, output, component.SizeBytes, token);
                using (var bytes = new FileStream(archivePath, FileMode.Open, FileAccess.Read, FileShare.Read))
                {
                    if (Convert.ToHexStringLower(SHA256.HashData(bytes)) != component.Sha256)
                        throw new InvalidDataException("dependency.python.download_digest");
                    bytes.Position = 0;
                    using var archive = new ZipArchive(bytes, ZipArchiveMode.Read);
                    var names = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
                    if (archive.Entries.Count > 10000) throw new InvalidDataException("dependency.python.archive_limit");
                    foreach (var entry in archive.Entries)
                        if (!SafeRelative(entry.FullName.TrimEnd('/')) || !names.Add(entry.FullName)
                            || (entry.ExternalAttributes >> 16 & 0xF000) == 0xA000)
                            throw new InvalidDataException("dependency.python.archive_path");
                    foreach (var file in component.Files)
                    {
                        token.ThrowIfCancellationRequested();
                        var entry = archive.GetEntry(file.ArchivePath) ?? throw new InvalidDataException("dependency.python.archive_missing");
                        if (entry.Length != file.SizeBytes) throw new InvalidDataException("dependency.python.archive_size");
                        string path = compiler.Scope(stage, file.Path); Directory.CreateDirectory(Path.GetDirectoryName(path)!);
                        await using var output = new FileStream(path, FileMode.CreateNew, FileAccess.Write, FileShare.None);
                        await using var input = entry.Open();
                        await CopyAsync(input, output, file.SizeBytes, token);
                    }
                }
                File.Delete(archivePath);
            }
            await File.WriteAllTextAsync(Path.Combine(stage, "python312._pth"), recipe.GeneratedPathFile, new UTF8Encoding(false), token);
            if (!VerifyFiles(compiler, Path.GetRelativePath(compiler.Root, stage), recipe, token)) throw new InvalidDataException("dependency.python.stage_digest");
            RequireRecipe(profile); token.ThrowIfCancellationRequested(); Directory.Move(stage, target);
            Verify(profile, token);
        }
        finally
        {
            if (Directory.Exists(stage))
            {
                compiler.Scope(compiler.Root, Path.GetRelativePath(compiler.Root, stage));
                if (!File.ReadAllBytes(Path.Combine(stage, Marker)).AsSpan().SequenceEqual(receipt))
                    throw new InvalidDataException("dependency.python.stage_ownership_changed");
                foreach (string file in Directory.EnumerateFileSystemEntries(stage, "*", SearchOption.AllDirectories))
                {
                    compiler.Scope(stage, Path.GetRelativePath(stage, file));
                    string relative = Path.GetRelativePath(stage, file).Replace('\\', '/');
                    if (Directory.Exists(file) ? !allowed.Any(path => path.StartsWith(relative + '/', StringComparison.OrdinalIgnoreCase)) : !allowed.Contains(relative))
                        throw new InvalidDataException("dependency.python.stage_unknown_bytes");
                }
                Directory.Delete(stage, true);
            }
        }
    }

    private static async Task CopyAsync(Stream input, Stream output, long expected, CancellationToken token)
    {
        byte[] block = new byte[65536]; long size = 0;
        while (true)
        {
            int count = await input.ReadAsync(block, token); if (count == 0) break;
            size = checked(size + count); if (size > expected) throw new InvalidDataException("dependency.python.payload_size");
            await output.WriteAsync(block.AsMemory(0, count), token);
        }
        if (size != expected) throw new InvalidDataException("dependency.python.payload_truncated");
    }
}
