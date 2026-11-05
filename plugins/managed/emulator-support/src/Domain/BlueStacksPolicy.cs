using System.Globalization;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace NexusPipeline.Extensions.EmulatorSupport;

internal static class BlueStacksPolicy
{
    private static readonly Regex Key = new("^(?:bst\\.)?instance\\.(?<id>[A-Za-z0-9_.-]{1,128}?)\\.(?<field>status\\.adb_port|adb_port|adbPort|display_name)$", RegexOptions.CultureInvariant, TimeSpan.FromMilliseconds(100));
    internal static EmulatorEnumeration Parse(EmulatorConfig configuration)
    {
        configuration.Validate(); var values = Read(EmulatorText.Decode(configuration.Bytes.Span)); var rows = new Dictionary<string, (int? Port, int? Status, string? Name)>(StringComparer.Ordinal);
        var declarations = new HashSet<string>(StringComparer.Ordinal);
        foreach (var (key, value) in values)
        {
            var match = Key.Match(key); if (!match.Success) continue; var id = match.Groups["id"].Value; var field = match.Groups["field"].Value;
            if (id is "." or ".." || id.Contains("..", StringComparison.Ordinal)) throw new EmulatorFailure("bluestacks_instance_invalid");
            if (!declarations.Add(id + "\n" + (field == "adbPort" ? "adb_port" : field))) throw new EmulatorFailure("bluestacks_mapping_duplicate");
            rows.TryGetValue(id, out var row);
            if (field == "display_name")
            { if (row.Name is not null || value.Length > 512 || value.Any(char.IsControl)) throw new EmulatorFailure("bluestacks_display_invalid"); rows[id] = row with { Name = value }; continue; }
            if (!int.TryParse(value, NumberStyles.None, CultureInfo.InvariantCulture, out var port) || port is < 0 or > 65535)
                throw new EmulatorFailure("bluestacks_adb_mapping_invalid");
            rows[id] = field == "status.adb_port" ? row with { Status = port } : row with { Port = port };
        }
        return EmulatorText.Result(rows.OrderBy(row => row.Key, StringComparer.Ordinal).Select(row => {
            var port = row.Value.Status is > 0 ? row.Value.Status : row.Value.Port;
            return new EmulatorInstance(row.Key, row.Value.Name ?? row.Key, null, null, null, port is > 0 ? [port.Value] : [], [configuration.Id]);
        }).ToList(), "bluestacks_instance_ambiguous");
    }
    private static Dictionary<string, string> Read(string content)
    {
        var values = new Dictionary<string, string>(StringComparer.Ordinal); var text = content.TrimStart('\ufeff').Trim();
        void Add(string key, string value)
        { if (!values.TryAdd(key, value)) throw new EmulatorFailure("bluestacks_config_duplicate"); }
        if (text.StartsWith('{'))
        {
            try
            {
                using var document = JsonDocument.Parse(text, new JsonDocumentOptions { MaxDepth = 16 });
                Walk(document.RootElement, "", Add); return values;
            }
            catch (JsonException) { throw new EmulatorFailure("bluestacks_config_json_invalid"); }
        }
        foreach (var line in EmulatorText.Lines(text))
        {
            if (line.StartsWith('#') || line.StartsWith(';')) continue;
            var equals = line.IndexOf('='); if (equals < 1) throw new EmulatorFailure("bluestacks_config_line_invalid");
            var key = line[..equals].Trim(); var value = line[(equals + 1)..].Trim();
            if (value.StartsWith('"') || value.StartsWith('\''))
            { if (value.Length < 2 || value[^1] != value[0]) throw new EmulatorFailure("bluestacks_config_line_invalid"); value = value[1..^1]; }
            Add(key, value);
        }
        return values;
    }
    private static void Walk(JsonElement element, string prefix, Action<string, string> add)
    {
        if (element.ValueKind != JsonValueKind.Object) throw new EmulatorFailure("bluestacks_config_json_invalid");
        var names = new HashSet<string>(StringComparer.Ordinal);
        foreach (var property in element.EnumerateObject())
        {
            if (!names.Add(property.Name)) throw new EmulatorFailure("bluestacks_config_duplicate");
            var key = prefix.Length == 0 ? property.Name : prefix + "." + property.Name;
            if (Key.IsMatch(key) && property.Value.ValueKind is not (JsonValueKind.String or JsonValueKind.Number))
                throw new EmulatorFailure("bluestacks_adb_mapping_invalid");
            if (property.Value.ValueKind == JsonValueKind.Object)
            {
                if (prefix.Length == 0 && property.Value.EnumerateObject().Any(child => child.Name is "adbPort" or "adb_port")) key = "instance." + key;
                Walk(property.Value, key, add);
            }
            else if (property.Value.ValueKind == JsonValueKind.String) add(key, property.Value.GetString()!);
            else if (property.Value.ValueKind == JsonValueKind.Number) add(key, property.Value.GetRawText());
        }
    }
    internal static EmulatorCommand Launch(EmulatorTarget target) => new(target.Installation.Control.Id, ["--instance", target.Instance.Identity], true);
    internal static EmulatorProcess? Process(EmulatorTarget target, IReadOnlyList<EmulatorProcess> processes)
    {
        var matches = processes.Where(process => process.InstallationId == target.Installation.Id && process.ImagePhysicalId == target.Installation.Control.PhysicalId && process.ImageSha256 == target.Installation.Control.Sha256 &&
            process.ProcessId > 0 && process.StartedAt != default && !string.IsNullOrWhiteSpace(process.EvidenceId) &&
            process.Arguments.Count(argument => argument == "--instance") == 1 &&
            process.Arguments.Select((argument, index) => (argument, index)).Any(item => item.argument == "--instance" && item.index + 1 < process.Arguments.Count && process.Arguments[item.index + 1] == target.Instance.Identity)).ToArray();
        return matches.Length == 1 ? matches[0] : null;
    }
}
