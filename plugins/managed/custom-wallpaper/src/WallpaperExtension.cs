using NexusPipeline.Extensibility.Frontend;
using NexusPipeline.Extensibility.Lifecycle;

namespace NexusPipeline.Extensions.CustomWallpaper;

public sealed class WallpaperExtension(ExtensionActivationContext context) : IExtension, IExtensionFrontend
{
    private readonly WallpaperService _service = new(context);

    public IReadOnlyList<FrontendOperation> Operations { get; } =
    [new("read-state", FrontendAccess.Read), new("read-asset", FrontendAccess.Read),
        new("advance-rotation", FrontendAccess.Read), new("save-settings", FrontendAccess.Write),
        new("upload-asset", FrontendAccess.Write), new("save-palette", FrontendAccess.Write), new("delete-asset", FrontendAccess.Write)];

    public ValueTask ActivateAsync(IExtensionScope scope, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        return scope.OwnAsync(_service);
    }

    public ValueTask<FrontendResult> InvokeAsync(FrontendCall call, CancellationToken cancellationToken) =>
        _service.InvokeAsync(call, cancellationToken);
}
