using System.Text;
using System.Text.Json.Nodes;
using System.Security.Cryptography;

namespace NexusPipeline.Plugin.MaaFrameworkDriver;

public sealed class SessionLogReader
{
    private readonly string _path, _relative, _source;
    private readonly Func<string, JsonObject, ValueTask> _send;
    private readonly bool _skipExisting;
    private readonly CancellationTokenSource _stop = new();
    private readonly LogTextFramer _text;
    private readonly Decoder _decoder = new UTF8Encoding(false, true).GetDecoder();
    private FileStream? _file;
    private string _identity = "";
    private long _offset, _startOffset;
    private int _epoch;
    private bool _incomplete, _primed, _completed;
    private Task? _pump;
    private readonly string? _backupPattern;
    private readonly Dictionary<string, string> _backupBaseline = new(StringComparer.OrdinalIgnoreCase);
    private readonly IncrementalHash _prefix = IncrementalHash.CreateHash(HashAlgorithmName.SHA256);
    private bool _verifiedPrefix = true, _backupInventoryAvailable = true;
    private byte[] _anchor = [];
    private const long BackupLimit = 64L * 1024 * 1024;
    private readonly bool _optional;

    public SessionLogReader(string path, string relativePath, string source, Func<string, JsonObject, ValueTask> send,
        IEnumerable<string> secrets, bool skipExisting = false, string? backupPattern = null, bool optional = false)
    {
        _path = Path.GetFullPath(path); _relative = relativePath; _source = source; _send = send; _skipExisting = skipExisting;
        _backupPattern = backupPattern;
        _optional = optional;
        if (backupPattern is not null && (backupPattern.Length > 64 || backupPattern.IndexOfAny(['/', '\\', ':']) >= 0 || backupPattern.Contains("..")))
            throw new InvalidDataException("log.backup.invalid");
        if (source.Length is < 1 or > 48 || !source.All(c => char.IsAsciiLetterOrDigit(c) || c is '.' or '_' or '-')
            || Path.IsPathFullyQualified(relativePath) || relativePath.Split('/', '\\').Any(part => part is "" or "." or ".."))
            throw new InvalidDataException("log.source.invalid");
        _text = new(text => send("log", new() { ["text"] = text }), secrets);
    }

