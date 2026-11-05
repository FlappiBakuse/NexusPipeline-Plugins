using System.Runtime.InteropServices;

namespace NexusPipeline.Extensions.MaaFramework;

internal sealed class ImageControllerCallbacks : IDisposable
{
    private readonly byte[] _png;
    private readonly List<Delegate> _roots = [];
    private readonly object _gate = new();
    private readonly List<string> _rejected = [];
    private readonly List<string> _failures = [];
    private nint _table;
    internal nint Table => _table;
    internal int CaptureCount { get; private set; }
    internal bool IsClean { get { lock (_gate) return _rejected.Count == 0 && _failures.Count == 0; } }

    internal ImageControllerCallbacks(MaaNative native, string imagePath)
    {
        var length = new FileInfo(imagePath).Length;
        if (length is < 33 or > 8388608) throw new IOException("maa_controller_image_size_invalid");
        _png = File.ReadAllBytes(imagePath);
        _table = Marshal.AllocHGlobal(21 * IntPtr.Size);
        try
        {
            Add(0, new Unary(_ => 1));
            Add(1, new Unary(_ => 1));
            Add(2, new Buffer((_, value) => Safe("uuid", () => native.MaaStringBufferSet(value, "nexus-image-controller"))));
            Add(3, new Features(_ => 0));
            Add(4, new Text((_, _) => Reject("start-app")));
            Add(5, new Text((_, _) => Reject("stop-app")));
            Add(6, new Buffer((_, image) => Safe("capture", () =>
            {
                lock (_gate) CaptureCount++;
                return native.MaaImageBufferSetEncoded(image, _png, (ulong)_png.Length);
            })));
            Add(7, new Point((_, _, _) => Reject("click")));
            Add(8, new Swipe((_, _, _, _, _, _) => Reject("swipe")));
            Add(9, new Touch((_, _, _, _, _) => Reject("touch-down")));
            Add(10, new Touch((_, _, _, _, _) => Reject("touch-move")));
            Add(11, new Key((_, _) => Reject("touch-up")));
            Add(12, new Key((_, _) => Reject("click-key")));
            Add(13, new Text((_, _) => Reject("input-text")));
            Add(14, new Key((_, _) => Reject("key-down")));
            Add(15, new Key((_, _) => Reject("key-up")));
            Add(16, new Point((_, _, _) => Reject("scroll")));
            Add(17, new Point((_, _, _) => Reject("relative-move")));
            Add(18, new Shell((_, _, _, _) => Reject("shell")));
            Add(19, new Unary(_ => 1));
            Add(20, new Buffer((_, value) => Safe("info", () => native.MaaStringBufferSet(value, "{\"imageOnly\":true}"))));
        }
        catch { Dispose(); throw; }
    }

    private void Add(int index, Delegate callback)
    {
        _roots.Add(callback);
        Marshal.WriteIntPtr(_table, index * IntPtr.Size, Marshal.GetFunctionPointerForDelegate(callback));
    }

    private byte Safe(string name, Func<byte> invoke)
    {
        try { return invoke(); }
        catch (Exception exception)
        {
            lock (_gate) _failures.Add(name + ":" + exception.GetType().Name);
            return 0;
        }
    }

    private byte Reject(string name)
    {
        lock (_gate) _rejected.Add(name);
        return 0;
    }

    public void Dispose()
    {
        var table = Interlocked.Exchange(ref _table, 0);
        if (table != 0) Marshal.FreeHGlobal(table);
        _roots.Clear();
    }

    [UnmanagedFunctionPointer(CallingConvention.Cdecl)]
    private delegate byte Unary(nint argument);
    [UnmanagedFunctionPointer(CallingConvention.Cdecl)]
    private delegate ulong Features(nint argument);
    [UnmanagedFunctionPointer(CallingConvention.Cdecl)]
    private delegate byte Buffer(nint argument, nint buffer);
    [UnmanagedFunctionPointer(CallingConvention.Cdecl)]
    private delegate byte Text(nint text, nint argument);
    [UnmanagedFunctionPointer(CallingConvention.Cdecl)]
    private delegate byte Point(int x, int y, nint argument);
    [UnmanagedFunctionPointer(CallingConvention.Cdecl)]
    private delegate byte Swipe(int x1, int y1, int x2, int y2, int duration, nint argument);
    [UnmanagedFunctionPointer(CallingConvention.Cdecl)]
    private delegate byte Touch(int contact, int x, int y, int pressure, nint argument);
    [UnmanagedFunctionPointer(CallingConvention.Cdecl)]
    private delegate byte Key(int key, nint argument);
    [UnmanagedFunctionPointer(CallingConvention.Cdecl)]
    private delegate byte Shell(nint command, long timeout, nint output, nint argument);
}
