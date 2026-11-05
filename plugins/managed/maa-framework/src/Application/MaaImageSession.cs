using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text;
using NexusPipeline.Extensibility.Media;
using NexusPipeline.Extensibility.Protocol;

namespace NexusPipeline.Extensions.MaaFramework;

public sealed class MaaImageSession : IMediaFrameProvider, IAsyncDisposable
{
    private readonly object _gate = new();
    private readonly string _runtimeLibrary, _runtimeSha256, _resourceRoot, _imagePath, _logRoot;
    private readonly string _controllerSha256;
    private nint _resource, _controller, _tasker;
    private ImageControllerCallbacks? _callbacks;
    private MaaNative? _native;
    private bool _stopping, _disposed;
    public string? NativeVersion { get; private set; }
    public int ResourceStatus { get; private set; }
    public int ConnectionStatus { get; private set; }
    public int ImageCaptureCount => _callbacks?.CaptureCount ?? 0;
    public bool ImageControllerClean => _callbacks?.IsClean ?? false;

    public MaaImageSession(string runtimeLibrary, string runtimeSha256, string controllerSha256, string resourceRoot, string imagePath, string logRoot)
    {
        _runtimeLibrary = MaaNativePath.Capture(runtimeLibrary, directory: false);
        _resourceRoot = MaaNativePath.Capture(resourceRoot, directory: true);
        _imagePath = MaaNativePath.Capture(imagePath, directory: false);
        _logRoot = MaaNativePath.Capture(logRoot, directory: true);
        _runtimeSha256 = runtimeSha256;
        _controllerSha256 = controllerSha256;
    }

    public void Initialize(CancellationToken cancellationToken)
    {
        lock (_gate)
        {
            ObjectDisposedException.ThrowIf(_stopping || _disposed, this);
            if (_native is not null || _resource != 0 || _controller != 0 || _tasker != 0) throw new InvalidOperationException("maa_session_already_initialized");
            cancellationToken.ThrowIfCancellationRequested();
            var stage = "library_load";
            try
            {
                var native = MaaNative.Load(_runtimeLibrary, _runtimeSha256, _controllerSha256);
                _native = native;
                stage = "version";
                NativeVersion = Marshal.PtrToStringUTF8(native.MaaVersion());
                if (NativeVersion is not ("v5.14.3" or "5.14.3")) throw new IOException("maa_runtime_version_unverified");
                stage = "log_directory";
                var logPath = Encoding.UTF8.GetBytes(MaaNativePath.Vendor(_logRoot));
                Require(native.MaaSetGlobalOption(1, logPath, (ulong)logPath.Length) != 0, "maa_log_root_rejected");
                stage = "resource_create";
                _resource = native.MaaResourceCreate();
                Require(_resource != 0, "maa_resource_create_failed");
                stage = "resource_bundle";
                ResourceStatus = native.MaaResourceWait(_resource, native.MaaResourcePostBundle(_resource, MaaNativePath.Vendor(_resourceRoot)));
                Require(ResourceStatus == 3000, "maa_resource_load_failed");
                stage = "controller_create";
                _callbacks = new ImageControllerCallbacks(native, _imagePath);
                _controller = native.MaaCustomControllerCreate(_callbacks.Table, 0);
                Require(_controller != 0, "maa_image_controller_create_failed");
                Require(native.MaaControllerSetOption(_controller, 3, [1], 1) != 0, "maa_raw_size_option_rejected");
                stage = "controller_connect";
                ConnectionStatus = native.MaaControllerWait(_controller, native.MaaControllerPostConnection(_controller));
                Require(ConnectionStatus == 3000, "maa_image_controller_connect_failed");
                stage = "tasker_create";
                _tasker = native.MaaTaskerCreate();
                Require(_tasker != 0 && native.MaaTaskerBindResource(_tasker, _resource) != 0 &&
                    native.MaaTaskerBindController(_tasker, _controller) != 0 && native.MaaTaskerInited(_tasker) != 0, "maa_tasker_bind_failed");
                cancellationToken.ThrowIfCancellationRequested();
            }
            catch (Exception failure)
            {
                try { DisposeHandles(); }
                catch (Exception cleanup) { throw new AggregateException("maa_initialize_cleanup_failed", failure, cleanup); }
                if (failure is OperationCanceledException) throw;
                throw new IOException("maa_initialize_" + stage + "_failed", failure);
            }
        }
    }

