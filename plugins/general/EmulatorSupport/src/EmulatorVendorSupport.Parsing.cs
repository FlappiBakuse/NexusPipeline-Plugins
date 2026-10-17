using System.Diagnostics;
using System.Text.RegularExpressions;
using Microsoft.Win32;
using NexusPipeline.Plugin.Abstractions;

namespace NexusPipeline.Plugin.EmulatorSupport;

internal static partial class EmulatorVendorSupport
{
    private static readonly Regex ProcessIdPattern = new(
        @"(?:pid|process[_ -]?id)\s*[:=]\s*(\d+)",
        RegexOptions.IgnoreCase | RegexOptions.CultureInvariant | RegexOptions.Compiled);

    private static readonly Regex NoxLabeledListLinePattern = new(
        @"(?:index\s*[:=]\s*)(?<index>\d+).*?(?:name\s*[:=]\s*)(?<name>[A-Za-z0-9_. -]+)",
        RegexOptions.IgnoreCase | RegexOptions.CultureInvariant | RegexOptions.Compiled);

    private static readonly Regex NoxWhitespaceListLinePattern = new(
        @"^\s*(?<first>[^\s,|:\t]+)\s{2,}(?<second>[^,|:\t]+)",
        RegexOptions.IgnoreCase | RegexOptions.CultureInvariant | RegexOptions.Compiled);

    private static readonly Regex NoxVboxPortPattern = new(
        @"(?:hostport|host\s*port|adb[_ -]?port|forward[^\r\n]{0,20}port)\D{0,24}(?<port>\d{1,5})",
        RegexOptions.IgnoreCase | RegexOptions.CultureInvariant | RegexOptions.Compiled);

    private static readonly Regex BlueStacksNestedConfigPattern = new(
        "[\\\"'](?<id>[^\\\"']+)[\\\"']\\s*:\\s*\\{[^}]{0,2000}?[\\\"'](?:adb[_\\.]?port|adbPort)[\\\"']\\s*:\\s*[\\\"']?(?<port>\\d{1,5})",
        RegexOptions.IgnoreCase | RegexOptions.CultureInvariant | RegexOptions.Compiled | RegexOptions.Singleline);

    private static readonly Regex BlueStacksLineConfigPattern = new(
        "^\\s*[\\\"']?bst\\.instance\\.(?<id>.+?)\\.(?:(?<status>status)\\.)?adb[_\\.]?port\\s*=\\s*[\\\"']?(?<port>\\d{1,5})[\\\"']?\\s*$",
        RegexOptions.IgnoreCase | RegexOptions.CultureInvariant | RegexOptions.Compiled);

    private static readonly Regex BlueStacksJsonFlatConfigPattern = new(
        "[\\\"'](?:bst\\.)?instance\\.(?<id>[^\\\"'.]+?)(?:\\.(?<status>status))?\\.(?:adb[_\\.]?port|adbPort)[\\\"']\\s*:\\s*[\\\"']?(?<port>\\d{1,5})",
        RegexOptions.IgnoreCase | RegexOptions.CultureInvariant | RegexOptions.Compiled);

    internal static IReadOnlyList<int> CandidateLdAdbPorts(string index)
    {
        if (!int.TryParse(index.Trim(), out int numericIndex) || numericIndex < 0)
        {
            return Array.Empty<int>();
        }
        long basePort = 5554L + numericIndex * 2L;
        return basePort is < 1 or > 65534
            ? Array.Empty<int>()
            : new[] { (int)basePort, (int)basePort + 1 };
    }

    internal static IReadOnlyList<LdPlayerInstance> ParseLdList2(string output)
    {
        var instances = new List<LdPlayerInstance>();
        foreach (string rawLine in output.Split('\n'))
        {
            string line = rawLine.Trim().Trim('\r');
            if (line.Length == 0) continue;
            string[] fields = line.Split(new[] { ',', '\t', '|' }, StringSplitOptions.TrimEntries);
            string index;
            string name;
            if (fields.Length >= 2 && int.TryParse(fields[0], out _))
            {
                index = fields[0];
                name = fields[1];
            }
            else
            {
                Match match = Regex.Match(line, @"^(?<index>\d+)\s+(?<name>\S+)", RegexOptions.CultureInvariant);
                if (!match.Success) continue;
                index = match.Groups["index"].Value;
                name = match.Groups["name"].Value;
            }
            int? processId = fields.Length >= 7
                ? ParsePositiveProcessId(fields[5])
                : ParseProcessId(line);
            instances.Add(new LdPlayerInstance(index.Trim(), name.Trim(), processId));
        }
        return instances;
    }

