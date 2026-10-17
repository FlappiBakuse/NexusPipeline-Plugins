using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;

namespace NexusPipeline.Plugin.MaaFrameworkDriver;

public sealed partial class ProjectCompiler
{
    private string ResolveExecutable(string declaration)
    {
        if (Path.IsPathFullyQualified(declaration))
        {
            if (!Regex.IsMatch(Path.GetFileNameWithoutExtension(declaration), "^python(?:w|[0-9.]*)?$",
                RegexOptions.IgnoreCase | RegexOptions.CultureInvariant) || !declaration.EndsWith(".exe", StringComparison.OrdinalIgnoreCase))
                throw Error("exec", "absolute program must be an explicit Python interpreter");
            return File.Exists(declaration) ? Path.GetFullPath(declaration) : throw Error("exec", "interpreter missing");
        }
        if (declaration.Contains('/') || declaration.Contains('\\'))
        {
            string path = Scope(_directory, declaration);
            if (!File.Exists(path) && File.Exists(path + ".exe")) path += ".exe";
            return File.Exists(path) ? path : throw Error("exec", "missing program");
        }
        var matches = new List<string>();
        foreach (string basis in new[] { _directory, _root, Scope(_root, "python"), Scope(_root, "runtime/python"),
            Scope(_root, ".venv/Scripts"), Scope(_root, "venv/Scripts") }.Distinct(StringComparer.OrdinalIgnoreCase))
            foreach (string ext in new[] { "", ".exe" })
            {
                string candidate = Scope(basis, declaration + ext);
                if (File.Exists(candidate) && Path.GetExtension(candidate).Equals(".exe", StringComparison.OrdinalIgnoreCase))
                    matches.Add(candidate);
            }
        matches = matches.Distinct(StringComparer.OrdinalIgnoreCase).ToList();
        if (matches.Count == 1) return matches[0];
        if (matches.Count > 1) throw Error("exec", "explicit interpreter selection required");
        throw Error("exec", "interpreter missing: " + declaration);
    }

    private static int PythonEntryIndex(IReadOnlyList<string> arguments)
    {
        int index = 0;
        while (index < arguments.Count && arguments[index].StartsWith('-'))
        {
            string option = arguments[index++];
            if (option == "--") break;
            if (option is "-W" or "-X")
            { if (index >= arguments.Count) throw Error("exec.args", "missing interpreter option value"); index++; }
            else if (option is not ("-u" or "-B" or "-E" or "-I" or "-O" or "-OO" or "-s" or "-S" or "-q")
                && !option.StartsWith("-W", StringComparison.Ordinal) && !option.StartsWith("-X", StringComparison.Ordinal))
                throw Error("exec.args", "unsupported interpreter option; explicit script required");
        }
        if (index >= arguments.Count) throw Error("exec.args", "explicit project script entry required");
        return index;
    }

