using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;
using NexusPipeline.Plugin.Abstractions;

namespace NexusPipeline.Plugin.EmulatorSupport;

internal static class EmulatorSupport
{
    private const int MaxBinaryBytes = 16 * 1024 * 1024;

    internal static int? ParseAdbPort(string? address)
    {
        if (string.IsNullOrWhiteSpace(address)) return null;
        string trimmed = address.Trim();
        int colon = trimmed.LastIndexOf(':');
        return colon > 0
            && colon < trimmed.Length - 1
            && int.TryParse(trimmed[(colon + 1)..], out int port)
            && port is >= 1 and <= 65535
                ? port
                : null;
    }

    internal static bool IsLoopbackAdbEndpoint(string? address)
    {
        if (string.IsNullOrWhiteSpace(address) || ParseAdbPort(address) is null) return false;
        string trimmed = address.Trim();
        string host = trimmed[..trimmed.LastIndexOf(':')].Trim();
        if (host.StartsWith("[", StringComparison.Ordinal) && host.EndsWith("]", StringComparison.Ordinal))
        {
            host = host[1..^1];
        }
        return host.Equals("localhost", StringComparison.OrdinalIgnoreCase)
            || host.Equals("127.0.0.1", StringComparison.Ordinal)
            || host.Equals("::1", StringComparison.Ordinal);
    }

    internal static Task<(bool Ok, string Output)> AdbShellAsync(
        string adb,
        string endpoint,
        IReadOnlyList<string> shellArgs,
        int timeoutSeconds,
        CancellationToken token)
    {
        var args = new List<string> { "-s", endpoint, "shell" };
        args.AddRange(shellArgs);
        return RunCommandAsync(adb, args, timeoutSeconds, token);
    }

    internal static async Task<(bool Ok, string Output)> AdbConnectAsync(
        string adb,
        string endpoint,
        CancellationToken token,
        int timeoutSeconds = 30)
    {
        (bool ok, string output) = await RunCommandAsync(
            adb,
            new[] { "connect", endpoint },
            timeoutSeconds,
            token).ConfigureAwait(false);
        bool failed = output.Contains("cannot connect", StringComparison.OrdinalIgnoreCase)
            || output.Contains("failed to connect", StringComparison.OrdinalIgnoreCase)
            || output.Contains("unable to connect", StringComparison.OrdinalIgnoreCase);
        return (ok && !failed, output);
    }

    internal static bool AmStartFailed(string output) =>
        output.Contains("error", StringComparison.OrdinalIgnoreCase);

    internal static async Task<string?> GetForegroundPackageAsync(
        string adb,
        string endpoint,
        CancellationToken token,
        int timeoutSeconds = 30)
    {
        (bool ok, string output) = await AdbShellAsync(
            adb,
            endpoint,
            new[] { "dumpsys", "window" },
            timeoutSeconds,
            token).ConfigureAwait(false);
        return ok ? ParseForegroundPackage(output) : null;
    }

    internal static string? ParseForegroundPackage(string output)
    {
        foreach (string rawLine in output.Split('\n'))
        {
            string line = rawLine.Trim();
            string? target = null;
            if (line.StartsWith("mCurrentFocus=", StringComparison.Ordinal))
            {
                int start = line.IndexOf('{');
                int end = line.IndexOf('}');
                if (start >= 0 && end > start)
                {
                    string inside = line[(start + 1)..end];
                    int user = inside.LastIndexOf(" u0 ", StringComparison.Ordinal);
                    if (user < 0) user = inside.LastIndexOf(" u1 ", StringComparison.Ordinal);
                    target = user >= 0 ? inside[(user + 4)..] : inside;
                }
            }
            else if (line.StartsWith("topResumedActivity=", StringComparison.Ordinal))
            {
                int start = line.IndexOf('{');
                int end = line.IndexOf('}');
                if (start >= 0 && end > start)
                {
                    string[] parts = line[(start + 1)..end].Split(' ', StringSplitOptions.RemoveEmptyEntries);
                    target = parts.Length >= 2 ? parts[^2] : null;
                }
            }
            if (target is null) continue;
            int slash = target.IndexOf('/');
            string packageName = (slash >= 0 ? target[..slash] : target).Trim();
            if (packageName.Length > 0) return packageName;
        }
        return null;
    }

