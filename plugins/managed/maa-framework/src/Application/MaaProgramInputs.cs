using System.Runtime.InteropServices;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace NexusPipeline.Extensions.MaaFramework;

internal sealed class MaaProgramInputs : IAsyncDisposable
{
    private readonly MaaRuntimePlan plan;
    private readonly MaaFrozenResources resources;
    private readonly MaaWorkerInputs inputs;
    private readonly MaaWorkerSecrets secrets;
    private readonly MaaInputLease held = new();
    private readonly string directory;
    private readonly MaaProgramSpec[] programs;
    private readonly HashSet<string> libraryDirectories = new(StringComparer.OrdinalIgnoreCase);
    private readonly List<MaaProgramProcess> preparation = [];
    private bool disposed;

    internal MaaProgramInputs(MaaRuntimePlan plan, MaaFrozenResources resources, MaaWorkerInputs inputs, MaaWorkerSecrets secrets,
        bool initialize = false)
    {
        this.plan = plan; this.resources = resources; this.inputs = inputs; this.secrets = secrets;
        programs = plan.Programs.Where(program => !initialize || program.Kind == "pretask").ToArray();
        directory = Path.GetDirectoryName(Path.Combine(resources.ProjectRoot, plan.InterfacePath.Replace('/', Path.DirectorySeparatorChar)))!;
        RequireCurrent();
        try
        {
            held.Directory(directory);
            foreach (var program in programs)
            {
                _ = resources.File(program.Executable);
                if (program.ScriptIndex is { } index) _ = resources.File(program.Arguments[index]);
                var executable = Resolve(program.Executable);
                var name = Path.GetFileNameWithoutExtension(executable);
                if (!name.StartsWith("python", StringComparison.OrdinalIgnoreCase) && !name.Equals("uv", StringComparison.OrdinalIgnoreCase))
                    BindLibraries(Path.GetDirectoryName(executable)!);
            }
        }
        catch
        {
            held.Dispose();
            throw;
        }
    }
    internal MaaAgentSession? Agents()
    {
        RequireCurrent(); var agents = programs.Where(item => item.Kind == "agent").ToArray();
        return agents.Length == 0 ? null : new(inputs.AgentLibrary, inputs.AgentSizeBytes, inputs.AgentSha256,
            agents.Select(program => new MaaAgentLaunch(program.Identifier, program.TimeoutMilliseconds,
                (identifier, token) => StartAsync(program, identifier, token))).ToArray(), RequireCurrent);
    }
    internal async Task RunPretasksAsync(IReadOnlyList<string> occurrenceIds, CancellationToken cancellation,
        Func<string, bool, Task>? publish = null, bool retainChildren = false)
    {
        var selected = occurrenceIds.ToHashSet(StringComparer.Ordinal);
        var selectedPrograms = occurrenceIds.Select(id => programs.SingleOrDefault(item => item.Kind == "pretask" && item.OccurrenceId == id)
            ?? throw new MaaInputFailure("maa_initialization_selection_unbound")).ToArray();
        if (selected.Count != occurrenceIds.Count) throw new MaaInputFailure("maa_initialization_selection_unbound");
        foreach (var program in selectedPrograms)
        {
            cancellation.ThrowIfCancellationRequested(); RequireCurrent();
            var process = await StartAsync(program, null, cancellation).ConfigureAwait(false);
            preparation.Add(process);
            var succeeded = await process.WaitAsync(TimeSpan.FromMilliseconds(program.TimeoutMilliseconds), cancellation, !retainChildren).ConfigureAwait(false) == 0;
            if (publish is not null) await publish(program.OccurrenceId, succeeded).ConfigureAwait(false);
            if (!succeeded)
                throw new IOException("maa_pretask_failed");
            if (!retainChildren) { await process.DisposeAsync().ConfigureAwait(false); preparation.Remove(process); }
        }
    }
    private async ValueTask<MaaProgramProcess> StartAsync(MaaProgramSpec program, string? identifier, CancellationToken cancellation)
    {
        cancellation.ThrowIfCancellationRequested(); RequireCurrent();
        var executable = Resolve(program.Executable); var arguments = program.Arguments.ToList();
        if (program.ScriptIndex is { } index) arguments[index] = Resolve(arguments[index]);
        var environment = EnvironmentFor(program, executable);
        MaaProgramProcess Start() { cancellation.ThrowIfCancellationRequested(); RequireCurrent(); return new(executable, arguments, directory, environment, RequireCurrent); }
        if (identifier is not null) arguments.Add(identifier);
        if (program.Options is null) return Start();
        if (program.Kind != "pretask") throw new MaaInputFailure("maa_program_secret_scope_invalid");
        using var payload = await secrets.ToJsonAsync(program.Options, program.OccurrenceId, cancellation).ConfigureAwait(false);
        MaaProgramProcess? process = null;
        payload.Use(bytes => {
            arguments.Add(new UTF8Encoding(false, true).GetString(bytes));
            try { process = Start(); }
            finally { arguments.RemoveAt(arguments.Count - 1); }
        });
        return process ?? throw new IOException("maa_program_start_failed");
    }
    private Dictionary<string, string> EnvironmentFor(MaaProgramSpec program, string executable)
    {
        var resource = plan.Resource; resource["path"] = new JsonArray(resources.Directories.Select(path => (JsonNode)JsonValue.Create(path)!).ToArray());
        var result = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase) {
            ["PI_INTERFACE_VERSION"] = "v2.10.2", ["PI_CLIENT_NAME"] = "NexusPipeline", ["PI_CLIENT_VERSION"] = "0.18.0",
            ["PI_CLIENT_MAAFW_VERSION"] = "5.14.3", ["PI_CONTROLLER"] = plan.Controller.ToJsonString(), ["PI_RESOURCE"] = resource.ToJsonString(),
            ["PYTHONIOENCODING"] = "utf-8", ["PYTHONUTF8"] = "1", ["PYTHONNOUSERSITE"] = "1", ["PYTHONDONTWRITEBYTECODE"] = "1",
            ["PYTHONPATH"] = "" };
        if (Path.GetFileNameWithoutExtension(executable).Equals("uv", StringComparison.OrdinalIgnoreCase))
        {
            var local = Path.Combine(directory, ".venv");
            _ = resources.File(Path.GetRelativePath(resources.ProjectRoot, Path.Combine(local, "Scripts/python.exe")).Replace('\\', '/'));
            result["UV_NO_SYNC"] = "1"; result["UV_OFFLINE"] = "1"; result["UV_PYTHON_DOWNLOADS"] = "never";
            result["UV_PROJECT_ENVIRONMENT"] = local; result["UV_NO_CACHE"] = "1";
        }
        return result;
    }
    private void BindLibraries(string target)
    {
        if (!libraryDirectories.Add(target)) return;
        foreach (var file in inputs.NativeFiles)
        {
            RequireCurrent(); var original = Path.Combine(inputs.NativeDirectory, file.Name);
            var path = Path.Combine(target, file.Name);
            if (path.Equals(original, StringComparison.OrdinalIgnoreCase)) continue;
            if (File.Exists(path))
            {
                var existing = resources.File(Path.GetRelativePath(resources.ProjectRoot, path).Replace('\\', '/'));
                if (existing.Bytes != file.SizeBytes || existing.Sha256 != file.Sha256)
                    throw new IOException("maa_program_native_combination_changed");
            }
            else if (!CreateHardLink(MaaNativePath.Vendor(path), MaaNativePath.Vendor(original), 0))
                throw new IOException("maa_program_native_alias_failed");
            held.File(path, file.SizeBytes, file.Sha256);
        }
    }
    private string Resolve(string path)
    {
        _ = resources.File(path);
        return MaaNativePath.Capture(Path.Combine(resources.ProjectRoot, path.Replace('/', Path.DirectorySeparatorChar)), false);
    }
    private void RequireCurrent()
    { ObjectDisposedException.ThrowIf(disposed, this); resources.RequireCurrent(); inputs.RequireCurrent(); held.RequireCurrent(); }
    public async ValueTask DisposeAsync()
    {
        if (disposed) return;
        foreach (var process in preparation) await process.DisposeAsync().ConfigureAwait(false);
        preparation.Clear(); disposed = true; held.Dispose();
    }
    [DllImport("kernel32.dll", EntryPoint = "CreateHardLinkW", CharSet = CharSet.Unicode, SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)] private static extern bool CreateHardLink(string path, string existing, nint reserved);
}
