using System.Text;
using System.Text.Json;
using NexusPipeline.Extensions.MaaFramework;

internal static class AgentCases
{
    internal static IEnumerable<(string Name, Func<Task> Run)> All(string receipt, string root)
    {
        yield return ("official-agent-tcp-custom-action-and-graceful-family-drain", () => Success(receipt, root, false));
        yield return ("official-agent-explicit-identifier-custom-action", () => Success(receipt, root, true));
        yield return ("cancel-active-agent-callback-before-family-and-native-destroy", () => Cancel(receipt, root));
        yield return ("agent-root-exit-is-not-native-task-success", () => Exit(receipt, root));
    }
    private static (MaaTaskSession Session, string Report, Func<MaaProgramProcess> Process) Create(string receipt, string root, string mode, bool identifier = false)
    {
        var inputs = new FixtureInputs(receipt, root, [Path.Combine(root, "base")]);
        var runtime = Path.GetDirectoryName(inputs.RuntimeLibrary)!;
        using var source = JsonDocument.Parse(File.ReadAllBytes(receipt));
        var client = source.RootElement.GetProperty("files").EnumerateArray().Single(item => item.GetProperty("path").GetString() == "bin/MaaAgentClient.dll");
        var report = Path.Combine(root, "agent-" + Guid.NewGuid().ToString("N") + ".json");
        MaaProgramProcess? process = null;
        ValueTask<MaaProgramProcess> Start(string address, CancellationToken token)
        {
            token.ThrowIfCancellationRequested();
            process = new(Environment.ProcessPath!, [typeof(AgentCases).Assembly.Location, "agent-child", receipt, runtime, report, mode, address], root,
                new Dictionary<string, string>(), inputs.RequireCurrent);
            return ValueTask.FromResult(process);
        }
        var address = identifier ? "nexus-owned-" + Guid.NewGuid().ToString("N") : "";
        if (identifier) File.WriteAllText(report + ".identifier", address);
        var agents = new MaaAgentSession(Path.Combine(runtime, "MaaAgentClient.dll"), client.GetProperty("sizeBytes").GetInt64(), client.GetProperty("sha256").GetString()!,
            [new(address, 3000, Start)], inputs.RequireCurrent);
        var controller = new NoInputController(File.ReadAllBytes(Path.Combine(root, "base/image/sample.png")));
        return (new(inputs, controller, TimeSpan.FromSeconds(15), TimeSpan.FromSeconds(8), agents: agents), report, () => process!);
    }
    private static MaaSessionTask Row() => new("agent-task", "agent-source", "OwnedCustom", Encoding.UTF8.GetBytes(
        "{\"OwnedCustom\":{\"recognition\":\"DirectHit\",\"action\":\"Custom\",\"custom_action\":\"OwnedAgentAction\",\"custom_action_param\":{\"text\":\"中文 Agent\"}}}"), 1);
    private static async Task Success(string receipt, string root, bool identifier)
    {
        var fixture = Create(receipt, root, "success", identifier); await using var session = fixture.Session;
        await session.InitializeAsync(default);
        var facts = await session.RunAsync([Row()], default);
        if (facts.Count != 1 || facts[0].Status != 3000) throw new IOException("fixture_agent_action_not_completed");
        await session.StopAsync();
        using var report = JsonDocument.Parse(File.ReadAllBytes(fixture.Report));
        if (!session.IsDrained || !fixture.Process().FamilyStopped || report.RootElement.GetProperty("calls").GetInt32() != 1 ||
            report.RootElement.GetProperty("processId").GetInt32() != fixture.Process().ProcessId) throw new IOException("fixture_agent_family_unbound");
    }
    private static async Task Cancel(string receipt, string root)
    {
        var fixture = Create(receipt, root, "delay"); await using var session = fixture.Session;
        await session.InitializeAsync(default); using var cancel = new CancellationTokenSource();
        var run = session.RunAsync([Row()], cancel.Token);
        using var deadline = new CancellationTokenSource(TimeSpan.FromSeconds(5));
        while (!File.Exists(fixture.Report + ".entered")) await Task.Delay(10, deadline.Token);
        cancel.Cancel();
        try { _ = await run; throw new IOException("fixture_expected_cancel"); }
        catch (OperationCanceledException) { }
        if (!session.IsDrained || !fixture.Process().FamilyStopped || !File.Exists(fixture.Report + ".returned") || !File.Exists(fixture.Report))
            throw new IOException("fixture_agent_callback_or_family_not_drained");
    }
    private static async Task Exit(string receipt, string root)
    {
        var fixture = Create(receipt, root, "exit"); await using var session = fixture.Session;
        await session.InitializeAsync(default); await File.WriteAllTextAsync(fixture.Report + ".exit", "exit");
        using var deadline = new CancellationTokenSource(TimeSpan.FromSeconds(5));
        while (!fixture.Process().HasExited) await Task.Delay(10, deadline.Token);
        try { _ = await session.RunAsync([Row()], default); throw new IOException("fixture_expected_agent_exit"); }
        catch (IOException failure) when (failure.Message == "maa_agent_process_exited") { }
        if (!session.IsDrained || !fixture.Process().FamilyStopped || session.Facts.Length != 0)
            throw new IOException($"fixture_agent_exit_unconfirmed: drained={session.IsDrained}, family={fixture.Process().FamilyStopped}, facts={session.Facts.Length}");
    }
}
