namespace NexusPipeline.Extensions.MaaFramework;

internal static class MaaResourcePaths
{
    internal static string Resolve(string interfacePath, string relative)
    {
        relative = relative.Replace('\\', '/');
        if (relative.StartsWith("{PROJECT_DIR}/", StringComparison.Ordinal)) relative = relative[14..];
        if (relative.Length == 0 || relative.Length > 4096 || relative.StartsWith('/') || relative.Contains(':') || relative.Any(char.IsControl))
            throw new MaaInputFailure("maa_resource_scope_invalid");
        var directory = interfacePath.Contains('/') ? interfacePath[..interfacePath.LastIndexOf('/')] : "";
        var segments = directory.Length == 0 ? new List<string>() : directory.Split('/').ToList();
        foreach (var segment in relative.Split('/'))
        {
            if (segment is "" or ".") continue;
            if (segment == "..")
            { if (segments.Count == 0) throw new MaaInputFailure("maa_resource_scope_escape"); segments.RemoveAt(segments.Count - 1); }
            else
            { if (segment.EndsWith('.') || segment.EndsWith(' ')) throw new MaaInputFailure("maa_resource_scope_invalid"); segments.Add(segment); }
        }
        if (segments.Count == 0) throw new MaaInputFailure("maa_resource_scope_invalid");
        return MaaSourceSet.Normalize(string.Join('/', segments));
    }
}
