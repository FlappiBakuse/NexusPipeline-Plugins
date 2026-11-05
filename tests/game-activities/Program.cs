using System.Text.Json;
using NexusPipeline.Extensions.GameActivities;

var cases = new List<object>();
async Task Run(string name, Func<Task> action)
{
    try { await action(); cases.Add(new { name, status = "PASS" }); }
    catch (Exception error) { cases.Add(new { name, status = "FAIL", error = error.ToString() }); }
}
await ModelCases.RunAsync(Run, args[0]);
await CoordinatorCases.RunAsync(Run);
await SdkCases.RunAsync(Run);
await ViewFixture.WriteAsync(args[0], Path.Combine(Path.GetDirectoryName(args[1])!, "view-model.json"));
var json = JsonSerializer.Serialize(cases, new JsonSerializerOptions { WriteIndented = true });
await File.WriteAllTextAsync(args[1], json);
Console.WriteLine(json);
return cases.Any(item => JsonSerializer.Serialize(item).Contains("\"FAIL\"", StringComparison.Ordinal)) ? 1 : 0;

internal static class Check
{
    internal static void That(bool value, string message = "assertion_failed") { if (!value) throw new InvalidOperationException(message); }
    internal static async Task Reject(Func<Task> action, string? code = null)
    {
        try { await action(); }
        catch (Exception error) { if (code is null || error.Message.Contains(code, StringComparison.Ordinal)) return; throw; }
        throw new InvalidOperationException("expected_rejection");
    }
    internal static Task Sync(Action action) { action(); return Task.CompletedTask; }
    internal static JsonElement Element(object value) => JsonSerializer.SerializeToElement(value, ActivityJson.Options);
}
