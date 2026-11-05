using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;

namespace NexusPipeline.Extensions.MaaFramework;

internal sealed class MaaTaskSession : IAsyncDisposable
{
    private readonly object gate = new(), nativeGate = new();
    private readonly IMaaSessionInputs inputs;
    private readonly IMaaController controllerPort;
    private readonly IMaaOutputScope? outputScope;
    private readonly MaaAgentSession? agents;
    private readonly Func<MaaSessionItem, CancellationToken, ValueTask<MaaTaskPayload>>? payloadFactory;
    private readonly TimeProvider clock;
    private readonly string? outputRoot;
    private readonly TimeSpan operationTimeout, stopTimeout;
    private readonly string library, logDirectory;
    private readonly string[] resources;
    private readonly CancellationTokenSource stopping = new();
    private readonly List<MaaNativeTaskFact> facts = [];
    private readonly List<long> resourceOperations = [];
    private Task? active, stopTask;
    private MaaNative? native;
    private MaaControllerBridge? callbacks;
    private MaaWaitBridge? waits;
    private nint resource, controller, tasker;
    private long connection, activeTask, stopId, sink;
    private GCHandle retention;
    private bool initialized, runIssued, closing, cleaned;
    private static int runtimeOwner;
    private bool ownsRuntime;
    internal bool IsDrained { get { lock (gate) return cleaned; } }
    internal long StopTaskId => Interlocked.Read(ref stopId);
    internal MaaNativeTaskFact[] Facts { get { lock (gate) return facts.ToArray(); } }
    internal MaaNativeEvent[] Events => callbacks?.Events ?? [];
    internal int DroppedEvents => callbacks?.DroppedEvents ?? 0;
    internal int AcceptedWaits => waits?.Accepted ?? 0;
    internal MaaOutputSnapshot? Outputs { get; private set; }

