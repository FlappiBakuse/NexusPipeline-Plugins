using NexusPipeline.Extensibility.Lifecycle;

namespace NexusPipeline.Extensions.EmulatorSupport;

public sealed class EmulatorExtension(ExtensionActivationContext context) : IExtension
{
    public ValueTask ActivateAsync(IExtensionScope scope, CancellationToken cancellationToken) =>
        (context.Emulators ?? throw new IOException("emulator_registration_unavailable"))
            .RegisterAsync("vendors", new EmulatorProvider(), cancellationToken);
}
