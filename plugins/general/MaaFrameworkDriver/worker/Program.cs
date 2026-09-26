using System.IO.Pipes;
using System.Text.Json;
using System.Text.Json.Nodes;
using NexusPipeline.Plugin.Abstractions;
using NexusPipeline.Plugin.MaaFrameworkDriver;

if (args.Length != 0 || !Console.IsInputRedirected)
{
    Console.Error.WriteLine("MaaFramework worker must be started by NexusPipeline through an authenticated session.");
    return 64;
}
// Never let an unauthenticated launcher allocate an unbounded line.
using var bootstrapDeadline = new CancellationTokenSource(TimeSpan.FromSeconds(30));
var bootstrapText = new System.Text.StringBuilder();
var characters = new char[4096];
bool terminated = false;
while (!terminated)
{
    int count;
    try { count = await Console.In.ReadAsync(characters.AsMemory(), bootstrapDeadline.Token); }
    catch (OperationCanceledException) { return 64; }
    if (count == 0) return 64;
    int end = Array.IndexOf(characters, '\n', 0, count);
    bootstrapText.Append(characters, 0, end >= 0 ? end : count);
    if (bootstrapText.Length > PluginWorkerProtocol.MaximumFrameBytes) return 64;
    terminated = end >= 0;
}
string input = bootstrapText.ToString().TrimEnd('\r');
if (System.Text.Encoding.UTF8.GetByteCount(input) > PluginWorkerProtocol.MaximumFrameBytes) return 64;
PluginWorkerBootstrap bootstrap;
try { bootstrap = JsonSerializer.Deserialize<PluginWorkerBootstrap>(input, PluginWorkerProtocol.Json)!; }
catch (JsonException) { return 64; }
if (bootstrap is null || bootstrap.Nonce.Length != 64 || bootstrap.SessionId.Length != 32) return 64;
using var events = new NamedPipeClientStream(".", bootstrap.EventPipe, PipeDirection.Out, PipeOptions.Asynchronous | PipeOptions.CurrentUserOnly);
using var control = new NamedPipeClientStream(".", bootstrap.ControlPipe, PipeDirection.In, PipeOptions.Asynchronous | PipeOptions.CurrentUserOnly);
using var startup = new CancellationTokenSource(TimeSpan.FromSeconds(30));
await Task.WhenAll(events.ConnectAsync(startup.Token), control.ConnectAsync(startup.Token));
long sequence = 0;
using var sendGate = new SemaphoreSlim(1, 1);
async ValueTask Send(string kind, JsonObject payload)
{
    await sendGate.WaitAsync();
    try
    {
        await PluginWorkerProtocol.WriteAsync(events, new(1, bootstrap.ExecutionId, bootstrap.RecordId,
            bootstrap.AttemptNumber, bootstrap.SessionId, "worker_to_host", ++sequence, kind, payload), CancellationToken.None);
    }
    finally { sendGate.Release(); }
}
await Send("handshake", new() { ["nonce"] = bootstrap.Nonce });
var start = await PluginWorkerProtocol.ReadAsync(control, startup.Token);
PluginWorkerProtocol.Validate(start, bootstrap, "host_to_worker", 1);
if (start.Kind != "start") return 65;
using var cancelled = new CancellationTokenSource();
var session = new NativeSession();
Task controls = Task.Run(async () =>
{
    try
    {
        var cancel = await PluginWorkerProtocol.ReadAsync(control, CancellationToken.None);
        PluginWorkerProtocol.Validate(cancel, bootstrap, "host_to_worker", 2);
        if (cancel.Kind != "cancel") throw new InvalidDataException("invalid control");
        await Send("cancel_ack", new() { ["status"] = "cancelled" });
        cancelled.Cancel(); session.RequestStop();
    }
    catch (Exception ex) when (ex is IOException or ObjectDisposedException) { cancelled.Cancel(); session.RequestStop(); }
});
try
{
    var profile = bootstrap.Input["profile"]!.Deserialize<DriverProfile>(DriverJson.Options)!;
    var compiled = bootstrap.Input["compiled"]!.Deserialize<CompiledProject>(DriverJson.Options)!;
    var secrets = bootstrap.Input["secrets"] as JsonObject ?? new();
    await session.RunAsync(profile, compiled, secrets, Send, cancelled.Token);
    await Send("completed", new() { ["status"] = cancelled.IsCancellationRequested ? "cancelled" : "succeeded" });
    return cancelled.IsCancellationRequested ? 2 : 0;
}
catch (Exception ex)
{
    // Project values, native details and command lines can contain secrets.
    await Send("fault", new() { ["status"] = "failed", ["code"] = ex is NativeStartupException native ? "worker." + native.Code
        : ex is OperationCanceledException ? "worker.cancelled" : "worker." + ex.GetType().Name });
    return cancelled.IsCancellationRequested ? 2 : 1;
}
finally
{
    session.Dispose(); control.Dispose();
    try { await controls; } catch (Exception ex) when (ex is IOException or ObjectDisposedException) { }
}
