using System.Text.Json.Nodes;

namespace NexusPipeline.Extensions.MaaFramework;

internal sealed class MaaOptionCompiler(MaaPiProject project, MaaImportedProfile profile, CancellationToken cancellationToken = default)
{
    private int evaluations;
    internal bool Active(JsonObject definition) => (MaaJson.Strings(definition["controller"]) is var controllers && (controllers.Length == 0 || controllers.Contains(profile.Controller, StringComparer.Ordinal))) &&
        (MaaJson.Strings(definition["resource"]) is var resources && (resources.Length == 0 || resources.Contains(profile.Resource, StringComparer.Ordinal)));
    internal void Apply(IEnumerable<string> names, JsonObject supplied, JsonObject pipeline, bool savedOnly = false)
    {
        var visiting = new HashSet<string>(StringComparer.Ordinal);
        var processed = new HashSet<string>(StringComparer.Ordinal);
        foreach (var name in names) Evaluate(name, supplied, pipeline, visiting, savedOnly, processed: processed);
    }
    internal JsonObject Effective(IEnumerable<string> names, JsonObject supplied)
    {
        var result = new JsonObject(); var visiting = new HashSet<string>(StringComparer.Ordinal);
        var processed = new HashSet<string>(StringComparer.Ordinal);
        foreach (var name in names) Evaluate(name, supplied, new JsonObject(), visiting, false, result, processed);
        return result;
    }
    private void Evaluate(string name, JsonObject supplied, JsonObject pipeline, HashSet<string> visiting, bool savedOnly,
        JsonObject? effective = null, HashSet<string>? processed = null)
    {
        cancellationToken.ThrowIfCancellationRequested();
        if (++evaluations > 100000) throw new MaaInputFailure("maa_option_evaluation_budget");
        var definition = project.Options[name] as JsonObject ?? throw new MaaInputFailure("maa_option_reference_missing:" + name);
        if (!Active(definition) || savedOnly && !supplied.ContainsKey(name)) return;
        if (profile.Kind == "mfa" && processed is not null && !processed.Add(name)) return;
        if (visiting.Count > 32 || !visiting.Add(name)) throw new MaaInputFailure("maa_option_cycle_or_depth");
        var type = MaaJson.Text(definition, "type", "select");
        if (type is "input" or "hotkey")
        {
            var fields = MaaInputValues.Read(definition, MaaImportRules.Data(supplied[name]), MaaJson.Required(project.Select("controller", profile.Controller), "type"), effective is not null);
            MaaProtectedInput.RequireOrdinary(definition["pipeline_override"]);
            if (effective is not null) effective[name] = new JsonObject(fields.Select(pair => KeyValuePair.Create<string, JsonNode?>(pair.Key, pair.Value.DeepClone())));
            else MaaPipeline.Apply(pipeline, MaaPipeline.Expand(definition["pipeline_override"], fields), profile.Kind == "cfa", true);
        }
        else
        {
            var cases = MaaJson.Objects(definition["cases"]); var value = supplied[name] ?? MaaOptionDefaults.Selection(definition, project.ClientKind);
            var selected = type == "checkbox" ? MaaJson.Strings(value) : [value?.GetValue<string>() ?? (cases.Length > 0 ? MaaJson.Required(cases[0], "name") : "")];
            if (selected.Distinct(StringComparer.Ordinal).Count() != selected.Length || selected.Any(key => !cases.Any(item => MaaJson.Required(item, "name") == key)) ||
                type == "checkbox" && (selected.Length < (definition["min_count"]?.GetValue<int>() ?? 0) || selected.Length > (definition["max_count"]?.GetValue<int>() ?? cases.Length)))
                throw new MaaBusinessFailure("maa_option_selection_invalid");
            if (effective is not null) effective[name] = type == "checkbox"
                ? new JsonArray(selected.Select(item => (JsonNode?)JsonValue.Create(item)).ToArray()) : JsonValue.Create(selected[0]);
            foreach (var choice in cases.Where(item => selected.Contains(MaaJson.Required(item, "name"), StringComparer.Ordinal)))
            {
                if (effective is null) MaaPipeline.Apply(pipeline, choice["pipeline_override"], profile.Kind == "cfa");
                if (profile.Kind != "cfa" && (effective is null || type != "checkbox"))
                    foreach (var child in MaaJson.Strings(choice["option"])) Evaluate(child, supplied, pipeline, visiting, savedOnly, effective, processed);
            }
        }
        visiting.Remove(name);
    }
}
