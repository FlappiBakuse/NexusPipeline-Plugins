using System.Runtime.InteropServices;
using System.Text;
using System.Text.Json;

namespace NexusPipeline.Extensions.MaaFramework;

internal sealed class MaaControllerBridge : IDisposable
{
    private readonly MaaNative native;
    private readonly IMaaController port;
    private readonly CancellationToken cancellation;
    private readonly Action requireCurrent;
    private nint expectedTasker;
    private readonly List<Delegate> roots = [];
    private readonly object gate = new();
    private readonly Queue<MaaNativeEvent> events = [];
    private readonly TaskCompletionSource drained = new(TaskCreationOptions.RunContinuationsAsynchronously);
    private int active;
    private bool inputsClosed, closed;
    private string? fault;
    private nint table;
    private readonly string uuid = Guid.NewGuid().ToString("N");
    internal nint Table => table;
    internal nint EventPointer { get; }
    internal string? Fault => Volatile.Read(ref fault);
    internal int DroppedEvents { get; private set; }
    internal MaaNativeEvent[] Events { get { lock (gate) return events.ToArray(); } }

    internal MaaControllerBridge(MaaNative native, IMaaController port, CancellationToken cancellation, Action requireCurrent)
    {
        this.native = native; this.port = port; this.cancellation = cancellation; this.requireCurrent = requireCurrent;
        table = Marshal.AllocHGlobal(21 * IntPtr.Size);
        try
        {
            Add(0, new Unary(_ => Call(() => port.Connect(cancellation))));
            Add(1, new Unary(_ => Call(() => port.Connected(cancellation))));
            Add(2, new Buffer((_, buffer) => Call(() => native.MaaStringBufferSet(buffer, uuid) != 0)));
            Add(3, new Features(_ => CallFeatures()));
            Add(4, new Text((text, _) => Call(() => port.StartApp(ReadText(text), cancellation))));
            Add(5, new Text((text, _) => Call(() => port.StopApp(ReadText(text), cancellation))));
            Add(6, new Buffer((_, image) => Call(() => Capture(image))));
            Add(7, new Point((x, y, _) => Call(() => port.Click(x, y, cancellation))));
            Add(8, new Swipe((x1, y1, x2, y2, duration, _) => Call(() => port.Swipe(x1, y1, x2, y2, duration, cancellation))));
            Add(9, new Touch((contact, x, y, pressure, _) => Call(() => port.Touch(0, contact, x, y, pressure, cancellation))));
            Add(10, new Touch((contact, x, y, pressure, _) => Call(() => port.Touch(1, contact, x, y, pressure, cancellation))));
            Add(11, new Key((contact, _) => Call(() => port.Touch(2, contact, 0, 0, 0, cancellation))));
            Add(12, new Key((key, _) => Call(() => port.Key(0, key, cancellation))));
            Add(13, new Text((text, _) => Call(() => port.Text(ReadText(text), cancellation))));
            Add(14, new Key((key, _) => Call(() => port.Key(1, key, cancellation))));
            Add(15, new Key((key, _) => Call(() => port.Key(2, key, cancellation))));
            Add(16, new Point((x, y, _) => Call(() => port.Scroll(x, y, cancellation))));
            Add(17, new Point((x, y, _) => Call(() => port.Move(x, y, cancellation))));
            Add(18, new Shell((command, timeout, _, output) => Call(() => {
                var value = port.Shell(ReadText(command), timeout, cancellation);
                if (value is null) return false;
                if (value.Contains('\0') || Encoding.UTF8.GetByteCount(value) > 1048576) throw new IOException("maa_shell_output_invalid");
                return native.MaaStringBufferSet(output, value) != 0;
            })));
            Add(19, new Unary(_ => Call(() => port.Inactive(cancellation))));
            Add(20, new Buffer((_, output) => Call(() => native.MaaStringBufferSet(output, "{\"externalController\":true}") != 0)));
            var sink = new EventSink(OnEvent); roots.Add(sink); EventPointer = Marshal.GetFunctionPointerForDelegate(sink);
        }
        catch { lock (gate) { closed = true; } Dispose(); throw; }
    }
    internal void BindTasker(nint tasker) { if (tasker == 0 || expectedTasker != 0) throw new IOException("maa_event_owner_invalid"); expectedTasker = tasker; }
    internal void CloseInputs() { lock (gate) inputsClosed = true; }
    internal Task CloseAsync()
    {
        lock (gate) { closed = true; inputsClosed = true; if (active == 0) drained.TrySetResult(); return drained.Task; }
    }
    private bool Enter(bool input)
    {
        lock (gate) { if (closed || input && inputsClosed) return false; active++; return true; }
    }
    private void Exit()
    {
        lock (gate) { active--; if (closed && active == 0) drained.TrySetResult(); }
    }
    private byte Call(Func<bool> action)
    {
        if (!Enter(true)) return 0;
        try { cancellation.ThrowIfCancellationRequested(); requireCurrent(); return action() ? (byte)1 : (byte)0; }
        catch (Exception failure) { RecordFault(failure); return 0; }
        finally { Exit(); }
    }
    private ulong CallFeatures()
    {
        if (!Enter(true)) return 0;
        try { cancellation.ThrowIfCancellationRequested(); requireCurrent(); return port.Features(cancellation); }
        catch (Exception failure) { RecordFault(failure); return 0; }
        finally { Exit(); }
    }
    private bool Capture(nint image)
    {
        var bytes = port.Capture(cancellation).ToArray();
        if (bytes.Length is < 33 or > 8388608 || !bytes.AsSpan().StartsWith(new byte[] { 137, 80, 78, 71, 13, 10, 26, 10 })) throw new IOException("maa_capture_format_invalid");
        return native.MaaImageBufferSetEncoded(image, bytes, (ulong)bytes.Length) != 0;
    }
    private void OnEvent(nint handle, nint message, nint details, nint argument)
    {
        if (!Enter(false)) return;
        try
        {
            if (expectedTasker == 0 || handle != expectedTasker) throw new IOException("maa_event_owner_unbound");
            var code = Read(message, 128);
            if (code is not ("Tasker.Task.Starting" or "Tasker.Task.Succeeded" or "Tasker.Task.Failed")) return;
            using var json = JsonDocument.Parse(Read(details, 65536));
            if (!json.RootElement.TryGetProperty("task_id", out var id) || !id.TryGetInt64(out var task) || task < 1) throw new IOException("maa_task_event_invalid");
            lock (gate) { if (events.Count == 256) { events.Dequeue(); DroppedEvents++; } events.Enqueue(new(task, code)); }
        }
        catch (Exception failure) { RecordFault(failure); }
        finally { Exit(); }
    }
    private void RecordFault(Exception failure)
    {
        if (failure is OperationCanceledException && cancellation.IsCancellationRequested) return;
        Interlocked.CompareExchange(ref fault, "maa_controller_callback_" + failure.GetType().Name, null);
    }
    private void Add(int index, Delegate callback)
    {
        roots.Add(callback); Marshal.WriteIntPtr(table, index * IntPtr.Size, Marshal.GetFunctionPointerForDelegate(callback));
    }
    private static string ReadText(nint pointer)
    {
        var value = Read(pointer, 16384);
        if (value.Length > 4096) throw new IOException("maa_callback_text_budget");
        return value;
    }
    private static string Read(nint pointer, int maximum)
    {
        if (pointer == 0) throw new IOException("maa_callback_string_missing");
        var length = 0; while (length <= maximum && Marshal.ReadByte(pointer, length) != 0) length++;
        if (length > maximum) throw new IOException("maa_callback_string_budget");
        var bytes = new byte[length]; Marshal.Copy(pointer, bytes, 0, length); return new UTF8Encoding(false, true).GetString(bytes);
    }
    public void Dispose()
    {
        lock (gate)
        {
            if (!closed || active != 0) throw new IOException("maa_callback_drain_unproven");
            var value = Interlocked.Exchange(ref table, 0); if (value != 0) Marshal.FreeHGlobal(value); roots.Clear();
        }
    }
    [UnmanagedFunctionPointer(CallingConvention.Cdecl)] private delegate byte Unary(nint argument);
    [UnmanagedFunctionPointer(CallingConvention.Cdecl)] private delegate ulong Features(nint argument);
    [UnmanagedFunctionPointer(CallingConvention.Cdecl)] private delegate byte Buffer(nint argument, nint output);
    [UnmanagedFunctionPointer(CallingConvention.Cdecl)] private delegate byte Text(nint text, nint argument);
    [UnmanagedFunctionPointer(CallingConvention.Cdecl)] private delegate byte Point(int x, int y, nint argument);
    [UnmanagedFunctionPointer(CallingConvention.Cdecl)] private delegate byte Swipe(int x1, int y1, int x2, int y2, int duration, nint argument);
    [UnmanagedFunctionPointer(CallingConvention.Cdecl)] private delegate byte Touch(int contact, int x, int y, int pressure, nint argument);
    [UnmanagedFunctionPointer(CallingConvention.Cdecl)] private delegate byte Key(int key, nint argument);
    [UnmanagedFunctionPointer(CallingConvention.Cdecl)] private delegate byte Shell(nint command, long timeout, nint argument, nint output);
    [UnmanagedFunctionPointer(CallingConvention.Cdecl)] private delegate void EventSink(nint handle, nint message, nint details, nint argument);
}
