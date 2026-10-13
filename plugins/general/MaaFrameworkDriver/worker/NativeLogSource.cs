using System.Text.Json.Nodes;

namespace NexusPipeline.Plugin.MaaFrameworkDriver;

internal sealed class NativeLogSource(string directory, Func<string, JsonObject, ValueTask> send, IEnumerable<string> secrets)
{
    private readonly SessionLogReader _reader = new(Path.Combine(directory, "maafw.log"), "maafw.log", "native", send, secrets,
        backupPattern: "maafw.bak.*.log");
    internal void Start() => _reader.Start();
    internal ValueTask CompleteAsync() => _reader.CompleteAsync();
}
