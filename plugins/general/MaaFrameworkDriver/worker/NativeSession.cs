using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Threading.Channels;
using MaaFramework.Binding;
using NexusPipeline.Plugin.Abstractions;

namespace NexusPipeline.Plugin.MaaFrameworkDriver;

internal sealed class NativeSession : IDisposable
{
    private MaaTasker? _tasker;
    private MaaResource? _resource;
    private MaaController? _controller;
    private readonly List<MaaAgentClient> _agents = [];
    private readonly List<Process> _processes = [];
    private readonly Channel<JsonObject> _callbacks = Channel.CreateBounded<JsonObject>(new BoundedChannelOptions(1)
    { SingleReader = true, SingleWriter = false, FullMode = BoundedChannelFullMode.DropOldest });
    private bool _disposed;
    private readonly object _gate = new();
    internal string Phase { get; private set; } = "bootstrap";
    private Func<string, JsonObject, ValueTask>? _send;
    private long _callbackCount;
    private long _publishedCallbacks;
    private readonly List<Task> _outputDrains = [];
    private readonly CancellationTokenSource _outputStop = new();
    private string[] _logSecrets = [];
    private NativeLogSource? _nativeLog;
    private string _nativeLogDirectory = "";
    private string _nativeDirectory = "";

    private async ValueTask Stage(string phase, string state)
    {
        Phase = phase;
        if (_send is not null) await _send("progress", new() { ["code"] = phase + "." + state,
            ["workerPid"] = Environment.ProcessId });
    }

    internal void RequestStop()
    {
        _ = Task.Run(() => { lock (_gate) { if (!_disposed) _tasker?.Stop(); } });
    }

