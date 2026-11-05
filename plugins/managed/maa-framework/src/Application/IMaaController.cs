namespace NexusPipeline.Extensions.MaaFramework;

internal interface IMaaController : IAsyncDisposable
{
    bool Connect(CancellationToken cancellation);
    bool Connected(CancellationToken cancellation);
    ulong Features(CancellationToken cancellation);
    ReadOnlyMemory<byte> Capture(CancellationToken cancellation);
    bool Click(int x, int y, CancellationToken cancellation);
    bool Swipe(int x1, int y1, int x2, int y2, int milliseconds, CancellationToken cancellation);
    bool Touch(int phase, int contact, int x, int y, int pressure, CancellationToken cancellation);
    bool Key(int phase, int code, CancellationToken cancellation);
    bool Text(string text, CancellationToken cancellation);
    bool Scroll(int dx, int dy, CancellationToken cancellation);
    bool Move(int dx, int dy, CancellationToken cancellation);
    bool Inactive(CancellationToken cancellation);
    bool StartApp(string intent, CancellationToken cancellation);
    bool StopApp(string intent, CancellationToken cancellation);
    string? Shell(string command, long timeoutMilliseconds, CancellationToken cancellation);
}

internal interface IMaaSessionInputs : IAsyncDisposable
{
    string RuntimeLibrary { get; }
    string RuntimeSha256 { get; }
    string ControllerSha256 { get; }
    string LogDirectory { get; }
    IReadOnlyList<string> ResourceDirectories { get; }
    void RequireCurrent();
}

internal sealed record MaaSessionTask(string OccurrenceId, string SourceId, string Entry, ReadOnlyMemory<byte> Pipeline, int RepeatCount)
{
    internal int CompletedRepetitions { get; init; }
}
internal sealed record MaaNativeTaskFact(string OccurrenceId, string SourceId, int Repetition, long NativeTaskId, int Status);
internal sealed record MaaNativeEvent(long TaskId, string Code);
