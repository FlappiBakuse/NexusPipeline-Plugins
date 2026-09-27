using System.Diagnostics;
using System.Text.Json.Nodes;
using Xunit;

namespace NexusPipeline.Plugin.MaaFrameworkDriver.Tests;

public sealed class CompilerCancellationTests
{
    [Fact]
    public async Task AcceptedCancellationStopsActualHashReadsAndTheProducer()
    {
        string root = Path.Combine(Path.GetTempPath(), "nxp-cancel-hash-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(root);
        try
        {
            Directory.CreateDirectory(Path.Combine(root, "resource")); Directory.CreateDirectory(Path.Combine(root, "native"));
            File.WriteAllText(Path.Combine(root, "interface.json"), """
            {"interface_version":2,"name":"PI","controller":[{"name":"PC","type":"Win32"}],
             "resource":[{"name":"R","path":["resource"]}],"task":[]}
            """);
            using (var file = File.Create(Path.Combine(root, "resource", "large.bin"))) file.SetLength(512L * 1024 * 1024);
            var profile = new DriverProfile { PackageRoot = root, Controller = "PC", Resource = "R", NativeDirectory = "native" };
            var compiler = new ProjectCompiler(root, "interface.json");
            using var stop = new CancellationTokenSource();
            Task scan = Task.Run(() => compiler.Compile(profile, stop.Token));
            await Task.Delay(10); stop.Cancel(); var timer = Stopwatch.StartNew();
            await Assert.ThrowsAnyAsync<OperationCanceledException>(async () => await scan.WaitAsync(TimeSpan.FromSeconds(2)));
            Assert.True(timer.ElapsedMilliseconds < 500, "Actual compiler producer must stop within controlled IO cancellation bound");
            long final = compiler.BytesRead;
            await Task.Delay(100);
            Assert.Equal(final, compiler.BytesRead); Assert.True(scan.IsCompleted);
            Assert.True(final < 512L * 1024 * 1024);
        }
        finally { Directory.Delete(root, true); }
    }

    [Fact]
    public void CancelledInspectionDoesNotReadAnInterface()
    {
        using var stop = new CancellationTokenSource(); stop.Cancel();
        Assert.ThrowsAny<OperationCanceledException>(() => new ProjectCompiler("missing", "interface.json", cancellationToken: stop.Token));
    }

    [Fact]
    public async Task IndependentPreparationSurvivesAnotherProducerCancellation()
    {
        string root = Path.Combine(Path.GetTempPath(), "nxp-independent-hash-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(Path.Combine(root, "resource")); Directory.CreateDirectory(Path.Combine(root, "native"));
        try
        {
            File.WriteAllText(Path.Combine(root, "interface.json"), """
            {"interface_version":2,"name":"PI","controller":[{"name":"PC","type":"Win32"}],
             "resource":[{"name":"R","path":["resource"]}],"task":[]}
            """);
            using (var file = File.Create(Path.Combine(root, "resource", "large.bin"))) file.SetLength(512L * 1024 * 1024);
            var profile = new DriverProfile { PackageRoot = root, Controller = "PC", Resource = "R", NativeDirectory = "native" };
            var cancelled = new ProjectCompiler(root, "interface.json"); var independent = new ProjectCompiler(root, "interface.json");
            using var stop = new CancellationTokenSource();
            Task first = Task.Run(() => cancelled.Compile(profile, stop.Token));
            Task<CompiledProject> second = Task.Run(() => independent.Compile(profile));
            await Task.Delay(10); stop.Cancel();
            await Assert.ThrowsAnyAsync<OperationCanceledException>(async () => await first.WaitAsync(TimeSpan.FromSeconds(2)));
            Assert.NotEmpty((await second.WaitAsync(TimeSpan.FromSeconds(10))).ExecutionFingerprint);
            Assert.Equal(512L * 1024 * 1024, independent.BytesRead);
        }
        finally { Directory.Delete(root, true); }
    }
}
