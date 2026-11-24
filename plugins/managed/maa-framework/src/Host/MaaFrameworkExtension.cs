using NexusPipeline.Extensibility.Lifecycle;

namespace NexusPipeline.Extensions.MaaFramework;

public sealed class MaaFrameworkExtension(ExtensionActivationContext context) : IExtension
{
    public async ValueTask ActivateAsync(IExtensionScope scope, CancellationToken cancellationToken)
    {
        await MaaProjectCompiler.RegisterAsync(context.Compilers, cancellationToken);
    }
}
