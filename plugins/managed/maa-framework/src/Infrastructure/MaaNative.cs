using System.Runtime.InteropServices;
using System.Security.Cryptography;

namespace NexusPipeline.Extensions.MaaFramework;

internal sealed class MaaNative : IDisposable
{
    private nint _module;
    private nint _imageControllerModule;

    private MaaNative(nint module, nint controller)
    {
        _module = module; _imageControllerModule = controller;
        MaaVersion = Export<MaaVersionCall>(module, nameof(MaaVersion));
        MaaGlobalSetOption = Export<MaaSetGlobalOptionCall>(module, nameof(MaaGlobalSetOption));
        MaaResourceStatus = Export<MaaResourceWaitCall>(module, nameof(MaaResourceStatus));
        MaaResourceLoaded = Export<MaaTaskerRunningCall>(module, nameof(MaaResourceLoaded));
        MaaControllerStatus = Export<MaaControllerWaitCall>(module, nameof(MaaControllerStatus));
        MaaTaskerStatus = Export<MaaTaskerWaitCall>(module, nameof(MaaTaskerStatus));
        MaaTaskerPostStop = Export<MaaTaskerPostStopCall>(module, nameof(MaaTaskerPostStop));
        MaaTaskerStopping = Export<MaaTaskerRunningCall>(module, nameof(MaaTaskerStopping));
        MaaTaskerAddSink = Export<MaaTaskerAddSinkCall>(module, nameof(MaaTaskerAddSink));
        MaaTaskerRemoveSink = Export<MaaTaskerRemoveSinkCall>(module, nameof(MaaTaskerRemoveSink));
        MaaSetGlobalOption = Export<MaaSetGlobalOptionCall>(module, nameof(MaaSetGlobalOption));
        MaaResourceCreate = Export<MaaResourceCreateCall>(module, nameof(MaaResourceCreate));
        MaaResourceDestroy = Export<MaaResourceDestroyCall>(module, nameof(MaaResourceDestroy));
        MaaResourcePostBundle = Export<MaaResourcePostBundleCall>(module, nameof(MaaResourcePostBundle));
        MaaResourceWait = Export<MaaResourceWaitCall>(module, nameof(MaaResourceWait));
        MaaCustomControllerCreate = Export<MaaCustomControllerCreateCall>(module, nameof(MaaCustomControllerCreate));
        MaaControllerDestroy = Export<MaaControllerDestroyCall>(module, nameof(MaaControllerDestroy));
        MaaControllerSetOption = Export<MaaControllerSetOptionCall>(module, nameof(MaaControllerSetOption));
        MaaControllerPostConnection = Export<MaaControllerPostConnectionCall>(module, nameof(MaaControllerPostConnection));
        MaaControllerPostScreencap = Export<MaaControllerPostScreencapCall>(module, nameof(MaaControllerPostScreencap));
        MaaControllerWait = Export<MaaControllerWaitCall>(module, nameof(MaaControllerWait));
        MaaControllerCachedImage = Export<MaaControllerCachedImageCall>(module, nameof(MaaControllerCachedImage));
        MaaTaskerCreate = Export<MaaTaskerCreateCall>(module, nameof(MaaTaskerCreate));
        MaaTaskerDestroy = Export<MaaTaskerDestroyCall>(module, nameof(MaaTaskerDestroy));
        MaaTaskerBindResource = Export<MaaTaskerBindResourceCall>(module, nameof(MaaTaskerBindResource));
        MaaTaskerBindController = Export<MaaTaskerBindControllerCall>(module, nameof(MaaTaskerBindController));
        MaaTaskerInited = Export<MaaTaskerInitedCall>(module, nameof(MaaTaskerInited));
        MaaTaskerPostTask = Export<MaaTaskerPostTaskCall>(module, nameof(MaaTaskerPostTask));
        PostBytes = Export<PostBytesCall>(module, nameof(MaaTaskerPostTask));
        MaaTaskerWait = Export<MaaTaskerWaitCall>(module, nameof(MaaTaskerWait));
        MaaTaskerRunning = Export<MaaTaskerRunningCall>(module, nameof(MaaTaskerRunning));
        MaaImageBufferCreate = Export<MaaImageBufferCreateCall>(module, nameof(MaaImageBufferCreate));
        MaaImageBufferDestroy = Export<MaaImageBufferDestroyCall>(module, nameof(MaaImageBufferDestroy));
        MaaImageBufferWidth = Export<MaaImageBufferWidthCall>(module, nameof(MaaImageBufferWidth));
        MaaImageBufferHeight = Export<MaaImageBufferHeightCall>(module, nameof(MaaImageBufferHeight));
        MaaImageBufferGetEncoded = Export<MaaImageBufferGetEncodedCall>(module, nameof(MaaImageBufferGetEncoded));
        MaaImageBufferGetEncodedSize = Export<MaaImageBufferGetEncodedSizeCall>(module, nameof(MaaImageBufferGetEncodedSize));
        MaaImageBufferSetEncoded = Export<MaaImageBufferSetEncodedCall>(module, nameof(MaaImageBufferSetEncoded));
        MaaStringBufferSet = Export<MaaStringBufferSetCall>(module, nameof(MaaStringBufferSet));
    }

