using System.Text.Json.Nodes;

namespace NexusPipeline.Extensions.MaaFramework;

internal static class MaaPreset
{
    internal static MaaImportedProfile Apply(MaaPiProject project, MaaImportedProfile profile, string presetName)
    {
        if (profile.PiFingerprint != project.CompilationFingerprint) throw new MaaInputFailure("maa_compiled_pi_changed");
        var preset = project.Select("preset", presetName); var rows = MaaJson.Objects(preset["task"]);
        if (rows.Length > 4096) throw new MaaInputFailure("maa_occurrence_budget");
        var tasks = rows.Select((row, index) => {
            var name = MaaJson.Required(row, "name"); var enabled = MaaJson.Boolean(row, "enabled", true);
            var definition = MaaImportRules.Definition(project, name, enabled); var id = "preset:" + presetName + "/" + index;
            var occurrence = MaaImportRules.Identity("preset", profile.InstanceId, id);
            return new MaaTaskOccurrence(occurrence, "nexus-profile:" + occurrence, name, MaaJson.Text(definition, "entry"), index, enabled, 1,
                MaaImportRules.Data(row["option"]), new());
        }).ToArray();
        var definitions = MaaJson.Objects(project.Declaration["pretask"], true); var selected = MaaJson.Objects(preset["pretask"]);
        if (selected.Length > 4096 || selected.Any(row => !definitions.Any(item => MaaJson.Required(item, "name") == MaaJson.Required(row, "name"))))
            throw new MaaInputFailure("maa_pretask_unmapped");
        var pretasks = definitions.Where(item => selected.Any(row => MaaJson.Required(row, "name") == MaaJson.Required(item, "name")))
            .Select((item, index) => {
                var name = MaaJson.Required(item, "name"); var row = selected.Single(row => MaaJson.Required(row, "name") == name);
                var id = MaaImportRules.Identity("preset", profile.InstanceId, "preset:" + presetName + "/pretask/" + name);
                return new MaaTaskOccurrence(id, "nexus-profile:" + id, "__MXU_PRETASK__" + name, "", index,
                    MaaJson.Boolean(row, "enabled", true), 1, MaaImportRules.Data(row["option"]), new(), "technical");
            }).ToArray();
        var proposed = profile with { Tasks = tasks, Pretasks = pretasks };
        _ = MaaSemanticCompiler.Compile(project, proposed); return proposed;
    }
}
