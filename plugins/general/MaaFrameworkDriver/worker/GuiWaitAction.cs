using System.Diagnostics;
using System.Text.Json.Nodes;
using MaaFramework.Binding;
using MaaFramework.Binding.Custom;

namespace NexusPipeline.Plugin.MaaFrameworkDriver;

internal sealed class GuiWaitAction(string name, CancellationToken token) : IMaaCustomAction
{
    public string Name { get; set; } = name;

    public bool Run<T>(T context, in RunArgs args, in RunResults results) where T : IMaaContext
    {
        try
        {
            var parsed = JsonNode.Parse(args.ActionParam);
            if (parsed is JsonValue encoded) parsed = JsonNode.Parse(encoded.GetValue<string>());
            var parameters = parsed!.AsObject();
            GuiWaitActions.Validate(Name, new() { [Name] = new JsonObject { ["action"] = "Custom", ["custom_action"] = Name,
                ["custom_action_param"] = parameters.DeepClone() } });
            DateTime now = DateTime.Now;
            TimeSpan remaining = GuiWaitActions.Remaining(Name, parameters, now);
            DateTime target = now + remaining;
            var elapsed = Stopwatch.StartNew();
            while (Name == "TimedWaitAction" ? DateTime.Now < target : elapsed.Elapsed < remaining)
            {
                if (token.IsCancellationRequested || context.Tasker.IsStopping) return false;
                Thread.Sleep(100);
            }
            return !token.IsCancellationRequested && !context.Tasker.IsStopping;
        }
        catch (Exception) { return false; }
    }
}
