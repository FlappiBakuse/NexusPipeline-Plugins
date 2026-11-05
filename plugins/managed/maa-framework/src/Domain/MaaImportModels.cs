using System.Security.Cryptography;
using System.Text;
using System.Text.Json.Nodes;

namespace NexusPipeline.Extensions.MaaFramework;

internal sealed record MaaImportSelection(string Kind, string Path, string InstanceId);
internal sealed record MaaTaskOccurrence(string Id, string SourceId, string Name, string Entry, int Order, bool Enabled,
    int RepeatCount, JsonObject Options, JsonObject Pipeline, string Role = "business")
{
    public MaaRowOrigin? Origin { get; init; }
    public bool DefinitionKnown { get; init; } = true;
}
internal sealed record MaaRowOrigin(string Kind, string? Path, string? Pointer, string? SnapshotPointer, int? Index);
internal sealed record MaaProfileInheritance(string GlobalPath, string RequestedConfig, string ResolvedConfig);
internal sealed record MaaImportedProfile(string Kind, string InstanceId, string Controller, string Resource,
    MaaTaskOccurrence[] Tasks, MaaTaskOccurrence[] Pretasks, JsonObject GlobalOptions, JsonObject ResourceOptions,
    JsonObject ControllerOptions, JsonObject Connection, [property: System.Text.Json.Serialization.JsonIgnore] JsonObject SourceSnapshot,
    MaaSourceProof[] Sources, string SourceFingerprint, string SourceSchema = "", string PiFingerprint = "")
{
    public MaaProfileInheritance? Inheritance { get; init; }
}
internal static class MaaImportRules
{
    internal static string Identity(string kind, string instance, string sourceId)
    {
        var digest = SHA256.HashData(Encoding.UTF8.GetBytes("nexus.maa.occurrence/1\n" + kind + "\n" + instance + "\n" + sourceId));
        digest[6] = (byte)((digest[6] & 15) | 128); digest[8] = (byte)((digest[8] & 63) | 128);
        return new Guid(digest.AsSpan(0, 16), bigEndian: true).ToString("D");
    }
    internal static void Instance(string id)
    { if (id.Length is < 1 or > 128 || id.Any(character => !char.IsAsciiLetterOrDigit(character) && character is not ('_' or '-'))) throw new MaaInputFailure("maa_explicit_instance_required"); }
    internal static JsonObject Definition(MaaPiProject project, string name, bool enabled, MaaCompilationPolicy? policy = null)
    {
        var matches = project.Tasks.Where(task => MaaJson.Required(task, "name") == name).ToArray();
        if (matches.Length == 1) return matches[0];
        if (matches.Length > 1) throw new MaaInputFailure("maa_source_identity_ambiguous");
        if (enabled) (policy ?? new()).Block("maa_enabled_task_unmapped:" + name);
        return new() { ["name"] = name, ["entry"] = "", ["unmapped"] = true };
    }
    internal static void Selection(MaaPiProject project, string controller, string resource, MaaCompilationPolicy? policy = null)
    {
        var control = project.Select("controller", controller); var selected = project.Select("resource", resource);
        if (MaaJson.Required(control, "type") is not ("Win32" or "Adb")) (policy ?? new()).Block("maa_controller_not_supported");
        var constraints = MaaJson.Strings(selected["controller"]);
        if (constraints.Length > 0 && !constraints.Contains(controller, StringComparer.Ordinal)) throw new MaaInputFailure("maa_resource_incompatible");
    }
    internal static int Repeat(JsonObject item, JsonObject definition)
    {
        var count = item["repeat_count"]?.GetValue<int>() ?? 1;
        if (count is < 1 or > 100 || count != 1 && !MaaJson.Boolean(definition, "repeatable")) throw new MaaInputFailure("maa_repeat_invalid");
        return count;
    }
    internal static JsonObject Data(JsonNode? node) => node is null ? new() : MaaJson.Clone(MaaJson.Object(node));
    internal static void Unique(IEnumerable<string> ids)
    { var array = ids.ToArray(); if (array.Length != array.Distinct(StringComparer.Ordinal).Count()) throw new MaaInputFailure("maa_source_identity_ambiguous"); }
    internal static string Escape(string name) => name.Replace("~", "~0", StringComparison.Ordinal).Replace("/", "~1", StringComparison.Ordinal);
    internal static string Position(int index) => index.ToString(System.Globalization.CultureInfo.InvariantCulture);
    internal static bool HasDefinition(MaaPiProject project, JsonObject definition) => project.Tasks.Any(task => ReferenceEquals(task, definition));
}
