using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;

namespace NexusPipeline.Plugin.MaaFrameworkDriver;

public sealed partial class ProjectCompiler
{
    public SemanticProject CompileSemantics(DriverProfile profile, CancellationToken cancellationToken = default)
    {
        if (cancellationToken.CanBeCanceled) _token = cancellationToken;
        _token.ThrowIfCancellationRequested();
        BytesRead = 0; FilesHashed = 0; EntriesEnumerated = 0;
        profile = ProfileMigration.Upgrade(profile);
        ProfileMigration.Validate(profile.TaskOccurrences);
        if (Path.GetFullPath(profile.PackageRoot).TrimEnd('\\', '/') != _root)
            throw Error("profile", "root or schema mismatch");
        if (profile.WindowSelection is not ("exact_process" or "executable")
            || profile.WindowWaitMilliseconds is < 1 or > 30000)
            throw Error("profile.windowSelection", "unsupported selector or wait bound");
        var controller = ControllerConfiguration.Apply(Find("controller", profile.Controller), profile.ControllerConfiguration);
        var resource = Find("resource", profile.Resource);
        ValidateConfiguredOptions(profile);
        string type = Required(controller, "type");
        if (type is not ("Win32" or "Adb")) throw Error("controller.type", "unsupported " + type);
        if (type == "Adb" && controller["adb"] is JsonObject adb && adb.Count > 0)
            throw Error("controller.adb", "explicit method/config overrides unsupported; PI v2 uses Toolkit detection");
        if (type == "Win32" && profile.WindowSelection == "executable"
            && (!Path.IsPathFullyQualified(profile.WindowExecutable) || !File.Exists(profile.WindowExecutable)
                || !profile.WindowExecutable.EndsWith(".exe", StringComparison.OrdinalIgnoreCase)))
            throw Error("profile.windowExecutable", "existing full executable identity required");
        string[] displayFields = ["display_raw", "display_short_side", "display_long_side", "display_expand"];
        if (displayFields.Count(controller.ContainsKey) > 1) throw Error("controller.display", "mutually exclusive fields");
        foreach (string side in new[] { "display_short_side", "display_long_side" })
            if (controller[side] is not null && controller[side]!.GetValue<int>() is not (>= 1 and <= 16384))
                throw Error("controller." + side, "out of range");
        if (controller.ContainsKey("display_expand")
            && (controller["display_expand"] is not JsonArray expand || expand.Count != 2
                || expand.Any(value => value is not JsonValue scalar || !scalar.TryGetValue<int>(out int dimension) || dimension is not (>= 1 and <= 16384))))
            throw Error("controller.display_expand", "two positive dimensions required");
        if (!Active(resource, profile)) throw Error("resource.controller", "selected controller excluded");
        string[] paths = Strings(resource["path"]).Select(path => Scope(_directory, path)).ToArray();
        if (paths.Length == 0) throw Error("resource.path", "empty");
        int baseCount = paths.Length;
        paths = paths.Concat(Strings(controller["attach_resource_path"]).Concat(profile.AttachResourcePaths)
            .Select(path => Scope(_directory, path))).ToArray();
        var tasks = new List<CompiledTask>();
        foreach (var occurrence in profile.TaskOccurrences.Where(item => item.Enabled))
        {
            string name = occurrence.PiTaskName;
            _token.ThrowIfCancellationRequested();
            if (ConfigurationImporter.IsMxu(profile) && name.StartsWith(ConfigurationImporter.MxuPretaskPrefix, StringComparison.Ordinal))
            {
                if (!Objects(_pi["pretask"]).Any(item => ConfigurationImporter.PretaskName(item) == name))
                    throw Error("pretask." + name, "unknown reference");
                continue;
            }
            if (occurrence.GuiAction.Length != 0)
            {
                GuiWaitActions.Validate(occurrence.GuiAction, occurrence.PipelineOverride);
                for (int ordinal = 1; ordinal <= occurrence.RepeatCount; ordinal++)
                    tasks.Add(new(name, name, occurrence.GuiAction, occurrence.PipelineOverride.DeepClone().AsObject(),
                        occurrence.OccurrenceId + "_" + ordinal, occurrence.OccurrenceId, ordinal) { GuiAction = occurrence.GuiAction });
                continue;
            }
            var task = Find("task", name);
            if (!Active(task, profile)) throw Error("task." + name, "not applicable to selected controller/resource");
            bool cfa = profile.SourceBinding?.SourceKind == "cfa";
            var pipeline = cfa ? new JsonObject() : task["pipeline_override"]?.DeepClone().AsObject() ?? new();
            if (cfa)
            {
                // CFA submits only saved visible options, then overlays the task definition.
                foreach (var values in new[] { profile.Options, profile.ResourceOptions, profile.ControllerOptions })
                    ApplyOptions(values.Select(pair => pair.Key), profile, values, pipeline, new(), new());
                MergePipeline(pipeline, task["pipeline_override"] as JsonObject, true);
                ApplyOptions(occurrence.Options.Select(pair => pair.Key), profile, occurrence.Options, pipeline, new(), new());
            }
            else if (profile.SourceBinding?.SourceSchemaVersion == "mfa-flat-instance")
            {
                // Flat MFA submits saved options and does not synthesize missing child selections.
                foreach (var values in new[] { profile.ResourceOptions, occurrence.Options })
                    ApplyOptions(values.Select(pair => pair.Key), profile, values, pipeline, new(), new());
            }
            else
            {
                foreach (var (declaration, configured) in new (JsonNode?, JsonObject?)[]
                {
                    (_pi["global_option"], null), (resource["option"], profile.ResourceOptions),
                    (controller["option"], profile.ControllerOptions), (task["option"], occurrence.Options)
                })
                {
                    JsonObject values = profile.Options.DeepClone().AsObject();
                    if (configured is not null)
                        foreach (var pair in configured) values[pair.Key] = pair.Value?.DeepClone();
                    ApplyOptions(Strings(declaration), profile, values, pipeline, new(), new HashSet<string>(StringComparer.Ordinal));
                }
            }
            MergePipeline(pipeline, occurrence.PipelineOverride, cfa);
            for (int ordinal = 1; ordinal <= occurrence.RepeatCount; ordinal++)
                tasks.Add(new(name, Label(task), Required(task, "entry"), pipeline.DeepClone().AsObject(),
                    occurrence.OccurrenceId + "_" + ordinal, occurrence.OccurrenceId, ordinal));
        }
        return new(controller, resource, paths, baseCount, Strings(resource["hash"]), tasks.ToArray(), Inspect());
    }

    public DriverProfile ApplyPreset(DriverProfile profile, string presetName)
    {
        var preset = Find("preset", presetName);
        var entries = new List<TaskOccurrence>();
        foreach (JsonObject task in Objects(preset["task"]))
        {
            string name = Required(task, "name"); Find("task", name);
            entries.Add(new() { OccurrenceId = ProfileMigration.Identity("preset", profile.ProfileId, presetName, name),
                PiTaskName = name, Order = entries.Count, Enabled = task["enabled"]?.GetValue<bool>() != false,
                Options = task["option"]?.DeepClone().AsObject() ?? new() });
        }
        ProfileMigration.Validate(entries.ToArray());
        return profile with { SchemaVersion = 3, SelectedTasks = [], TaskOptions = new(), TaskOccurrences = entries.ToArray(), AuthorizedFingerprint = "" };
    }
}
