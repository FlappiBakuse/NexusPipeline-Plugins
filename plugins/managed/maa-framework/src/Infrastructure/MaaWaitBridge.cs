using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.Json.Nodes;

namespace NexusPipeline.Extensions.MaaFramework;

internal sealed class MaaWaitBridge
{
    private readonly object gate = new();
    private readonly MaaNative native;
    private readonly nint resource;
    private readonly CancellationToken cancellation;
    private readonly Action requireCurrent;
    private readonly TimeProvider clock;
    private readonly ActionCall callback;
    private readonly List<string> registrations = [];
    private readonly TaskCompletionSource drained = new(TaskCreationOptions.RunContinuationsAsynchronously);
    private int active, accepted;
    private bool closed;
    private string? fault;
    internal string? Fault => Volatile.Read(ref fault);
    internal int Accepted => Volatile.Read(ref accepted);

    internal MaaWaitBridge(MaaNative native, nint resource, CancellationToken cancellation, Action requireCurrent, TimeProvider clock)
    {
        this.native = native; this.resource = resource; this.cancellation = cancellation; this.requireCurrent = requireCurrent; this.clock = clock;
        callback = OnAction;
    }

    internal void Register()
    {
        var register = native.Resolve<RegisterCall>("MaaResourceRegisterCustomAction");
        foreach (var name in new[] { "CountdownAction", "TimedWaitAction" })
        {
            if (register(resource, name, Marshal.GetFunctionPointerForDelegate(callback), 0) == 0) throw new IOException("maa_wait_registration_failed");
            registrations.Add(name);
        }
    }

    private byte OnAction(nint context, long taskId, nint nodeName, nint actionName, nint parameters, long recognitionId, nint box, nint argument)
    {
        lock (gate) { if (closed || cancellation.IsCancellationRequested) return 0; active++; }
        try
        {
            cancellation.ThrowIfCancellationRequested(); requireCurrent();
            var entry = Text(actionName, 64);
            if (context == 0 || taskId <= 0 || !MaaWaitPolicy.Supports(entry) || Text(nodeName, 4096) != entry)
                throw new IOException("maa_wait_callback_unbound");
            var settings = MaaJson.Read(Encoding.UTF8.GetBytes(Text(parameters, 1024)));
            _ = MaaWaitPolicy.Parameters(entry, new() { [entry] = new JsonObject {
                ["action"] = "Custom", ["custom_action"] = entry, ["custom_action_param"] = settings.DeepClone() } });
            Interlocked.Increment(ref accepted);
            Wait(entry, settings); return 1;
        }
        catch (OperationCanceledException) when (cancellation.IsCancellationRequested) { return 0; }
        catch (Exception failure)
        { Interlocked.CompareExchange(ref fault, "maa_wait_callback_" + failure.GetType().Name, null); return 0; }
        finally { lock (gate) { active--; if (closed && active == 0) drained.TrySetResult(); } }
    }

    private void Wait(string entry, JsonObject settings)
    {
        var started = Stopwatch.StartNew();
        var duration = entry == "CountdownAction" ? TimeSpan.FromSeconds(settings["seconds"]!.GetValue<int>()) : TimeSpan.Zero;
        var target = entry == "TimedWaitAction" ? MaaWaitPolicy.Target(settings, clock.GetLocalNow().DateTime) : DateTime.MinValue;
        while (true)
        {
            cancellation.ThrowIfCancellationRequested(); requireCurrent();
            var remaining = entry == "CountdownAction" ? duration - started.Elapsed : target - clock.GetLocalNow().DateTime;
            if (remaining <= TimeSpan.Zero) return;
            Task.Delay(remaining < TimeSpan.FromMilliseconds(100) ? remaining : TimeSpan.FromMilliseconds(100), cancellation).GetAwaiter().GetResult();
        }
    }

    internal Task CloseAsync()
    { lock (gate) { closed = true; if (active == 0) drained.TrySetResult(); return drained.Task; } }
    internal void Unregister()
    {
        lock (gate)
        {
            if (!closed || active != 0) throw new IOException("maa_wait_drain_unproven");
            var unregister = native.Resolve<UnregisterCall>("MaaResourceUnregisterCustomAction");
            foreach (var name in registrations.ToArray())
            {
                if (unregister(resource, name) == 0) throw new IOException("maa_wait_unregister_failed");
                registrations.Remove(name);
            }
            GC.KeepAlive(callback);
        }
    }
    private static string Text(nint pointer, int maximum)
    {
        if (pointer == 0) throw new IOException("maa_wait_text_missing");
        var length = 0; while (length <= maximum && Marshal.ReadByte(pointer, length) != 0) length++;
        if (length > maximum) throw new IOException("maa_wait_text_budget");
        var bytes = new byte[length]; Marshal.Copy(pointer, bytes, 0, length); return new UTF8Encoding(false, true).GetString(bytes);
    }
    [UnmanagedFunctionPointer(CallingConvention.Cdecl)]
    private delegate byte ActionCall(nint context, long taskId, nint nodeName, nint actionName, nint parameters, long recognitionId, nint box, nint argument);
    [UnmanagedFunctionPointer(CallingConvention.Cdecl)]
    private delegate byte RegisterCall(nint resource, [MarshalAs(UnmanagedType.LPUTF8Str)] string name, nint callback, nint argument);
    [UnmanagedFunctionPointer(CallingConvention.Cdecl)]
    private delegate byte UnregisterCall(nint resource, [MarshalAs(UnmanagedType.LPUTF8Str)] string name);
}