    internal MaaTaskSession(IMaaSessionInputs inputs, IMaaController controllerPort, TimeSpan operationTimeout, TimeSpan stopTimeout,
        IMaaOutputScope? outputScope = null, TimeProvider? clock = null,
        Func<MaaSessionItem, CancellationToken, ValueTask<MaaTaskPayload>>? payloadFactory = null, MaaAgentSession? agents = null)
    {
        if (operationTimeout <= TimeSpan.Zero || operationTimeout > TimeSpan.FromDays(1) || stopTimeout <= TimeSpan.Zero || stopTimeout > TimeSpan.FromSeconds(60))
            throw new ArgumentOutOfRangeException(nameof(operationTimeout));
        this.inputs = inputs; this.controllerPort = controllerPort; this.operationTimeout = operationTimeout; this.stopTimeout = stopTimeout;
        this.clock = clock ?? TimeProvider.System;
        this.payloadFactory = payloadFactory;
        this.agents = agents;
        this.outputScope = outputScope; outputRoot = outputScope is null ? null : MaaNativePath.Capture(outputScope.Root, true);
        RequireCurrent(); library = MaaNativePath.Capture(inputs.RuntimeLibrary, false); logDirectory = MaaNativePath.Capture(inputs.LogDirectory, true);
        resources = inputs.ResourceDirectories.Select(path => MaaNativePath.Capture(path, true)).ToArray();
        if (resources.Length is < 1 or > 8 || resources.Distinct(StringComparer.OrdinalIgnoreCase).Count() != resources.Length) throw new IOException("maa_resource_roots_invalid");
    }
    internal async Task InitializeAsync(CancellationToken cancellation)
    {
        await GuardAsync(Start(() => InitializeCore(cancellation), false)).ConfigureAwait(false);
    }
    internal async Task<IReadOnlyList<MaaNativeTaskFact>> RunAsync(IReadOnlyList<MaaSessionTask> tasks, CancellationToken cancellation)
    {
        RequireCurrent(); var plan = MaaSessionPlan.Freeze(tasks, outputScope is not null);
        await GuardAsync(Start(() => RunCore(plan, cancellation), true)).ConfigureAwait(false);
        return Facts;
    }
    private Task Start(Func<Task> operation, bool run)
    {
        lock (gate)
        {
            ObjectDisposedException.ThrowIf(closing || cleaned, this);
            if (active is { IsCompleted: false }) throw new IOException("maa_session_operation_active");
            if (run ? !initialized || runIssued : initialized || native is not null) throw new IOException("maa_session_phase_invalid");
            if (run) runIssued = true;
            active = Task.Run(operation); return active;
        }
    }
    private async Task GuardAsync(Task operation)
    {
        try { await operation.ConfigureAwait(false); }
        catch (Exception failure)
        {
            try { await StopAsync().ConfigureAwait(false); }
            catch (Exception cleanup) { throw new AggregateException("maa_session_cleanup_unverified", failure, cleanup); }
            throw;
        }
    }
    private async Task InitializeCore(CancellationToken cancellation)
    {
        using var linked = CancellationTokenSource.CreateLinkedTokenSource(cancellation, stopping.Token);
        var token = linked.Token; token.ThrowIfCancellationRequested(); RequireCurrent();
        MaaPipelineGuard.CheckResources(resources, RequireCurrent, outputScope is not null);
        if (Interlocked.CompareExchange(ref runtimeOwner, 1, 0) != 0) throw new IOException("maa_worker_runtime_busy");
        ownsRuntime = true; retention = GCHandle.Alloc(this);
        var timer = Stopwatch.StartNew();
        lock (nativeGate)
        {
            ThrowStopping();
            native = MaaNative.Load(library, inputs.RuntimeSha256, inputs.ControllerSha256);
            if (Marshal.PtrToStringUTF8(native.MaaVersion()) is not ("v5.14.3" or "5.14.3")) throw new IOException("maa_runtime_version_unverified");
            // Vendor info logs include pipeline inputs; the worker exposes only filtered task facts.
            Require(native.MaaGlobalSetOption(1, [], 0) != 0 && native.MaaGlobalSetOption(4, BitConverter.GetBytes(0), 4) != 0 &&
                native.MaaGlobalSetOption(2, [0], 1) != 0 && native.MaaGlobalSetOption(6, [0], 1) != 0 &&
                native.MaaGlobalSetOption(7, [0], 1) != 0, "maa_logging_policy_rejected");
            resource = native.MaaResourceCreate(); Require(resource != 0, "maa_resource_create_failed");
            waits = new(native, resource, stopping.Token, RequireCurrent, clock);
            waits.Register();
        }
        foreach (var path in resources)
        {
            token.ThrowIfCancellationRequested(); RequireCurrent();
            long id;
            lock (nativeGate) { ThrowStopping(); id = native.MaaResourcePostBundle(resource, MaaNativePath.Vendor(path)); if (id > 0) resourceOperations.Add(id); }
            Require(id > 0, "maa_resource_not_accepted");
            var status = await WaitAsync(() => native.MaaResourceStatus(resource, id), timer, token).ConfigureAwait(false);
            Require(status == 3000 && native.MaaResourceLoaded(resource) != 0, "maa_resource_load_failed");
            lock (nativeGate) resourceOperations.Remove(id);
        }
        token.ThrowIfCancellationRequested(); RequireCurrent();
        lock (nativeGate)
        {
            ThrowStopping();
            new MaaNativeQueries(native).CheckResource(resource, outputScope is not null);
            callbacks = new(native, controllerPort, stopping.Token, RequireCurrent);
            controller = native.MaaCustomControllerCreate(callbacks.Table, 0); Require(controller != 0, "maa_controller_create_failed");
            Require(native.MaaControllerSetOption(controller, 3, [1], 1) != 0, "maa_raw_size_rejected");
            connection = native.MaaControllerPostConnection(controller); Require(connection > 0, "maa_connection_not_accepted");
        }
        Require(await WaitAsync(() => native.MaaControllerStatus(controller, connection), timer, token).ConfigureAwait(false) == 3000, "maa_connection_failed");
        Interlocked.Exchange(ref connection, 0);
        token.ThrowIfCancellationRequested(); RequireCurrent();
        lock (nativeGate)
        {
            ThrowStopping();
            tasker = native.MaaTaskerCreate(); Require(tasker != 0, "maa_tasker_create_failed");
            callbacks.BindTasker(tasker); sink = native.MaaTaskerAddSink(tasker, callbacks.EventPointer, 0); Require(sink > 0, "maa_task_sink_failed");
            Require(native.MaaTaskerBindResource(tasker, resource) != 0 && native.MaaTaskerBindController(tasker, controller) != 0 &&
                native.MaaTaskerInited(tasker) != 0, "maa_tasker_bind_failed");
        }
        if (agents is not null) await agents.StartAsync(native, resource, controller, tasker, token).ConfigureAwait(false);
        lock (gate) { if (closing) throw new OperationCanceledException(stopping.Token); initialized = true; }
    }
    private async Task RunCore(MaaSessionItem[] plan, CancellationToken cancellation)
    {
        using var linked = CancellationTokenSource.CreateLinkedTokenSource(cancellation, stopping.Token);
        var token = linked.Token; var timer = Stopwatch.StartNew();
        foreach (var task in plan)
            for (var repetition = task.CompletedRepetitions + 1; repetition <= task.RepeatCount; repetition++)
            {
                token.ThrowIfCancellationRequested(); RequireCurrent(); ThrowCallback(); agents?.RequireRunning();
                long id;
                using (var payload = payloadFactory is null ? null : await payloadFactory(task, token).ConfigureAwait(false))
                {
                    token.ThrowIfCancellationRequested(); RequireCurrent(); ThrowCallback();
                    lock (nativeGate)
                    {
                        ThrowStopping();
                        id = payload is null ? native!.MaaTaskerPostTask(tasker, task.Entry, task.Pipeline) :
                            payload.Post(native!, tasker, task.Entry, outputScope is not null);
                        if (id > 0) Interlocked.Exchange(ref activeTask, id);
                    }
                }
                Require(id > 0, "maa_task_not_accepted");
                var status = await WaitAsync(() => native!.MaaTaskerStatus(tasker, id), timer, token).ConfigureAwait(false);
                lock (gate) facts.Add(new(task.OccurrenceId, task.SourceId, repetition, id, status));
                Interlocked.Exchange(ref activeTask, 0);
                token.ThrowIfCancellationRequested(); RequireCurrent(); ThrowCallback(); agents?.RequireRunning();
                if (status != 3000) return;
            }
    }
    private async Task<int> WaitAsync(Func<int> status, Stopwatch timer, CancellationToken cancellation)
    {
        while (true)
        {
            cancellation.ThrowIfCancellationRequested(); RequireCurrent(); ThrowCallback();
            int value; lock (nativeGate) value = status();
            if (value is 3000 or 4000) return value;
            Require(value is 1000 or 2000, "maa_operation_status_invalid");
            if (timer.Elapsed >= operationTimeout) throw new TimeoutException("maa_operation_timeout");
            await Task.Delay(10, cancellation).ConfigureAwait(false);
        }
    }
    internal Task StopAsync()
    {
        Task completion;
        lock (gate)
        {
            if (cleaned) return Task.CompletedTask;
            if (stopTask is null)
            {
                closing = true; callbacks?.CloseInputs();
                stopTask = Task.Run(async () => {
                    try { stopping.Cancel(); } catch (AggregateException) { }
                    await StopCore().ConfigureAwait(false);
                });
            }
            completion = stopTask;
        }
        return completion.WaitAsync(stopTimeout);
    }
    private async Task StopCore()
    {
        var timer = Stopwatch.StartNew();
        lock (nativeGate)
        {
            if (native is not null && tasker != 0 && initialized) stopId = native.MaaTaskerPostStop(tasker);
        }
        Task? operation; lock (gate) operation = active;
        if (operation is not null)
        {
            try { await operation.WaitAsync(Remaining(timer)).ConfigureAwait(false); }
            catch (Exception) when (operation.IsCompleted) { }
        }
        while (true)
        {
            bool idle;
            lock (nativeGate)
            {
                idle = native is null || resourceOperations.All(id => Terminal(native.MaaResourceStatus(resource, id))) &&
                    (connection <= 0 || Terminal(native.MaaControllerStatus(controller, connection))) &&
                    (activeTask <= 0 || Terminal(native.MaaTaskerStatus(tasker, activeTask))) &&
                    (stopId <= 0 || Terminal(native.MaaTaskerStatus(tasker, stopId))) &&
                    (tasker == 0 || native.MaaTaskerRunning(tasker) == 0 && native.MaaTaskerStopping(tasker) == 0);
            }
            if (idle) break;
            await Task.Delay(TimeSpan.FromMilliseconds(10) < Remaining(timer) ? TimeSpan.FromMilliseconds(10) : Remaining(timer)).ConfigureAwait(false);
        }
        if (callbacks is not null) await callbacks.CloseAsync().WaitAsync(Remaining(timer)).ConfigureAwait(false);
        if (waits is not null) await waits.CloseAsync().WaitAsync(Remaining(timer)).ConfigureAwait(false);
        if (agents is not null) await agents.StopAsync(Remaining(timer)).ConfigureAwait(false);
        lock (nativeGate)
        {
            if (native is not null)
            {
                if (tasker != 0) { if (sink > 0) native.MaaTaskerRemoveSink(tasker, sink); native.MaaTaskerDestroy(tasker); tasker = 0; }
                if (controller != 0) { native.MaaControllerDestroy(controller); controller = 0; }
                callbacks?.Dispose();
                waits?.Unregister();
                if (resource != 0) { native.MaaResourceDestroy(resource); resource = 0; }
                native.Dispose(); native = null;
            }
        }
        try
        {
            if (outputScope is not null)
            {
                RequireCurrent(); using var budget = new CancellationTokenSource(Remaining(timer));
                Outputs = await outputScope.FreezeAsync(budget.Token).ConfigureAwait(false);
                Require(Outputs.NativeWritersDrained && !Outputs.ProcessFamilyStopped && Outputs.MayOverwrite, "maa_output_snapshot_scope_invalid");
            }
        }
        finally
        {
            // The caller retains the output/family master lease beyond this native-only borrow.
            await controllerPort.DisposeAsync().ConfigureAwait(false); await inputs.DisposeAsync().ConfigureAwait(false);
            if (ownsRuntime) { Interlocked.Exchange(ref runtimeOwner, 0); ownsRuntime = false; }
            lock (gate) cleaned = true;
            if (retention.IsAllocated) retention.Free(); stopping.Dispose();
        }
    }
    private TimeSpan Remaining(Stopwatch timer)
    {
        var remaining = stopTimeout - timer.Elapsed;
        if (remaining <= TimeSpan.Zero) throw new TimeoutException("maa_native_drain_unverified");
        return remaining;
    }
    private void ThrowCallback()
    { if ((callbacks?.Fault ?? waits?.Fault) is { } fault) throw new IOException(fault); }
    internal MaaNativeAction ReadAction(string node)
    {
        lock (nativeGate) { ThrowStopping(); RequireCurrent(); return new MaaNativeQueries(native ?? throw new IOException("maa_session_not_initialized")).ReadAction(tasker, node); }
    }
    private void RequireCurrent()
    {
        inputs.RequireCurrent();
        if (outputScope is null) return;
        outputScope.RequireCurrent();
        if (!Path.TrimEndingDirectorySeparator(Path.GetFullPath(Environment.CurrentDirectory)).Equals(Path.TrimEndingDirectorySeparator(outputRoot!), StringComparison.OrdinalIgnoreCase) ||
            !Path.GetFullPath(outputScope.Root).Equals(outputRoot, StringComparison.OrdinalIgnoreCase)) throw new IOException("maa_output_worker_cwd_mismatch");
    }
    private void ThrowStopping() { if (Volatile.Read(ref closing)) throw new OperationCanceledException(stopping.Token); }
    private static bool Terminal(int status) => status is 3000 or 4000;
    private static void Require(bool value, string code) { if (!value) throw new IOException(code); }
    public ValueTask DisposeAsync() => new(StopAsync());
}
