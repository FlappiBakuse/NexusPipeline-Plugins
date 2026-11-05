using System.Globalization;

namespace NexusPipeline.Extensions.EmulatorSupport;

internal static class LdPlayerPolicy
{
    internal static EmulatorEnumeration Parse(string output)
    {
        var rows = new List<EmulatorInstance>();
        foreach (var line in EmulatorText.Lines(output))
        {
            var fields = line.Split(',').Select(item => item.Trim()).ToArray();
            if (fields.Length < 2 || !int.TryParse(fields[0], NumberStyles.None, CultureInfo.InvariantCulture, out var index) || index is < 0 or > 29990)
                throw new EmulatorFailure("ldplayer_list_invalid");
            var name = fields[1].Trim(); int? pid = null;
            if (fields.Length > 2)
            {
                if (fields.Length < 7 || !long.TryParse(fields[^5], NumberStyles.None, CultureInfo.InvariantCulture, out _) ||
                    !long.TryParse(fields[^4], NumberStyles.None, CultureInfo.InvariantCulture, out _) || fields[^3] is not ("0" or "1") ||
                    !int.TryParse(fields[^2], NumberStyles.Integer, CultureInfo.InvariantCulture, out var process) || process < -1 ||
                    !int.TryParse(fields[^1], NumberStyles.Integer, CultureInfo.InvariantCulture, out var worker) || worker < -1)
                    throw new EmulatorFailure("ldplayer_list_invalid");
                name = string.Join(',', fields[1..^5]).Trim(); pid = process > 0 ? process : null;
            }
            if (string.IsNullOrWhiteSpace(name) || name.Length > 512) throw new EmulatorFailure("ldplayer_list_invalid");
            rows.Add(new(index.ToString(CultureInfo.InvariantCulture), name, null, index, pid, [5554 + index * 2, 5555 + index * 2], []));
        }
        return EmulatorText.Result(rows, "ldplayer_list_ambiguous");
    }
    internal static EmulatorCommand List(EmulatorInstallation installation) => new(installation.Control.Id, ["list2"]);
    internal static EmulatorCommand Control(EmulatorTarget target, bool launch) => new(target.Installation.Control.Id,
        [launch ? "launch" : "quit", "--index", target.Instance.Index?.ToString(CultureInfo.InvariantCulture) ?? throw new EmulatorFailure("ldplayer_selector_invalid")]);
}
