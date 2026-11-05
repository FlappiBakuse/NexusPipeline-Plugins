using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text.Json;
using NexusPipeline.Extensions.MaaFramework;

internal static class AgentChild
{
    internal static int Run(string[] arguments)
    {
        if (arguments is not [var receipt, var runtime, var report, var mode, var identifier]) return 2;
        using var source = JsonDocument.Parse(File.ReadAllBytes(receipt));
        string Hash(string name) => source.RootElement.GetProperty("files").EnumerateArray()
            .Single(item => item.GetProperty("path").GetString() == "bin/" + name).GetProperty("sha256").GetString()!;
        var library = Path.Combine(runtime, "MaaAgentServer.dll");
        if (Convert.ToHexStringLower(SHA256.HashData(File.ReadAllBytes(library))) != Hash("MaaAgentServer.dll")) return 2;
        using var native = MaaNative.Load(Path.Combine(runtime, "MaaFramework.dll"), Hash("MaaFramework.dll"), Hash("MaaCustomControlUnit.dll"));
        if (native.MaaGlobalSetOption(1, [], 0) == 0 || native.MaaGlobalSetOption(4, BitConverter.GetBytes(0), 4) == 0) return 2;
        var module = NativeLibrary.Load(library, typeof(AgentChild).Assembly,
            DllImportSearchPath.UseDllDirectoryForDependencies | DllImportSearchPath.System32);
        try
        {
            T Export<T>(string name) where T : Delegate => Marshal.GetDelegateForFunctionPointer<T>(NativeLibrary.GetExport(module, name));
            var calls = 0;
            ActionCall action = (_, _, _, _, parameters, _, _, _) => {
                try
                {
                    var value = Marshal.PtrToStringUTF8(parameters) ?? "";
                    using var parsed = JsonDocument.Parse(value);
                    if (parsed.RootElement.GetProperty("text").GetString() != "中文 Agent") return 0;
                    File.WriteAllText(report + ".entered", "entered");
                    if (mode == "delay") Thread.Sleep(500);
                    Interlocked.Increment(ref calls);
                    File.WriteAllText(report + ".returned", "returned"); return 1;
                }
                catch { return 0; }
            };
            if (Export<RegisterCall>("MaaAgentServerRegisterCustomAction")("OwnedAgentAction", Marshal.GetFunctionPointerForDelegate(action), 0) == 0 ||
                Export<StartupCall>("MaaAgentServerStartUp")(identifier) == 0) return 3;
            if (mode == "exit") _ = Task.Run(async () => {
                while (!File.Exists(report + ".exit")) await Task.Delay(10);
                Environment.Exit(7);
            });
            Export<VoidCall>("MaaAgentServerJoin")();
            Export<VoidCall>("MaaAgentServerShutDown")();
            File.WriteAllText(report, JsonSerializer.Serialize(new { processId = Environment.ProcessId, calls, stopped = true }));
            GC.KeepAlive(action); return 0;
        }
        finally { NativeLibrary.Free(module); }
    }
    [UnmanagedFunctionPointer(CallingConvention.Cdecl)] private delegate byte ActionCall(nint context, long task, nint node,
        nint action, nint parameters, long recognition, nint box, nint argument);
    [UnmanagedFunctionPointer(CallingConvention.Cdecl)] private delegate byte RegisterCall([MarshalAs(UnmanagedType.LPUTF8Str)] string name, nint callback, nint argument);
    [UnmanagedFunctionPointer(CallingConvention.Cdecl)] private delegate byte StartupCall([MarshalAs(UnmanagedType.LPUTF8Str)] string identifier);
    [UnmanagedFunctionPointer(CallingConvention.Cdecl)] private delegate void VoidCall();
}
