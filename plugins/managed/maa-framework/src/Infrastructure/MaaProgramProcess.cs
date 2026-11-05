using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;
using Microsoft.Win32.SafeHandles;

namespace NexusPipeline.Extensions.MaaFramework;

internal sealed class MaaProgramProcess : IAsyncDisposable
{
    private readonly SafeFileHandle job, process;
    private readonly Action requireCurrent;
    private bool stopped, disposed;
    internal int ProcessId { get; }
    internal bool FamilyStopped => stopped;
    internal bool HasExited => ExitCode is not null;
    internal int? ExitCode
    {
        get
        {
            ObjectDisposedException.ThrowIf(disposed, this);
            var wait = WaitForSingleObject(process, 0);
            if (wait == 258) return null;
            if (wait != 0 || !GetExitCodeProcess(process, out var code)) throw new IOException("maa_program_status_unavailable");
            return unchecked((int)code);
        }
    }

    internal MaaProgramProcess(string executable, IReadOnlyList<string> arguments, string directory,
        IReadOnlyDictionary<string, string> environment, Action requireCurrent)
    {
        this.requireCurrent = requireCurrent;
        requireCurrent(); executable = MaaNativePath.Capture(executable, false); directory = MaaNativePath.Capture(directory, true);
        if (arguments.Count > 256 || arguments.Any(value => value.Length > 32760 || value.Contains('\0')))
            throw new IOException("maa_program_arguments_invalid");
        var command = string.Join(' ', new[] { executable }.Concat(arguments).Select(Quote));
        if (command.Length > 32760) throw new IOException("maa_program_arguments_invalid");
        var variables = new SortedDictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        foreach (System.Collections.DictionaryEntry entry in Environment.GetEnvironmentVariables())
            if (entry.Key is string key && entry.Value is string value) variables[key] = value;
        foreach (var entry in environment)
        {
            if (entry.Key.Length is < 1 or > 128 || entry.Key.Any(value => value is '\0' or '=') ||
                entry.Value.Length > 32760 || entry.Value.Contains('\0')) throw new IOException("maa_program_environment_invalid");
            variables[entry.Key] = entry.Value;
        }
        var block = string.Concat(variables.Select(entry => entry.Key + "=" + entry.Value + "\0")) + "\0";
        if (block.Length > 262144) throw new IOException("maa_program_environment_invalid");
        job = CreateJobObject(0, null);
        if (job.IsInvalid) { job.Dispose(); throw new IOException("maa_program_job_unavailable"); }
        SafeFileHandle? started = null;
        var nativeCommand = Marshal.StringToHGlobalUni(command); var nativeEnvironment = Marshal.StringToHGlobalUni(block);
        try
        {
            var limits = new ExtendedLimits { Basic = new() { Flags = 0x2000 } };
            if (!SetInformationJobObject(job, 9, ref limits, checked((uint)Marshal.SizeOf<ExtendedLimits>())))
                throw new IOException("maa_program_job_policy_failed");
            var startup = new Startup { Size = checked((uint)Marshal.SizeOf<Startup>()) };
            requireCurrent();
            if (!CreateProcess(executable, nativeCommand, 0, 0, false, 0x08000404, nativeEnvironment, directory, ref startup, out var created))
                throw new IOException("maa_program_start_failed");
            started = new(created.Process, true);
            using var thread = new SafeFileHandle(created.Thread, true);
            ProcessId = checked((int)created.ProcessId);
            if (!AssignProcessToJobObject(job, started))
            {
                _ = TerminateProcess(started, 1);
                throw new IOException("maa_program_job_binding_failed");
            }
            requireCurrent();
            if (ResumeThread(thread) == uint.MaxValue) throw new IOException("maa_program_resume_failed");
            process = started; started = null;
        }
        catch
        {
            _ = TerminateJobObject(job, 1); started?.Dispose(); job.Dispose(); throw;
        }
        finally
        {
            Zero(nativeCommand, checked((command.Length + 1) * 2)); Zero(nativeEnvironment, checked((block.Length + 1) * 2));
        }
    }

