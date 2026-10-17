using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;

namespace NexusPipeline.Plugin.MaaFrameworkDriver;

public sealed partial class ProjectCompiler
{
    private JsonObject Load(string file, bool imported = false)
    {
        if (!_stack.Add(file) || _stack.Count > 32) throw Error("import", "cycle/depth");
        var main = Read(file);
        ValidateDeclarations(main, imported, Path.GetRelativePath(_root, file));
        foreach (string import in Strings(main["import"]))
        {
            var child = Load(Scope(_directory, import), true);
            foreach (string field in new[] { "task", "preset", "group", "pretask", "global_option", "setting" })
            {
                var items = (main[field] is null ? [] : field == "pretask" ? Objects(main[field]).Cast<JsonNode>() : main[field]!.AsArray().OfType<JsonNode>()).ToList();
                var additions = child[field] is null ? [] : field == "pretask" ? Objects(child[field]).Cast<JsonNode>() : child[field]!.AsArray().OfType<JsonNode>();
                items.AddRange(additions);
                if (field == "global_option") items = items.DistinctBy(item => item.GetValue<string>()).ToList();
                if (field == "group") items = items.DistinctBy(item => Required(item.AsObject(), "name")).ToList();
                main[field] = new JsonArray(items.Select(item => item.DeepClone()).ToArray());
            }
            if (child["option"] is JsonObject options)
            {
                if (main["option"] is not JsonObject own) main["option"] = own = new JsonObject();
                foreach (var pair in options) own[pair.Key] = pair.Value?.DeepClone();
            }
        }
        _stack.Remove(file); return main;
    }

    public JsonObject ReadScopedFile(string relative) => Read(Scope(_root, relative));

    private JsonObject Read(string file)
    {
        if (++_files > 128) throw Error("import", "file count");
        string fileIdentity = DirectoryIdentity.Read(file);
        long size = new FileInfo(file).Length;
        // MaaEnd v2.30.0 has a 2.2 MB declaration import. Keep an explicit
        // bounded parser budget that includes the locked official projects.
        if (size > 8 * 1024 * 1024 || (_bytes += size) > 32 * 1024 * 1024) throw Error("import", "byte budget");
        _token.ThrowIfCancellationRequested();
        using var stream = File.OpenRead(file);
        using var content = new MemoryStream();
        byte[] block = new byte[64 * 1024];
        while (true)
        {
            _token.ThrowIfCancellationRequested();
            int count = stream.Read(block);
            if (count == 0) break;
            if (content.Length + count > 8 * 1024 * 1024) throw Error("import", "byte budget");
            content.Write(block, 0, count);
            ParsedBytes += count;
        }
        _token.ThrowIfCancellationRequested();
        byte[] bytes = content.ToArray();
        if (bytes.LongLength != size || DirectoryIdentity.Read(file) != fileIdentity) throw Error("source", "file changed during read");
        string relative = Path.GetRelativePath(_root, file);
        string digest = Convert.ToHexString(SHA256.HashData(bytes)).ToLowerInvariant();
        if (_readFiles.TryGetValue(relative, out string? prior) && (prior != digest || _readIdentities[relative] != fileIdentity))
            throw Error("source." + relative, "file changed between reads");
        _readFiles[relative] = digest;
        _readIdentities[relative] = fileIdentity;
        var options = new JsonDocumentOptions { CommentHandling = JsonCommentHandling.Skip, AllowTrailingCommas = true, MaxDepth = 64 };
        using var document = JsonDocument.Parse(bytes.AsMemory(bytes.AsSpan().StartsWith(new byte[] { 239, 187, 191 }) ? 3 : 0), options);
        CheckDuplicates(document.RootElement);
        FilesParsed++;
        return JsonNode.Parse(document.RootElement.GetRawText(), documentOptions: options)?.AsObject() ?? throw Error("interface", "object required");
    }

    private static void CheckDuplicates(JsonElement node)
    {
        if (node.ValueKind == JsonValueKind.Array) foreach (var item in node.EnumerateArray()) CheckDuplicates(item);
        if (node.ValueKind != JsonValueKind.Object) return;
        var names = new HashSet<string>(StringComparer.Ordinal);
        foreach (var item in node.EnumerateObject())
        {
            if (!names.Add(item.Name)) throw Error(item.Name, "duplicate member");
            CheckDuplicates(item.Value);
        }
    }

    public string Scope(string basis, string relative)
    {
        if (relative.StartsWith("{PROJECT_DIR}/", StringComparison.Ordinal) || relative.StartsWith("{PROJECT_DIR}\\", StringComparison.Ordinal))
        {
            basis = _directory;
            relative = relative[14..];
        }
        return ResolveScopedPath(_root, basis, relative);
    }

    public void VerifyReadSnapshot()
    {
        if (DirectoryIdentity.Read(_root) != _rootIdentity) throw Error("source.root", "directory identity changed");
        foreach (var pair in _readFiles)
        {
            _token.ThrowIfCancellationRequested();
            string file = Scope(_root, pair.Key);
            if (DirectoryIdentity.Read(file) != _readIdentities[pair.Key]) throw Error("source." + pair.Key, "file identity changed");
            if (new FileInfo(file).Length > 8 * 1024 * 1024) throw Error("source." + pair.Key, "file changed");
            using var stream = File.OpenRead(file);
            if (Convert.ToHexString(SHA256.HashData(stream)).ToLowerInvariant() != pair.Value)
                throw Error("source." + pair.Key, "file changed; read the source again");
        }
    }

    public static string ResolveScopedPath(string packageRoot, string basis, string relative)
    {
        string root = Path.GetFullPath(packageRoot).TrimEnd('\\', '/');
        if (Path.IsPathRooted(relative)) throw Error("path", "absolute declaration");
        string path = Path.GetFullPath(Path.Combine(basis, relative));
        if (!path.Equals(root, StringComparison.OrdinalIgnoreCase)
            && !path.StartsWith(root + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase)) throw Error("path", "outside approved root");
        for (string? current = path; current is not null; current = Path.GetDirectoryName(current))
        {
            if (File.Exists(current) || Directory.Exists(current))
                if ((File.GetAttributes(current) & FileAttributes.ReparsePoint) != 0) throw Error("path", "link rejected");
            if (current.Equals(root, StringComparison.OrdinalIgnoreCase)) break;
        }
        return path;
    }
}
