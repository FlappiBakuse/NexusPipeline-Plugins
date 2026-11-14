using System.Reflection;
using NexusPipeline.Extensions.GameActivities;
using NexusPipeline.Extensibility.Assets;
using NexusPipeline.Extensibility.Frontend;
using NexusPipeline.Extensibility.Lifecycle;
using NexusPipeline.Extensibility.Media;
using NexusPipeline.Extensibility.Notifications;
using NexusPipeline.Extensibility.Scheduling;
using NexusPipeline.Extensibility.Secrets;

internal static class SdkCases
{
    internal static async Task RunAsync(Func<string, Func<Task>, Task> run)
    {
        await run("actual-sdk-documents-and-http-adapters", async () =>
        {
            var saved = new TestDocuments(); var docs = new SdkActivityDocuments(saved); var http = new TestNetwork(); var net = new SdkActivityNetwork(http);
            var op = Guid.NewGuid(); var first = await docs.WriteAsync(op, "settings", 0, ActivityJson.Bytes(new ActivitySettings()), default);
            var replay = await docs.WriteAsync(op, "settings", 0, ActivityJson.Bytes(new ActivitySettings()), default);
            Check.That(first.IsNew && !replay.IsNew && (await docs.ReadAsync("settings", default))?.Revision == 1);
            await net.GetAsync(ActivitySources.All[0].Endpoint, 4194304, default); Check.That(http.MaximumBytes == 4194304);
        });
        await run("actual-sdk-extension-dispatch-scope-save-read-feed-and-stop", async () =>
        {
            var docs = new TestDocuments(); var net = new TestNetwork();
            var context = new ExtensionActivationContext(Empty<IScheduleRegistrationPort>(), Empty<IExtensionSecretPort>(),
                Empty<INotificationSubmissionPort>(), Empty<IMediaPreviewRegistrationPort>(), Empty<IRunScreenshotPort>(),
                Empty<IExtensionPackageAssets>(), Empty<IExtensionRuntimeOutputs>(), docs, net, activation: new ReadyGate(true), images: new TestImages(docs));
            await using var scope = new TestScope(); var extension = new GameActivitiesExtension(context);
            await extension.ActivateAsync(scope, default);
            var state = await extension.InvokeAsync(new("read-state", null, "fixture", false, "{}"u8.ToArray()), default);
            Check.That(state.ContentType == "application/json" && Check.Element(System.Text.Json.JsonDocument.Parse(state.Content).RootElement).GetProperty("settingsRevision").GetInt64() == 0);
            var input = ActivityJson.Bytes(new { expectedRevision = 0, settings = new ActivitySettings { RotationSeconds = 40 } });
            await Check.Reject(async () => await extension.InvokeAsync(new("save-settings", null, "fixture", false, input), default), "operation_id");
            var operationId = Guid.NewGuid();
            await extension.InvokeAsync(new("save-settings", operationId, "fixture", false, input), default);
            var writes = docs.Writes;
            var completion = await extension.InvokeAsync(new("read-settings-result", null, "fixture", false,
                ActivityJson.Bytes(new { operationId })), default);
            var proof = System.Text.Json.JsonDocument.Parse(completion.Content).RootElement;
            Check.That(proof.GetProperty("operationId").GetGuid() == operationId && proof.GetProperty("committed").GetBoolean());
            var missing = await extension.InvokeAsync(new("read-settings-result", null, "fixture", false,
                ActivityJson.Bytes(new { operationId = Guid.NewGuid() })), default);
            Check.That(!System.Text.Json.JsonDocument.Parse(missing.Content).RootElement.GetProperty("committed").GetBoolean() &&
                docs.Writes == writes);
            Check.That(ActivityJson.Read<ActivitySettings>(docs.Values["settings"].Json).RotationSeconds == 40 && net.Calls.Count == 0);
            await extension.InvokeAsync(new("read-feed", null, "fixture", false, "{\"feedId\":\"blue-archive/cn\"}"u8.ToArray()), default);
            Check.That(extension.Operations.Single(op => op.Name == "read-cover").Access == FrontendAccess.Read);
            await scope.DisposeAsync(); Check.That(docs.Values.ContainsKey("settings"));
        });
        await ReadyCases.RunAsync(run);
        await ImageCacheCases.RunAsync(run);
    }
    private static T Empty<T>() where T : class => DispatchProxy.Create<T, UnusedPort>();
}

internal sealed class ReadyGate : IExtensionActivation
{
    private readonly TaskCompletionSource ready = new(TaskCreationOptions.RunContinuationsAsynchronously);
    internal ReadyGate(bool completed = false) { if (completed) ready.SetResult(); }
    internal void Publish() => ready.SetResult();
    public async ValueTask WaitReadyAsync(CancellationToken cancellationToken) => await ready.Task.WaitAsync(cancellationToken);
}

public class UnusedPort : DispatchProxy
{
    protected override object? Invoke(MethodInfo? targetMethod, object?[]? args) => throw new InvalidOperationException("unexpected_sdk_port_" + targetMethod?.Name);
}
internal sealed class TestScope : IExtensionScope
{
    private readonly CancellationTokenSource cancellation = new();
    private readonly List<IAsyncDisposable> resources = [];
    private bool stopped;
    public CancellationToken Cancellation => cancellation.Token;
    public ValueTask OwnAsync(IAsyncDisposable resource) { resources.Add(resource); return ValueTask.CompletedTask; }
    public async ValueTask DisposeAsync()
    {
        if (stopped) return; stopped = true; cancellation.Cancel();
        foreach (var resource in resources.AsEnumerable().Reverse()) await resource.DisposeAsync();
    }
}