    internal async Task<bool> RunAsync(DriverProfile profile, CompiledProject project, JsonObject secrets,
        Func<string, JsonObject, ValueTask> send, CancellationToken token, PluginProviderLaunchTarget? hostTarget = null,
        bool initializeOnly = false, string operationId = "", string revision = "", string artifactsDirectory = "", string nonce = "")
    {
        if (!Environment.Is64BitProcess || !OperatingSystem.IsWindows()) throw new PlatformNotSupportedException();
        _send = send;
        _logSecrets = secrets.Select(pair => pair.Value?.GetValue<string>() ?? "").Append(nonce).ToArray();
        if (profile.RuntimeInputs is not null) RuntimeInputs.Verify(profile, token);
        await Stage("compiled.validate", "enter");
        if (project.SchemaVersion != 2) throw new NativeStartupException("compiled_schema");
        await Stage("compiled.validate", "exit");
        bool projectRelative = profile.NativeDirectory.StartsWith("{PROJECT_DIR}/", StringComparison.Ordinal)
            || profile.NativeDirectory.StartsWith("{PROJECT_DIR}\\", StringComparison.Ordinal);
        string native = ProjectCompiler.ResolveScopedPath(profile.PackageRoot,
            projectRelative ? project.InterfaceDirectory : profile.PackageRoot,
            projectRelative ? profile.NativeDirectory[14..] : profile.NativeDirectory);
        await Stage("native.load", "enter");
        ConfigureNative(native);
        _nativeDirectory = native;
        foreach (string module in new[] { "MaaFramework.dll", "MaaToolkit.dll", "MaaAgentClient.dll" })
        {
            using var bytes = File.OpenRead(Path.Combine(native, module));
            await send("progress", new() { ["code"] = "native.module", ["module"] = module,
                ["sha256"] = Convert.ToHexString(System.Security.Cryptography.SHA256.HashData(bytes)).ToLowerInvariant() });
        }
        NativeBindingContext.AppendNativeLibrarySearchPaths([native]);
        Environment.SetEnvironmentVariable("MAAFW_BINARY_PATH", native);
        if (!Path.IsPathFullyQualified(artifactsDirectory) || !Directory.Exists(artifactsDirectory))
            throw new NativeStartupException("log_session_directory_missing");
        _nativeLogDirectory = Path.Combine(artifactsDirectory, "native");
        if (Directory.Exists(_nativeLogDirectory) || File.Exists(_nativeLogDirectory)) throw new NativeStartupException("log_session_directory_exists");
        Directory.CreateDirectory(_nativeLogDirectory);
        if (!MaaGlobal.Shared.SetOption_LogDir(_nativeLogDirectory)) throw new NativeStartupException("log_directory_rejected");
        _nativeLog = new NativeLogSource(_nativeLogDirectory, send, _logSecrets); _nativeLog.Start();
        string version = NativeBindingContext.LibraryVersion;
        await Stage("native.load", "exit");
        if (!Version.TryParse(version.TrimStart('v'), out var observed) || observed.Major != 5)
            throw new NativeStartupException("native_abi_unsupported");
        if (profile.NativeVersion.Length != 0 && version.TrimStart('v') != profile.NativeVersion.TrimStart('v'))
            throw new NativeStartupException("native_version_changed");
        MaaGlobal.Shared.SetOption_StdoutLevel(LoggingLevel.Off);
        foreach (var pretask in project.Pretasks)
        {
            token.ThrowIfCancellationRequested();
            await Stage("pretask.process", "enter");
            Process process = Start(pretask, project, profile, version, secrets, null);
            _processes.Add(process);
            using var deadline = CancellationTokenSource.CreateLinkedTokenSource(token);
            deadline.CancelAfter(TimeSpan.FromMilliseconds(pretask.TimeoutMilliseconds));
            try { await process.WaitForExitAsync(deadline.Token); }
            catch (OperationCanceledException) when (!token.IsCancellationRequested) { throw new TimeoutException("pretask timeout"); }
            if (process.ExitCode != 0) throw new InvalidDataException("pretask failed");
            await Stage("pretask.process", "exit");
        }
        token.ThrowIfCancellationRequested();
        await Stage("resource.load", "enter");
        MaaResource resource = _resource = new();
        foreach (string action in project.Tasks.Select(task => task.GuiAction).Where(name => name.Length != 0).Distinct(StringComparer.Ordinal))
            if (!GuiWaitActions.Supports(action) || !resource.Register(new GuiWaitAction(action, token)))
                throw new NativeStartupException("gui_action_registration_failed");
        for (int i = 0; i < project.ResourcePaths.Length; i++)
        {
            resource.AppendBundle(project.ResourcePaths[i]).Wait().ThrowIfNot(MaaJobStatus.Succeeded);
            if (i + 1 == project.BaseResourceCount && project.ResourceHashes.Length > 0
                && !project.ResourceHashes.Contains(resource.Hash, StringComparer.OrdinalIgnoreCase))
                await send("progress", new() { ["code"] = "resource.hash_mismatch" });
        }
        await Stage("resource.load", "exit");
        if (project.Controller["type"]!.GetValue<string>() == "Win32")
        {
            await Stage("controller.resolve", "enter");
            profile = await WindowDiscovery.ResolveAsync(profile, project.Controller, hostTarget, token);
            await Stage("controller.resolve", "exit");
        }
        await Stage("controller.create", "enter");
        MaaController controller = _controller = CreateController(profile, project);
        if (!controller.IsConnected) throw new NativeStartupException("controller_connection_failed");
        await Stage("controller.create", "exit");
        _tasker = new MaaTasker { Resource = resource, Controller = controller, DisposeOptions = DisposeOptions.None };
        foreach (var definition in project.Agents)
        {
            token.ThrowIfCancellationRequested();
            await Stage("agent.client.create", "enter");
            var agent = string.IsNullOrEmpty(definition.Identifier) ? MaaAgentClient.Create(resource)
                : MaaAgentClient.Create(definition.Identifier, resource);
            _agents.Add(agent);
            await Stage("agent.client.create", "exit");
            agent.SetTimeout(definition.TimeoutMilliseconds);
            await Stage("agent.process.start", "enter");
            var process = Start(definition, project, profile, version, secrets, agent.Id);
            _processes.Add(process);
            await Stage("agent.process.start", "exit");
            await Stage("agent.connect", "enter");
            if (!await agent.LinkStartUnlessProcessExit(process, token) || !agent.IsConnected)
                throw new NativeStartupException("agent_connection_failed");
            await Stage("agent.connect", "exit");
        }
        if (!_tasker.IsInitialized) throw new NativeStartupException("tasker_initialization_failed");
        if (initializeOnly)
        {
            token.ThrowIfCancellationRequested();
            await send("ready", new() { ["nativeVersion"] = version, ["projectVersion"] = project.Version });
            await send("progress", new() { ["code"] = "initialization.completed", ["operationId"] = operationId,
                ["revision"] = revision, ["fingerprint"] = project.ExecutionFingerprint,
                ["nativeVersion"] = version, ["projectVersion"] = project.Version, ["formalTasksSubmitted"] = 0 });
            return true;
        }
        _tasker.Callback += OnCallback;
        using var callbackStop = new CancellationTokenSource();
        Task drain = Task.Run(async () =>
        {
            await foreach (var next in _callbacks.Reader.ReadAllAsync(callbackStop.Token))
            {
                var fact = next;
                await Task.Delay(250, callbackStop.Token);
                while (_callbacks.Reader.TryRead(out var latest)) fact = latest;
                await send("progress", fact);
                Interlocked.Increment(ref _publishedCallbacks);
            }
        });
        await send("ready", new() { ["nativeVersion"] = version, ["projectVersion"] = project.Version });
        try
        {
            foreach (var task in project.Tasks)
            {
                token.ThrowIfCancellationRequested();
                await Stage("agent.health", "enter");
                if (_agents.Any(agent => !agent.IsAlive)) throw new NativeStartupException("agent_disconnected");
                var pipeline = ResolveSecrets(task.Override, secrets)!.AsObject();
                await Stage("task.submit", "enter");
                var job = _tasker.AppendTask(task.Entry, pipeline.ToJsonString());
                await send("task_event", new() { ["taskId"] = task.Id, ["status"] = "running", ["nativeTaskId"] = job.Id.ToString() });
                MaaJobStatus status = await Task.Run(() => job.Wait(), CancellationToken.None).WaitAsync(token);
                await Stage("task.complete", "exit");
                token.ThrowIfCancellationRequested();
                if (status is not (MaaJobStatus.Succeeded or MaaJobStatus.Failed))
                    throw new NativeStartupException("task_terminal_unknown");
                await send("task_event", new() { ["taskId"] = task.Id,
                    ["status"] = status == MaaJobStatus.Succeeded ? "succeeded" : "failed", ["nativeTaskId"] = job.Id.ToString(), ["nativeStatus"] = status.ToString() });
                if (status == MaaJobStatus.Failed) return false;
            }
            return true;
        }
        finally
        {
            _tasker.Callback -= OnCallback;
            _callbacks.Writer.TryComplete();
            try { await drain.WaitAsync(TimeSpan.FromSeconds(2)); }
            catch (TimeoutException) { callbackStop.Cancel(); }
            catch (OperationCanceledException) when (callbackStop.IsCancellationRequested) { }
            await send("progress", new() { ["code"] = "native.callbacks.summary",
                ["received"] = Interlocked.Read(ref _callbackCount), ["published"] = Interlocked.Read(ref _publishedCallbacks) });
        }
    }

