using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Threading.Channels;
using MaaFramework.Binding;

namespace NexusPipeline.Plugin.MaaFrameworkDriver;

internal sealed class NativeSession : IDisposable
{
    private MaaTasker? _tasker;
    private MaaResource? _resource;
    private MaaController? _controller;
    private readonly List<MaaAgentClient> _agents = [];
    private readonly List<Process> _processes = [];
    private readonly Channel<JsonObject> _callbacks = Channel.CreateBounded<JsonObject>(new BoundedChannelOptions(1024)
    { SingleReader = true, SingleWriter = false, FullMode = BoundedChannelFullMode.Wait });
    private int _callbackBytes;
    private int _gap;
    private bool _disposed;
    private readonly object _gate = new();

    internal void RequestStop()
    {
        _ = Task.Run(() => { lock (_gate) { if (!_disposed) _tasker?.Stop(); } });
    }

    internal async Task RunAsync(DriverProfile profile, CompiledProject project, JsonObject secrets,
        Func<string, JsonObject, ValueTask> send, CancellationToken token)
    {
        if (!Environment.Is64BitProcess || !OperatingSystem.IsWindows()) throw new PlatformNotSupportedException();
        string native = new ProjectCompiler(profile.PackageRoot, profile.InterfacePath, profile.Language)
            .Scope(profile.PackageRoot, profile.NativeDirectory);
        ConfigureNative(native);
        NativeBindingContext.AppendNativeLibrarySearchPaths([native]);
        Environment.SetEnvironmentVariable("MAAFW_BINARY_PATH", native);
        string version = NativeBindingContext.LibraryVersion;
        if (version.TrimStart('v') != profile.NativeVersion.TrimStart('v')) throw new NativeStartupException("native_version_changed");
        MaaGlobal.Shared.SetOption_StdoutLevel(LoggingLevel.Off);
        foreach (var pretask in project.Pretasks)
        {
            token.ThrowIfCancellationRequested();
            Process process = Start(pretask, project, profile, version, secrets, null);
            _processes.Add(process);
            using var deadline = CancellationTokenSource.CreateLinkedTokenSource(token);
            deadline.CancelAfter(TimeSpan.FromMilliseconds(pretask.TimeoutMilliseconds));
            try { await process.WaitForExitAsync(deadline.Token); }
            catch (OperationCanceledException) when (!token.IsCancellationRequested) { throw new TimeoutException("pretask timeout"); }
            if (process.ExitCode != 0) throw new InvalidDataException("pretask failed");
            _processes.Remove(process); process.Dispose();
        }
        token.ThrowIfCancellationRequested();
        MaaResource resource = _resource = new();
        for (int i = 0; i < project.ResourcePaths.Length; i++)
        {
            resource.AppendBundle(project.ResourcePaths[i]).Wait().ThrowIfNot(MaaJobStatus.Succeeded);
            if (i + 1 == project.BaseResourceCount && project.ResourceHashes.Length > 0
                && !project.ResourceHashes.Contains(resource.Hash, StringComparer.OrdinalIgnoreCase))
                await send("progress", new() { ["code"] = "resource.hash_mismatch" });
        }
        MaaController controller = _controller = CreateController(profile, project);
        _tasker = new MaaTasker { Resource = resource, Controller = controller, DisposeOptions = DisposeOptions.None };
        foreach (var definition in project.Agents)
        {
            token.ThrowIfCancellationRequested();
            var agent = string.IsNullOrEmpty(definition.Identifier) ? MaaAgentClient.Create(resource)
                : MaaAgentClient.Create(definition.Identifier, resource);
            _agents.Add(agent);
            agent.SetTimeout(definition.TimeoutMilliseconds);
            var process = Start(definition, project, profile, version, secrets, agent.Id);
            _processes.Add(process);
            if (!await agent.LinkStartUnlessProcessExit(process, token) || !agent.IsConnected)
                throw new NativeStartupException("agent_connection_failed");
        }
        if (!_tasker.IsInitialized) throw new NativeStartupException("tasker_initialization_failed");
        _tasker.Callback += OnCallback;
        using var callbackStop = new CancellationTokenSource();
        Task drain = Task.Run(async () =>
        {
            await foreach (var fact in _callbacks.Reader.ReadAllAsync(callbackStop.Token))
            {
                Interlocked.Add(ref _callbackBytes, -System.Text.Encoding.UTF8.GetByteCount(fact.ToJsonString()));
                await send("progress", fact);
            }
        });
        await send("ready", new() { ["nativeVersion"] = version, ["projectVersion"] = project.Version });
        try
        {
            foreach (var task in project.Tasks)
            {
                token.ThrowIfCancellationRequested();
                if (_agents.Any(agent => !agent.IsAlive)) throw new InvalidDataException("agent disconnected");
                var pipeline = ResolveSecrets(task.Override, secrets)!.AsObject();
                var job = _tasker.AppendTask(task.Entry, pipeline.ToJsonString());
                await send("task_event", new() { ["taskId"] = task.Name, ["status"] = "running", ["nativeTaskId"] = job.Id.ToString() });
                MaaJobStatus status = await Task.Run(() => job.Wait(), CancellationToken.None).WaitAsync(token);
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
            catch (TimeoutException) { callbackStop.Cancel(); Interlocked.Exchange(ref _gap, 1); }
        }
        if (_gap != 0) throw new InvalidDataException("callback gap");
    }

    private void OnCallback(object? sender, MaaCallbackEventArgs args)
    {
        // Copy only bounded, non-sensitive diagnostics. Focus/node text is never a task terminal.
        var fact = new JsonObject { ["message"] = args.Message };
        if (args.Details.Length <= 64 * 1024)
        {
            try
            {
                using var detail = JsonDocument.Parse(args.Details, new JsonDocumentOptions { MaxDepth = 16 });
                foreach (string key in new[] { "task_id", "node_id", "reco_id", "action_id" })
                    if (detail.RootElement.TryGetProperty(key, out var value) && value.TryGetInt64(out long id)) fact[key] = id;
            }
            catch (JsonException) { Interlocked.Exchange(ref _gap, 1); }
        }
        else Interlocked.Exchange(ref _gap, 1);
        int size = System.Text.Encoding.UTF8.GetByteCount(fact.ToJsonString());
        if (size > 1024 * 1024 || Interlocked.Add(ref _callbackBytes, size) > 8 * 1024 * 1024)
        { Interlocked.Add(ref _callbackBytes, -size); Interlocked.Exchange(ref _gap, 1); return; }
        if (!_callbacks.Writer.TryWrite(fact)) { Interlocked.Add(ref _callbackBytes, -size); Interlocked.Exchange(ref _gap, 1); }
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
            string effective = arg.StartsWith('{') ? ResolveSecrets(JsonNode.Parse(arg), secrets)!.ToJsonString() : arg;
            psi.ArgumentList.Add(effective);
        }
        if (identifier is not null) psi.ArgumentList.Add(identifier);
        psi.Environment["PI_INTERFACE_VERSION"] = "v2.10.2";
        psi.Environment["PI_CLIENT_NAME"] = "NexusPipeline"; psi.Environment["PI_CLIENT_VERSION"] = "v0.16.9";
        psi.Environment["PI_CLIENT_LANGUAGE"] = profile.Language; psi.Environment["PI_CLIENT_MAAFW_VERSION"] = nativeVersion;
        psi.Environment["PI_VERSION"] = project.Version;
        psi.Environment["PI_CONTROLLER"] = project.Controller.ToJsonString(); psi.Environment["PI_RESOURCE"] = project.Resource.ToJsonString();
        if (psi.Environment.Values.Any(value => value?.Length > 32760)) throw new InvalidDataException("environment too large");
        var process = Process.Start(psi) ?? throw new InvalidOperationException("project program start failed");
        // A project program may echo passwords. Consume its output without forwarding it.
        process.OutputDataReceived += (_, _) => { }; process.ErrorDataReceived += (_, _) => { };
        process.BeginOutputReadLine(); process.BeginErrorReadLine(); return process;
    }

    private static JsonNode? ResolveSecrets(JsonNode? node, JsonObject secrets)
    {
        if (node is JsonObject obj) return new JsonObject(obj.Select(pair => new KeyValuePair<string, JsonNode?>(pair.Key, ResolveSecrets(pair.Value, secrets))));
        if (node is JsonArray array) return new JsonArray(array.Select(item => ResolveSecrets(item, secrets)).ToArray());
        if (node is JsonValue value && value.TryGetValue<string>(out string? text) && text.StartsWith("secret:", StringComparison.Ordinal))
            return secrets[text]?.DeepClone() ?? throw new InvalidDataException("secret missing");
        return node?.DeepClone();
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
                    if (!process.HasExited && !process.WaitForExit(remaining)) process.Kill();
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