    public void Start()
    {
        if (_pump is not null || _completed) throw new InvalidOperationException("log.source.started");
        Prime(); _pump = PumpAsync();
    }
    private void Prime()
    {
        if (_primed) return;
        _primed = true;
        if (_backupPattern is not null)
        {
            var entries = Backups();
            foreach (string entry in entries)
                using (var bytes = OpenPath(entry)) if (bytes is not null) _backupBaseline[entry] = BackupIdentity(bytes, entry);
        }
        if (!_skipExisting) return;
        _file = Open();
        if (_file is null) return;
        _identity = DirectoryIdentity.Read(_file.SafeFileHandle); _startOffset = _offset = _file.Length;
        if (_offset > BackupLimit)
        {
            _verifiedPrefix = false; _file.Position = Math.Max(0, _offset - 256);
            _anchor = new byte[(int)(_offset - _file.Position)]; _file.ReadExactly(_anchor);
        }
        else
        {
            byte[] block = new byte[4096]; long remaining = _offset;
            while (remaining > 0)
            {
                int count = _file.Read(block, 0, (int)Math.Min(block.Length, remaining));
                if (count == 0) { _verifiedPrefix = false; break; }
                _prefix.AppendData(block, 0, count); Remember(block.AsSpan(0, count)); remaining -= count;
            }
        }
    }
    private FileStream? Open() => OpenPath(_path);
    private static FileStream? OpenPath(string path)
    {
        for (string? current = path; current is not null; current = Path.GetDirectoryName(current))
            if ((File.Exists(current) || Directory.Exists(current)) && (File.GetAttributes(current) & FileAttributes.ReparsePoint) != 0)
                throw new IOException("log.source_link");
        // Buffered seek can replay stale bytes after another process truncates this same file.
        try { return new(path, FileMode.Open, FileAccess.Read, FileShare.ReadWrite | FileShare.Delete, 1, FileOptions.Asynchronous); }
        catch (FileNotFoundException) { return null; }
        catch (DirectoryNotFoundException) { return null; }
    }
    private async Task PumpAsync()
    {
        try { while (true) { await PollAsync(); await Task.Delay(200, _stop.Token); } }
        catch (OperationCanceledException) when (_stop.IsCancellationRequested) { }
        catch (Exception error) when (error is IOException or UnauthorizedAccessException)
        { _incomplete = true; await State("incomplete"); }
    }
    public async ValueTask PollAsync()
    {
        if (_completed) throw new InvalidOperationException("log.source.completed");
        Prime(); FileStream? observed = Open();
        try
        {
            string identity = observed is null ? "" : DirectoryIdentity.Read(observed.SafeFileHandle);
            if (_file is not null && observed is not null && identity != _identity)
            {
                // Keep the old handle through rename so unread bytes remain associated with their original file.
                await DrainAsync(); await FlushDecoderAsync(); await State(_incomplete ? "incomplete" : "complete");
                _file.Dispose(); _file = null; _epoch++; _offset = _startOffset = 0;
                _prefix.GetHashAndReset(); _verifiedPrefix = true;
                _anchor = [];
            }
            if (_file is null && observed is not null) { _file = observed; observed = null; _identity = identity; }
            if (_file is null) return;
            if (_file.Length < _offset || !AnchorMatches())
            {
                bool recovered = await RecoverBackupAsync();
                if (!recovered) _incomplete = true;
                await State(_incomplete ? "incomplete" : "complete"); await FlushDecoderAsync();
                _epoch++; _offset = _startOffset = 0;
                _prefix.GetHashAndReset(); _verifiedPrefix = true;
                _anchor = [];
            }
            await DrainAsync();
        }
        finally { observed?.Dispose(); }
    }
    private async ValueTask DrainAsync()
    {
        if (_file is null) return;
        _file.Position = _offset;
        byte[] block = new byte[4096]; char[] characters = new char[8192]; long end = _file.Length;
        while (_offset < end)
        {
            int count = await _file.ReadAsync(block.AsMemory(0, (int)Math.Min(block.Length, end - _offset)));
            if (count == 0) { _incomplete = true; break; }
            _offset += count;
            _prefix.AppendData(block, 0, count);
            Remember(block.AsSpan(0, count));
            try { int length = _decoder.GetChars(block, 0, count, characters, 0, false); await _text.AppendAsync(new string(characters, 0, length)); }
            catch (DecoderFallbackException) { _incomplete = true; _decoder.Reset(); await State("incomplete"); }
        }
    }
    private void Remember(ReadOnlySpan<byte> bytes)
    {
        byte[] combined = new byte[_anchor.Length + bytes.Length];
        _anchor.CopyTo(combined, 0); bytes.CopyTo(combined.AsSpan(_anchor.Length));
        _anchor = combined.AsSpan(Math.Max(0, combined.Length - 256)).ToArray();
    }
    private bool AnchorMatches()
    {
        if (_file is null || _anchor.Length == 0) return true;
        _file.Position = _offset - _anchor.Length;
        byte[] observed = new byte[_anchor.Length]; int count = 0;
        while (count < observed.Length)
        {
            int read = _file.Read(observed, count, observed.Length - count);
            if (read == 0) return false; count += read;
        }
        return observed.AsSpan().SequenceEqual(_anchor);
    }
    private string[] Backups()
    {
        string directory = Path.GetDirectoryName(_path)!;
        if (_backupPattern is null || !Directory.Exists(directory)) return [];
        string[] files = Directory.EnumerateFiles(directory, _backupPattern).Take(129).ToArray();
        if (files.Length > 128) { _backupInventoryAvailable = false; return []; }
        return files;
    }
    private static string BackupIdentity(FileStream bytes, string path) => DirectoryIdentity.Read(bytes.SafeFileHandle)
        + ":" + bytes.Length + ":" + File.GetLastWriteTimeUtc(path).Ticks;
    private async ValueTask<bool> RecoverBackupAsync()
    {
        if (!_verifiedPrefix || !_backupInventoryAvailable || _backupPattern is null) return false;
        byte[] expected = _prefix.GetCurrentHash();
        foreach (string path in Backups().OrderByDescending(File.GetLastWriteTimeUtc))
        {
            using var backup = OpenPath(path);
            if (backup is null || backup.Length < _offset || backup.Length > BackupLimit) continue;
            string identity = BackupIdentity(backup, path);
            if (_backupBaseline.TryGetValue(path, out string? previous) && previous == identity) continue;
            using var hash = IncrementalHash.CreateHash(HashAlgorithmName.SHA256);
            byte[] block = new byte[4096]; long remaining = _offset;
            while (remaining > 0)
            {
                int count = await backup.ReadAsync(block.AsMemory(0, (int)Math.Min(block.Length, remaining)));
                if (count == 0) break;
                hash.AppendData(block, 0, count); remaining -= count;
            }
            if (remaining != 0 || !hash.GetHashAndReset().AsSpan().SequenceEqual(expected)) continue;
            long start = _offset; var active = _file;
            try { _file = backup; await DrainAsync(); }
            finally { _file = active; }
            _incomplete |= BackupIdentity(backup, path) != identity;
            string state = _incomplete ? "incomplete" : "complete";
            await _send("progress", new() { ["code"] = "log." + _source + "." + state, ["logSource"] = _source + ".backup.epoch" + _epoch,
                ["logPath"] = Path.Combine(Path.GetDirectoryName(_relative) ?? "", Path.GetFileName(path)).Replace('\\', '/'),
                ["fileIdentity"] = DirectoryIdentity.Read(backup.SafeFileHandle), ["startByteOffset"] = start, ["byteOffset"] = _offset,
                ["rotationEpoch"] = _epoch, ["encoding"] = "utf-8", ["sourceState"] = state });
            _backupBaseline[path] = identity;
            return true;
        }
        return false;
    }
    private async ValueTask FlushDecoderAsync()
    {
        try { char[] tail = new char[4]; int count = _decoder.GetChars([], 0, 0, tail, 0, true); await _text.AppendAsync(new string(tail, 0, count)); }
        catch (DecoderFallbackException) { _incomplete = true; }
        finally { _decoder.Reset(); }
    }
    private ValueTask State(string state) => _send("progress", new() { ["code"] = "log." + _source + "." + state,
        ["logSource"] = _source + (_epoch == 0 ? "" : ".epoch" + _epoch), ["logPath"] = _relative,
        ["fileIdentity"] = _identity, ["startByteOffset"] = _startOffset, ["byteOffset"] = _offset,
        ["rotationEpoch"] = _epoch, ["encoding"] = "utf-8", ["sourceState"] = state });
    public async ValueTask CompleteAsync()
    {
        if (_completed) return;
        _stop.Cancel();
        try
        {
            if (_pump is not null) await _pump;
            try { await PollAsync(); await FlushDecoderAsync(); }
            catch (Exception error) when (error is IOException or UnauthorizedAccessException) { _incomplete = true; }
            await _text.AppendAsync("", complete: true);
            await State(_identity.Length == 0 ? _optional ? "absent" : "missing" : _incomplete ? "incomplete" : "complete");
        }
        finally { _completed = true; _file?.Dispose(); _file = null; _stop.Dispose(); _prefix.Dispose(); }
    }
}
