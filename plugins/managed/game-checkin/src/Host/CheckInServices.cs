using NexusPipeline.Extensibility.Lifecycle;

namespace NexusPipeline.Extensions.GameCheckIn;

internal sealed class CheckInServices : IAsyncDisposable
{
    private readonly CancellationTokenSource lifetime;
    private readonly CheckInClients clients;
    private readonly CheckInEditors editors;
    private readonly CredentialRevealGrants grants;
    private readonly CheckInBrowserLogins browser;
    private readonly ICheckInBrowserCapture capture;
    private readonly TajiduoLogins tajiduo;
    private readonly SklandDeviceProvider devices;
    private readonly Task initialized;
    private int disposed;
    internal SdkCheckInFrontend Frontend { get; }
    internal CheckInWorkHandler Work { get; }

    internal CheckInServices(ExtensionActivationContext context, ICheckInNativeLogin native, ICheckInBrowserCapture capture,
        CancellationToken scopeCancellation)
    {
        ArgumentNullException.ThrowIfNull(native); ArgumentNullException.ThrowIfNull(capture);
        this.capture = capture;
        var documents = context.Documents ?? throw new CheckInFailure("checkin_documents_required");
        var atomic = context.SecretDocuments ?? throw new CheckInFailure("checkin_atomic_required");
        var http = context.Http ?? throw new CheckInFailure("checkin_http_required");
        var work = context.WorkTasks ?? throw new CheckInFailure("checkin_work_required");
        var effects = context.WorkEffects ?? throw new CheckInFailure("checkin_effects_required");
        var targetPort = context.NotificationTargets ?? throw new CheckInFailure("checkin_targets_required");
        var activation = context.Activation ?? throw new CheckInFailure("checkin_activation_required");
        lifetime = CancellationTokenSource.CreateLinkedTokenSource(scopeCancellation);
        var clock = TimeProvider.System; clients = new(lifetime.Token); editors = new(clock); grants = new(clock);
        var persistence = new SdkCheckInPersistence(documents, context.Secrets, atomic); var network = new SdkCheckInNetwork(http);
        devices = new(network, clock); var verifier = new CheckInIdentity(network, devices, clock);
        browser = new(editors, native, capture, verifier.VerifyAsync); tajiduo = new(editors, new(network, clock), native, clock);
        var control = new SdkCheckInWork(work, persistence); var targets = new SdkCheckInNotifications(targetPort);
        var runtime = new SdkCheckInRuntime(work, persistence, control, targets); var execution = new SdkCheckInExecution(work, effects, persistence);
        var protocols = new CheckInProtocols(network, execution, devices, clock); var runner = new CheckInRunner(persistence, protocols, execution, clock);
        Work = new(persistence, runner, control, targets, new(context.Notifications, targets));
        var application = new CheckInFrontend(new(persistence, editors, runtime), new(persistence, runtime, native), editors,
            new(persistence, editors, grants), browser, tajiduo);
        var initializationCancellation = lifetime.Token;
        async Task InitializeAsync()
        {
            await activation.WaitReadyAsync(initializationCancellation);
            _ = await persistence.ReadTasksAsync(initializationCancellation);
        }
        // Initialization outlives activation's call frame and must use the extension's own consumption context.
        if (ExecutionContext.IsFlowSuppressed()) initialized = Task.Run(InitializeAsync);
        else { using (ExecutionContext.SuppressFlow()) initialized = Task.Run(InitializeAsync); }
        Frontend = new(application, clients, initialized);
    }
    public async ValueTask DisposeAsync()
    {
        if (Interlocked.Exchange(ref disposed, 1) != 0) return;
        CheckInCancellation.Stop(lifetime);
        clients.Dispose(); browser.Dispose(); tajiduo.Dispose();
        await capture.DisposeAsync(); editors.Dispose(); grants.Dispose();
        try { await initialized; }
        catch (Exception error) when (error is not OutOfMemoryException) { }
        await devices.DisposeAsync();
    }
}
