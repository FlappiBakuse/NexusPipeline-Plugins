using NexusPipeline.Plugin.Abstractions;

namespace NexusPipeline.Plugin.EmulatorSupport;

internal sealed class EmulatorSupportProvider : IPluginEmulatorSupportProvider
{
    public string Id => "android-vendors";

    public int Priority => 0;

    public async ValueTask<PluginEmulatorProbeResult> ProbeAsync(
        string adbEndpoint,
        CancellationToken cancellationToken,
        int timeoutSeconds)
    {
        if (!EmulatorSupport.IsLoopbackAdbEndpoint(adbEndpoint)
            || EmulatorSupport.ParseAdbPort(adbEndpoint) is not int port)
        {
            return PluginEmulatorProbeResult.NotApplicable();
        }

        foreach (EmulatorVendor vendor in Enum.GetValues<EmulatorVendor>())
        {
            VendorProbeResult result = await EmulatorVendorDetector.ProbeAsync(
                vendor,
                adbEndpoint,
                port,
                cancellationToken,
                timeoutSeconds).ConfigureAwait(false);
            if (result.State == VendorProbeState.Error)
            {
                return PluginEmulatorProbeResult.Failure(result.Error ?? $"{vendor} 模拟器目标识别失败");
            }
            if (result.State != VendorProbeState.Match || result.Target is null)
            {
                continue;
            }

            IPluginEmulatorDriver driver = result.Target.Kind switch
            {
                EmulatorKind.LdPlayer => new LdPlayerEmulatorDriver(result.Target),
                EmulatorKind.Nox => new NoxEmulatorDriver(result.Target),
                EmulatorKind.BlueStacks => new BlueStacksEmulatorDriver(result.Target),
                _ => throw new InvalidOperationException("模拟器 provider 返回未知驱动类型。"),
            };
            return PluginEmulatorProbeResult.Match(driver);
        }
        return PluginEmulatorProbeResult.NotApplicable();
    }
}