    internal static MaaNative Load(string path, string expectedSha256, string controllerSha256)
    {
        path = Path.GetFullPath(path);
        // The vendor scans this directory during module initialization, before any session policy can run.
        if (Directory.Exists(Path.Combine(Path.GetDirectoryName(path)!, "plugins"))) throw new IOException("maa_undeclared_native_plugins");
        using var input = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.Read);
        if (Convert.ToHexStringLower(SHA256.HashData(input)) != expectedSha256) throw new IOException("maa_runtime_digest_mismatch");
        var controllerPath = Path.Combine(Path.GetDirectoryName(path)!, "MaaCustomControlUnit.dll");
        using var controller = new FileStream(controllerPath, FileMode.Open, FileAccess.Read, FileShare.Read);
        if (Convert.ToHexStringLower(SHA256.HashData(controller)) != controllerSha256) throw new IOException("maa_controller_digest_mismatch");
        var search = DllImportSearchPath.UseDllDirectoryForDependencies | DllImportSearchPath.System32;
        var module = NativeLibrary.Load(path, typeof(MaaNative).Assembly, search);
        nint controllerModule = 0;
        try
        {
            // The framework loads this controller later through Win32's default search; bind its dependencies first.
            controllerModule = NativeLibrary.Load(controllerPath, typeof(MaaNative).Assembly, search);
            return new(module, controllerModule);
        }
        catch
        {
            try { if (controllerModule != 0) NativeLibrary.Free(controllerModule); }
            finally { NativeLibrary.Free(module); }
            throw;
        }
    }

    [UnmanagedFunctionPointer(CallingConvention.Cdecl)]
    internal delegate long MaaTaskerPostStopCall(nint tasker);
    [UnmanagedFunctionPointer(CallingConvention.Cdecl)]
    internal delegate long MaaTaskerAddSinkCall(nint tasker, nint sink, nint argument);
    [UnmanagedFunctionPointer(CallingConvention.Cdecl)]
    internal delegate void MaaTaskerRemoveSinkCall(nint tasker, long sinkId);
    internal MaaSetGlobalOptionCall MaaGlobalSetOption { get; }
    internal MaaResourceWaitCall MaaResourceStatus { get; }
    internal MaaTaskerRunningCall MaaResourceLoaded { get; }
    internal MaaControllerWaitCall MaaControllerStatus { get; }
    internal MaaTaskerWaitCall MaaTaskerStatus { get; }
    internal MaaTaskerPostStopCall MaaTaskerPostStop { get; }
    internal MaaTaskerRunningCall MaaTaskerStopping { get; }
    internal MaaTaskerAddSinkCall MaaTaskerAddSink { get; }
    internal MaaTaskerRemoveSinkCall MaaTaskerRemoveSink { get; }

    private static T Export<T>(nint module, string name) where T : Delegate =>
        Marshal.GetDelegateForFunctionPointer<T>(NativeLibrary.GetExport(module, name));
    internal T Resolve<T>(string name) where T : Delegate => Export<T>(_module, name);

    public void Dispose()
    {
        var controller = Interlocked.Exchange(ref _imageControllerModule, 0);
        var module = Interlocked.Exchange(ref _module, 0);
        try { if (controller != 0) NativeLibrary.Free(controller); }
        finally { if (module != 0) NativeLibrary.Free(module); }
    }

    [UnmanagedFunctionPointer(CallingConvention.Cdecl)]
    internal delegate nint MaaVersionCall();
    internal MaaVersionCall MaaVersion { get; }

    [UnmanagedFunctionPointer(CallingConvention.Cdecl)]
    internal delegate byte MaaSetGlobalOptionCall(int option, byte[] value, ulong size);
    internal MaaSetGlobalOptionCall MaaSetGlobalOption { get; }

    [UnmanagedFunctionPointer(CallingConvention.Cdecl)]
    internal delegate nint MaaResourceCreateCall();
    internal MaaResourceCreateCall MaaResourceCreate { get; }

    [UnmanagedFunctionPointer(CallingConvention.Cdecl)]
    internal delegate void MaaResourceDestroyCall(nint resource);
    internal MaaResourceDestroyCall MaaResourceDestroy { get; }

    [UnmanagedFunctionPointer(CallingConvention.Cdecl)]
    internal delegate long MaaResourcePostBundleCall(nint resource, [MarshalAs(UnmanagedType.LPUTF8Str)] string path);
    internal MaaResourcePostBundleCall MaaResourcePostBundle { get; }

    [UnmanagedFunctionPointer(CallingConvention.Cdecl)]
    internal delegate int MaaResourceWaitCall(nint resource, long request);
    internal MaaResourceWaitCall MaaResourceWait { get; }

    [UnmanagedFunctionPointer(CallingConvention.Cdecl)]
    internal delegate nint MaaCustomControllerCreateCall(nint callbacks, nint argument);
    internal MaaCustomControllerCreateCall MaaCustomControllerCreate { get; }

    [UnmanagedFunctionPointer(CallingConvention.Cdecl)]
    internal delegate void MaaControllerDestroyCall(nint controller);
    internal MaaControllerDestroyCall MaaControllerDestroy { get; }

    [UnmanagedFunctionPointer(CallingConvention.Cdecl)]
    internal delegate byte MaaControllerSetOptionCall(nint controller, int option, byte[] value, ulong size);
    internal MaaControllerSetOptionCall MaaControllerSetOption { get; }

    [UnmanagedFunctionPointer(CallingConvention.Cdecl)]
    internal delegate long MaaControllerPostConnectionCall(nint controller);
    internal MaaControllerPostConnectionCall MaaControllerPostConnection { get; }

    [UnmanagedFunctionPointer(CallingConvention.Cdecl)]
    internal delegate long MaaControllerPostScreencapCall(nint controller);
    internal MaaControllerPostScreencapCall MaaControllerPostScreencap { get; }

    [UnmanagedFunctionPointer(CallingConvention.Cdecl)]
    internal delegate int MaaControllerWaitCall(nint controller, long request);
    internal MaaControllerWaitCall MaaControllerWait { get; }

    [UnmanagedFunctionPointer(CallingConvention.Cdecl)]
    internal delegate byte MaaControllerCachedImageCall(nint controller, nint image);
    internal MaaControllerCachedImageCall MaaControllerCachedImage { get; }

    [UnmanagedFunctionPointer(CallingConvention.Cdecl)]
    internal delegate nint MaaTaskerCreateCall();
    internal MaaTaskerCreateCall MaaTaskerCreate { get; }

    [UnmanagedFunctionPointer(CallingConvention.Cdecl)]
    internal delegate void MaaTaskerDestroyCall(nint tasker);
    internal MaaTaskerDestroyCall MaaTaskerDestroy { get; }

    [UnmanagedFunctionPointer(CallingConvention.Cdecl)]
    internal delegate byte MaaTaskerBindResourceCall(nint tasker, nint resource);
    internal MaaTaskerBindResourceCall MaaTaskerBindResource { get; }

    [UnmanagedFunctionPointer(CallingConvention.Cdecl)]
    internal delegate byte MaaTaskerBindControllerCall(nint tasker, nint controller);
    internal MaaTaskerBindControllerCall MaaTaskerBindController { get; }

    [UnmanagedFunctionPointer(CallingConvention.Cdecl)]
    internal delegate byte MaaTaskerInitedCall(nint tasker);
    internal MaaTaskerInitedCall MaaTaskerInited { get; }

    [UnmanagedFunctionPointer(CallingConvention.Cdecl)]
    internal delegate long MaaTaskerPostTaskCall(nint tasker, [MarshalAs(UnmanagedType.LPUTF8Str)] string entry,
        [MarshalAs(UnmanagedType.LPUTF8Str)] string pipelineOverride);
    internal MaaTaskerPostTaskCall MaaTaskerPostTask { get; }
    [UnmanagedFunctionPointer(CallingConvention.Cdecl)]
    internal delegate long PostBytesCall(nint tasker, [MarshalAs(UnmanagedType.LPUTF8Str)] string entry, nint pipeline);
    internal PostBytesCall PostBytes { get; }

    [UnmanagedFunctionPointer(CallingConvention.Cdecl)]
    internal delegate int MaaTaskerWaitCall(nint tasker, long task);
    internal MaaTaskerWaitCall MaaTaskerWait { get; }

    [UnmanagedFunctionPointer(CallingConvention.Cdecl)]
    internal delegate byte MaaTaskerRunningCall(nint tasker);
    internal MaaTaskerRunningCall MaaTaskerRunning { get; }

    [UnmanagedFunctionPointer(CallingConvention.Cdecl)]
    internal delegate nint MaaImageBufferCreateCall();
    internal MaaImageBufferCreateCall MaaImageBufferCreate { get; }

    [UnmanagedFunctionPointer(CallingConvention.Cdecl)]
    internal delegate void MaaImageBufferDestroyCall(nint image);
    internal MaaImageBufferDestroyCall MaaImageBufferDestroy { get; }

    [UnmanagedFunctionPointer(CallingConvention.Cdecl)]
    internal delegate int MaaImageBufferWidthCall(nint image);
    internal MaaImageBufferWidthCall MaaImageBufferWidth { get; }

    [UnmanagedFunctionPointer(CallingConvention.Cdecl)]
    internal delegate int MaaImageBufferHeightCall(nint image);
    internal MaaImageBufferHeightCall MaaImageBufferHeight { get; }

    [UnmanagedFunctionPointer(CallingConvention.Cdecl)]
    internal delegate nint MaaImageBufferGetEncodedCall(nint image);
    internal MaaImageBufferGetEncodedCall MaaImageBufferGetEncoded { get; }

    [UnmanagedFunctionPointer(CallingConvention.Cdecl)]
    internal delegate ulong MaaImageBufferGetEncodedSizeCall(nint image);
    internal MaaImageBufferGetEncodedSizeCall MaaImageBufferGetEncodedSize { get; }

    [UnmanagedFunctionPointer(CallingConvention.Cdecl)]
    internal delegate byte MaaImageBufferSetEncodedCall(nint image, byte[] data, ulong size);
    internal MaaImageBufferSetEncodedCall MaaImageBufferSetEncoded { get; }

    [UnmanagedFunctionPointer(CallingConvention.Cdecl)]
    internal delegate byte MaaStringBufferSetCall(nint buffer, [MarshalAs(UnmanagedType.LPUTF8Str)] string value);
    internal MaaStringBufferSetCall MaaStringBufferSet { get; }
}
