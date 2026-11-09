using System.Text.Json;

var cases = new List<object>();
var failed = false;
void Run(string name, Action test)
{
    try { test(); cases.Add(new { name, status = "PASS" }); }
    catch (Exception error) { failed = true; cases.Add(new { name, status = "FAIL", error = error.ToString() }); }
}
ParserCases.Run(Run);
SelectionCases.Run(Run);
TargetDescriptionCases.Run(Run);
SessionCases.Run(Run);
DiscoveryCases.Run(Run);
await File.WriteAllBytesAsync(args[0], JsonSerializer.SerializeToUtf8Bytes(cases, new JsonSerializerOptions { WriteIndented = true }));
return cases.Count > 0 && !failed ? 0 : 1;
