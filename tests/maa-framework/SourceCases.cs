using System.Text.Json.Nodes;
using NexusPipeline.Extensions.MaaFramework;

internal static class SourceCases
{
    internal static void Run(Action<string, Action> run)
    {
        static void Assert(bool value) { if (!value) throw new InvalidOperationException("assertion_failed"); }
        static void Reject(Action action)
        { try { action(); } catch (MaaInputFailure) { return; } throw new InvalidOperationException("rejection_expected"); }
        run("mxu-explicit-instance-stable-item-identity-and-disabled-controller-cache-preserved", () => {
            var document = CompilerFixture.Mxu(); var second = document["instances"]![0]!.DeepClone(); second["id"] = "two"; document["instances"]!.AsArray().Add(second);
            var (sources, project) = CompilerFixture.Project(("mxu.json", document)); var importer = new MaaProjectImport(sources, project);
            var first = importer.Import(new("mxu", "mxu.json", "one")); var other = importer.Import(new("mxu", "mxu.json", "two"));
            Assert(first.Tasks.Single().Options["Mode"]!.GetValue<string>() == "B" && first.Tasks.Single().Id != other.Tasks.Single().Id);
            Reject(() => importer.Import(new("mxu", "mxu.json", "same label")));
        });
        run("mxu-conflicting-controller-enabled-cache-rejected", () => {
            var source = CompilerFixture.Mxu(); source["instances"]![0]!["tasks"]![0]!["enabledByController"]!["PC"] = false;
            var (files, pi) = CompilerFixture.Project(("mxu.json", source)); Reject(() => new MaaProjectImport(files, pi).Import(new("mxu", "mxu.json", "one")));
        });
        run("mfa-inheritance-does-not-mutate-global-and-repeats-remain-independent", () => {
            var global = CompilerFixture.Mfa(); global["Instance.one.TaskItems"] = global["TaskItems"]!.DeepClone();
            global["Instance.one.TaskItems"]!.AsArray().Add(global["TaskItems"]![0]!.DeepClone()); var original = global.ToJsonString();
            var (files, pi) = CompilerFixture.Project(("appsettings.json", new()), ("config/config.json", global), ("config/instances/one.json", new()));
            var profile = new MaaProjectImport(files, pi).Import(new("mfa", "config/instances/one.json", "one"));
            Assert(profile.Tasks.Length == 2 && profile.Tasks[0].Id != profile.Tasks[1].Id && profile.Tasks.All(task => task.RepeatCount == 2));
            Assert(profile.Tasks[0].Options["Mode"]!.GetValue<string>() == "B" && files.Read("config/config.json").ToJsonString() == original);
        });
        run("mfa-flat-shared-configuration-reads-selected-prefix-not-active-tab", () => {
            var global = CompilerFixture.Mfa(); global["Instance.one.Resource"] = "Official"; global["Instance.other.Resource"] = "removed";
            var (files, pi) = CompilerFixture.Project(("appsettings.json", new()), ("config/config.json", global));
            Assert(new MaaProjectImport(files, pi).Import(new("mfa", "config/config.json", "one")).Resource == "Official");
        });
        run("mfa-active-external-actions-rejected-unused-software-path-retained", () => {
            var global = CompilerFixture.Mfa(); var (files, pi) = CompilerFixture.Project(("appsettings.json", new()), ("config/config.json", global), ("config/instances/one.json", new()));
            Assert(new MaaProjectImport(files, pi).Import(new("mfa", "config/instances/one.json", "one")).Connection["SoftwarePath"]!.GetValue<string>() == "D:\\Games\\unused.exe");
            global["BeforeTask"] = "StartupSoftwareAndScript"; var next = CompilerFixture.Project(("appsettings.json", new()), ("config/config.json", global), ("config/instances/one.json", new()));
            Reject(() => new MaaProjectImport(next.Sources, next.Project).Import(new("mfa", "config/instances/one.json", "one")));
        });
        run("maapicli-identical-named-tasks-retain-source-order-and-independent-identity", () => {
            var source = CompilerFixture.Cli(); source["task"]!.AsArray().Add(source["task"]![0]!.DeepClone());
            var (files, pi) = CompilerFixture.Project(("config.json", source)); var profile = new MaaProjectImport(files, pi).Import(new("maapicli", "config.json", "one"));
            Assert(profile.Tasks.Length == 2 && profile.Tasks[0].Id != profile.Tasks[1].Id && profile.Tasks[1].Order == 1 && profile.Tasks[0].Options["Mode"]!.GetValue<string>() == "B");
        });
        run("cfa-explicit-bundle-and-item-id-preserve-visible-saved-options", () => {
            var main = new JsonObject { ["config_list"] = new JsonArray("one"), ["bundle"] = new JsonObject { ["Bundle"] = new JsonObject { ["path"] = "./assets" } } };
            var (files, pi) = CompilerFixture.Project(("config/multi_config.json", main), ("config/configs/one.json", CompilerFixture.Cfa()));
            var profile = new MaaProjectImport(files, pi).Import(new("cfa", "config/configs/one.json", "one"));
            Assert(profile.Tasks.Single().SourceId == "task-1" && profile.Tasks.Single().Options["Mode"]!.GetValue<string>() == "B");
            Assert(!profile.Tasks.Single().Options.ContainsKey("_speedrun_config"));
        });
    }
}