    internal static bool IsOfflineProbeFailure(string output) =>
        output.Contains("device offline", StringComparison.OrdinalIgnoreCase)
        || output.Contains("device not found", StringComparison.OrdinalIgnoreCase)
        || output.Contains("no devices/emulators found", StringComparison.OrdinalIgnoreCase)
        || output.Contains("cannot connect to", StringComparison.OrdinalIgnoreCase)
        || output.Contains("failed to connect", StringComparison.OrdinalIgnoreCase);

    internal static async Task<bool> WaitEmulatorOfflineAsync(string adb, string endpoint, CancellationToken token)
    {
        DateTime deadline = DateTime.UtcNow.AddSeconds(60);
        int consecutiveOfflineProbes = 0;
        while (DateTime.UtcNow < deadline)
        {
            (bool ok, string output) = await RunCommandAsync(
                adb,
                new[] { "-s", endpoint, "shell", "echo", "ok" },
                10,
                token).ConfigureAwait(false);
            if (!ok && IsOfflineProbeFailure(output))
            {
                if (++consecutiveOfflineProbes >= 2) return true;
            }
            else
            {
                consecutiveOfflineProbes = 0;
            }
            await Task.Delay(TimeSpan.FromSeconds(1), token).ConfigureAwait(false);
        }
        return false;
    }

    internal static bool IsCommandFile(string path) =>
        Path.GetExtension(path).Equals(".bat", StringComparison.OrdinalIgnoreCase)
        || Path.GetExtension(path).Equals(".cmd", StringComparison.OrdinalIgnoreCase);

    private static ProcessStartInfo BuildCommandStartInfo(string executable, IReadOnlyList<string> args)
    {
        ProcessStartInfo info;
        if (IsCommandFile(executable))
        {
            var command = new StringBuilder();
            command.Append("/d /s /c \"\"").Append(executable).Append('"');
            foreach (string arg in args)
            {
                command.Append(" \"").Append(arg.Replace("\"", "\\\"", StringComparison.Ordinal)).Append('"');
            }
            command.Append('"');
            info = new ProcessStartInfo(Environment.GetEnvironmentVariable("COMSPEC") ?? "cmd.exe", command.ToString());
        }
        else
        {
            info = new ProcessStartInfo(executable);
            foreach (string arg in args) info.ArgumentList.Add(arg);
        }
        info.UseShellExecute = false;
        info.RedirectStandardOutput = true;
        info.RedirectStandardError = true;
        info.RedirectStandardInput = true;
        info.StandardOutputEncoding = Encoding.UTF8;
        info.StandardErrorEncoding = Encoding.UTF8;
        info.CreateNoWindow = true;
        return info;
    }

    internal static async Task<(bool Ok, string Output)> RunCommandAsync(
        string executable,
        IReadOnlyList<string> args,
        int timeoutSeconds,
        CancellationToken token)
    {
        Process process;
        try
        {
            process = Process.Start(BuildCommandStartInfo(executable, args))
                ?? throw new InvalidOperationException("无法启动模拟器命令进程");
        }
        catch (Exception ex)
        {
            return (false, ex.Message);
        }
        using (process)
        {
            using OwnedProcessTree? processTree = OwnedProcessTree.TryAttach(process);
            try { process.StandardInput.Close(); } catch { }
            using var operation = CancellationTokenSource.CreateLinkedTokenSource(token);
            operation.CancelAfter(TimeSpan.FromSeconds(Math.Max(1, timeoutSeconds)));
            Task<string> stdout = process.StandardOutput.ReadToEndAsync(operation.Token);
            Task<string> stderr = process.StandardError.ReadToEndAsync(operation.Token);
            Task exit = process.WaitForExitAsync(operation.Token);
            try
            {
                await Task.WhenAll(exit, stdout, stderr).WaitAsync(operation.Token).ConfigureAwait(false);
            }
            catch (OperationCanceledException)
            {
                await StopAndDrainAsync(process, processTree, exit, stdout, stderr).ConfigureAwait(false);
                token.ThrowIfCancellationRequested();
                return (false, $"命令执行超时（{Math.Max(1, timeoutSeconds)} 秒）");
            }
            catch (Exception ex)
            {
                await StopAndDrainAsync(process, processTree, exit, stdout, stderr).ConfigureAwait(false);
                return (false, ex.Message);
            }
            string output = await stdout.ConfigureAwait(false);
            string error = await stderr.ConfigureAwait(false);
            return (process.ExitCode == 0, string.IsNullOrWhiteSpace(error) ? output : $"{output}\n{error}".Trim());
        }
    }

