using System.Text.Json;
using NexusPipeline.Extensibility.Compilation;

namespace NexusPipeline.Extensions.MaaFramework;

internal sealed class MaaProjectCompiler : IProjectCompiler
{
    internal static ValueTask RegisterAsync(ICompilerRegistration? registration, CancellationToken cancellation)
        => (registration ?? throw new IOException("maa_compiler_registration_unavailable")).RegisterAsync("project", new MaaProjectCompiler(), cancellation);
    public async ValueTask<JsonElement> DiscoverAsync(ISelectedSource source, JsonElement selection, CancellationToken cancellationToken)
    {
        var choice = MaaCompilerChoice.Read(selection, false); var files = new MaaSelectedFiles(source, cancellationToken);
        await MaaSourceDiscovery.CaptureAsync(files, choice);
        var candidates = MaaProjectDiscovery.Discover(files.Snapshot(), choice.InterfacePath);
        return JsonSerializer.SerializeToElement(candidates);
    }
    public async ValueTask<CompilationResult> CompileAsync(ISelectedSource source, JsonElement selection, CancellationToken cancellationToken)
    {
        var choice = MaaCompilerChoice.Read(selection, true); var files = new MaaSelectedFiles(source, cancellationToken);
        var bundle = await MaaSourceCapture.CompileAsync(files,
            new MaaCompilationSelection(choice.InterfacePath!, choice.ClientKind, choice.Language, choice.Source!)
                { Profile = choice.Profile, Preset = choice.Preset, Runtime = choice.Runtime }, cancellationToken);
        return MaaCompilerAssets.Create(bundle, files);
    }
}
