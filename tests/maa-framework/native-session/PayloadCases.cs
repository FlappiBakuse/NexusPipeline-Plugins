using System.Reflection;
using System.Security.Cryptography;
using System.Text;
using NexusPipeline.Extensions.MaaFramework;

internal static class PayloadCases
{
    internal static IEnumerable<(string Name, Func<Task> Run)> All(string receipt, string root)
    {
        yield return ("native-utf8-payload-owned-per-repetition-and-cleared-after-submit", () => Run(receipt, root, false));
        yield return ("native-expanded-payload-rechecks-action-policy-before-acceptance", () => Run(receipt, root, true));
    }

    private static async Task Run(string receipt, string root, bool reject)
    {
        const string canary = "synthetic-native-密钥-𠜎";
        var inputs = new FixtureInputs(receipt, root, [Path.Combine(root, "base")]);
        var image = File.ReadAllBytes(Path.Combine(root, "base/image/sample.png"));
        var held = new List<byte[]>();
        ValueTask<MaaTaskPayload> Create(MaaSessionItem item, CancellationToken cancellation)
        {
            cancellation.ThrowIfCancellationRequested();
            if (item.OccurrenceId != "private-row") throw new IOException("fixture_payload_wrong_occurrence");
            var bytes = Encoding.UTF8.GetBytes(reject ? "{\"Success\":{\"action\":\"Command\",\"exec\":\"never-execute\"}}" :
                "{\"Success\":{\"action\":\"DoNothing\",\"custom_action_param\":\"" + canary + "\"}}");
            var payload = new MaaTaskPayload(bytes); CryptographicOperations.ZeroMemory(bytes);
            held.Add((byte[])typeof(MaaTaskPayload).GetField("bytes", BindingFlags.NonPublic | BindingFlags.Instance)!.GetValue(payload)!);
            return ValueTask.FromResult(payload);
        }
        await using var session = new MaaTaskSession(inputs, new NoInputController(image), TimeSpan.FromSeconds(15),
            TimeSpan.FromSeconds(10), payloadFactory: Create);
        await session.InitializeAsync(default);
        var row = new MaaSessionTask("private-row", "source-private", "Success", "{}"u8.ToArray(), 2);
        Exception? failure = null;
        try { _ = await session.RunAsync([row], default); }
        catch (IOException error) when (reject && error.Message == "maa_native_action_requires_host_owner:Command") { failure = error; }
        if (reject ? failure is null || session.Facts.Length != 0 : session.Facts.Length != 2 || session.Facts.Any(fact => fact.Status != 3000))
            throw new IOException("fixture_payload_native_outcome_invalid");
        if (held.Count != (reject ? 1 : 2) || held.Any(bytes => bytes.Any(value => value != 0)))
            throw new IOException("fixture_payload_not_cleared");
        await session.StopAsync();
        if (!session.IsDrained) throw new IOException("fixture_payload_session_not_drained");
        if (Directory.Exists(inputs.LogDirectory) && Directory.EnumerateFiles(inputs.LogDirectory, "*", SearchOption.AllDirectories)
            .Any(file => Encoding.UTF8.GetString(File.ReadAllBytes(file)).Contains(canary, StringComparison.Ordinal)))
            throw new IOException("fixture_payload_secret_in_native_log");
    }
}
