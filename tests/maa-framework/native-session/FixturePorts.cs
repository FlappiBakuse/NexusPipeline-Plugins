using System.Security.Cryptography;
using System.Text.Json;
using NexusPipeline.Extensions.MaaFramework;

internal sealed class FixtureInputs : IMaaSessionInputs
{
    private readonly List<FileStream> held = [];
    private bool disposed;
    public string RuntimeLibrary { get; }
    public string RuntimeSha256 { get; }
    public string ControllerSha256 { get; }
    public string LogDirectory { get; }
    public IReadOnlyList<string> ResourceDirectories { get; }
    internal bool Disposed => disposed;
    internal string[] ReadOnlyPaths => held.Select(file => file.Name).ToArray();
    internal FixtureInputs(string runtimeReceipt, string root, string[] resources)
    {
        using var document = JsonDocument.Parse(File.ReadAllBytes(runtimeReceipt));
        var value = document.RootElement;
        if (value.GetProperty("status").GetString() != "VERIFIED_BINARY_INPUT_ONLY") throw new IOException("fixture_runtime_not_verified");
        var runtime = Path.GetFullPath(Path.Combine(root, "../../..", "runtime"));
        var hashes = new Dictionary<string, string>(StringComparer.Ordinal);
        string[] required = ["MaaFramework.dll", "MaaCustomControlUnit.dll", "MaaUtils.dll", "opencv_world4_maa.dll", "fastdeploy_ppocr_maa.dll",
            "onnxruntime_maa.dll", "webgpu_dawn_maa.dll", "DirectML.dll", "dxcompiler.dll", "dxil.dll", "MaaAgentClient.dll"];
        foreach (var file in value.GetProperty("files").EnumerateArray())
        {
            var relative = file.GetProperty("path").GetString()!;
            if (!required.Any(name => relative == "bin/" + name)) continue;
            var path = MaaNativePath.Capture(Path.Combine(runtime, relative), false);
            var stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.Read);
            held.Add(stream);
            var sha = Convert.ToHexStringLower(SHA256.HashData(stream)); stream.Position = 0;
            if (sha != file.GetProperty("sha256").GetString()) throw new IOException("fixture_runtime_hash_mismatch");
            hashes.Add(relative, sha);
        }
        if (hashes.Count != 11) throw new IOException("fixture_runtime_closure_changed");
        RuntimeLibrary = Path.Combine(runtime, "bin/MaaFramework.dll"); RuntimeSha256 = hashes["bin/MaaFramework.dll"];
        ControllerSha256 = hashes["bin/MaaCustomControlUnit.dll"];
        LogDirectory = Path.Combine(root, "logs"); Directory.CreateDirectory(LogDirectory);
        ResourceDirectories = resources;
        foreach (var resource in resources)
            foreach (var path in Directory.EnumerateFiles(resource, "*", SearchOption.AllDirectories))
                held.Add(new FileStream(MaaNativePath.Capture(path, false), FileMode.Open, FileAccess.Read, FileShare.Read));
    }
    public void RequireCurrent() { ObjectDisposedException.ThrowIf(disposed, this); }
    public ValueTask DisposeAsync()
    {
        if (!disposed) { disposed = true; foreach (var stream in held) stream.Dispose(); }
        return ValueTask.CompletedTask;
    }
}

internal sealed class NoInputController(byte[] image) : IMaaController
{
    internal int Captures, Actions;
    internal bool Disposed, ThrowCapture, IgnoreCancellation;
    internal string? LastIntent, LastCommand;
    internal long ShellTimeout;
    internal ManualResetEventSlim? CaptureEntered, CaptureRelease;
    public bool Connect(CancellationToken cancellation) => true;
    public bool Connected(CancellationToken cancellation) => !Disposed;
    public ulong Features(CancellationToken cancellation) => 0;
    public ReadOnlyMemory<byte> Capture(CancellationToken cancellation)
    {
        Interlocked.Increment(ref Captures); CaptureEntered?.Set(); CaptureRelease?.Wait(IgnoreCancellation ? default : cancellation);
        cancellation.ThrowIfCancellationRequested();
        if (ThrowCapture) throw new IOException("fixture_sensitive_input_must_not_escape");
        return image;
    }
    private bool Deny() { Interlocked.Increment(ref Actions); return false; }
    public bool Click(int x, int y, CancellationToken cancellation) => Deny();
    public bool Swipe(int x1, int y1, int x2, int y2, int milliseconds, CancellationToken cancellation) => Deny();
    public bool Touch(int phase, int contact, int x, int y, int pressure, CancellationToken cancellation) => Deny();
    public bool Key(int phase, int code, CancellationToken cancellation) => Deny();
    public bool Text(string text, CancellationToken cancellation) => Deny();
    public bool Scroll(int dx, int dy, CancellationToken cancellation) => Deny();
    public bool Move(int dx, int dy, CancellationToken cancellation) => Deny();
    public bool Inactive(CancellationToken cancellation) => true;
    public bool StartApp(string intent, CancellationToken cancellation) { LastIntent = "start:" + intent; return Deny(); }
    public bool StopApp(string intent, CancellationToken cancellation) { LastIntent = "stop:" + intent; return Deny(); }
    public string? Shell(string command, long timeoutMilliseconds, CancellationToken cancellation)
    { LastCommand = command; ShellTimeout = timeoutMilliseconds; Deny(); return null; }
    public ValueTask DisposeAsync() { Disposed = true; return ValueTask.CompletedTask; }
}
