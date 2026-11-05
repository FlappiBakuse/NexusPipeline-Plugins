using NexusPipeline.Extensibility.Frontend;
using NexusPipeline.Extensibility.Lifecycle;

namespace NexusPipeline.Extensions.GameCheckIn;

public sealed class CheckInExtension(ExtensionActivationContext context) : IExtension, IExtensionFrontend
{
    private CheckInServices? services;
    public IReadOnlyList<FrontendOperation> Operations => SdkCheckInFrontend.Declarations;
    public async ValueTask ActivateAsync(IExtensionScope scope, CancellationToken cancellationToken)
    {
        if (services is not null) throw new CheckInFailure("checkin_already_activated");
        var current = new CheckInServices(context, new SdkCheckInNative(context.Desktop), new SdkCheckInBrowser(context.Desktop), scope.Cancellation);
        await scope.OwnAsync(current);
        cancellationToken.ThrowIfCancellationRequested(); scope.Cancellation.ThrowIfCancellationRequested();
        await context.Schedules.RegisterAsync(SdkCheckInWork.ProviderId, current.Work, cancellationToken);
        cancellationToken.ThrowIfCancellationRequested(); scope.Cancellation.ThrowIfCancellationRequested();
        services = current;
    }
    public ValueTask<FrontendResult> InvokeAsync(FrontendCall call, CancellationToken cancellationToken) =>
        services is { } current ? current.Frontend.InvokeAsync(call, cancellationToken) :
        ValueTask.FromException<FrontendResult>(new CheckInFailure("checkin_not_activated"));
}
