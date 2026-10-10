using NexusPipeline.Plugin.Abstractions;

namespace NexusPipeline.Plugin.TestKit;

public sealed class RecordingBrowserLoginRegistry : IPluginBrowserLoginRegistry
{
    public sealed record Flow(PluginBrowserLoginFlow Spec,
        Func<PluginBrowserCapture, PluginBrowserInvocation, CancellationToken, ValueTask<PluginBrowserLoginResult>> Complete,
        Func<PluginBrowserInvocation, PluginBrowserLoginTerminal, CancellationToken, ValueTask> Terminal,
        Action<PluginBrowserInvocation> ValidateInvocation);
    public Dictionary<string, Flow> Flows { get; } = new(StringComparer.Ordinal);
    public ValueTask CancelEditorAsync(PluginClientSessionContext client, string editorSessionId, CancellationToken cancellationToken = default) => ValueTask.CompletedTask;
    public IDisposable Register(PluginBrowserLoginFlow flow,
        Func<PluginBrowserCapture, PluginBrowserInvocation, CancellationToken, ValueTask<PluginBrowserLoginResult>> complete,
        Func<PluginBrowserInvocation, PluginBrowserLoginTerminal, CancellationToken, ValueTask> onTerminal,
        Action<PluginBrowserInvocation> validateInvocation)
    {
        Flows.Add(flow.Id, new(flow, complete, onTerminal, validateInvocation));
        return new Registration(() => Flows.Remove(flow.Id));
    }
    private sealed class Registration(Action release) : IDisposable { public void Dispose() => release(); }
}
