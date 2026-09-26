namespace NexusPipeline.Plugin.MaaFrameworkDriver;

// Only fixed codes constructed by the driver are exposed; project/native messages stay private.
internal sealed class NativeStartupException(string code) : Exception
{
    internal string Code { get; } = code;
}
