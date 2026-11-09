using System.Reflection;
using System.Text;
using System.Text.Json;
using NexusPipeline.Extensions.GameCheckIn;
using NexusPipeline.Extensibility.Assets;
using NexusPipeline.Extensibility.Frontend;
using NexusPipeline.Extensibility.Lifecycle;
using NexusPipeline.Extensibility.Media;
using NexusPipeline.Extensibility.Networking;
using NexusPipeline.Extensibility.Notifications;
using NexusPipeline.Extensibility.Scheduling;

internal static class ServiceCases
{
    private static readonly AsyncLocal<string?> Caller = new();
    internal static async Task RunAsync(Func<string, Func<Task>, Task> run)
    {
        static void Assert(bool value) { if (!value) throw new InvalidOperationException("assertion_failed"); }
        await run("scope-services-ready-without-inheriting-original-use", async () => {
            using var fixture = new Fixture(); Caller.Value = "original-frontend-use";
            await using var services = new CheckInServices(fixture.Context, new Native(), new Capture(), fixture.Scope.Token);
            await fixture.Activation.Entered.Task; Assert(fixture.Ports.DocumentReads == 0 && fixture.Activation.Caller is null);
            Caller.Value = null; fixture.Activation.Ready.SetResult();
            var call = new FrontendCall("unknown-operation", null, "fixture", true, "{}"u8.ToArray());
            for (var index = 0; index < 2; index++)
            {
                using var response = JsonDocument.Parse((await services.Frontend.InvokeAsync(call, default)).Content);
                Assert(!response.RootElement.GetProperty("ok").GetBoolean() &&
                    response.RootElement.GetProperty("error").GetProperty("code").GetString() == "checkin_operation_unknown");
            }
            Assert(services.Work.IdentityVersion == "v1");
        });
        await run("scope-stop-before-publication-cancels-initialization-without-document-consumption", async () => {
            using var fixture = new Fixture(); var services = new CheckInServices(fixture.Context, new Native(), new Capture(), fixture.Scope.Token);
            await fixture.Activation.Entered.Task; await services.DisposeAsync(); await services.DisposeAsync();
            Assert(fixture.Activation.Cancelled && fixture.Ports.DocumentReads == 0);
        });
        await run("scope-stop-waits-owned-capture-drain-before-service-disposal-finishes", async () => {
            using var fixture = new Fixture(); var capture = new Capture { Cleanup = new(TaskCreationOptions.RunContinuationsAsynchronously) };
            var services = new CheckInServices(fixture.Context, new Native(), capture, fixture.Scope.Token);
            await fixture.Activation.Entered.Task; var stopping = services.DisposeAsync().AsTask();
            await capture.Draining.Task; Assert(!stopping.IsCompleted && fixture.Ports.DocumentReads == 0);
            capture.Cleanup.SetResult(); await stopping; Assert(fixture.Activation.Cancelled);
        });
        await run("scope-initialization-preserves-unsupported-document-and-front-does-not-return-empty", async () => {
            using var fixture = new Fixture(); var bytes = Encoding.UTF8.GetBytes("{\"formatVersion\":9,\"tasks\":[]}"); fixture.Ports.Document = new(7, "original", bytes);
            await using var services = new CheckInServices(fixture.Context, new Native(), new Capture(), fixture.Scope.Token);
            await fixture.Activation.Entered.Task; fixture.Activation.Ready.SetResult();
            try { await services.Frontend.InvokeAsync(new("read-state", null, "fixture", true, "{}"u8.ToArray()), default); }
            catch (CheckInFailure) { Assert(fixture.Ports.Document.Json.Span.SequenceEqual(bytes) && fixture.Ports.AtomicWrites == 0); return; }
            throw new InvalidOperationException("unknown_document_became_empty");
        });
    }
    private sealed class Fixture : IDisposable
    {
        internal readonly PersistencePorts Ports = new();
        internal readonly CancellationTokenSource Scope = new();
        internal readonly Activation Activation = new();
        internal readonly ExtensionActivationContext Context;
        internal Fixture() => Context = new(Fake<IScheduleRegistrationPort>(), Ports, Fake<INotificationSubmissionPort>(), Fake<IMediaPreviewRegistrationPort>(),
            Fake<IRunScreenshotPort>(), Fake<IExtensionPackageAssets>(), Fake<IExtensionRuntimeOutputs>(), documents: Ports, http: Fake<IExtensionHttp>(),
            activation: Activation, secretDocuments: Ports, notificationTargets: Fake<INotificationTargets>(), workTasks: Fake<IWorkTasks>(), workEffects: Fake<IWorkEffects>());
        public void Dispose() { Scope.Cancel(); Scope.Dispose(); Ports.Dispose(); Caller.Value = null; }
    }
    private sealed class Activation : IExtensionActivation
    {
        internal readonly TaskCompletionSource Entered = new(TaskCreationOptions.RunContinuationsAsynchronously), Ready = new(TaskCreationOptions.RunContinuationsAsynchronously);
        internal string? Caller;
        internal bool Cancelled;
        public async ValueTask WaitReadyAsync(CancellationToken cancellationToken)
        {
            Caller = ServiceCases.Caller.Value; Entered.TrySetResult();
            try { await Ready.Task.WaitAsync(cancellationToken); }
            catch (OperationCanceledException) { Cancelled = true; throw; }
        }
    }
    private sealed class Native : ICheckInNativeLogin
    {
        public ValueTask<CheckInNativeAvailability> ReadAsync(CheckInClient client, CancellationToken cancellationToken) => throw new InvalidOperationException("unexpected_native_read");
        public ValueTask RequireAsync(CheckInClient client, CancellationToken cancellationToken) => throw new InvalidOperationException("unexpected_native_action");
    }
    private sealed class Capture : ICheckInBrowserCapture
    {
        internal TaskCompletionSource? Cleanup;
        internal readonly TaskCompletionSource Draining = new(TaskCreationOptions.RunContinuationsAsynchronously);
        public async ValueTask DisposeAsync() { Draining.TrySetResult(); if (Cleanup is not null) await Cleanup.Task; }
        public ValueTask<BrowserCredentialCapture> CaptureAsync(CheckInClient client, CheckInLoginPolicy policy, Guid nonce, Func<BrowserCredentialCapture, CancellationToken, ValueTask<bool>> validate, CancellationToken cancellationToken) => throw new InvalidOperationException("unexpected_capture");
        public ValueTask CancelAsync(CheckInClient client, Guid nonce, CancellationToken cancellationToken) => throw new InvalidOperationException("unexpected_capture_cancel");
    }
    private static T Fake<T>() where T : class => DispatchProxy.Create<T, UnexpectedSdkCall>();
}

public class UnexpectedSdkCall : DispatchProxy
{
    protected override object? Invoke(MethodInfo? method, object?[]? args) => throw new InvalidOperationException("unexpected_sdk_call_" + method?.Name);
}
