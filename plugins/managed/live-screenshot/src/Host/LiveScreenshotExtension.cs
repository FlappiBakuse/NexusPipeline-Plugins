using NexusPipeline.Extensibility.Lifecycle;
using NexusPipeline.Extensibility.Media;
using NexusPipeline.Extensibility.Protocol;

namespace NexusPipeline.Extensions.LiveScreenshot;

public sealed class LiveScreenshotExtension(ExtensionActivationContext context) : IExtension
{
    public ValueTask ActivateAsync(IExtensionScope scope, CancellationToken cancellationToken) =>
        context.MediaPreviews.RegisterAsync("current-task", new CurrentTaskPreview(context.RunScreenshots), cancellationToken);

    private sealed class CurrentTaskPreview(IRunScreenshotPort screenshots) : IMediaFrameProvider
    {
        public ValueTask<MediaFrameContent> CaptureAsync(MediaCapture request, CancellationToken cancellationToken) =>
            screenshots.CaptureAsync(request, cancellationToken);
    }
}
