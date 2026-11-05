using System.Text.Json.Serialization;
using NexusPipeline.Extensibility.Frontend;
using NexusPipeline.Extensibility.Lifecycle;

namespace NexusPipeline.Extensions.GameActivities;

public sealed class GameActivitiesExtension(ExtensionActivationContext context) : IExtension, IExtensionFrontend
{
    private ActivityCoordinator? coordinator;
    public IReadOnlyList<FrontendOperation> Operations { get; } = [new("read-state", FrontendAccess.Read),
        new("read-feed", FrontendAccess.Read), new("read-cover", FrontendAccess.Read),
        new("save-settings", FrontendAccess.Write), new("refresh-all", FrontendAccess.Write)];

    public async ValueTask ActivateAsync(IExtensionScope scope, CancellationToken cancellationToken)
    {
        if (coordinator is not null) throw new InvalidOperationException("activity_already_activated");
        var service = new ActivityCoordinator(new SdkActivityDocuments(context.Documents ?? throw new InvalidOperationException("activity_documents_required")),
            new SdkActivityNetwork(context.Http ?? throw new InvalidOperationException("activity_http_required")), TimeProvider.System);
        var activation = context.Activation ?? throw new InvalidOperationException("activity_activation_required");
        await scope.OwnAsync(service);
        cancellationToken.ThrowIfCancellationRequested(); scope.Cancellation.ThrowIfCancellationRequested();
        coordinator = service; service.StartWhenReady(activation.WaitReadyAsync, scope.Cancellation);
    }
    public async ValueTask<FrontendResult> InvokeAsync(FrontendCall call, CancellationToken cancellationToken)
    {
        var service = coordinator ?? throw new InvalidOperationException("activity_not_activated");
        await service.WaitInitializedAsync(cancellationToken);
        object result;
        switch (call.Operation)
        {
            case "read-state": result = await service.StateAsync(cancellationToken); break;
            case "read-feed": result = await service.FeedAsync(ActivityJson.Read<FeedInput>(call.Payload).FeedId, cancellationToken); break;
            case "read-cover":
                var image = await service.CoverAsync(ActivityJson.Read<CoverInput>(call.Payload).AssetId, cancellationToken);
                return new(image.ContentType, image.Bytes);
            case "save-settings":
                var input = ActivityJson.Read<SaveInput>(call.Payload);
                await service.SaveAsync(OperationId(call), input.ExpectedRevision, input.Settings, cancellationToken);
                result = await service.StateAsync(cancellationToken); break;
            case "refresh-all":
                await service.RefreshAsync(OperationId(call), cancellationToken);
                result = await service.StateAsync(cancellationToken); break;
            default: throw new InvalidOperationException("activity_operation_unknown");
        }
        return new("application/json", ActivityJson.Bytes(result));
    }
    private static Guid OperationId(FrontendCall call) => call.OperationId is { } id && id != Guid.Empty ? id :
        throw new InvalidOperationException("activity_operation_id_required");
    private sealed record FeedInput([property: JsonRequired] string FeedId);
    private sealed record CoverInput([property: JsonRequired] string AssetId);
    private sealed record SaveInput([property: JsonRequired] long ExpectedRevision, [property: JsonRequired] ActivitySettings Settings);
}
