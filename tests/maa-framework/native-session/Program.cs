using System.Text;
using System.Text.Json;
using NexusPipeline.Extensions.MaaFramework;

if (args is ["agent-child", .. var agentArguments]) return AgentChild.Run(agentArguments);
if (args.Length is < 3 or > 4) throw new ArgumentException("runtime-receipt fixture-root result-path [resource-inventory]");
if (args.Length == 4 && args[3].StartsWith("output-", StringComparison.Ordinal))
{
    var result = await OutputCases.Run(args[3], args[0], args[1]);
    await File.WriteAllTextAsync(args[2], JsonSerializer.Serialize(new[] { result }) + "\n");
    return result.Status == "PASS" ? 0 : 1;
}
if (args.Length == 4) ResourceAudit.Run(args[3], Path.Combine(Path.GetDirectoryName(args[2])!, "native-policy-corpus.json"));
var suite = new NativeCases(args[0], args[1]);
await suite.RunAsync();
await File.WriteAllTextAsync(args[2], JsonSerializer.Serialize(suite.Results, new JsonSerializerOptions { WriteIndented = true }) + "\n");
return suite.Results.All(result => result.Status == "PASS") ? 0 : 1;

internal sealed record CaseResult(string Name, string Status, string? Error);
internal sealed class NativeCases(string runtimeReceipt, string root)
{
    internal List<CaseResult> Results { get; } = [];
    private readonly string[]? selectedCases = Environment.GetEnvironmentVariable("NEXUS_NATIVE_CASES") is { } selection
        ? JsonSerializer.Deserialize<string[]>(selection) : null;
    private readonly byte[] image = File.ReadAllBytes(Path.Combine(root, "base/image/sample.png"));
    private static readonly TimeSpan Budget = TimeSpan.FromSeconds(15);
    internal async Task RunAsync()
    {
        foreach (var policy in PolicyCases.All()) await Case(policy.Name, () => { policy.Run(); return System.Threading.Tasks.Task.CompletedTask; });
        foreach (var payload in PayloadCases.All(runtimeReceipt, root)) await Case(payload.Name, payload.Run);
        foreach (var agent in AgentCases.All(runtimeReceipt, root)) await Case(agent.Name, agent.Run);
        await Case("repeat-order-status-events-drain", Repeats);
        await Case("repeat-resumes-after-completed-count", RemainingRepeats);
        await Case("repeat-resume-failure-preserves-absolute-ordinal", RemainingFailure);
        await Case("pipeline-override-is-applied", Override);
        await Case("failure-stops-later-occurrences", Failure);
        await Case("resource-order-overlay", Overlay);
        await Case("capture-native-recognition", Capture);
        await Case("mfa-countdown-native-custom-action", Countdown);
        await Case("mfa-timed-wait-native-custom-action", TimedWait);
        await Case("cancel-mfa-wait-drains-native-callback", CancelWait);
        await Case("managed-callback-exception-contained", CallbackFailure);
        await Case("cancel-active-callback-drains", CancelCallback);
        await Case("single-operation-and-single-run", Concurrent);
        await Case("no-input-click-denied", DeniedAction);
        await Case("start-app-uses-typed-denying-port", () => DeniedPort("Start", "start:fixture-app"));
        await Case("stop-app-uses-typed-denying-port", () => DeniedPort("Stop", "stop:fixture-app"));
        await Case("shell-uses-typed-denying-port", () => DeniedPort("Shell", null));
        await Case("stop-before-initialize-idempotent", EarlyStop);
        await Case("runtime-single-owner", RuntimeOwner);
        await Case("invalid-plan-has-no-native-side-effects", InvalidPlan);
        await Case("unsafe-resource-rejected-before-native-load", UnsafeResource);
        await Case("undeclared-plugin-directory-rejected-before-load", PluginDirectory);
        await Case("unproven-drain-retains-native-ownership", UnprovenDrain);
    }
    private async Task Case(string name, Func<Task> test)
    {
        if (selectedCases is not null && !selectedCases.Contains(name, StringComparer.Ordinal)) return;
        try { await test().WaitAsync(TimeSpan.FromSeconds(40)); Results.Add(new(name, "PASS", null)); }
        catch (Exception failure) { Results.Add(new(name, "FAIL", failure.ToString())); }
        Console.WriteLine(JsonSerializer.Serialize(Results[^1]));
    }
    private (MaaTaskSession Session, FixtureInputs Inputs, NoInputController Controller) Create(bool overlay = false, TimeProvider? clock = null)
    {
        var inputs = new FixtureInputs(runtimeReceipt, root, overlay ? [Path.Combine(root, "base"), Path.Combine(root, "overlay")] : [Path.Combine(root, "base")]);
        var controller = new NoInputController(image);
        return (new(inputs, controller, Budget, TimeSpan.FromSeconds(10), clock: clock), inputs, controller);
    }
    private static MaaSessionTask TaskRow(string id, string entry = "Success", int repeat = 1, string pipeline = "{}") =>
        new(id, "source:" + id, entry, Encoding.UTF8.GetBytes(pipeline), repeat);
    private static void Check(bool condition) { if (!condition) throw new IOException("fixture_expectation_failed"); }
    private static async Task Reject(Func<Task> action, string code)
    {
        try { await action(); } catch (Exception failure) when (failure.ToString().Contains(code, StringComparison.Ordinal) ||
            code == "OperationCanceledException" && failure is OperationCanceledException) { return; }
        throw new IOException("fixture_expected_rejection:" + code);
    }
    private async Task Repeats()
    {
        var f = Create(); await using var session = f.Session;
        await session.InitializeAsync(default);
        var facts = await session.RunAsync([TaskRow("a", repeat: 2), TaskRow("b")], default);
        Check(facts.Count == 3 && facts.All(fact => fact.Status == 3000) && facts.Select(fact => fact.NativeTaskId).Distinct().Count() == 3);
        Check(facts.Select(fact => fact.OccurrenceId + fact.Repetition).SequenceEqual(new[] { "a1", "a2", "b1" }));
        Check(facts.All(fact => session.Events.Any(item => item.TaskId == fact.NativeTaskId && item.Code == "Tasker.Task.Succeeded")));
        await session.StopAsync(); Check(session.IsDrained && f.Inputs.Disposed && f.Controller.Disposed && f.Controller.Actions == 0);
        Check(!Directory.EnumerateFiles(f.Inputs.LogDirectory).Any());
    }
    private async Task Override()
    {
        var f = Create(); await using var session = f.Session; await session.InitializeAsync(default);
        var facts = await session.RunAsync([TaskRow("override", "Missing", pipeline: "{\"Missing\":{\"recognition\":\"DirectHit\",\"action\":\"DoNothing\"}}")], default);
        Check(facts.Single().Status == 3000);
    }
    private async Task RemainingRepeats()
    {
        var f = Create(); await using var session = f.Session; await session.InitializeAsync(default);
        var facts = await session.RunAsync([TaskRow("a", repeat: 3) with { CompletedRepetitions = 1 }, TaskRow("b")], default);
        Check(facts.All(fact => fact.Status == 3000) && facts.Select(fact => fact.OccurrenceId + fact.Repetition)
            .SequenceEqual(new[] { "a2", "a3", "b1" }));
        await session.StopAsync(); Check(session.IsDrained && f.Controller.Actions == 0);
    }
    private async Task RemainingFailure()
    {
        var f = Create(); await using var session = f.Session; await session.InitializeAsync(default);
        var facts = await session.RunAsync([TaskRow("a", "Missing", 3) with { CompletedRepetitions = 1 }, TaskRow("b")], default);
        Check(facts.Count == 1 && facts[0].Repetition == 2 && facts[0].Status == 4000);
        await session.StopAsync(); Check(session.IsDrained && f.Controller.Actions == 0);
    }
    private async Task Failure()
    {
        var f = Create(); await using var session = f.Session; await session.InitializeAsync(default);
        var facts = await session.RunAsync([TaskRow("bad", "Missing", 2), TaskRow("later")], default);
        Check(facts.Count == 1 && facts[0].Status == 4000 && facts[0].Repetition == 1);
    }
    private async Task Overlay()
    {
        var f = Create(true); await using var session = f.Session; await session.InitializeAsync(default);
        Check((await session.RunAsync([TaskRow("overlay", "Overlay")], default)).Single().Status == 3000);
    }
    private async Task Capture()
    {
        var f = Create(); await using var session = f.Session; await session.InitializeAsync(default);
        Check((await session.RunAsync([TaskRow("image", "Capture")], default)).Single().Status == 3000 && f.Controller.Captures > 0);
    }
    private async Task CallbackFailure()
    {
        var f = Create(); await using var session = f.Session; await session.InitializeAsync(default); f.Controller.ThrowCapture = true;
        await Reject(() => session.RunAsync([TaskRow("image", "Capture")], default), "maa_controller_callback_IOException");
        Check(session.IsDrained && f.Inputs.Disposed && f.Controller.Disposed);
    }
    private static MaaSessionTask WaitRow(string entry, string parameters) => TaskRow("wait", entry, pipeline:
        "{\"" + entry + "\":{\"action\":\"Custom\",\"custom_action\":\"" + entry + "\",\"custom_action_param\":" + parameters + "}}");
    private async Task Countdown()
    {
        var f = Create(); await using var session = f.Session; await session.InitializeAsync(default);
        var timer = System.Diagnostics.Stopwatch.StartNew();
        var facts = await session.RunAsync([WaitRow("CountdownAction", "{\"seconds\":1}")], default);
        Check(facts.Single().Status == 3000 && session.AcceptedWaits == 1 && timer.Elapsed >= TimeSpan.FromMilliseconds(900));
        await session.StopAsync(); Check(session.IsDrained && f.Controller.Actions == 0);
    }
    private async Task TimedWait()
    {
        var f = Create(clock: new WaitClock()); await using var session = f.Session; await session.InitializeAsync(default);
        var facts = await session.RunAsync([WaitRow("TimedWaitAction", "{\"hour\":3,\"minute\":5}")], default);
        Check(facts.Single().Status == 3000 && session.AcceptedWaits == 1);
        await session.StopAsync(); Check(session.IsDrained && f.Controller.Actions == 0);
    }
    private async Task CancelWait()
    {
        var f = Create(); await using var session = f.Session; await session.InitializeAsync(default);
        using var cancellation = new CancellationTokenSource();
        var running = session.RunAsync([WaitRow("CountdownAction", "{\"seconds\":60}")], cancellation.Token);
        var timer = System.Diagnostics.Stopwatch.StartNew();
        while (session.AcceptedWaits == 0)
        { if (timer.Elapsed > TimeSpan.FromSeconds(3)) throw new TimeoutException("wait_callback_not_started"); await System.Threading.Tasks.Task.Delay(10); }
        cancellation.Cancel(); await Reject(async () => await running, "OperationCanceledException");
        Check(session.IsDrained && f.Inputs.Disposed && f.Controller.Disposed);
    }
    private sealed class WaitClock : TimeProvider
    {
        private int reads;
        public override TimeZoneInfo LocalTimeZone => TimeZoneInfo.Utc;
        public override DateTimeOffset GetUtcNow() => Interlocked.Increment(ref reads) == 1 ?
            new(2026, 10, 26, 3, 4, 59, TimeSpan.Zero) : new(2026, 10, 26, 3, 5, 0, TimeSpan.Zero);
    }
    private async Task CancelCallback()
    {
        var f = Create(); await using var session = f.Session; await session.InitializeAsync(default);
        using var entered = new ManualResetEventSlim(); using var release = new ManualResetEventSlim();
        f.Controller.CaptureEntered = entered; f.Controller.CaptureRelease = release;
        using var cancellation = new CancellationTokenSource();
        var running = session.RunAsync([TaskRow("image", "Capture")], cancellation.Token);
        Check(await System.Threading.Tasks.Task.Run(() => entered.Wait(TimeSpan.FromSeconds(5)))); cancellation.Cancel();
        await Reject(() => running, "OperationCanceledException"); Check(session.IsDrained && f.Controller.Disposed);
    }
    private async Task Concurrent()
    {
        var f = Create(); await using var session = f.Session; await session.InitializeAsync(default);
        var running = session.RunAsync([TaskRow("wait", "Wait")], default);
        await Reject(() => session.RunAsync([TaskRow("overlap")], default), "maa_session_operation_active");
        Check((await running).Single().Status == 3000);
        await Reject(() => session.RunAsync([TaskRow("again")], default), "maa_session_phase_invalid");
    }
    private async Task DeniedAction()
    {
        var f = Create(); await using var session = f.Session; await session.InitializeAsync(default);
        Check((await session.RunAsync([TaskRow("click", "Click")], default)).Single().Status == 4000 && f.Controller.Actions > 0);
    }
    private async Task EarlyStop()
    {
        var f = Create(); await f.Session.StopAsync(); await f.Session.StopAsync();
        Check(f.Session.IsDrained && f.Controller.Disposed && f.Inputs.Disposed);
        await Reject(() => f.Session.InitializeAsync(default), "ObjectDisposedException");
    }
    private async Task DeniedPort(string entry, string? intent)
    {
        var f = Create(); await using var session = f.Session; await session.InitializeAsync(default);
        Check((await session.RunAsync([TaskRow("denied", entry)], default)).Single().Status == 4000 && f.Controller.Actions == 1);
        if (intent is not null) Check(f.Controller.LastIntent == intent);
        else Check(f.Controller.LastCommand == "never-execute" && f.Controller.ShellTimeout == 1234);
    }
    private async Task RuntimeOwner()
    {
        var a = Create(); await using var first = a.Session; await first.InitializeAsync(default);
        var b = Create(); await using var second = b.Session;
        await Reject(() => second.InitializeAsync(default), "maa_worker_runtime_busy"); Check(second.IsDrained && !a.Inputs.Disposed);
        Check((await first.RunAsync([TaskRow("owner")], default)).Single().Status == 3000);
    }
    private async Task InvalidPlan()
    {
        var f = Create(); await using var session = f.Session;
        await Reject(() => session.RunAsync([], default), "maa_session_task_budget");
        await Reject(() => session.RunAsync([TaskRow("a"), TaskRow("a")], default), "maa_session_task_budget");
        await Reject(() => session.RunAsync([TaskRow("a", repeat: 101)], default), "maa_session_task_invalid");
        await Reject(() => session.RunAsync([TaskRow("a", pipeline: "{\"a\":1,\"a\":2}")], default), "maa_duplicate_field");
        Check(!f.Inputs.Disposed && f.Controller.Captures == 0 && f.Controller.Actions == 0);
    }
    private async Task UnprovenDrain()
    {
        var inputs = new FixtureInputs(runtimeReceipt, root, [Path.Combine(root, "base")]);
        var port = new NoInputController(image) { IgnoreCancellation = true };
        var session = new MaaTaskSession(inputs, port, Budget, TimeSpan.FromMilliseconds(200));
        await session.InitializeAsync(default);
        using var entered = new ManualResetEventSlim(); using var release = new ManualResetEventSlim();
        port.CaptureEntered = entered; port.CaptureRelease = release;
        var running = session.RunAsync([TaskRow("blocked", "Capture")], default);
        Check(await System.Threading.Tasks.Task.Run(() => entered.Wait(TimeSpan.FromSeconds(5))));
        await Reject(() => session.StopAsync(), "TimeoutException");
        Check(!session.IsDrained && !inputs.Disposed && !port.Disposed);
        release.Set();
        await Reject(() => running, "maa_session_cleanup_unverified");
        Check(!session.IsDrained && !inputs.Disposed && !port.Disposed);
    }
    private async Task UnsafeResource()
    {
        var inputs = new FixtureInputs(runtimeReceipt, root, [Path.Combine(root, "unsafe")]);
        var port = new NoInputController(image);
        await using var session = new MaaTaskSession(inputs, port, Budget, TimeSpan.FromSeconds(5));
        await Reject(() => session.InitializeAsync(default), "maa_native_action_requires_host_owner:Command");
        Check(session.IsDrained && inputs.Disposed && port.Disposed && port.Captures == 0 && port.Actions == 0);
    }
    private Task PluginDirectory()
    {
        using var document = JsonDocument.Parse(File.ReadAllBytes(runtimeReceipt));
        var runtime = document.RootElement.GetProperty("runtime").GetString()!;
        try { using var native = MaaNative.Load(Path.Combine(runtime, "bin/MaaFramework.dll"), "unused", "unused"); }
        catch (IOException failure) when (failure.Message == "maa_undeclared_native_plugins") { return System.Threading.Tasks.Task.CompletedTask; }
        throw new IOException("fixture_plugin_directory_not_rejected");
    }
}
