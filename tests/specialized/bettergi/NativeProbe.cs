using System.Diagnostics;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using NexusPipeline.Platform.Extensions;

if (args is not [var scriptPath, var casesPath, var reportPath, var hostSourcePath]) return 2;
var scriptBytes = File.ReadAllBytes(scriptPath);
var digest = Convert.ToHexStringLower(SHA256.HashData(scriptBytes));
var script = new BoundedTaskScript(new UTF8Encoding(false, true).GetString(scriptBytes), digest);
using var cases = JsonDocument.Parse(File.ReadAllBytes(casesPath));
var results = new List<object>();
var failures = 0;
foreach (var row in cases.RootElement.EnumerateArray())
{
    var timer = Stopwatch.StartNew();
    string? error = null;
    var expectedError = row.TryGetProperty("error", out var expected) ? expected.GetString() : null;
    try
    {
        var sourceFiles = row.TryGetProperty("sourceFiles", out var files) ? files : default;
        var response = script.Execute(Encoding.UTF8.GetBytes(row.GetProperty("input").GetRawText()), default, null,
            name => sourceFiles.ValueKind == JsonValueKind.Object && sourceFiles.TryGetProperty(name, out var file)
                ? file.GetRawText() : "null");
        if (expectedError is not null) throw new InvalidOperationException("Adapter accepted an input that requires rejection");
        var actual = JsonNode.Parse(response)!;
        foreach (var assertion in row.GetProperty("expect").EnumerateObject())
        {
            JsonNode? value = actual;
            foreach (var step in assertion.Name.Split('.'))
                value = value is JsonArray array ? array[int.Parse(step)] : value![step];
            if (!JsonNode.DeepEquals(value, JsonNode.Parse(assertion.Value.GetRawText())))
                throw new InvalidOperationException(assertion.Name + " expected " + assertion.Value.GetRawText() + " actual " + value);
        }
    }
    catch (Exception exception)
    {
        if (expectedError is null || !exception.GetType().Namespace!.StartsWith("Jint", StringComparison.Ordinal) ||
            !exception.Message.Contains(expectedError, StringComparison.Ordinal)) error = exception.ToString();
    }
    if (error is not null) failures++;
    results.Add(new { name = row.GetProperty("name").GetString(), status = error is null ? "PASS" : "FAIL", error, elapsedMs = timer.Elapsed.TotalMilliseconds });
}
var report = new
{
    status = failures == 0 ? "PASS" : "FAIL",
    scope = "Exact production Host BoundedTaskScript.cs compiled in a dedicated component probe with the declared Jint/Acornima assemblies; synthetic adapter requests only",
    command = Environment.GetCommandLineArgs(),
    adapterSha256 = digest,
    hostInterpreter = new { path = hostSourcePath, sha256 = Convert.ToHexStringLower(SHA256.HashData(File.ReadAllBytes(hostSourcePath))) },
    runtime = System.Runtime.InteropServices.RuntimeInformation.FrameworkDescription,
    engineAssembly = new { path = typeof(Jint.Engine).Assembly.Location, sha256 = Convert.ToHexStringLower(SHA256.HashData(File.ReadAllBytes(typeof(Jint.Engine).Assembly.Location))) },
    caseCount = results.Count, failures, results,
    installedHost = "NOT_RUN", upstreamBinary = "NOT_RUN", persistentRetry = "NOT_RUN", browserSurface = "NOT_RUN"
};
File.WriteAllText(reportPath, JsonSerializer.Serialize(report, new JsonSerializerOptions { WriteIndented = true }) + "\n", new UTF8Encoding(false));
Console.WriteLine(JsonSerializer.Serialize(new { report.status, report.caseCount, failures }));
return failures == 0 ? 0 : 1;
