using System.Text;
using System.Text.Json;
using NexusPipeline.Extensions.MaaFramework;

internal static class OutputCases
{
    internal static async Task<CaseResult> Run(string mode, string receipt, string fixture)
    {
        try { await Execute(mode, receipt, fixture); return new(mode, "PASS", null); }
        catch (Exception failure) { return new(mode, "FAIL", failure.ToString()); }
    }
    private static async Task Execute(string mode, string receipt, string fixture)
    {
        var input = new FixtureInputs(receipt, fixture, [Path.Combine(fixture, mode == "output-resource-parameters" ? "unsafe-screenshots" : "screenshots")]);
        var port = new NoInputController(File.ReadAllBytes(Path.Combine(fixture, "base/image/sample.png")));
        await using var output = new FixtureOutputScope(Environment.CurrentDirectory, input, mode == "output-quota" ? 1 : 8388608);
        if (mode == "output-cwd-mismatch")
        {
            await Reject(() => {
                _ = new MaaTaskSession(input, port, TimeSpan.FromSeconds(15), TimeSpan.FromSeconds(5), new WrongCwd(output, fixture));
                return Task.CompletedTask;
            }, "maa_output_worker_cwd_mismatch");
            await input.DisposeAsync(); await port.DisposeAsync(); return;
        }
        await using var session = new MaaTaskSession(input, port, TimeSpan.FromSeconds(15), TimeSpan.FromSeconds(5), mode == "output-no-scope" ? null : output);
        if (mode is "output-resource-parameters" or "output-no-scope")
        {
            await Reject(() => session.InitializeAsync(default), mode == "output-no-scope" ? "maa_native_action_requires_host_owner:Screencap" : "maa_screencap_filename_rejected");
            Check(session.IsDrained && !output.Disposed && port.Captures == 0 && !Directory.EnumerateFiles(Path.Combine(output.Root, "screencap")).Any()); return;
        }
        await session.InitializeAsync(default);
        if (mode == "output-reject-parameters")
        {
            var original = File.ReadAllBytes(Path.Combine(fixture, "screenshots/pipeline/main.json"));
            foreach (var value in new[] { "../outside", Path.Combine(fixture, "screenshots/pipeline/main.json"), "C:\\outside" })
                await Reject(() => session.RunAsync([Row(JsonSerializer.Serialize(new { Screenshot = new { filename = value } }))], default), "maa_screencap_filename_rejected");
            await Reject(() => session.RunAsync([Row("{\"../Escape\":{\"action\":\"Screencap\"}}")], default), "maa_screencap_node_unsafe");
            await Reject(() => session.RunAsync([Row("{\"Screenshot\":{\"format\":\"jpg\"}}")], default), "maa_screencap_format_rejected");
            await Reject(() => session.RunAsync([Row("{\"Screenshot\":{\"action\":{\"param\":{\"quality\":99}}}}")], default), "maa_screencap_quality_rejected");
            await Reject(() => session.RunAsync([Row("{\"Screenshot\":{\"action\":\"Command\"}}")], default), "maa_native_action_requires_host_owner:Command");
            Check(original.AsSpan().SequenceEqual(File.ReadAllBytes(Path.Combine(fixture, "screenshots/pipeline/main.json"))));
            try { using var writer = new FileStream(Path.Combine(fixture, "screenshots/pipeline/main.json"), FileMode.Open, FileAccess.Write, FileShare.ReadWrite); throw new InvalidOperationException("input_write_was_allowed"); }
            catch (IOException) { }
            await session.StopAsync(); Check(session.Outputs!.Files.Count == 0 && !output.Disposed); return;
        }
        if (mode == "output-cancel")
        {
            using var entered = new ManualResetEventSlim(); using var release = new ManualResetEventSlim(); using var cancel = new CancellationTokenSource();
            port.CaptureEntered = entered; port.CaptureRelease = release;
            var running = session.RunAsync([Row("{}")], cancel.Token);
            Check(await Task.Run(() => entered.Wait(TimeSpan.FromSeconds(5)))); cancel.Cancel();
            try { await running; throw new IOException("cancel_not_observed"); } catch (OperationCanceledException) { }
            Check(session.IsDrained && output.FreezeCalled && !output.Disposed && session.Outputs!.Files.Count == 0); return;
        }
        var facts = await session.RunAsync([Row("{}")], default); Check(facts.Single().Status == 3000);
        var action = session.ReadAction("Screenshot"); Check(action.Action == "Screencap" && action.Success);
        using var detail = JsonDocument.Parse(action.DetailJson);
        var actualPath = Path.GetFullPath(detail.RootElement.GetProperty("filepath").GetString()!);
        Check(actualPath.StartsWith(Path.Combine(output.Root, "screencap") + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase));
        Check(detail.RootElement.GetProperty("format").GetString() == "png" && detail.RootElement.GetProperty("quality").GetInt32() == 100);
        if (mode == "output-quota")
        {
            await Reject(() => session.StopAsync(), "maa_output_quota_exceeded"); Check(session.IsDrained && !output.Disposed && input.Disposed); return;
        }
        await session.StopAsync(); var snapshot = session.Outputs!;
        Check(session.IsDrained && output.FreezeCalled && !output.Disposed && snapshot.Files.Count == 1 && snapshot.TotalBytes > 0 && snapshot.MayOverwrite);
        Check(snapshot.NativeWritersDrained && !snapshot.ProcessFamilyStopped && snapshot.Files[0].Name == Path.GetFileName(actualPath));
        output.RequireCurrent();
        try { Directory.Move(Path.Combine(output.Root, "screencap"), Path.Combine(output.Root, "moved")); throw new InvalidOperationException("directory_move_was_allowed"); }
        catch (IOException) { }
        if (mode == "output-native-detail") Check(!Directory.EnumerateFiles(output.Root, "*.log", SearchOption.AllDirectories).Any());
    }
    private static MaaSessionTask Row(string pipeline) => new("occurrence", "source", "Screenshot", Encoding.UTF8.GetBytes(pipeline), 1);
    private static void Check(bool value) { if (!value) throw new IOException("fixture_output_expectation_failed"); }
    private static async Task Reject(Func<Task> action, string code)
    {
        try { await action(); } catch (Exception failure) when (failure.ToString().Contains(code, StringComparison.Ordinal)) { return; }
        throw new IOException("fixture_output_expected_rejection:" + code);
    }
    private sealed class WrongCwd(IMaaOutputScope inner, string root) : IMaaOutputScope
    {
        public string Root => root;
        public void RequireCurrent() => inner.RequireCurrent();
        public ValueTask<MaaOutputSnapshot> FreezeAsync(CancellationToken cancellation) => inner.FreezeAsync(cancellation);
        public ValueTask DisposeAsync() => ValueTask.CompletedTask;
    }
}
