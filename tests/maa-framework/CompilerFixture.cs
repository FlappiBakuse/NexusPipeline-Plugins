using System.Security.Cryptography;
using System.Text;
using System.Text.Json.Nodes;
using NexusPipeline.Extensions.MaaFramework;

internal static class CompilerFixture
{
    internal static JsonObject Interface() => new() { ["interface_version"] = 2, ["name"] = "fixture", ["version"] = "1.0",
        ["controller"] = new JsonArray(new JsonObject { ["name"] = "PC", ["type"] = "Win32", ["option"] = new JsonArray("Mode") }),
        ["resource"] = new JsonArray(new JsonObject { ["name"] = "Official", ["path"] = new JsonArray("resource") }),
        ["task"] = new JsonArray(new JsonObject { ["name"] = "Daily", ["entry"] = "DailyEntry", ["default_check"] = true,
            ["repeatable"] = true, ["option"] = new JsonArray("Mode") }),
        ["option"] = new JsonObject { ["Mode"] = new JsonObject { ["type"] = "select", ["default_case"] = "A",
            ["cases"] = new JsonArray(new JsonObject { ["name"] = "A" }, new JsonObject { ["name"] = "B" }) } } };
    internal static JsonObject Mxu() => new() { ["version"] = "1.0", ["instances"] = new JsonArray(new JsonObject { ["id"] = "one", ["name"] = "same label",
        ["controllerName"] = "PC", ["resourceName"] = "Official", ["tasks"] = new JsonArray(new JsonObject { ["id"] = "task-1", ["taskName"] = "Daily",
            ["enabled"] = true, ["enabledByController"] = new JsonObject { ["PC"] = true },
            ["optionValues"] = new JsonObject { ["Mode"] = new JsonObject { ["type"] = "select", ["caseName"] = "B" } } }) }) };
    internal static JsonObject Mfa() => new() { ["CurrentControllerName"] = "PC", ["CurrentController"] = "Win32", ["Resource"] = "Official",
        ["TaskItems"] = new JsonArray(new JsonObject { ["name"] = "Daily", ["entry"] = "DailyEntry", ["default_check"] = true, ["repeat_count"] = 2,
            ["option"] = new JsonArray(new JsonObject { ["name"] = "Mode", ["index"] = 1 }) }), ["CurrentTasks"] = new JsonArray("Daily<|||>DailyEntry"),
        ["BeforeTask"] = "None", ["AfterTask"] = "None", ["SoftwarePath"] = "D:\\Games\\unused.exe" };
    internal static JsonObject Cli() => new() { ["controller"] = new JsonObject { ["name"] = "PC" }, ["resource"] = "Official",
        ["task"] = new JsonArray(new JsonObject { ["name"] = "Daily", ["option"] = new JsonArray(new JsonObject { ["name"] = "Mode", ["value"] = "B" }) }) };
    internal static JsonObject Cfa() => new() { ["item_id"] = "one", ["bundle"] = "Bundle", ["tasks"] = new JsonArray(
        new JsonObject { ["item_id"] = "Controller", ["is_checked"] = true, ["task_option"] = new JsonObject { ["controller_type"] = "PC" } },
        new JsonObject { ["item_id"] = "Resource", ["is_checked"] = true, ["task_option"] = new JsonObject { ["resource"] = "Official" } },
        new JsonObject { ["item_id"] = "task-1", ["name"] = "Daily", ["is_checked"] = true, ["task_option"] = new JsonObject {
            ["Mode"] = new JsonObject { ["value"] = "B", ["hidden"] = false }, ["_speedrun_config"] = new JsonObject { ["enabled"] = false } } }) };
    internal static MaaSourceInput Input(string path, string content)
    { var bytes = Encoding.UTF8.GetBytes(content); return new(path, bytes, Convert.ToHexStringLower(SHA256.HashData(bytes)), "fixture:" + path); }
    internal static MaaSourceSet Sources(params (string Path, JsonObject Value)[] additions) => new(new[] { Input("assets/interface.json", Interface().ToJsonString()) }
        .Concat(additions.Select(item => Input(item.Path, item.Value.ToJsonString()))).ToArray());
    internal static (MaaSourceSet Sources, MaaPiProject Project) Project(params (string Path, JsonObject Value)[] additions)
    { var sources = Sources(additions); return (sources, new MaaPiCompiler(sources).Compile("assets/interface.json")); }
}
