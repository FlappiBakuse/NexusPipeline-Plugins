using System.Reflection.PortableExecutable;
using System.Security.Cryptography;
using System.Text.Json;

namespace NexusPipeline.Plugin.MaaFrameworkDriver;

public sealed record RuntimeInputFile(string Path, long SizeBytes, string Sha256);
public sealed record RuntimeInputLock(int SchemaVersion, string RootIdentity, string NativeDirectory,
    RuntimeInputFile[] Files, string LockHash);

public static class RuntimeInputs
{
    private static readonly string[] RequiredLibraries = ["MaaFramework.dll", "MaaToolkit.dll", "MaaAgentClient.dll"];

    public static DriverProfile Bind(DriverProfile profile, CancellationToken token)
    {
        var compiler = new ProjectCompiler(profile.PackageRoot, profile.InterfacePath, profile.Language, token);
        string[] candidates = profile.NativeDirectory.Length != 0
            ? [profile.NativeDirectory]
            : new[] { ".", "maafw", "bin", "runtime", "assets", "assets/maafw", "assets/bin", "runtimes/win-x64/native" };
        var found = candidates.Where(relative => RequiredLibraries.All(name => File.Exists(
            compiler.Scope(profile.PackageRoot, relative + "/" + name)))).ToArray();
        if (found.Length == 0) throw new InvalidDataException("maa.runtime.incomplete_distribution: native libraries missing");
        if (found.Length != 1) throw new InvalidDataException("maa.runtime.native_selection_required");
        string directory = compiler.Scope(profile.PackageRoot, found[0]);
        string[] paths = Directory.EnumerateFiles(directory, "*.dll").Order(StringComparer.OrdinalIgnoreCase).Take(129).ToArray();
        if (paths.Length > 128) throw new InvalidDataException("maa.runtime.native_file_limit");
        var files = new List<RuntimeInputFile>();
        foreach (string path in paths)
        {
            token.ThrowIfCancellationRequested();
            compiler.Scope(profile.PackageRoot, Path.GetRelativePath(profile.PackageRoot, path));
            using var stream = File.OpenRead(path);
            if (stream.Length is < 1 or > 256 * 1024 * 1024) throw new InvalidDataException("maa.runtime.native_size");
            using (var pe = new PEReader(stream, PEStreamOptions.LeaveOpen))
                if (pe.PEHeaders.CoffHeader.Machine != Machine.Amd64)
                    throw new InvalidDataException("maa.runtime.native_architecture: x64 required");
            stream.Position = 0;
            files.Add(new(Path.GetFileName(path), stream.Length, Convert.ToHexStringLower(SHA256.HashData(stream))));
        }
        var inputs = new RuntimeInputLock(1, DirectoryIdentity.Read(Path.GetFullPath(profile.PackageRoot)),
            Path.GetRelativePath(profile.PackageRoot, directory).Replace('\\', '/'), files.ToArray(), "");
        inputs = inputs with { LockHash = Hash(inputs) };
        return profile with { NativeDirectory = inputs.NativeDirectory, NativeVersion = "", RuntimeInputs = inputs, DependencyLock = null };
    }

    public static void Verify(DriverProfile profile, CancellationToken token)
    {
        var expected = profile.RuntimeInputs ?? throw new InvalidDataException("maa.runtime.rebind_required");
        if (expected.SchemaVersion != 1 || expected.LockHash != Hash(expected with { LockHash = "" }))
            throw new InvalidDataException("maa.runtime.input_identity_invalid");
        var current = Bind(profile, token).RuntimeInputs!;
        if (current.LockHash != expected.LockHash) throw new InvalidDataException("maa.runtime.inputs_changed");
    }

    private static string Hash(RuntimeInputLock value) => Convert.ToHexStringLower(SHA256.HashData(
        JsonSerializer.SerializeToUtf8Bytes(value, DriverJson.Options)));
}
