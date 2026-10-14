using System.Text.Json;
using System.Text.Json.Nodes;

namespace NexusPipeline.Plugin.MaaFrameworkDriver;

public sealed record EffectiveConfiguration
{
    public int SchemaVersion { get; init; } = 1;
    public JsonObject Options { get; init; } = new();
    public JsonObject ResourceOptions { get; init; } = new();
    public JsonObject ControllerOptions { get; init; } = new();
    public TaskOccurrence[] TaskOccurrences { get; init; } = [];

    public static JsonObject FromProfile(DriverProfile profile) => JsonSerializer.SerializeToNode(new EffectiveConfiguration {
        Options = profile.Options, ResourceOptions = profile.ResourceOptions, ControllerOptions = profile.ControllerOptions,
        TaskOccurrences = profile.TaskOccurrences }, DriverJson.Options)!.AsObject();

    public static DriverProfile Apply(DriverProfile profile, JsonObject configuration)
    {
        var effective = configuration.Deserialize<EffectiveConfiguration>(DriverJson.Options)
            ?? throw new InvalidDataException("driver.effective_configuration_missing");
        if (effective.SchemaVersion != 1 || effective.Options is null || effective.ResourceOptions is null
            || effective.ControllerOptions is null || effective.TaskOccurrences is null
            || effective.TaskOccurrences.Length != profile.TaskOccurrences.Length)
            throw new InvalidDataException("driver.effective_configuration_shape");
        for (int i = 0; i < effective.TaskOccurrences.Length; i++)
        {
            var actual = effective.TaskOccurrences[i];
            var expected = profile.TaskOccurrences[i];
            if (actual is null || actual.Options is null || actual.PipelineOverride is null
                || JsonSerializer.Serialize(actual with { Options = new(), PipelineOverride = new() }, DriverJson.Options)
                    != JsonSerializer.Serialize(expected with { Options = new(), PipelineOverride = new() }, DriverJson.Options))
                throw new InvalidDataException("driver.effective_configuration_task_identity");
        }
        return profile with { Options = effective.Options, ResourceOptions = effective.ResourceOptions,
            ControllerOptions = effective.ControllerOptions, TaskOccurrences = effective.TaskOccurrences };
    }
}
