using System.Text.Json;
using NexusPipeline.Extensions.GameActivities;

if (args is not [_, _] and not ["--source-fields", _, _]) return 2;
var (fixtures, report) = (args[^2], args[^1]);
var cases = new List<object>();
var failed = false;
async Task Run(string name, Func<Task> action)
{
    try { await action(); cases.Add(new { name, status = "PASS" }); }
    catch (Exception error) { failed = true; cases.Add(new { name, status = "FAIL", error = error.ToString() }); }
}
await ModelCases.SourceFieldsAsync(Run, fixtures);
if (args.Length == 2)
{
    await ModelCases.RunAsync(Run);
    await CoordinatorCases.RunAsync(Run);
    await SdkCases.RunAsync(Run);
}
await ViewFixture.WriteAsync(fixtures, Path.Combine(Path.GetDirectoryName(report)!, "view-model.json"));
var json = JsonSerializer.Serialize(cases, new JsonSerializerOptions { WriteIndented = true });
await File.WriteAllTextAsync(report, json);
Console.WriteLine(json);
return cases.Count > 0 && !failed ? 0 : 1;

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