    private string ExecutionFingerprint(DriverProfile profile, JsonObject controller, JsonObject resource, string[] resourcePaths,
        CompiledProgram[] pretasks, CompiledProgram[] agents)
    {
        string native = Scope(_root, profile.NativeDirectory);
        var programs = new JsonArray();
        var identity = new StringBuilder();
        identity.Append(JsonSerializer.Serialize(new { root = _root, interfacePath = Scope(_root, profile.InterfacePath), profile.NativeVersion }));
        identity.Append(JsonSerializer.Serialize(new { profile.HostLaunchRequired, profile.HostLaunchConfiguration,
            profile.WindowSelection, profile.WindowExecutable, profile.WindowWaitMilliseconds, profile.AgentEmbedded }));
        identity.Append(profile.RuntimeInputs?.LockHash ?? "");
        identity.Append(JsonSerializer.Serialize(new { type = controller["type"], win32 = controller["win32"], path = resource["path"] }));
        // Execution declarations are authorized as code; translated display-only
        // metadata does not invalidate that authorization.
        foreach (string field in new[] { "controller", "resource", "task", "option", "global_option", "preset" })
            identity.Append(JsonSerializer.Serialize(new { field, value = ExecutionDeclaration(_pi[field]) }));
        if (!Directory.Exists(native)) throw Error("nativeDirectory", "missing");
        var files = Directory.EnumerateFiles(native, "*.dll").Order(StringComparer.OrdinalIgnoreCase).ToList();
        foreach (string relative in new[] { "requirements.txt", "agent/requirements.txt", "pyproject.toml", "uv.lock" })
        {
            string declaration = Scope(_root, relative);
            if (File.Exists(declaration)) files.Add(declaration);
        }
        foreach (string path in resourcePaths) files.AddRange(ScopedTree(path));
        string[]? localPythonFiles = null;
        foreach (var program in pretasks.Concat(agents))
        {
            files.Add(program.Executable);
            // Hash declarations, not expanded user values or secrets.
            var authorizedArguments = program.Arguments.ToArray();
            string interpreter = Path.GetFileNameWithoutExtension(program.Executable);
            bool uv = interpreter.Equals("uv", StringComparison.OrdinalIgnoreCase);
            if (uv || Regex.IsMatch(interpreter, "^python(?:w|[0-9.]*)?$", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant))
            {
                int index = uv ? 2 + PythonEntryIndex(authorizedArguments.Skip(2).ToArray()) : PythonEntryIndex(authorizedArguments);
                string entry = authorizedArguments[index];
                if (!Path.IsPathFullyQualified(entry)) entry = Scope(_directory, entry);
                Scope(_root, Path.GetRelativePath(_root, entry));
                if (!File.Exists(entry) || !entry.EndsWith(".py", StringComparison.OrdinalIgnoreCase))
                    throw Error("exec.args", "explicit .py entry missing");
                authorizedArguments[index] = entry;
                files.Add(entry);
                // Local imports can extend beyond the entry directory; all Python programs
                // in this compilation share one bounded package enumeration.
                string[] excluded = [Scope(_root, ".nexus")];
                files.AddRange(localPythonFiles ??= ScopedTree(_root, excluded).Where(IsLocalCode).ToArray());
            }
            else if (program.Executable.StartsWith(_root + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase))
                files.AddRange(ScopedTree(Path.GetDirectoryName(program.Executable)!).Where(IsLocalCode));
            var authorizedProgram = JsonSerializer.SerializeToNode(new { program.Executable, program.Identifier, program.TimeoutMilliseconds,
                arguments = authorizedArguments, generatedOptions = program.GeneratedOptionPayload is not null })!;
            programs.Add(authorizedProgram); identity.Append(authorizedProgram.ToJsonString());
        }
        if (!string.IsNullOrWhiteSpace(profile.AdbPath)) files.Add(profile.AdbPath);
        if (!string.IsNullOrWhiteSpace(profile.WindowExecutable)) files.Add(profile.WindowExecutable);
        long totalBytes = 0;
        var unique = files.Distinct(StringComparer.OrdinalIgnoreCase).Order(StringComparer.OrdinalIgnoreCase).ToArray();
        if (unique.Length > 50000) throw Error("fingerprint", "file count limit");
        byte[] hashBlock = new byte[64 * 1024];
        foreach (string file in unique)
        {
            _token.ThrowIfCancellationRequested();
            if (file.StartsWith(_root + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase))
                Scope(_root, Path.GetRelativePath(_root, file));
            else
                for (string? current = file; current is not null; current = Path.GetDirectoryName(current))
                    if ((File.GetAttributes(current) & FileAttributes.ReparsePoint) != 0)
                        throw Error("exec", "linked interpreter or target");
            if ((totalBytes += new FileInfo(file).Length) > 4L * 1024 * 1024 * 1024)
                throw Error("fingerprint", "byte limit");
            using var stream = File.OpenRead(file);
            using var hash = IncrementalHash.CreateHash(HashAlgorithmName.SHA256);
            while (true)
            {
                _token.ThrowIfCancellationRequested();
                int count = stream.Read(hashBlock);
                if (count == 0) break;
                hash.AppendData(hashBlock, 0, count); BytesRead += count;
            }
            _token.ThrowIfCancellationRequested(); FilesHashed++;
            identity.Append(JsonSerializer.Serialize(new { file, sha256 = Convert.ToHexString(hash.GetHashAndReset()) }));
        }
        foreach (var declaration in Objects(_pi["agent"]).Concat(Objects(_pi["pretask"])))
            foreach (string key in new[] { "option", "controller", "resource" })
                identity.Append(JsonSerializer.Serialize(new { key, value = declaration[key] }));
        string fingerprint = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(identity.ToString()))).ToLowerInvariant();
        _authorizationManifest = new() { ["schemaVersion"] = 1, ["packageRoot"] = _root, ["nativeRoot"] = native,
            ["programs"] = programs, ["resourceRoots"] = new JsonArray(resourcePaths.Select(path => (JsonNode?)JsonValue.Create(path)).ToArray()),
            ["localCodeScope"] = "Bounded package-local code for Python; bounded executable-directory code and runtime metadata for direct EXE",
            ["fileCount"] = unique.Length, ["contentFingerprint"] = fingerprint,
            ["inputFiles"] = new JsonArray(unique.Where(file => file.StartsWith(_root + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase))
                .Select(file => (JsonNode?)JsonValue.Create(Path.GetRelativePath(_root, file).Replace('\\', '/'))).ToArray()),
            ["windowSelection"] = profile.WindowSelection, ["windowExecutable"] = profile.WindowExecutable };
        return fingerprint;
    }

    private static bool IsLocalCode(string path) => Path.GetExtension(path).ToLowerInvariant() is ".py" or ".pyd" or ".dll" or ".exe"
        || path.EndsWith(".deps.json", StringComparison.OrdinalIgnoreCase)
        || path.EndsWith(".runtimeconfig.json", StringComparison.OrdinalIgnoreCase);

    private IEnumerable<string> ScopedTree(string directory, string[]? excludedDirectories = null)
    {
        var pending = new Stack<string>(); pending.Push(directory);
        int entries = 0;
        while (pending.TryPop(out string? current))
        {
            _token.ThrowIfCancellationRequested();
            foreach (string path in Directory.EnumerateFileSystemEntries(current).Select(path =>
                { _token.ThrowIfCancellationRequested(); return path; }).Order(StringComparer.OrdinalIgnoreCase))
            {
                _token.ThrowIfCancellationRequested();
                EntriesEnumerated++;
                if (++entries > 50000) throw Error("resource", "file count limit");
                Scope(_root, Path.GetRelativePath(_root, path));
                if (Directory.Exists(path))
                {
                    if (excludedDirectories?.Contains(path, StringComparer.OrdinalIgnoreCase) != true) pending.Push(path);
                }
                else yield return path;
            }
        }
    }

    private static JsonNode? ExecutionDeclaration(JsonNode? node)
    {
        if (node is JsonObject obj) return new JsonObject(obj
            .Where(pair => pair.Key is not ("label" or "description" or "icon" or "doc" or "help"))
            .OrderBy(pair => pair.Key, StringComparer.Ordinal)
            .Select(pair => new KeyValuePair<string, JsonNode?>(pair.Key,
                pair.Key == "pipeline_override" ? pair.Value?.DeepClone() : ExecutionDeclaration(pair.Value))));
        if (node is JsonArray array) return new JsonArray(array.Select(ExecutionDeclaration).ToArray());
        return node?.DeepClone();
    }
}
