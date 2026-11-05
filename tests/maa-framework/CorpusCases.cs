using System.Security.Cryptography;
using System.Text.Json;
using System.Text.Json.Nodes;
using NexusPipeline.Extensions.MaaFramework;

internal static class CorpusCases
{
    internal static void Run(Action<string, Action> run, string manifest, string reportPath)
    {
        var rows = new List<object>();
        foreach (var source in JsonNode.Parse(File.ReadAllBytes(manifest))!.AsArray().Select(node => node!.AsObject()))
        {
            var name = source["project"]!.GetValue<string>();
            run("explicit-local-source-corpus/" + name, () =>
            {
                var root = Path.GetFullPath(source["root"]!.GetValue<string>());
                var main = source["interface"]!.GetValue<string>();
                var inventory = JsonNode.Parse(File.ReadAllBytes(source["inventory"]!.GetValue<string>()))!.AsObject();
                var expected = inventory["files"]!.AsObject(); var used = new Dictionary<string, MaaSourceInput>(StringComparer.OrdinalIgnoreCase);
                void Capture(string relative)
                {
                    relative = MaaSourceSet.Normalize(relative); if (used.ContainsKey(relative)) return;
                    var path = Path.GetFullPath(Path.Combine(root, relative));
                    if (!path.StartsWith(root + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase)) throw new InvalidDataException("corpus_path_escape");
                    for (var current = new FileInfo(path) as FileSystemInfo; current is not null && !current.FullName.Equals(root, StringComparison.OrdinalIgnoreCase);
                         current = current is FileInfo file ? file.Directory : ((DirectoryInfo)current).Parent)
                        if ((current.Attributes & FileAttributes.ReparsePoint) != 0) throw new InvalidDataException("corpus_link_rejected");
                    var bytes = File.ReadAllBytes(path); var sha = Convert.ToHexStringLower(SHA256.HashData(bytes));
                    if (expected[relative]?.GetValue<string>() != sha) throw new InvalidDataException("corpus_inventory_mismatch");
                    used.Add(relative, new(relative, bytes, sha, "inventory:" + sha));
                    var document = MaaJson.Read(bytes);
                    foreach (var import in MaaJson.Strings(document["import"])) Capture(MaaSourceSet.Relative(main, import));
                }
                Capture(main);
                var head = MaaJson.Read(used[main].Content);
                if (head["languages"] is JsonObject languages && languages["zh_cn"] is JsonValue locale)
                    Capture(MaaSourceSet.Relative(main, locale.GetValue<string>()));
                var inputs = new MaaSourceSet(used.Values.ToArray()); var project = new MaaPiCompiler(inputs, name == "MaaStellaSora" ? "mfa" : "mxu").Compile(main);
                if (project.Tasks.Length != source["taskCount"]!.GetValue<int>()) throw new InvalidDataException("corpus_task_count_mismatch");
                var json = JsonSerializer.SerializeToUtf8Bytes(project.Declaration);
                var projection = MaaCompactProjection.Build(project);
                if (!JsonNode.DeepEquals(MaaCompactProjection.Restore(projection, project.CompilationFingerprint), project.Declaration))
                    throw new InvalidDataException("corpus_projection_not_lossless");
                var artifacts = Path.GetFullPath(Path.Combine(Path.GetDirectoryName(reportPath)!, "..", "..", "projection-artifacts"));
                Directory.CreateDirectory(artifacts);
                void Save(string sha, byte[] content)
                {
                    var destination = Path.Combine(artifacts, sha + ".json");
                    if (File.Exists(destination))
                    { if (!File.ReadAllBytes(destination).AsSpan().SequenceEqual(content)) throw new InvalidDataException("corpus_artifact_conflict"); }
                    else { using var output = new FileStream(destination, FileMode.CreateNew, FileAccess.Write); output.Write(content); }
                }
                Save(projection.ArtifactSha256, projection.Artifact); Save(projection.ViewSha256, projection.View);
                foreach (var page in projection.Pages) Save(page.Key, page.Value);
                var bundle = CorpusBundle.Build(name, project, used.Values, expected);
                Save(bundle.ArtifactSha256, bundle.Artifact); Save(bundle.ExecutionSha256, bundle.Execution); Save(bundle.IndexSha256, bundle.Index);
                Save(bundle.Pi.ArtifactSha256, bundle.Pi.Artifact); Save(bundle.Pi.ViewSha256, bundle.Pi.View);
                foreach (var page in bundle.Pi.Pages) Save(page.Key, page.Value);
                var editor = MaaEditorProjection.Build(bundle); var publicEditor = MaaEditorProjection.Restore(editor);
                BundleCases.Assert(publicEditor["schema"]!["task"]!.AsArray().Count == project.Tasks.Length &&
                    publicEditor["schema"]!["option"]!.AsObject().Count == project.Options.Count &&
                    publicEditor["profile"]!["Tasks"]!.AsArray().Count == project.Tasks.Length);
                Save(editor.IndexSha256, editor.Index); foreach (var page in editor.Pages) Save(page.Key, page.Value);
                rows.Add(new { project = name, status = "PASS", files = used.Count, rawBytes = used.Values.Sum(input => input.Content.Length),
                    largestInput = used.Values.Max(input => input.Content.Length), tasks = project.Tasks.Length, options = project.Options.Count,
                    compiledDeclarationBytes = json.Length, compiledDeclarationSha256 = Convert.ToHexStringLower(SHA256.HashData(json)),
                    project.SourceFingerprint, project.ClientKind, project.CompilationFingerprint, project.Sources,
                    projectionArtifactBytes = projection.Artifact.Length, projection.ArtifactSha256, projectionViewBytes = projection.View.Length,
                    projection.ViewSha256, externalizedPipelines = projection.Bindings.Length, losslessRoundtrip = true, projectionDirectory = artifacts,
                    projectionPages = projection.Pages.Count, projectionPageBytes = projection.Pages.Values.Sum(page => page.Length),
                    largestProjectionPage = projection.Pages.Count == 0 ? 0 : projection.Pages.Values.Max(page => page.Length),
                    bundleArtifactBytes = bundle.Artifact.Length, bundleArtifactSha256 = bundle.ArtifactSha256, executionBytes = bundle.Execution.Length,
                    bundleIndexBytes = bundle.Index.Length, bundle.IndexSha256,
                    bundle.ExecutionSha256, bundle.SemanticFingerprint, bundleSnapshotFingerprint = bundle.SnapshotFingerprint,
                    editorIndexBytes = editor.Index.Length, editorIndexSha256 = editor.IndexSha256, editorPages = editor.Pages.Count,
                    editorPageBytes = editor.Pages.Values.Sum(page => page.Length), editorTranslationCount = publicEditor["translations"]!.AsObject().Count,
                    bundleQualification = "Complete locked PI with explicit synthetic saved profile; one enabled real PI task plus all disabled occurrences retained; no upstream user configuration or execution",
                    sdkProviderQualification = "Actual SDK ISelectedSource/IProjectCompiler with a readonly fixture of the locked inventory and explicit synthetic configuration; identical semantic fingerprint; not installed Host integration",
                    qualification = "Complete locked local PI closure interpreted by actual C# compiler; not Host/Jint/native integration" });
            });
        }
        File.WriteAllText(reportPath, JsonSerializer.Serialize(rows, new JsonSerializerOptions { WriteIndented = true }) + "\n");
    }
}
