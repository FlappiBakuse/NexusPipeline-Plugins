using System.Globalization;
using System.Text.RegularExpressions;
using System.Xml;
using System.Xml.Linq;

namespace NexusPipeline.Extensions.EmulatorSupport;

internal static class NoxPolicy
{
    private static readonly Regex Labeled = new("^index\\s*[:=]\\s*(?<index>[0-9]+)\\s+name\\s*[:=]\\s*(?<name>.+?)(?:\\s+pid\\s*[:=]\\s*(?<pid>[0-9]+))?$", RegexOptions.CultureInvariant | RegexOptions.IgnoreCase, TimeSpan.FromMilliseconds(100));
    internal static EmulatorEnumeration Parse(string output, IReadOnlyList<EmulatorConfig> configurations)
    {
        var rows = new List<EmulatorInstance>();
        foreach (var line in EmulatorText.Lines(output))
        {
            var fields = line.Split(new[] { ',', '|', ':', '\t' }, StringSplitOptions.None).Select(field => field.Trim()).ToArray();
            if (fields.Length < 2) fields = Regex.Split(line, "\\s{2,}", RegexOptions.CultureInvariant, TimeSpan.FromMilliseconds(100));
            var labeled = Labeled.Match(line);
            string identity, name; string? control; int? index = null; int? pid = null;
            if (labeled.Success)
            {
                index = Index(labeled.Groups["index"].Value); identity = name = labeled.Groups["name"].Value.Trim(); control = null;
                if (labeled.Groups["pid"].Success) pid = Process(labeled.Groups["pid"].Value);
            }
            else
            {
                if (fields.Length < 2 || fields.Any(field => field.Length == 0)) throw new EmulatorFailure("nox_list_invalid");
                name = fields[1];
                if (int.TryParse(fields[0], NumberStyles.Integer, CultureInfo.InvariantCulture, out var signed) && signed < 0) throw new EmulatorFailure("nox_index_invalid");
                if (fields[0].All(char.IsAsciiDigit)) { index = Index(fields[0]); identity = name; control = null; }
                else { identity = fields[0]; control = name; }
                if (fields.Length >= 6) pid = Process(fields[^1]);
                else if (fields.Length > 3) throw new EmulatorFailure("nox_list_invalid");
            }
            if (!EmulatorPaths.Selector(identity) || !EmulatorPaths.Selector(name)) throw new EmulatorFailure("nox_list_invalid");
            rows.Add(new(identity, name, control, index, pid, [], []));
        }
        var parsed = EmulatorText.Result(rows, "nox_list_ambiguous");
        var configs = configurations.Where(config => EmulatorPaths.Name(config.RelativePath).EndsWith(".vbox", StringComparison.Ordinal)).ToArray();
        var mappings = new Dictionary<string, (List<int> Ports, List<string> Configs)>(StringComparer.OrdinalIgnoreCase);
        foreach (var config in configs)
        {
            config.Validate(); var ports = Ports(EmulatorText.Decode(config.Bytes.Span));
            var matching = rows.Where(row => Identity(config.RelativePath, row.Identity)).ToArray();
            if (matching.Length == 0) matching = rows.Where(row => row.ControlName is not null && Identity(config.RelativePath, row.ControlName)).ToArray();
            if (matching.Length > 1) throw new EmulatorFailure("nox_config_ambiguous");
            if (matching.Length == 0) continue;
            if (!mappings.TryAdd(matching[0].Identity, (ports.ToList(), [config.Id]))) throw new EmulatorFailure("nox_config_ambiguous");
        }
        return parsed with { Instances = rows.Select(row => mappings.TryGetValue(row.Identity, out var mapping) ? row with { CandidatePorts = mapping.Ports, ConfigIds = mapping.Configs } : row).ToArray() };
    }
    internal static IReadOnlyList<int> Ports(string xml)
    {
        try
        {
            using var text = new StringReader(xml.TrimStart('\ufeff')); using var reader = XmlReader.Create(text,
                new XmlReaderSettings { DtdProcessing = DtdProcessing.Prohibit, XmlResolver = null, MaxCharactersInDocument = 1048576, MaxCharactersFromEntities = 0 });
            var root = XDocument.Load(reader); var ports = new HashSet<int>();
            foreach (var item in root.Descendants().Where(item => item.Name.LocalName == "Forwarding"))
            {
                if ((string?)item.Attribute("guestport") != "5555") continue;
                var host = (string?)item.Attribute("hostip");
                if (host is not (null or "" or "127.0.0.1" or "::1") || (string?)item.Attribute("proto") is not (null or "1" or "tcp")) continue;
                if (!int.TryParse((string?)item.Attribute("hostport"), NumberStyles.None, CultureInfo.InvariantCulture, out var port) || port is < 1 or > 65535)
                    throw new EmulatorFailure("nox_adb_mapping_invalid");
                ports.Add(port);
            }
            return ports.Order().ToArray();
        }
        catch (XmlException) { throw new EmulatorFailure("nox_config_xml_invalid"); }
    }
    internal static EmulatorCommand List(EmulatorInstallation installation) => new(installation.Control.Id, ["list"]);
    internal static EmulatorCommand Control(EmulatorTarget target, bool launch)
    {
        var row = target.Instance; var selector = row.Index is { } index ? "-index:" + index.ToString(CultureInfo.InvariantCulture) :
            row.ControlName is { } name && EmulatorPaths.Selector(name) ? "-name:" + name : throw new EmulatorFailure("nox_selector_invalid");
        return new(target.Installation.Control.Id, [launch ? "launch" : "quit", selector]);
    }
    private static bool Identity(string path, string identity) => path.Replace('\\', '/').Split('/').Any(segment =>
        segment.Equals(identity, StringComparison.OrdinalIgnoreCase) || segment.EndsWith(".vbox", StringComparison.OrdinalIgnoreCase) && segment[..^5].Equals(identity, StringComparison.OrdinalIgnoreCase));
    private static int Index(string text) => int.TryParse(text, NumberStyles.None, CultureInfo.InvariantCulture, out var value) && value >= 0 ? value : throw new EmulatorFailure("nox_index_invalid");
    private static int? Process(string text) => int.TryParse(text, NumberStyles.Integer, CultureInfo.InvariantCulture, out var value) && value >= -1 ? value > 0 ? value : null : throw new EmulatorFailure("nox_process_invalid");
}
