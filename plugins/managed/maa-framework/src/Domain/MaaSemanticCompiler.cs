using System.Text.Json.Nodes;

namespace NexusPipeline.Extensions.MaaFramework;

internal sealed record MaaCompiledTask(string OccurrenceId, string SourceId, string Name, string Entry, int Order, int RepeatCount, JsonObject Pipeline, string Kind = "native");
internal sealed record MaaSemanticPlan(MaaCompiledTask[] Tasks, JsonObject Controller, JsonObject Resource,
    MaaTaskOccurrence[] Pretasks, JsonNode? Agent, MaaSourceProof[] Sources, string SourceFingerprint, string[] ResourcePaths)
{
    public MaaProgramSpec[] Programs { get; init; } = [];
    internal string Fingerprint => Convert.ToHexStringLower(System.Security.Cryptography.SHA256.HashData(System.Text.Json.JsonSerializer.SerializeToUtf8Bytes(
        new { format = "nexus.maa.semantic-plan", version = 1, Tasks, Controller, Resource, Pretasks, Agent, Sources, SourceFingerprint, ResourcePaths, Programs })));
}
internal static class MaaSemanticCompiler
{
    internal static MaaSemanticPlan Compile(MaaPiProject project, MaaImportedProfile profile, CancellationToken cancellationToken = default, MaaRuntimeSelection? runtime = null)
    {
        cancellationToken.ThrowIfCancellationRequested();
        if (profile.PiFingerprint != project.CompilationFingerprint) throw new MaaInputFailure("maa_compiled_pi_changed");
        foreach (var configured in new[] { profile.GlobalOptions, profile.ResourceOptions, profile.ControllerOptions }.Concat(profile.Tasks.Select(task => task.Options)))
            if (configured.Any(pair => !project.Options.ContainsKey(pair.Key))) throw new MaaBusinessFailure("maa_saved_option_unmapped");
        MaaImportRules.Selection(project, profile.Controller, profile.Resource);
        var controller = project.Select("controller", profile.Controller); var resource = project.Select("resource", profile.Resource);
        var paths = Resources(project, profile);
        if (MaaJson.Required(controller, "type") == "Adb" && controller["adb"] is JsonObject overrides && overrides.Count > 0)
            throw new MaaBusinessFailure("maa_adb_methods_unmapped");
        foreach (var agent in MaaJson.Objects(project.Declaration["agent"], true))
            if (profile.Connection["agentEmbedded"]?.GetValue<bool>() ?? MaaJson.Boolean(agent, "embedded")) throw new MaaBusinessFailure("maa_embedded_agent_unsupported");
        var engine = new MaaOptionCompiler(project, profile, cancellationToken); var tasks = new List<MaaCompiledTask>();
        foreach (var occurrence in profile.Tasks.Where(task => task.Enabled))
        {
            cancellationToken.ThrowIfCancellationRequested();
            if (MaaWaitPolicy.Supports(occurrence.Entry))
            {
                _ = MaaWaitPolicy.Parameters(occurrence.Entry, occurrence.Pipeline);
                tasks.Add(new(occurrence.Id, occurrence.SourceId, occurrence.Name, occurrence.Entry, occurrence.Order, 1, MaaJson.Clone(occurrence.Pipeline), "mfa-wait"));
                continue;
            }
            var declaration = MaaImportRules.Definition(project, occurrence.Name, true);
            if (MaaJson.Required(declaration, "entry") != occurrence.Entry || !engine.Active(declaration)) throw new MaaInputFailure("maa_task_definition_changed");
            var pipeline = profile.Kind == "cfa" ? new JsonObject() : MaaImportRules.Data(declaration["pipeline_override"]);
            if (profile.Kind == "cfa")
            {
                foreach (var saved in new[] { profile.GlobalOptions, profile.ResourceOptions, profile.ControllerOptions }) engine.Apply(saved.Select(pair => pair.Key), saved, pipeline, true);
                MaaPipeline.Apply(pipeline, declaration["pipeline_override"], true); engine.Apply(occurrence.Options.Select(pair => pair.Key), occurrence.Options, pipeline, true);
            }
            else if (profile.SourceSchema == "mfa-flat")
            {
                foreach (var saved in new[] { profile.ResourceOptions, occurrence.Options }) engine.Apply(saved.Select(pair => pair.Key), saved, pipeline, true);
            }
            else
            {
                foreach (var (keys, layer) in new[] { (project.Declaration["global_option"], profile.GlobalOptions), (resource["option"], profile.ResourceOptions),
                    (controller["option"], profile.ControllerOptions), (declaration["option"], occurrence.Options) })
                {
                    var values = MaaJson.Clone(profile.GlobalOptions); foreach (var pair in layer) values[pair.Key] = pair.Value?.DeepClone();
                    engine.Apply(MaaJson.Strings(keys), values, pipeline);
                }
            }
            MaaPipeline.Apply(pipeline, occurrence.Pipeline, profile.Kind == "cfa");
            tasks.Add(new(occurrence.Id, occurrence.SourceId, occurrence.Name, occurrence.Entry, occurrence.Order, occurrence.RepeatCount, pipeline));
        }
        if (tasks.Sum(task => (long)task.RepeatCount) > 100000) throw new MaaInputFailure("maa_compiled_task_budget");
        return new(tasks.ToArray(), MaaJson.Clone(controller), MaaJson.Clone(resource), profile.Pretasks.Where(task => task.Enabled).ToArray(),
            project.Declaration["agent"]?.DeepClone(), profile.Sources, profile.SourceFingerprint, paths)
            { Programs = MaaProgramCompiler.Compile(project, profile, engine, runtime) };
    }
    internal static string[] Resources(MaaPiProject project, MaaImportedProfile profile)
    {
        var resource = project.Select("resource", profile.Resource); var controller = project.Select("controller", profile.Controller);
        var constraints = MaaJson.Strings(resource["controller"]);
        if (constraints.Length > 0 && !constraints.Contains(profile.Controller, StringComparer.Ordinal)) throw new MaaInputFailure("maa_resource_incompatible");
        var paths = MaaJson.Strings(resource["path"]);
        if (paths.Length == 0) throw new MaaInputFailure("maa_resource_paths_required");
        return paths.Concat(MaaJson.Strings(controller["attach_resource_path"]))
            .Select(path => MaaResourcePaths.Resolve(project.InterfacePath, path)).ToArray();
    }
}