    private void OnCallback(object? sender, MaaCallbackEventArgs args)
    {
        // Copy only bounded, non-sensitive diagnostics. Focus/node text is never a task terminal.
        Interlocked.Increment(ref _callbackCount);
        _callbacks.Writer.TryWrite(NativeDiagnosticProjection.Project(args.Message, args.Details));
    }

    private static MaaController CreateController(DriverProfile profile, CompiledProject project)
    {
        string type = project.Controller["type"]!.GetValue<string>();
        MaaController controller;
        if (type == "Adb")
        {
            var device = MaaToolkit.Shared.AdbDevice.Find(profile.AdbPath)
                .SingleOrDefault(item => item.AdbSerial == profile.AdbSerial) ?? throw new InvalidDataException("adb target unavailable");
            controller = device.ToAdbControllerWith();
        }
        else
        {
            nint handle = (nint)profile.WindowHandle;
            if (handle == 0 || !IsWindow(handle) || GetWindowThreadProcessId(handle, out uint pid) == 0
                || pid != profile.WindowProcessId) throw new NativeStartupException("window_identity_changed");
            var selected = WindowDiscovery.Find(project.Controller).OfType<JsonObject>().SingleOrDefault(window =>
                window["handle"]!.GetValue<long>() == profile.WindowHandle && window["pid"]!.GetValue<int>() == profile.WindowProcessId)
                ?? throw new NativeStartupException("window_filter_changed");
            if (profile.WindowStartedAtUtc is null || DateTime.Parse(selected["startedAtUtc"]!.GetValue<string>(),
                    System.Globalization.CultureInfo.InvariantCulture, System.Globalization.DateTimeStyles.RoundtripKind) != profile.WindowStartedAtUtc
                || !string.Equals(selected["executable"]!.GetValue<string>(), profile.WindowExecutable, StringComparison.OrdinalIgnoreCase))
                throw new NativeStartupException("window_executable_changed");
            var win = project.Controller["win32"] as JsonObject ?? new();
            T Method<T>(string field, T fallback) where T : struct, Enum => win[field] is null ? fallback
                : Enum.TryParse<T>(win[field]!.GetValue<string>(), true, out var value) ? value : throw new InvalidDataException("unsupported controller method");
            controller = new MaaWin32Controller(handle, Method("screencap", Win32ScreencapMethods.FramePool),
                Method("mouse", Win32InputMethod.SendMessage), Method("keyboard", Win32InputMethod.SendMessage));
        }
        bool configured;
        if (project.Controller["display_raw"]?.GetValue<bool>() == true)
            configured = controller.SetOption_ScreenshotUseRawSize(true);
        else if (project.Controller["display_expand"] is JsonArray expand)
        {
            // v5.14 adds option 8 (int32_t[2]); binding 5.10's typed switch
            // cannot express it. Use that binding's public C ABI declaration.
            byte[] dimensions = new byte[8];
            System.Buffers.Binary.BinaryPrimitives.WriteInt32LittleEndian(dimensions, expand[0]!.GetValue<int>());
            System.Buffers.Binary.BinaryPrimitives.WriteInt32LittleEndian(dimensions.AsSpan(4), expand[1]!.GetValue<int>());
            configured = MaaFramework.Binding.Interop.Native.MaaController.MaaControllerSetOption(controller.Handle, 8, dimensions, 8);
        }
        else if (project.Controller["display_long_side"] is JsonValue longSide)
            configured = controller.SetOption_ScreenshotTargetLongSide(longSide.GetValue<int>());
        else
            configured = controller.SetOption_ScreenshotTargetShortSide(project.Controller["display_short_side"]?.GetValue<int>() ?? 720);
        if (!configured) { controller.Dispose(); throw new NativeStartupException("controller_display_rejected"); }
        return controller;
    }

