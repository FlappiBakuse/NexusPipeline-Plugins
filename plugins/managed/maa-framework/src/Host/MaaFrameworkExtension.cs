using NexusPipeline.Extensibility.Lifecycle;
using NexusPipeline.Extensibility.Frontend;
using System.Text.Json;

namespace NexusPipeline.Extensions.MaaFramework;

public sealed class MaaFrameworkExtension(ExtensionActivationContext context) : IExtension, IExtensionFrontend
{
    public IReadOnlyList<FrontendOperation> Operations { get; } = [new("find-windows", FrontendAccess.Desktop)];

    public async ValueTask ActivateAsync(IExtensionScope scope, CancellationToken cancellationToken)
    {
        await MaaProjectCompiler.RegisterAsync(context.Compilers, cancellationToken);
    }

    public async ValueTask<FrontendResult> InvokeAsync(FrontendCall call, CancellationToken cancellationToken)
    {
        if (call.Operation != "find-windows" || call.OperationId is null || call.OperationId == Guid.Empty ||
            call.ContentType != "application/json" || call.FileName is not null || call.Payload.Length > 1024)
            throw new MaaInputFailure("maa_frontend_operation_invalid");
        using var body = JsonDocument.Parse(call.Payload, new() { MaxDepth = 2 });
        if (body.RootElement.ValueKind != JsonValueKind.Object || body.RootElement.EnumerateObject().Any())
            throw new MaaInputFailure("maa_frontend_input_invalid");
        var desktop = context.Desktop ?? throw new MaaInputFailure("maa_desktop_unavailable");
        var windows = await desktop.ReadWindowsAsync(cancellationToken).ConfigureAwait(false);
        return new("application/json", JsonSerializer.SerializeToUtf8Bytes(windows, new JsonSerializerOptions(JsonSerializerDefaults.Web)));
    }
}
