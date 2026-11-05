using System.Text.Json;
using System.Text.Json.Nodes;

namespace NexusPipeline.Extensions.MaaFramework;

internal static class MaaExecutionProjection
{
    internal static byte[] Build(string artifactSha256, string snapshotFingerprint, MaaPiProject project,
        MaaImportedProfile profile, MaaSemanticPlan? semantic, MaaCompilationDiagnostic[] diagnostics, MaaConfigBinding[] bindings, int maximumBytes)
    {
        var compiled = semantic?.Tasks.Select((task, index) => (task, index)).ToDictionary(item => item.task.OccurrenceId, StringComparer.Ordinal);
        object Row(MaaTaskOccurrence task, int index, bool pretask)
        {
            object? submission = null;
            if (semantic is not null && !pretask && task.Enabled)
            {
                if (!compiled!.TryGetValue(task.Id, out var item) || item.task.SourceId != task.SourceId || item.task.Name != task.Name ||
                    item.task.Entry != task.Entry || item.task.Order != task.Order || item.task.RepeatCount != task.RepeatCount)
                    throw new MaaInputFailure("maa_compilation_task_unbound");
                submission = new { item.task.Kind, Pipeline = Part(item.task.Pipeline, "/semantic/Tasks/" + Position(item.index) + "/Pipeline") };
            }
            var pointer = "/profile/" + (pretask ? "Pretasks" : "Tasks") + "/" + Position(index);
            return new { task.Id, task.SourceId, task.Name, task.Entry, task.Order, task.Enabled, task.RepeatCount, task.Role,
                task.Origin, task.DefinitionKnown,
                Options = Part(task.Options, pointer + "/Options"), Pipeline = Part(task.Pipeline, pointer + "/Pipeline"), Compiled = submission };
        }
        var result = MaaCompilationBundle.Serialize(new {
            format = "maa-internal-execution", version = 1, artifactSha256, snapshotFingerprint,
            compilationFingerprint = project.CompilationFingerprint, sourceFingerprint = profile.SourceFingerprint,
            semanticFingerprint = semantic?.Fingerprint, canExecute = semantic is not null, blockingDiagnostics = diagnostics,
            configurationBindings = bindings, profile.Kind, profile.InstanceId, profile.SourceSchema, profile.Inheritance,
            profile.Controller, profile.Resource,
            Tasks = profile.Tasks.Select((task, index) => Row(task, index, false)).ToArray(),
            Pretasks = profile.Pretasks.Select((task, index) => Row(task, index, true)).ToArray(),
            ControllerOptions = Part(profile.ControllerOptions, "/profile/ControllerOptions"),
            ResourceOptions = Part(profile.ResourceOptions, "/profile/ResourceOptions"),
            GlobalOptions = Part(profile.GlobalOptions, "/profile/GlobalOptions"),
            Connection = Part(profile.Connection, "/profile/Connection"),
            ControllerDefinition = semantic is null ? null : Part(semantic.Controller, "/semantic/Controller"),
            ResourceDefinition = semantic is null ? null : Part(semantic.Resource, "/semantic/Resource"),
            Agent = semantic is null ? null : Part(semantic.Agent, "/semantic/Agent"), ResourcePaths = MaaSemanticCompiler.Resources(project, profile) }, maximumBytes);
        if (result.Length > maximumBytes) throw new MaaInputFailure("maa_compilation_execution_budget:" + result.Length);
        return result;
    }
    private static JsonObject Part(JsonNode? node, string pointer)
    {
        var reference = MaaCompilationBundle.Reference(JsonSerializer.SerializeToUtf8Bytes(node));
        reference.Add("pointer", pointer); return reference;
    }
    private static string Position(int index) => index.ToString(System.Globalization.CultureInfo.InvariantCulture);
}
