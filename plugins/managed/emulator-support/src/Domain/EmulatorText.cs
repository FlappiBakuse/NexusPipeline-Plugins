namespace NexusPipeline.Extensions.EmulatorSupport;

internal static class EmulatorText
{
    internal static string Decode(ReadOnlySpan<byte> bytes)
    {
        try
        {
            if (bytes.StartsWith(new byte[] { 0xff, 0xfe })) return new System.Text.UnicodeEncoding(false, false, true).GetString(bytes[2..]);
            if (bytes.StartsWith(new byte[] { 0xfe, 0xff })) return new System.Text.UnicodeEncoding(true, false, true).GetString(bytes[2..]);
            return new System.Text.UTF8Encoding(false, true).GetString(bytes);
        }
        catch (System.Text.DecoderFallbackException) { throw new EmulatorFailure("emulator_config_encoding_invalid"); }
    }
    internal static string[] Lines(string text)
    {
        if (text.Length > 1048576 || text.Contains('\0')) throw new EmulatorFailure("emulator_output_invalid");
        var lines = text.Split('\n').Select(line => line.Trim().TrimStart('\ufeff')).Where(line => line.Length > 0).ToArray();
        if (lines.Length > 4096 || lines.Any(line => line.Length > 8192 || line.Any(character => char.IsControl(character) && character != '\t')))
            throw new EmulatorFailure("emulator_output_invalid");
        return lines;
    }
    internal static EmulatorEnumeration Result(List<EmulatorInstance> rows, string code)
    {
        if (rows.Select(row => row.Identity).Distinct(StringComparer.OrdinalIgnoreCase).Count() != rows.Count)
            throw new EmulatorFailure(code);
        return new(rows.Count == 0 ? "empty" : "enumerated", rows.ToArray());
    }
}
