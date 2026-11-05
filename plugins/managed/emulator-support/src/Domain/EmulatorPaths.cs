using System.Globalization;

namespace NexusPipeline.Extensions.EmulatorSupport;

internal static class EmulatorPaths
{
    internal static bool Absolute(string path) => path.Length is > 3 and <= 32767 && char.IsAsciiLetter(path[0]) && path[1] == ':' &&
        path[2] is '\\' or '/' && !path.Any(char.IsControl) && !path[2..].Contains(':') && Relative(path[3..]);
    internal static bool Relative(string path) => path.Length > 0 && !path.Any(char.IsControl) && !path.Contains(':') &&
        path.Replace('\\', '/').Split('/').All(segment => segment.Length > 0 && segment is not "." and not ".." &&
            segment[^1] is not ' ' and not '.' && !segment.Any(character => "<>\"|?*".Contains(character)));
    internal static string Name(string path) => path.Replace('\\', '/').Split('/')[^1].ToLowerInvariant();
    internal static bool Within(string root, string path) => path.Replace('\\', '/').StartsWith(root.Replace('\\', '/').TrimEnd('/') + "/", StringComparison.OrdinalIgnoreCase);
    internal static string Endpoint(string endpoint)
    {
        var split = endpoint.LastIndexOf(':'); if (split < 1) throw new EmulatorFailure("emulator_endpoint_invalid");
        var host = endpoint[..split];
        if (host is not ("127.0.0.1" or "localhost" or "[::1]") || !int.TryParse(endpoint[(split + 1)..], NumberStyles.None, CultureInfo.InvariantCulture, out var port) || port is < 1 or > 65535)
            throw new EmulatorFailure("emulator_endpoint_invalid");
        return (host == "localhost" ? "127.0.0.1" : host) + ":" + port.ToString(CultureInfo.InvariantCulture);
    }
    internal static int Port(string endpoint) => int.Parse(Endpoint(endpoint).Split(':')[^1], CultureInfo.InvariantCulture);
    internal static bool Selector(string value) => value.Length is > 0 and <= 128 && value.All(character => char.IsLetterOrDigit(character) || character is ' ' or '_' or '-' or '.');
}