    private Process Start(CompiledProgram definition, CompiledProject project, DriverProfile profile,
        string nativeVersion, JsonObject secrets, string? identifier)
    {
        var psi = new ProcessStartInfo(definition.Executable) { UseShellExecute = false,
            CreateNoWindow = true, WorkingDirectory = project.InterfaceDirectory,
            RedirectStandardOutput = true, RedirectStandardError = true };
        foreach (string arg in definition.Arguments)
        {
            psi.ArgumentList.Add(arg);
        }
        if (definition.GeneratedOptionPayload is not null)
            psi.ArgumentList.Add(ResolveSecrets(definition.GeneratedOptionPayload, secrets)!.ToJsonString());
        if (identifier is not null) psi.ArgumentList.Add(identifier);
        if (Path.GetFileNameWithoutExtension(definition.Executable).Equals("uv", StringComparison.OrdinalIgnoreCase))
        {
            // The approved distribution owns its environment; execution must not resolve or download new code.
            psi.Environment["UV_NO_SYNC"] = "1";
            psi.Environment["UV_OFFLINE"] = "1";
            psi.Environment["UV_PROJECT_ENVIRONMENT"] = Path.Combine(project.InterfaceDirectory, ".venv");
        }
        psi.Environment["PI_INTERFACE_VERSION"] = "v2.10.2";
        psi.Environment["PI_CLIENT_NAME"] = "NexusPipeline"; psi.Environment["PI_CLIENT_VERSION"] = "v0.17.3";
        psi.Environment["PI_CLIENT_LANGUAGE"] = profile.Language; psi.Environment["PI_CLIENT_MAAFW_VERSION"] = nativeVersion;
        psi.Environment["PI_VERSION"] = project.Version;
        // Native DLL search registrations are local to the worker; external C++ Agents need the verified directory too.
        psi.Environment["PATH"] = _nativeDirectory + Path.PathSeparator + psi.Environment["PATH"];
        psi.Environment["PI_CONTROLLER"] = project.Controller.ToJsonString(); psi.Environment["PI_RESOURCE"] = project.Resource.ToJsonString();
        if (psi.Environment.Values.Any(value => value?.Length > 32760)) throw new InvalidDataException("environment too large");
        var process = Process.Start(psi) ?? throw new InvalidOperationException("project program start failed");
        _outputDrains.Add(PumpOutput(process.StandardOutput));
        _outputDrains.Add(PumpOutput(process.StandardError));
        return process;
    }

