using System.Text.Json;

var cases = new List<object>();
void Run(string name, Action test)
{
    try { test(); cases.Add(new { name, status = "PASS" }); }
    catch (Exception error) { cases.Add(new { name, status = "FAIL", error = error.ToString() }); }
}
await Task.CompletedTask;
ParserCases.Run(Run);
SelectionCases.Run(Run);
TargetDescriptionCases.Run(Run);
SessionCases.Run(Run);
DiscoveryCases.Run(Run);
await File.WriteAllBytesAsync(args[0], JsonSerializer.SerializeToUtf8Bytes(cases, new JsonSerializerOptions { WriteIndented = true }));
return cases.Count > 0 && cases.All(item => !JsonSerializer.Serialize(item).Contains("\"FAIL\"", StringComparison.Ordinal)) ? 0 : 1;
