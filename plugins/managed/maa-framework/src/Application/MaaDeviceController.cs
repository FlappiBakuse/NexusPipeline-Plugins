using NexusPipeline.Extensibility.Execution;
using NexusPipeline.Extensibility.Protocol;

namespace NexusPipeline.Extensions.MaaFramework;

internal sealed class MaaDeviceController(ExecutionDeviceClient client) : IMaaController
{
    private ulong _features;
    internal async Task ConfigureAsync(System.Text.Json.Nodes.JsonObject controller, CancellationToken cancellation)
    {
        if (MaaJson.Required(controller, "type") == "Adb")
        {
            var configured = await client.InvokeAsync(new() { Sequence = 1, Kind = "configure", CaptureMethod = "adb",
                MouseMethod = "adb", KeyboardMethod = "adb" }, cancellation).ConfigureAwait(false);
            if (!configured.Success) throw new IOException("maa_device_configuration_unavailable");
            _features = 0; return;
        }
        var methods = controller["win32"]!.AsObject();
        var capture = MaaJson.Required(methods, "screencap") switch {
            "PrintWindow" => "printWindow", "GDI" => "gdi", "ScreenDC" => "screenDc", "FramePool" => "framePool",
            _ => throw new MaaInputFailure("maa_controller_methods_unavailable") };
        static string Input(string value) => value switch {
            "SendMessage" => "sendMessage", "PostMessage" => "postMessage",
            "SendMessageWithCursorPos" => "sendMessageWithCursorPos", "Seize" => "seize",
            _ => throw new MaaInputFailure("maa_controller_methods_unavailable") };
        var response = await client.InvokeAsync(new() { Sequence = 1, Kind = "configure", CaptureMethod = capture,
            MouseMethod = Input(MaaJson.Required(methods, "mouse")), KeyboardMethod = Input(MaaJson.Required(methods, "keyboard")) }, cancellation).ConfigureAwait(false);
        if (!response.Success) throw new IOException("maa_device_configuration_unavailable");
        _features = 3;
    }
    public bool Connect(CancellationToken cancellation) => Call(new() { Sequence = 1, Kind = "connect" }, cancellation).Success;
    public bool Connected(CancellationToken cancellation) => Call(new() { Sequence = 1, Kind = "connected" }, cancellation).Success;
    public ulong Features(CancellationToken cancellation)
    {
        var response = Call(new() { Sequence = 1, Kind = "features" }, cancellation);
        // Maa applies its configured press duration when Win32 input exposes separate down and up callbacks.
        return response.Success && response.Features is >= 0 ? checked((ulong)response.Features.Value) | _features : throw new IOException("maa_device_features_unavailable");
    }
    public ReadOnlyMemory<byte> Capture(CancellationToken cancellation) => client.CaptureAsync(cancellation).GetAwaiter().GetResult();
    public bool Click(int x, int y, CancellationToken cancellation) =>
        Call(new() { Sequence = 1, Kind = "click", X = x, Y = y }, cancellation).Success;
    public bool Swipe(int x1, int y1, int x2, int y2, int milliseconds, CancellationToken cancellation) =>
        Call(new() { Sequence = 1, Kind = "swipe", X = x1, Y = y1, X2 = x2, Y2 = y2, DurationMilliseconds = milliseconds }, cancellation).Success;
    public bool Touch(int phase, int contact, int x, int y, int pressure, CancellationToken cancellation) =>
        Call(new() { Sequence = 1, Kind = "touch", Phase = phase, Contact = contact,
            X = phase == 2 ? null : x, Y = phase == 2 ? null : y, Pressure = phase == 2 ? null : pressure }, cancellation).Success;
    public bool Key(int phase, int code, CancellationToken cancellation) =>
        Call(new() { Sequence = 1, Kind = "key", Phase = phase, KeyCode = code }, cancellation).Success;
    public bool Text(string text, CancellationToken cancellation) => Call(new() { Sequence = 1, Kind = "text", Text = text }, cancellation).Success;
    public bool Scroll(int dx, int dy, CancellationToken cancellation) => Call(new() { Sequence = 1, Kind = "scroll", Dx = dx, Dy = dy }, cancellation).Success;
    public bool Move(int dx, int dy, CancellationToken cancellation) => Call(new() { Sequence = 1, Kind = "move", Dx = dx, Dy = dy }, cancellation).Success;
    public bool Inactive(CancellationToken cancellation) => Call(new() { Sequence = 1, Kind = "inactive" }, cancellation).Success;
    public bool StartApp(string intent, CancellationToken cancellation) => Call(new() { Sequence = 1, Kind = "startApp", Intent = intent }, cancellation).Success;
    public bool StopApp(string intent, CancellationToken cancellation) => Call(new() { Sequence = 1, Kind = "stopApp", Intent = intent }, cancellation).Success;
    public string? Shell(string command, long timeoutMilliseconds, CancellationToken cancellation)
    {
        var response = Call(new() { Sequence = 1, Kind = "shell", Command = command, TimeoutMilliseconds = timeoutMilliseconds }, cancellation);
        return response.Success ? response.Text : null;
    }
    private ExecutionDeviceResponse Call(ExecutionDeviceRequest request, CancellationToken cancellation) =>
        client.InvokeAsync(request, cancellation).GetAwaiter().GetResult();
    public ValueTask DisposeAsync() => client.DisposeAsync();
}