    private async Task PumpOutput(StreamReader stream)
    {
        char[] block = new char[1024];
        var text = new LogTextFramer(value => _send!("log", new() { ["text"] = value }), _logSecrets);
        try
        {
            while (true)
            {
                int count = await stream.ReadAsync(block.AsMemory(), _outputStop.Token);
                if (count == 0) break;
                await text.AppendAsync(new string(block, 0, count));
            }
        }
        catch (Exception ex) when (ex is IOException or ObjectDisposedException
            || ex is OperationCanceledException && _outputStop.IsCancellationRequested) { }
        finally { await text.AppendAsync("", complete: true); }
    }

    private static JsonNode? ResolveSecrets(JsonNode? node, JsonObject secrets)
    {
        if (node is JsonObject obj) return new JsonObject(obj.Select(pair => new KeyValuePair<string, JsonNode?>(pair.Key, ResolveSecrets(pair.Value, secrets))));
        if (node is JsonArray array) return new JsonArray(array.Select(item => ResolveSecrets(item, secrets)).ToArray());
        if (node is JsonValue value && value.TryGetValue<string>(out string? text) && text.StartsWith("secret:", StringComparison.Ordinal))
            return secrets[text]?.DeepClone() ?? throw new InvalidDataException("secret missing");
        return node?.DeepClone();
    }

    internal async ValueTask CloseAsync()
    {
        if (_disposed) return;
        await Stage("session.cleanup", "enter");
        Dispose();
        _outputStop.Cancel();
        try { await Task.WhenAll(_outputDrains).WaitAsync(TimeSpan.FromSeconds(2)); }
        catch (TimeoutException) { throw new NativeStartupException("log_cleanup_unconfirmed"); }
        if (_nativeLog is not null)
        {
            // Reopening the same session log flushes the native stream; Host removes it after process exit.
            MaaGlobal.Shared.SetOption_LogDir(_nativeLogDirectory);
            await _nativeLog.CompleteAsync(); _nativeLog = null;
        }
        await Stage("session.cleanup", "exit");
    }

    public void Dispose()
    {
        lock (_gate)
        {
            if (_disposed) return;
            foreach (var agent in _agents) { agent.LinkStop(); agent.Dispose(); }
            _tasker?.Dispose(); _controller?.Dispose(); _resource?.Dispose(); _disposed = true;
            long stopped = Stopwatch.GetTimestamp();
            foreach (var process in _processes)
            {
                try
                {
                    int remaining = Math.Max(0, 2000 - (int)Stopwatch.GetElapsedTime(stopped).TotalMilliseconds);
                    if (!process.HasExited && !process.WaitForExit(remaining))
                    {
                        process.Kill();
                        if (!process.WaitForExit(2000)) throw new NativeStartupException("process_stop_unconfirmed");
                    }
                }
                catch (InvalidOperationException) { }
                finally { process.Dispose(); }
            }
        }
    }

    private static void ConfigureNative(string root)
    {
        if (!SetDefaultDllDirectories(0xC00) || AddDllDirectory(root) == 0) throw new InvalidOperationException("native search setup");
        foreach (string name in new[] { "MaaFramework", "MaaToolkit", "MaaAgentClient" })
        {
            string path = Path.Combine(root, name + ".dll");
            using var stream = File.OpenRead(path); using var reader = new BinaryReader(stream);
            stream.Position = 0x3c; int offset = reader.ReadInt32(); stream.Position = offset;
            if (reader.ReadUInt32() != 0x4550 || reader.ReadUInt16() != 0x8664) throw new BadImageFormatException("x64 required");
            nint library = LoadLibraryEx(path, 0, 0xD00);
            if (library == 0) throw new DllNotFoundException(name);
            if (name == "MaaFramework")
                foreach (string export in new[] { "MaaTaskerCreate", "MaaTaskerPostTask", "MaaTaskerAddSink", "MaaTaskerPostStop", "MaaResourceCreate", "MaaWin32ControllerCreate", "MaaAdbControllerCreate" })
                    if (NativeLibrary.GetExport(library, export) == 0) throw new EntryPointNotFoundException(export);
        }
    }

    [DllImport("kernel32.dll", SetLastError = true)] [return: MarshalAs(UnmanagedType.Bool)] private static extern bool SetDefaultDllDirectories(uint flags);
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)] private static extern nint AddDllDirectory(string path);
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)] private static extern nint LoadLibraryEx(string path, nint file, uint flags);
    [DllImport("user32.dll")] [return: MarshalAs(UnmanagedType.Bool)] private static extern bool IsWindow(nint window);
    [DllImport("user32.dll")] private static extern uint GetWindowThreadProcessId(nint window, out uint pid);
}
