using NexusPipeline.Extensibility.Execution;
using NexusPipeline.Extensibility.Protocol;

namespace NexusPipeline.Extensions.MaaFramework;

internal interface IMaaResourceSource
{
    Task<ExecutionProjectResponse> ManifestAsync(CancellationToken cancellation);
    Task<ExecutionProjectResponse> TreeAsync(string name, long index, CancellationToken cancellation);
    Task<ExecutionProjectResponse> FileAsync(string name, string path, long offset, int maximum, CancellationToken cancellation);
}

internal sealed class MaaResourceSource(ExecutionProjectReader reader) : IMaaResourceSource
{
    public Task<ExecutionProjectResponse> ManifestAsync(CancellationToken cancellation) => reader.ManifestAsync(cancellation);
    public Task<ExecutionProjectResponse> TreeAsync(string name, long index, CancellationToken cancellation) => reader.TreeAsync(name, index, cancellation);
    public Task<ExecutionProjectResponse> FileAsync(string name, string path, long offset, int maximum, CancellationToken cancellation) =>
        reader.ReadFileAsync(name, path, offset, maximum, cancellation);
}
