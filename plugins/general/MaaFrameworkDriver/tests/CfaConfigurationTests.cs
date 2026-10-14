using System.Text.Json.Nodes;
using Xunit;

namespace NexusPipeline.Plugin.MaaFrameworkDriver.Tests;

public sealed class CfaConfigurationTests
{
    [Fact]
    public void PublicConfigPreservesIdentityOrderBranchesAndDisabledTasksWithoutWrites()
    {
        string root = Path.Combine(Path.GetTempPath(), "nxp-cfa-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(Path.Combine(root, "config", "configs"));
        try
        {
            File.WriteAllText(Path.Combine(root, "interface.json"), """
                {"interface_version":2,"name":"Renamed Bundle","controller":[{"name":"PC","type":"Win32"}],
                "resource":[{"name":"R","path":"arbitrary_resources"}],
                "global_option":["Global"],
                "task":[{"name":"T","entry":"Entry","option":["Mode","Count"],"pipeline_override":{"Entry":{"attach":{"fromTask":true,"same":"task"}}}}],
                "option":{"Mode":{"cases":[{"name":"Yes","option":["Child"]},{"name":"No"}]},
                "Global":{"default_case":"On","cases":[{"name":"On","pipeline_override":{"Entry":{"attach":{"fromGlobal":true,"same":"global"}}}}]},
                "Count":{"type":"input","inputs":[{"name":"amount","default":"1","pipeline_type":"int"}],"pipeline_override":{"Entry":{"max_hit":"{amount}"}}},
                "Child":{"cases":[{"name":"A","pipeline_override":{"Entry":{"timeout":10}}},{"name":"B","pipeline_override":{"Entry":{"timeout":20,"attach":{"fromChild":true}}}}]}}}
                """);
            File.WriteAllText(Path.Combine(root, "config", "multi_config.json"), """
                {"config_list":["c_one"],"curr_config_id":"c_one","bundle":{"Display Bundle":{"path":"./"}}}
                """);
            string path = Path.Combine(root, "config", "configs", "c_one.json");
            var source = JsonNode.Parse("""
                {"item_id":"c_one","name":"Account","bundle":"Display Bundle","global_options":{},"tasks":[
                {"item_id":"Controller","name":"Controller","is_checked":true,"task_option":{"controller_type":"PC","controller_options":{"Global":{"value":"On"}}}},
                {"item_id":"Resource","name":"Resource","is_checked":true,"task_option":{"resource":"R"}},
                {"item_id":"t_one","name":"T","is_checked":true,"task_option":{"Count":{"value":{"amount":10}},"Mode":{"value":"Yes","branches":{"Yes":{"Child":{"value":"B"}}}}}},
                {"item_id":"t_two","name":"T","is_checked":false,"task_option":{"Mode":{"value":"No"}}}]}
                """)!.AsObject();
            File.WriteAllText(path, source.ToJsonString()); byte[] before = File.ReadAllBytes(path);
            var candidate = Assert.Single(SourceDiscovery.Discover(root).Candidates);
            var profile = SourceDiscovery.Read(new() { SchemaVersion = 3, PackageRoot = root }, candidate);
            Assert.Equal(2, profile.TaskOccurrences.Length); Assert.False(profile.TaskOccurrences[1].Enabled);
            var compiled = new ProjectCompiler(root, "interface.json").CompileSemantics(profile);
            var task = Assert.Single(compiled.Tasks);
            Assert.Equal("Entry", task.Entry); Assert.Equal(20, task.Override["Entry"]!["timeout"]!.GetValue<int>());
            Assert.Equal(10L, task.Override["Entry"]!["max_hit"]!.GetValue<long>());
            Assert.Null(task.Override["Entry"]!["attach"]!["fromGlobal"]);
            Assert.True(task.Override["Entry"]!["attach"]!["fromTask"]!.GetValue<bool>());
            Assert.True(task.Override["Entry"]!["attach"]!["fromChild"]!.GetValue<bool>());
            Assert.Equal(before, File.ReadAllBytes(path));
            source["tasks"]![2]!["task_option"]!["_speedrun_config"] = new JsonObject
                { ["enabled"] = false, ["condition"] = new JsonObject { ["type"] = "always" } };
            File.WriteAllText(path, source.ToJsonString());
            byte[] inactiveBytes = File.ReadAllBytes(path);
            var inactive = SourceDiscovery.Read(profile, candidate);
            Assert.True(JsonNode.DeepEquals(task.Override,
                Assert.Single(new ProjectCompiler(root, "interface.json").CompileSemantics(inactive).Tasks).Override));
            Assert.Equal(inactiveBytes, File.ReadAllBytes(path));
            source["tasks"]![2]!["task_option"]!["_speedrun_config"]!["enabled"] = true;
            File.WriteAllText(path, source.ToJsonString());
            Assert.Contains("speedrun_unsupported", Assert.Throws<InvalidDataException>(() => SourceDiscovery.Read(profile, candidate)).Message);
            source["tasks"]![2]!["task_option"]!["_speedrun_config"]!["enabled"] = false;
            source["tasks"]![1]!["task_option"]!["setting_options"] = new JsonObject
                { ["Global"] = new JsonObject { ["value"] = "On" } };
            File.WriteAllText(path, source.ToJsonString());
            var layered = new ProjectCompiler(root, "interface.json").CompileSemantics(SourceDiscovery.Read(profile, candidate));
            var attached = Assert.Single(layered.Tasks).Override["Entry"]!["attach"]!;
            Assert.True(attached["fromGlobal"]!.GetValue<bool>());
            Assert.True(attached["fromTask"]!.GetValue<bool>());
            Assert.True(attached["fromChild"]!.GetValue<bool>());
            Assert.Equal("task", attached["same"]!.GetValue<string>());
            string executable = Path.Combine(root, "game.exe"); File.WriteAllText(executable, "owned launch fixture");
            source["tasks"]![0]!["task_option"]!["PC"] = new JsonObject { ["program_path"] = "game.exe",
                ["program_params"] = "--profile test", ["wait_time"] = 17 };
            File.WriteAllText(path, source.ToJsonString());
            var launch = SourceDiscovery.Read(profile, candidate);
            Assert.True(launch.HostLaunchRequired);
            Assert.Equal(executable, launch.HostLaunchConfiguration["gameExe"]!.GetValue<string>());
            Assert.Equal("--profile test", launch.HostLaunchConfiguration["gameArgs"]!.GetValue<string>());
            Assert.Equal(17, launch.HostLaunchConfiguration["gameWaitSeconds"]!.GetValue<int>());
            var pi = JsonNode.Parse(File.ReadAllText(Path.Combine(root, "interface.json")))!;
            pi["agent"] = new JsonObject { ["child_exec"] = "game.exe", ["child_args"] = new JsonArray(), ["embedded"] = true };
            File.WriteAllText(Path.Combine(root, "interface.json"), pi.ToJsonString());
            Directory.CreateDirectory(Path.Combine(root, "arbitrary_resources"));
            var embedded = SourceDiscovery.Read(profile, candidate);
            Assert.Single(new ProjectCompiler(root, "interface.json").CompileSemantics(embedded).Tasks);
            Assert.Contains("embedded_agent_unsupported", Assert.Throws<InvalidDataException>(() =>
                new ProjectCompiler(root, "interface.json").Compile(embedded)).Message);
            source["tasks"]![0]!["task_option"]!["agent_embedded"] = false;
            File.WriteAllText(path, source.ToJsonString());
            var external = SourceDiscovery.Read(profile, candidate);
            Assert.False(external.AgentEmbedded);
            Assert.NotEqual(embedded.SourceSnapshot!.EffectiveConfigHash, external.SourceSnapshot!.EffectiveConfigHash);
            Assert.Equal(executable, Assert.Single(new ProjectCompiler(root, "interface.json").Compile(external).Agents).Executable);
            source["tasks"]![2]!["task_source"] = "builtin"; source["tasks"]![2]!["builtin_key"] = "unknown";
            File.WriteAllText(path, source.ToJsonString());
            Assert.Contains("builtin_action_unsupported", Assert.Throws<InvalidDataException>(() => SourceDiscovery.Read(profile, candidate)).Message);
            Assert.NotEqual(profile.TaskOccurrences[0].OccurrenceId, profile.TaskOccurrences[1].OccurrenceId);
        }
        finally { Directory.Delete(root, true); }
    }
}
