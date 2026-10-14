using System.Text;
using System.Text.Json.Nodes;
using Xunit;

namespace NexusPipeline.Plugin.MaaFrameworkDriver.Tests;

public sealed class SessionLogReaderTests
{
    [Fact]
    public async Task SessionOffsetsExcludeHistoryDrainRenamedFilesAndExposeTruncationAndInvalidEncoding()
    {
        string root = Path.Combine(Path.GetTempPath(), "nxp-log-source-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(root);
        try
        {
            string path = Path.Combine(root, "agent.log"); File.WriteAllText(path, "old-session\n", new UTF8Encoding(false));
            var logs = new List<string>(); var facts = new List<JsonObject>();
            ValueTask Send(string kind, JsonObject value) { if (kind == "log") logs.Add(value["text"]!.GetValue<string>()); else facts.Add(value.DeepClone().AsObject()); return ValueTask.CompletedTask; }
            var reader = new SessionLogReader(path, "agent.log", "agent", Send, ["owned-secret"], skipExisting: true);
            await reader.PollAsync();
            File.AppendAllText(path, "current 中文 owned-secret\n", new UTF8Encoding(false));
            File.Move(path, path + ".1"); File.WriteAllText(path, "new-file\n", new UTF8Encoding(false));
            await reader.PollAsync();
            File.WriteAllText(path, "x\n", new UTF8Encoding(false)); await reader.PollAsync();
            using (var bytes = new FileStream(path, FileMode.Append, FileAccess.Write, FileShare.ReadWrite | FileShare.Delete)) bytes.Write([0xff]);
            await reader.CompleteAsync();
            string output = string.Concat(logs);
            Assert.DoesNotContain("old-session", output); Assert.DoesNotContain("owned-secret", output);
            Assert.Contains("current 中文", output); Assert.Contains("new-file", output); Assert.Contains("x", output);
            Assert.Contains(facts, fact => fact["rotationEpoch"]!.GetValue<int>() == 0 && fact["startByteOffset"]!.GetValue<long>() > 0);
            Assert.Equal(2, facts[^1]["rotationEpoch"]!.GetValue<int>()); Assert.Equal("incomplete", facts[^1]["sourceState"]!.GetValue<string>());
            Assert.Equal("agent.epoch2", facts[^1]["logSource"]!.GetValue<string>());
            Assert.NotEqual(facts[0]["fileIdentity"]!.GetValue<string>(), facts[^1]["fileIdentity"]!.GetValue<string>());
            File.Delete(path);
            logs.Clear(); facts.Clear();
            string native = Path.Combine(root, "maafw.log");
            File.WriteAllText(native, "consumed\n", new UTF8Encoding(false));
            File.WriteAllText(Path.Combine(root, "maafw.bak.old.log"), "unrelated-history\n", new UTF8Encoding(false));
            var nativeReader = new SessionLogReader(native, "maafw.log", "native", Send, ["owned-secret"], backupPattern: "maafw.bak.*.log");
            await nativeReader.PollAsync();
            File.AppendAllText(native, "unread-tail owned-secret\n", new UTF8Encoding(false));
            File.Copy(native, Path.Combine(root, "maafw.bak.new.log"));
            File.WriteAllText(native, "new-content-longer-than-consumed-offset\n", new UTF8Encoding(false));
            await nativeReader.CompleteAsync();
            output = string.Concat(logs);
            Assert.Contains("unread-tail [redacted]", output); Assert.Contains("new-content-longer", output);
            Assert.DoesNotContain("unrelated-history", output); Assert.DoesNotContain("owned-secret", output);
            Assert.Equal("complete", facts[^1]["sourceState"]!.GetValue<string>());
            Assert.Equal(1, facts[^1]["rotationEpoch"]!.GetValue<int>());
            Assert.Contains(facts, fact => fact["logSource"]!.GetValue<string>() == "native.backup.epoch0"
                && fact["logPath"]!.GetValue<string>() == "maafw.bak.new.log");
        }
        finally { Directory.Delete(root, true); }
    }
}