    public MaaTaskCompletion ExecuteTask(string entry, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(entry) || entry.Length > 120 || entry.Contains('\0')) throw new ArgumentException("maa_task_entry_invalid");
        lock (_gate)
        {
            var native = RequireReady();
            cancellationToken.ThrowIfCancellationRequested();
            var taskId = native.MaaTaskerPostTask(_tasker, entry, "{}");
            Require(taskId > 0, "maa_task_not_accepted");
            var status = native.MaaTaskerWait(_tasker, taskId);
            Require(native.MaaTaskerRunning(_tasker) == 0, "maa_task_still_running");
            cancellationToken.ThrowIfCancellationRequested();
            return new(taskId, status);
        }
    }

    public ValueTask<MediaFrameContent> CaptureAsync(MediaCapture request, CancellationToken cancellationToken)
    {
        lock (_gate)
        {
            var native = RequireReady();
            cancellationToken.ThrowIfCancellationRequested();
            Require(native.MaaControllerWait(_controller, native.MaaControllerPostScreencap(_controller)) == 3000, "maa_screencap_failed");
            var image = native.MaaImageBufferCreate();
            Require(image != 0, "maa_image_buffer_failed");
            try
            {
                Require(native.MaaControllerCachedImage(_controller, image) != 0, "maa_image_cache_unavailable");
                var size = native.MaaImageBufferGetEncodedSize(image);
                Require(size is >= 33 and <= 8388608, "maa_image_size_invalid");
                var bytes = new byte[checked((int)size)];
                var data = native.MaaImageBufferGetEncoded(image);
                Require(data != 0, "maa_image_bytes_unavailable");
                Marshal.Copy(data, bytes, 0, bytes.Length);
                cancellationToken.ThrowIfCancellationRequested();
                var descriptor = new MediaFrame
                {
                CapturedAt = DateTime.UtcNow.ToString("O", System.Globalization.CultureInfo.InvariantCulture),
                    Format = "nexus.media.frame", Version = 1, Capture = request, MimeType = "image/png",
                    Width = native.MaaImageBufferWidth(image), Height = native.MaaImageBufferHeight(image),
                    SizeBytes = bytes.Length, Sha256 = Convert.ToHexStringLower(SHA256.HashData(bytes))
                };
                return ValueTask.FromResult(new MediaFrameContent(descriptor, new MemoryStream(bytes, writable: false)));
            }
            finally { native.MaaImageBufferDestroy(image); }
        }
    }

    public ValueTask DisposeAsync()
    {
        lock (_gate)
        {
            if (_disposed) return ValueTask.CompletedTask;
            _stopping = true;
            DisposeHandles();
            _disposed = true;
            return ValueTask.CompletedTask;
        }
    }

    private MaaNative RequireReady()
    {
        ObjectDisposedException.ThrowIf(_stopping || _disposed, this);
        if (_tasker == 0 || _controller == 0 || _resource == 0 || _native is null)
            throw new InvalidOperationException("maa_session_not_ready");
        return _native;
    }

    private void DisposeHandles()
    {
        var native = _native;
        if (native is null) return;
        if (_tasker != 0) { native.MaaTaskerDestroy(_tasker); _tasker = 0; }
        if (_controller != 0) { native.MaaControllerDestroy(_controller); _controller = 0; }
        _callbacks?.Dispose();
        if (_resource != 0) { native.MaaResourceDestroy(_resource); _resource = 0; }
        native.Dispose(); _native = null;
    }

    private static void Require(bool condition, string code) { if (!condition) throw new IOException(code); }
}

public sealed record MaaTaskCompletion(long TaskId, int NativeStatus);