    internal void RequireRunning()
    {
        ObjectDisposedException.ThrowIf(disposed || stopped, this); requireCurrent();
        if (HasExited) throw new IOException("maa_agent_process_exited");
    }
    internal async Task<int> WaitAsync(TimeSpan timeout, CancellationToken cancellation, bool waitForFamily = true)
    {
        var timer = Stopwatch.StartNew();
        while (true)
        {
            cancellation.ThrowIfCancellationRequested(); requireCurrent();
            if (ExitCode is { } result)
            {
                stopped = ActiveCount() == 0;
                if (stopped || !waitForFamily) return result;
            }
            if (timer.Elapsed >= timeout) throw new TimeoutException("maa_program_exit_timeout");
            await Task.Delay(10, cancellation).ConfigureAwait(false);
        }
    }
    internal async Task StopAsync(TimeSpan timeout)
    {
        ObjectDisposedException.ThrowIf(disposed, this);
        if (stopped) return;
        if (ActiveCount() > 0 && !TerminateJobObject(job, 2)) throw new IOException("maa_program_stop_failed");
        var timer = Stopwatch.StartNew();
        while (ActiveCount() != 0)
        {
            if (timer.Elapsed >= timeout) throw new TimeoutException("maa_program_family_unconfirmed");
            await Task.Delay(10).ConfigureAwait(false);
        }
        if (ExitCode is null) throw new IOException("maa_program_root_unconfirmed");
        stopped = true;
    }
    internal uint ActiveCount()
    {
        ObjectDisposedException.ThrowIf(disposed, this);
        if (!QueryInformationJobObject(job, 1, out var accounting, checked((uint)Marshal.SizeOf<Accounting>()), out _))
            throw new IOException("maa_program_accounting_unavailable");
        return accounting.ActiveProcesses;
    }
    public async ValueTask DisposeAsync()
    {
        if (disposed) return;
        await StopAsync(TimeSpan.FromSeconds(5)).ConfigureAwait(false);
        disposed = true; process.Dispose(); job.Dispose();
    }
    private static void Zero(nint memory, int bytes)
    {
        for (var index = 0; index < bytes; index++) Marshal.WriteByte(memory, index, 0);
        Marshal.FreeHGlobal(memory);
    }
    private static string Quote(string argument)
    {
        var result = new StringBuilder("\""); var slashes = 0;
        foreach (var character in argument)
        {
            if (character == '\\') { slashes++; continue; }
            result.Append('\\', character == '"' ? slashes * 2 + 1 : slashes); result.Append(character); slashes = 0;
        }
        return result.Append('\\', slashes * 2).Append('"').ToString();
    }

    [StructLayout(LayoutKind.Sequential)] private struct BasicLimits
    { public long ProcessTime, JobTime; public uint Flags; public nuint MinimumWorkingSet, MaximumWorkingSet; public uint ActiveProcessLimit; public nuint Affinity; public uint Priority, Scheduling; }
    [StructLayout(LayoutKind.Sequential)] private struct IoCounters
    { public ulong ReadOperations, WriteOperations, OtherOperations, ReadBytes, WriteBytes, OtherBytes; }
    [StructLayout(LayoutKind.Sequential)] private struct ExtendedLimits
    { public BasicLimits Basic; public IoCounters Io; public nuint ProcessMemory, JobMemory, PeakProcessMemory, PeakJobMemory; }
    [StructLayout(LayoutKind.Sequential)] private struct Accounting
    { public long UserTime, KernelTime, PeriodUserTime, PeriodKernelTime; public uint PageFaults, TotalProcesses, ActiveProcesses, TerminatedProcesses; }
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)] private struct Startup
    { public uint Size; public nint Reserved, Desktop, Title; public uint X, Y, Width, Height, CharactersX, CharactersY, Fill, Flags; public ushort Show, ReservedSize; public nint ReservedBytes, Input, Output, Error; }
    [StructLayout(LayoutKind.Sequential)] private struct CreatedProcess
    { public nint Process, Thread; public uint ProcessId, ThreadId; }
    [DllImport("kernel32.dll", EntryPoint = "CreateJobObjectW", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern SafeFileHandle CreateJobObject(nint security, string? name);
    [DllImport("kernel32.dll", SetLastError = true)] [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool SetInformationJobObject(SafeFileHandle job, int information, ref ExtendedLimits value, uint bytes);
    [DllImport("kernel32.dll", SetLastError = true)] [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool QueryInformationJobObject(SafeFileHandle job, int information, out Accounting value, uint bytes, out uint returned);
    [DllImport("kernel32.dll", EntryPoint = "CreateProcessW", CharSet = CharSet.Unicode, SetLastError = true)] [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool CreateProcess(string application, nint command, nint processSecurity, nint threadSecurity, [MarshalAs(UnmanagedType.Bool)] bool inherit,
        uint flags, nint environment, string directory, ref Startup startup, out CreatedProcess process);
    [DllImport("kernel32.dll", SetLastError = true)] [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool AssignProcessToJobObject(SafeFileHandle job, SafeFileHandle process);
    [DllImport("kernel32.dll", SetLastError = true)] private static extern uint ResumeThread(SafeFileHandle thread);
    [DllImport("kernel32.dll", SetLastError = true)] [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool GetExitCodeProcess(SafeFileHandle process, out uint code);
    [DllImport("kernel32.dll", SetLastError = true)] private static extern uint WaitForSingleObject(SafeFileHandle process, uint milliseconds);
    [DllImport("kernel32.dll", SetLastError = true)] [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool TerminateJobObject(SafeFileHandle job, uint exitCode);
    [DllImport("kernel32.dll", SetLastError = true)] [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool TerminateProcess(SafeFileHandle process, uint exitCode);
}
