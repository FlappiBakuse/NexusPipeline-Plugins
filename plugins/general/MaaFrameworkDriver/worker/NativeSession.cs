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

    internal async Task RunAsync(DriverProfile profile, CompiledProject project, JsonObject secrets,
        Func<string, JsonObject, ValueTask> send, CancellationToken token, PluginProviderLaunchTarget? hostTarget = null)
    {
        if (!Environment.Is64BitProcess || !OperatingSystem.IsWindows()) throw new PlatformNotSupportedException();
        _send = send;
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
        foreach (string module in new[] { "MaaFramework.dll", "MaaToolkit.dll", "MaaAgentClient.dll" })
        {
            using var bytes = File.OpenRead(Path.Combine(native, module));
            await send("progress", new() { ["code"] = "native.module", ["module"] = module,
                ["sha256"] = Convert.ToHexString(System.Security.Cryptography.SHA256.HashData(bytes)).ToLowerInvariant() });
        }
        NativeBindingContext.AppendNativeLibrarySearchPaths([native]);
        Environment.SetEnvironmentVariable("MAAFW_BINARY_PATH", native);
        string version = NativeBindingContext.LibraryVersion;
        await Stage("native.load", "exit");
        if (version.TrimStart('v') != profile.NativeVersion.TrimStart('v')) throw new NativeStartupException("native_version_changed");
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
            _processes.Remove(process); process.Dispose();
            await Stage("pretask.process", "exit");
        }
        token.ThrowIfCancellationRequested();
        await Stage("resource.load", "enter");
        MaaResource resource = _resource = new();
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
                await send("task_event", new() { ["taskId"] = task.Name, ["status"] = "running", ["nativeTaskId"] = job.Id.ToString() });
                MaaJobStatus status = await Task.Run(() => job.Wait(), CancellationToken.None).WaitAsync(token);
                await Stage("task.complete", "exit");
                await send("task_event", new() { ["taskId"] = task.Name,
                    ["status"] = status == MaaJobStatus.Succeeded ? "succeeded" : "failed", ["nativeTaskId"] = job.Id.ToString(), ["nativeStatus"] = status.ToString() });
                if (status != MaaJobStatus.Succeeded) throw new InvalidDataException("native task failed");
            }
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
            using Process process = Process.GetProcessById((int)pid);
            if (profile.WindowStartedAtUtc is null || process.StartTime.ToUniversalTime() != profile.WindowStartedAtUtc
                || !string.Equals(process.MainModule?.FileName, profile.WindowExecutable, StringComparison.OrdinalIgnoreCase))
                throw new NativeStartupException("window_executable_changed");
            if (!WindowDiscovery.Find(project.Controller).OfType<JsonObject>().Any(window =>
                window["handle"]!.GetValue<long>() == profile.WindowHandle && window["pid"]!.GetValue<int>() == profile.WindowProcessId))
                throw new NativeStartupException("window_filter_changed");
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

    private static Process Start(CompiledProgram definition, CompiledProject project, DriverProfile profile,
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
        psi.Environment["PI_INTERFACE_VERSION"] = "v2.10.2";
        psi.Environment["PI_CLIENT_NAME"] = "NexusPipeline"; psi.Environment["PI_CLIENT_VERSION"] = "v0.16.9";
        psi.Environment["PI_CLIENT_LANGUAGE"] = profile.Language; psi.Environment["PI_CLIENT_MAAFW_VERSION"] = nativeVersion;
        psi.Environment["PI_VERSION"] = project.Version;
        psi.Environment["PI_CONTROLLER"] = project.Controller.ToJsonString(); psi.Environment["PI_RESOURCE"] = project.Resource.ToJsonString();
        if (psi.Environment.Values.Any(value => value?.Length > 32760)) throw new InvalidDataException("environment too large");
        var process = Process.Start(psi) ?? throw new InvalidOperationException("project program start failed");
        // A project program may echo passwords. Consume its output without forwarding it.
        // Read streams independently: a launched target can inherit a pipe after
        // its pretask exits, so EOF is not the pretask process lifetime.
        _ = Discard(process.StandardOutput.BaseStream);
        _ = Discard(process.StandardError.BaseStream);
        return process;
    }

    private static async Task Discard(Stream stream)
    {
        byte[] block = new byte[4096];
        try { while (await stream.ReadAsync(block) != 0) { } }
        catch (Exception ex) when (ex is IOException or ObjectDisposedException) { }
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
