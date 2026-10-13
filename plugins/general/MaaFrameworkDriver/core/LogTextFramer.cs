using System.Text;

namespace NexusPipeline.Plugin.MaaFrameworkDriver;

public sealed class LogTextFramer(Func<string, ValueTask> publish, IEnumerable<string> secrets)
{
    private readonly string[] _secrets = secrets.Where(value => value.Length > 0).Distinct().OrderByDescending(value => value.Length).ToArray();
    private readonly StringBuilder _pending = new();

    public async ValueTask AppendAsync(string text, bool complete = false)
    {
        _pending.Append(text);
        int window = _secrets.Select(value => value.Length).DefaultIfEmpty(1).Max();
        bool multiline = _secrets.Any(value => value.Contains('\n'));
        while (_pending.Length > 0)
        {
            string raw = _pending.ToString();
            int newline = raw.IndexOf('\n');
            int cut = complete ? Math.Min(raw.Length, 2048)
                : !multiline && newline >= 0 && newline < 2048 ? newline + 1
                : raw.Length >= 2048 + window ? 2048 : 0;
            if (cut == 0) break;
            // Preserve a whole match before framing so a token crossing a wire boundary cannot leak.
            int previous;
            do
            {
                previous = cut;
                foreach (string secret in _secrets)
                    for (int at = raw.IndexOf(secret, StringComparison.Ordinal); at >= 0 && at < cut;
                        at = raw.IndexOf(secret, at + secret.Length, StringComparison.Ordinal))
                        cut = Math.Max(cut, at + secret.Length);
            } while (previous != cut);
            if (cut < raw.Length && char.IsHighSurrogate(raw[cut - 1]) && char.IsLowSurrogate(raw[cut])) cut--;
            string safe = raw[..cut];
            _pending.Remove(0, cut);
            foreach (string secret in _secrets) safe = safe.Replace(secret, "[redacted]", StringComparison.Ordinal);
            while (safe.Length > 0)
            {
                int count = Math.Min(2048, safe.Length);
                if (count < safe.Length && char.IsHighSurrogate(safe[count - 1]) && char.IsLowSurrogate(safe[count])) count--;
                await publish(safe[..count]); safe = safe[count..];
            }
        }
    }
}
