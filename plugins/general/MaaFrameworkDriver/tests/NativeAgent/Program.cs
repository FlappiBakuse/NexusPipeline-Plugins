using System.Diagnostics;
using System.Text.Json;
using MaaFramework.Binding;
using MaaFramework.Binding.Custom;

// Executed only from a newly owned contract project. The production driver never ships this fixture.
if (Environment.GetEnvironmentVariable("NXP_MAA_FIXTURE") != "owned-native-contract") return 90;
if (args.FirstOrDefault() == "--pretask")
{
    File.WriteAllText("pretask-evidence.json", JsonSerializer.Serialize(new { pid = Environment.ProcessId,
        startedUtc = Process.GetCurrentProcess().StartTime.ToUniversalTime().ToString("O"), argumentCount = args.Length,
        cwdMatches = Environment.CurrentDirectory == Environment.GetEnvironmentVariable("NXP_MAA_FIXTURE_ROOT"),
        piVersion = Environment.GetEnvironmentVariable("PI_INTERFACE_VERSION"),
        options = args.Length == 2 ? JsonDocument.Parse(args[1]).RootElement : (JsonElement?)null }));
    if (Environment.GetEnvironmentVariable("NXP_MAA_FIXTURE_SCENARIO") == "pretask_timeout") Thread.Sleep(30000);
    return Environment.GetEnvironmentVariable("NXP_MAA_FIXTURE_SCENARIO") == "pretask_failure" ? 93 : 0;
}
if (args.Length != 1) return 91;
File.WriteAllText("agent-evidence.json", JsonSerializer.Serialize(new { pid = Environment.ProcessId,
    startedUtc = Process.GetCurrentProcess().StartTime.ToUniversalTime().ToString("O"),
    cwdMatches = Environment.CurrentDirectory == Environment.GetEnvironmentVariable("NXP_MAA_FIXTURE_ROOT"),
    piVersion = Environment.GetEnvironmentVariable("PI_INTERFACE_VERSION"),
    hasIdentifier = args[0].Length > 0 }));
var agent = MaaAgentServer.Current.WithNativeLibrary([Environment.GetEnvironmentVariable("MAAFW_BINARY_PATH")!]);
agent.WithIdentifier(args[0]).SetStdoutLevel(LoggingLevel.Off).SetLogDirectory("native-agent-logs");
agent.Register("FixtureAction", new FixtureAction()).StartUp();
// Follow the standard server lifecycle; a watchdog bounds a broken fixture client.
using var watchdog = new CancellationTokenSource();
var timer = Task.Run(async () => {
    try { await Task.Delay(TimeSpan.FromSeconds(15), watchdog.Token); agent.ShutDown(); }
    catch (OperationCanceledException) { }
});
agent.Join(); agent.ShutDown(); watchdog.Cancel(); await timer;
File.WriteAllText("agent-exited.marker", "0");
return 0;

sealed class FixtureAction : IMaaCustomAction
{
    public string Name { get; set; } = "FixtureAction";
    public bool Run<T>(T context, in RunArgs args, in RunResults results) where T : IMaaContext
    {
        File.WriteAllText("agent-action-ran.marker", args.NodeName);
        string? scenario = Environment.GetEnvironmentVariable("NXP_MAA_FIXTURE_SCENARIO");
        if (scenario == "secret") { Console.WriteLine("fixture-private-echo"); Console.Error.WriteLine("fixture-private-echo"); }
        if (scenario == "cancel") Thread.Sleep(1000);
        return scenario != "failure";
    }
}