    internal static async Task<PluginEmulatorBinaryResult> RunBinaryCommandAsync(
        string executable,
        IReadOnlyList<string> args,
        int timeoutSeconds,
        CancellationToken token)
    {
        Process process;
        try
        {
            process = Process.Start(BuildCommandStartInfo(executable, args))
                ?? throw new InvalidOperationException("无法启动模拟器截图进程");
        }
        catch (Exception ex)
        {
            return PluginEmulatorBinaryResult.Failure(ex.Message);
        }
        using (process)
        {
            using OwnedProcessTree? processTree = OwnedProcessTree.TryAttach(process);
            try { process.StandardInput.Close(); } catch { }
            using var operation = CancellationTokenSource.CreateLinkedTokenSource(token);
            operation.CancelAfter(TimeSpan.FromSeconds(Math.Max(1, timeoutSeconds)));
            Task<byte[]> stdout = ReadBinaryAsync(process.StandardOutput.BaseStream, operation.Token);
            Task<string> stderr = process.StandardError.ReadToEndAsync(operation.Token);
            Task exit = process.WaitForExitAsync(operation.Token);
            try
            {
                await Task.WhenAll(exit, stdout, stderr).WaitAsync(operation.Token).ConfigureAwait(false);
            }
            catch (OperationCanceledException)
            {
                await StopAndDrainAsync(process, processTree, exit, stdout, stderr).ConfigureAwait(false);
                token.ThrowIfCancellationRequested();
                return PluginEmulatorBinaryResult.Failure($"命令执行超时（{Math.Max(1, timeoutSeconds)} 秒）");
            }
            catch (Exception ex)
            {
                await StopAndDrainAsync(process, processTree, exit, stdout, stderr).ConfigureAwait(false);
                return PluginEmulatorBinaryResult.Failure(ex.Message);
            }
            byte[] data = await stdout.ConfigureAwait(false);
            string error = await stderr.ConfigureAwait(false);
            return process.ExitCode == 0
                ? PluginEmulatorBinaryResult.Success(data)
                : PluginEmulatorBinaryResult.Failure(string.IsNullOrWhiteSpace(error) ? $"命令返回码 {process.ExitCode}" : error.Trim());
        }
    }

    private static async Task<byte[]> ReadBinaryAsync(Stream stream, CancellationToken token)
    {
        using var output = new MemoryStream();
        byte[] buffer = new byte[64 * 1024];
        while (true)
        {
            int read = await stream.ReadAsync(buffer.AsMemory(), token).ConfigureAwait(false);
            if (read == 0) return output.ToArray();
            if (output.Length + read > MaxBinaryBytes) throw new InvalidOperationException("截图响应超过大小上限");
            output.Write(buffer, 0, read);
        }
    }

    internal static bool IsPng(byte[]? data) =>
        data is { Length: >= 8 }
        && data[0] == 0x89 && data[1] == 0x50 && data[2] == 0x4E && data[3] == 0x47
        && data[4] == 0x0D && data[5] == 0x0A && data[6] == 0x1A && data[7] == 0x0A;

