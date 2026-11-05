namespace NexusPipeline.Extensions.MaaFramework;

internal static class MaaNativePath
{
    internal static string Vendor(string path)
    {
        // The vendor CRT does not inherit .NET's long-path normalization.
        if (!OperatingSystem.IsWindows() || path.StartsWith(@"\\?\", StringComparison.Ordinal)) return path;
        return path.StartsWith(@"\\", StringComparison.Ordinal) ? @"\\?\UNC\" + path[2..] : @"\\?\" + path;
    }
    internal static string Capture(string path, bool directory)
    {
        if (!Path.IsPathFullyQualified(path)) throw new IOException("maa_input_path_must_be_absolute");
        var full = Path.GetFullPath(path);
        if (directory ? !Directory.Exists(full) : !File.Exists(full)) throw new IOException("maa_input_missing");
        FileSystemInfo? item = directory ? new DirectoryInfo(full) : new FileInfo(full);
        while (item is not null)
        {
            if ((item.Attributes & FileAttributes.ReparsePoint) != 0) throw new IOException("maa_input_reparse_point");
            item = item is DirectoryInfo folder ? folder.Parent : ((FileInfo)item).Directory;
        }
        return full;
    }
}
