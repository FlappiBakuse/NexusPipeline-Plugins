using System.Text.Json;

namespace NexusPipeline.Extensions.MaaFramework;

internal sealed record MaaRuntimeSettings(string RuntimeLibrary, string ControllerLibrary, string ResourceDirectory, string Image)
{
    internal static MaaRuntimeSettings Read(Stream stream)
    {
        if (!stream.CanSeek || stream.Length is < 2 or > 8192) throw Invalid();
        var bytes = new byte[checked((int)stream.Length)];
        stream.ReadExactly(bytes);
        if (bytes.AsSpan().StartsWith(new byte[] { 0xef, 0xbb, 0xbf })) throw Invalid();
        using var json = JsonDocument.Parse(bytes, new() { MaxDepth = 2 });
        var root = json.RootElement;
        if (root.ValueKind != JsonValueKind.Object) throw Invalid();
        var fields = new HashSet<string>(StringComparer.Ordinal);
        foreach (var property in root.EnumerateObject())
            if (!fields.Add(property.Name) || property.Name is not
                ("format" or "version" or "runtimeLibrary" or "controllerLibrary" or "resourceDirectory" or "image")) throw Invalid();
        if (fields.Count != 6 || root.GetProperty("format").GetString() != "nexus.maa.runtime" ||
            !root.GetProperty("version").TryGetInt32(out var version) || version != 1) throw Invalid();
        var runtime = Text("runtimeLibrary"); var controller = Text("controllerLibrary");
        if (Path.GetFileName(runtime) != "MaaFramework.dll" || Path.GetFileName(controller) != "MaaCustomControlUnit.dll" ||
            Path.GetDirectoryName(runtime) != Path.GetDirectoryName(controller)) throw Invalid();
        return new(runtime, controller, Text("resourceDirectory"), Text("image"));

        string Text(string name)
        {
            var element = root.GetProperty(name);
            if (element.ValueKind != JsonValueKind.String || element.GetString() is not { Length: > 0 and <= 512 } value ||
                value.Any(character => char.IsControl(character) || character is '\\' or ':') ||
                value.Split('/').Any(part => part.Length == 0 || part is "." or "..")) throw Invalid();
            return value;
        }
    }

    private static IOException Invalid() => new("maa_runtime_settings_invalid");
}