    internal static bool TryKillExactProcess(int pid, IReadOnlyCollection<string> expectedNames, string display)
    {
        if (pid <= 0) return false;
        try
        {
            using Process process = Process.GetProcessById(pid);
            if (process.HasExited) return true;
            if (expectedNames.Count > 0 && !expectedNames.Contains(process.ProcessName, StringComparer.OrdinalIgnoreCase)) return false;
            process.Kill(entireProcessTree: false);
            process.WaitForExit(5000);
            return process.HasExited;
        }
        catch (ArgumentException) { return true; }
        catch (InvalidOperationException) { return true; }
        catch { return false; }
    }

    private static void TryKill(Process process)
    {
        try
        {
            if (!process.HasExited) process.Kill(entireProcessTree: true);
        }
        catch { }
    }

    private static async Task StopAndDrainAsync(Process process, OwnedProcessTree? processTree, params Task[] pendingTasks)
    {
        foreach (Task task in pendingTasks) ObserveFault(task);
        if (processTree is not null)
        {
            processTree.Terminate();
        }
        else
        {
            TryKill(process);
        }
        try { process.StandardOutput.Dispose(); } catch { }
        try { process.StandardError.Dispose(); } catch { }
        try
        {
            using var drainTimeout = new CancellationTokenSource(TimeSpan.FromSeconds(2));
            await process.WaitForExitAsync(drainTimeout.Token).ConfigureAwait(false);
        }
        catch { }
        try
        {
            await Task.WhenAll(pendingTasks).WaitAsync(TimeSpan.FromSeconds(2)).ConfigureAwait(false);
        }
        catch { }
    }

    private static void ObserveFault(Task task)
    {
        if (task.IsFaulted)
        {
            _ = task.Exception;
            return;
        }
        if (task.IsCompleted) return;
        _ = task.ContinueWith(
            completed => _ = completed.Exception,
            CancellationToken.None,
            TaskContinuationOptions.OnlyOnFaulted | TaskContinuationOptions.ExecuteSynchronously,
            TaskScheduler.Default);
    }

    private sealed class OwnedProcessTree : IDisposable
    {
        private const uint ProcessTerminate = 0x0001;
        private const uint ProcessSetQuota = 0x0100;
        private IntPtr _job;

        private OwnedProcessTree(IntPtr job)
        {
            _job = job;
        }

        public static OwnedProcessTree? TryAttach(Process process)
        {
            if (!OperatingSystem.IsWindows()) return null;

            IntPtr job = CreateJobObject(IntPtr.Zero, null);
            if (job == IntPtr.Zero) return null;
            try
            {
                IntPtr processHandle = OpenProcess(ProcessSetQuota | ProcessTerminate, inheritHandle: false, process.Id);
                if (processHandle == IntPtr.Zero)
                {
                    CloseHandle(job);
                    return null;
                }
                try
                {
                    if (!AssignProcessToJobObject(job, processHandle))
                    {
                        CloseHandle(job);
                        return null;
                    }
                }
                finally
                {
                    CloseHandle(processHandle);
                }
                return new OwnedProcessTree(job);
            }
            catch
            {
                CloseHandle(job);
                return null;
            }
        }

        public void Terminate()
        {
            if (_job == IntPtr.Zero) return;
            _ = TerminateJobObject(_job, 1);
            CloseHandle(_job);
            _job = IntPtr.Zero;
        }

        public void Dispose()
        {
            if (_job == IntPtr.Zero) return;
            CloseHandle(_job);
            _job = IntPtr.Zero;
        }

        [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
        private static extern IntPtr CreateJobObject(IntPtr jobAttributes, string? name);

        [DllImport("kernel32.dll", SetLastError = true)]
        private static extern IntPtr OpenProcess(uint desiredAccess, bool inheritHandle, int processId);

        [DllImport("kernel32.dll", SetLastError = true)]
        private static extern bool AssignProcessToJobObject(IntPtr job, IntPtr process);

        [DllImport("kernel32.dll", SetLastError = true)]
        private static extern bool TerminateJobObject(IntPtr job, uint exitCode);

        [DllImport("kernel32.dll", SetLastError = true)]
        private static extern bool CloseHandle(IntPtr handle);

    }
}
