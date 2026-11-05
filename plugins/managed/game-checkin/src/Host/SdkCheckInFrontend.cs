using NexusPipeline.Extensibility.Frontend;

namespace NexusPipeline.Extensions.GameCheckIn;

internal sealed class SdkCheckInFrontend(CheckInFrontend application, CheckInClients clients, Task initialized) : IExtensionFrontend
{
    internal static IReadOnlyList<FrontendOperation> Declarations { get; } = [
        new("read-state", FrontendAccess.Read), new("read-editor", FrontendAccess.Read), new("read-publication", FrontendAccess.Read),
        new("open-editor", FrontendAccess.Write), new("lease-editor", FrontendAccess.Write), new("close-editor", FrontendAccess.Write),
        new("save-task", FrontendAccess.Write), new("delete-task", FrontendAccess.Write), new("reorder-tasks", FrontendAccess.Write), new("run-task", FrontendAccess.Write),
        new("confirm-reveal", FrontendAccess.RevealSecret), new("reveal-credential", FrontendAccess.RevealSecret),
        new("begin-browser-login", FrontendAccess.Desktop), new("cancel-browser-login", FrontendAccess.Write),
        new("prepare-tajiduo", FrontendAccess.Desktop), new("send-tajiduo-code", FrontendAccess.Desktop), new("login-tajiduo", FrontendAccess.Desktop), new("cancel-tajiduo", FrontendAccess.Write)
    ];
    public IReadOnlyList<FrontendOperation> Operations => Declarations;

    public async ValueTask<FrontendResult> InvokeAsync(FrontendCall call, CancellationToken cancellationToken)
    {
        await initialized.WaitAsync(cancellationToken);
        try
        {
            var operation = Operations.SingleOrDefault(operation => operation.Name == call.Operation) ?? throw new CheckInFailure("checkin_operation_unknown");
            if (call.ContentType != "application/json" || call.FileName is not null || call.Payload.Length > 1048576 ||
                operation.Access == FrontendAccess.Read && call.OperationId is not null ||
                operation.Access != FrontendAccess.Read && (call.OperationId is null || call.OperationId == Guid.Empty))
                throw new CheckInFailure("checkin_operation_invalid");
            var client = clients.Get(call.ClientId, call.ClientLifetime);
            var result = await application.InvokeAsync(call.Operation, call.OperationId, client, call.Payload, cancellationToken);
            client.Require();
            return new("application/json", CheckInJson.Bytes(new { ok = true, value = result }));
        }
        catch (CheckInFailure error)
        { return new("application/json", CheckInJson.Bytes(new { ok = false, error = new { code = error.Code } })); }
    }
}
