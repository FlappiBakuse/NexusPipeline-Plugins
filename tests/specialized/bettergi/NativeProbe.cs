using System.Diagnostics;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using NexusPipeline.Platform.Extensions;

if (args is not [var scriptPath, var casesPath, var reportPath, var hostSourcePath]) return 2;
BoundedTaskScript script;
JsonElement cases;
string digest, hostDigest, enginePath, engineDigest;
try
{
    var scriptBytes = File.ReadAllBytes(scriptPath);
    digest = Convert.ToHexStringLower(SHA256.HashData(scriptBytes));
    script = new BoundedTaskScript(new UTF8Encoding(false, true).GetString(scriptBytes), digest);
    cases = JsonSerializer.Deserialize<JsonElement>(File.ReadAllBytes(casesPath));
    if (cases.ValueKind != JsonValueKind.Array || cases.GetArrayLength() == 0 || cases.EnumerateArray().Any(row =>
            row.ValueKind != JsonValueKind.Object || !row.TryGetProperty("name", out var name) || name.ValueKind != JsonValueKind.String ||
            !row.TryGetProperty("input", out _)))
        throw new IOException("Missing or invalid Jint vectors");
    hostDigest = Convert.ToHexStringLower(SHA256.HashData(File.ReadAllBytes(hostSourcePath)));
    enginePath = typeof(Jint.Engine).Assembly.Location;
    engineDigest = Convert.ToHexStringLower(SHA256.HashData(File.ReadAllBytes(enginePath)));
}
catch (Exception error) when (error is IOException or UnauthorizedAccessException or JsonException or DecoderFallbackException)
{
    WriteReport(new { status = "FAIL", preparation = "FAIL", error = error.ToString(),
        caseCount = 0, failures = 0, results = Array.Empty<object>() });
    return 1;
}
var results = new List<object>();
var failures = 0;
foreach (var row in cases.EnumerateArray())
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
            var steps = assertion.Name.Split('.');
            if (steps is ["diagnostics", var code])
            {
                var severity = assertion.Value.GetString();
                if (actual["diagnostics"] is not JsonArray diagnostics || !diagnostics.Any(item =>
                    item?["code"]?.GetValue<string>() == code && item?["severity"]?.GetValue<string>() == severity))
                    throw new InvalidOperationException(assertion.Name + " requires severity " + severity);
                continue;
            }
            JsonNode? value = actual;
            foreach (var step in steps)
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
    preparation = "PASS",
    scope = "Exact production Host BoundedTaskScript.cs compiled in a dedicated component probe with the declared Jint/Acornima assemblies; synthetic adapter requests only",
    command = Environment.GetCommandLineArgs(),
    adapterSha256 = digest,
    hostInterpreter = new { path = hostSourcePath, sha256 = hostDigest },
    runtime = System.Runtime.InteropServices.RuntimeInformation.FrameworkDescription,
    engineAssembly = new { path = enginePath, sha256 = engineDigest },
    caseCount = results.Count, failures, results,
    installedHost = "NOT_RUN", upstreamBinary = "NOT_RUN", persistentRetry = "NOT_RUN", browserSurface = "NOT_RUN"
};
WriteReport(report);
Console.WriteLine(JsonSerializer.Serialize(new { report.status, report.caseCount, failures }));
return failures == 0 ? 0 : 1;

void WriteReport(object value) =>
    File.WriteAllText(reportPath, JsonSerializer.Serialize(value, new JsonSerializerOptions { WriteIndented = true }) + "\n", new UTF8Encoding(false));