    internal static IReadOnlyList<NoxInstance> ParseNoxConsoleList(string output)
    {
        var instances = new List<NoxInstance>();
        foreach (string rawLine in output.Split('\n'))
        {
            string line = rawLine.Trim().Trim('\r');
            if (line.Length == 0) continue;

            Match labeled = NoxLabeledListLinePattern.Match(line);
            if (labeled.Success)
            {
                if (!int.TryParse(labeled.Groups["index"].Value, out int labeledIndex) || labeledIndex < 0)
                {
                    continue;
                }
                instances.Add(new NoxInstance(
                    labeled.Groups["name"].Value.Trim(),
                    null,
                    labeledIndex,
                    ParseProcessId(line)));
                continue;
            }

            string[] fields = line.Split(new[] { ',', '\t', '|', ':' }, StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries);
            if (fields.Length >= 2)
            {
                string first = fields[0];
                string second = fields[1];
                if (int.TryParse(first, out int numericIndex))
                {
                    if (numericIndex < 0 || IsNoxHeader(second))
                    {
                        continue;
                    }
                    instances.Add(new NoxInstance(
                        second,
                        fields.Length >= 6 && !IsNoxHeader(fields[2]) ? fields[2] : null,
                        numericIndex,
                        ParseNoxProcessId(line, fields)));
                    continue;
                }
                if (first.All(char.IsDigit))
                {
                    continue;
                }
                if (IsNoxNameSelector(first) && !IsNoxHeader(second))
                {
                    instances.Add(new NoxInstance(
                        first,
                        second,
                        null,
                        ParseNoxProcessId(line, fields)));
                    continue;
                }
            }

            Match whitespace = NoxWhitespaceListLinePattern.Match(line);
            if (!whitespace.Success) continue;
            string whitespaceFirst = whitespace.Groups["first"].Value.Trim();
            string whitespaceSecond = whitespace.Groups["second"].Value.Trim();
            if (int.TryParse(whitespaceFirst, out int whitespaceIndex))
            {
                if (whitespaceIndex < 0 || IsNoxHeader(whitespaceSecond)) continue;
                instances.Add(new NoxInstance(whitespaceSecond, null, whitespaceIndex, ParseProcessId(line)));
            }
            else if (!whitespaceFirst.All(char.IsDigit)
                && IsNoxNameSelector(whitespaceFirst)
                && !IsNoxHeader(whitespaceSecond))
            {
                instances.Add(new NoxInstance(whitespaceFirst, whitespaceSecond, null, ParseProcessId(line)));
            }
        }
        return instances;
    }

    internal static IReadOnlyList<int> ParseNoxVboxAdbPorts(string vboxContent)
    {
        var ports = new HashSet<int>();
        foreach (Match match in NoxVboxPortPattern.Matches(vboxContent))
        {
            if (int.TryParse(match.Groups["port"].Value, out int port) && port is >= 1 and <= 65535)
            {
                ports.Add(port);
            }
        }
        return ports.OrderBy(port => port).ToArray();
    }

    internal static IReadOnlyList<BlueStacksInstance> ParseBlueStacksConfig(string config)
    {
        var instances = new Dictionary<string, (int Port, bool IsStatus)>(StringComparer.OrdinalIgnoreCase);
        foreach (string rawLine in config.Split('\n'))
        {
            Match match = BlueStacksLineConfigPattern.Match(rawLine.Trim().Trim('\r'));
            if (match.Success)
            {
                AddBlueStacksInstance(
                    instances,
                    match.Groups["id"].Value,
                    match.Groups["port"].Value,
                    match.Groups["status"].Success);
            }
        }
        foreach (Match match in BlueStacksJsonFlatConfigPattern.Matches(config))
        {
            AddBlueStacksInstance(
                instances,
                match.Groups["id"].Value,
                match.Groups["port"].Value,
                match.Groups["status"].Success);
        }
        foreach (Match match in BlueStacksNestedConfigPattern.Matches(config))
        {
            AddBlueStacksInstance(instances, match.Groups["id"].Value, match.Groups["port"].Value, false);
        }
        return instances
            .Select(instance => new BlueStacksInstance(instance.Key, instance.Value.Port))
            .OrderBy(instance => instance.Id, StringComparer.OrdinalIgnoreCase)
            .ToArray();
    }

    private static void AddBlueStacksInstance(
        Dictionary<string, (int Port, bool IsStatus)> instances,
        string id,
        string rawPort,
        bool isStatus)
    {
        if (int.TryParse(rawPort, out int port) && port is >= 1 and <= 65535 && !string.IsNullOrWhiteSpace(id))
        {
            string key = id.Trim();
            if (!instances.TryGetValue(key, out (int Port, bool IsStatus) existing) || isStatus || !existing.IsStatus)
            {
                instances[key] = (port, isStatus);
            }
        }
    }

    private static bool PathHasIdentity(IReadOnlyList<string> segments, string? identity)
    {
        if (string.IsNullOrWhiteSpace(identity)) return false;
        foreach (string segment in segments)
        {
            if (segment.Equals(identity, StringComparison.OrdinalIgnoreCase)
                || Path.GetFileNameWithoutExtension(segment).Equals(identity, StringComparison.OrdinalIgnoreCase))
            {
                return true;
            }
        }
        return false;
    }

    private static bool IsNoxNameSelector(string value)
    {
        return !string.IsNullOrWhiteSpace(value)
            && value.All(character => char.IsLetterOrDigit(character) || char.IsWhiteSpace(character) || character is '_' or '-' or '.');
    }

    private static bool IsNoxHeader(string value)
    {
        return value.Equals("index", StringComparison.OrdinalIgnoreCase)
            || value.Equals("name", StringComparison.OrdinalIgnoreCase)
            || value.Equals("status", StringComparison.OrdinalIgnoreCase)
            || value.Equals("state", StringComparison.OrdinalIgnoreCase);
    }

    private static int? ParsePositiveProcessId(string value)
    {
        return int.TryParse(value.Trim(), out int pid) && pid > 0 ? pid : null;
    }

    private static int? ParseProcessId(string line)
    {
        Match match = ProcessIdPattern.Match(line);
        return match.Success && int.TryParse(match.Groups[1].Value, out int pid) && pid > 0 ? pid : null;
    }

    private static int? ParseNoxProcessId(string line, IReadOnlyList<string> fields)
    {
        return fields.Count >= 6
            ? ParsePositiveProcessId(fields[^1])
            : ParseProcessId(line);
    }
}
