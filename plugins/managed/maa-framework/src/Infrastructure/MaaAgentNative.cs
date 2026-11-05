using System.Runtime.InteropServices;

namespace NexusPipeline.Extensions.MaaFramework;

internal sealed class MaaAgentNative : IDisposable
{
    private readonly MaaInputLease held = new();
    private readonly MaaNative framework;
    private nint module, client;
    private readonly DestroyCall destroy;
    private readonly FlagCall connect, disconnect, connected, alive;
    private readonly BindCall bind;
    internal string Identifier { get; }

    internal MaaAgentNative(MaaNative framework, string path, long bytes, string sha256, string identifier, long timeout)
    {
        if (identifier.Length > 128 || identifier.Any(char.IsControl) || timeout is < -1 or 0 or > 120000)
            throw new IOException("maa_agent_settings_invalid");
        this.framework = framework;
        try
        {
            path = MaaNativePath.Capture(path, false);
            if (Path.GetFileName(path) != "MaaAgentClient.dll") throw new IOException("maa_agent_library_unbound");
            held.Directory(Path.GetDirectoryName(path)!); held.File(path, bytes, sha256);
            module = NativeLibrary.Load(path, typeof(MaaAgentNative).Assembly,
                DllImportSearchPath.UseDllDirectoryForDependencies | DllImportSearchPath.System32);
            destroy = Export<DestroyCall>("MaaAgentClientDestroy");
            connect = Export<FlagCall>("MaaAgentClientConnect"); disconnect = Export<FlagCall>("MaaAgentClientDisconnect");
            connected = Export<FlagCall>("MaaAgentClientConnected"); alive = Export<FlagCall>("MaaAgentClientAlive");
            bind = Export<BindCall>("MaaAgentClientBindResource");
            if (identifier.Length == 0) client = Export<CreateTcpCall>("MaaAgentClientCreateTcp")(0);
            else
            {
                var buffer = framework.Resolve<CreateBuffer>("MaaStringBufferCreate")();
                if (buffer == 0) throw new IOException("maa_agent_identifier_failed");
                try
                {
                    if (framework.MaaStringBufferSet(buffer, identifier) == 0) throw new IOException("maa_agent_identifier_failed");
                    client = Export<CreateCall>("MaaAgentClientCreateV2")(buffer);
                }
                finally { framework.Resolve<DestroyCall>("MaaStringBufferDestroy")(buffer); }
            }
            if (client == 0 || Export<TimeoutCall>("MaaAgentClientSetTimeout")(client, timeout) == 0)
                throw new IOException("maa_agent_create_failed");
            Identifier = ReadIdentifier();
            if (Identifier.Length is < 1 or > 128 || Identifier.Any(char.IsControl)) throw new IOException("maa_agent_identifier_failed");
        }
        catch
        {
            if (client != 0 && module != 0)
                Marshal.GetDelegateForFunctionPointer<DestroyCall>(NativeLibrary.GetExport(module, "MaaAgentClientDestroy"))(client);
            client = 0;
            if (module != 0) NativeLibrary.Free(module);
            module = 0; held.Dispose(); throw;
        }
    }

    internal void Bind(nint resource)
    {
        RequireCurrent();
        if (resource == 0 || bind(client, resource) == 0) throw new IOException("maa_agent_resource_failed");
    }
    internal void RegisterSinks(nint resource, nint controller, nint tasker)
    {
        RequireCurrent();
        if (Export<BindCall>("MaaAgentClientRegisterResourceSink")(client, resource) == 0 ||
            Export<BindCall>("MaaAgentClientRegisterControllerSink")(client, controller) == 0 ||
            Export<BindCall>("MaaAgentClientRegisterTaskerSink")(client, tasker) == 0)
            throw new IOException("maa_agent_sinks_failed");
    }
    internal bool Connect() { RequireCurrent(); return connect(client) != 0; }
    internal bool Connected { get { RequireCurrent(); return connected(client) != 0; } }
    internal bool Alive { get { RequireCurrent(); return alive(client) != 0; } }
    internal void BoundStop()
    {
        RequireCurrent();
        if (Export<TimeoutCall>("MaaAgentClientSetTimeout")(client, 1000) == 0) throw new IOException("maa_agent_timeout_failed");
    }
    internal void Disconnect()
    {
        RequireCurrent();
        if (disconnect(client) == 0) throw new IOException("maa_agent_disconnect_failed");
    }
    internal void RequireCurrent()
    {
        ObjectDisposedException.ThrowIf(client == 0 || module == 0, this);
        held.RequireCurrent();
    }
    private string ReadIdentifier()
    {
        var buffer = framework.Resolve<CreateBuffer>("MaaStringBufferCreate")();
        if (buffer == 0) throw new IOException("maa_agent_identifier_failed");
        try
        {
            if (Export<BindCall>("MaaAgentClientIdentifier")(client, buffer) == 0) throw new IOException("maa_agent_identifier_failed");
            var size = framework.Resolve<SizeCall>("MaaStringBufferSize")(buffer);
            if (size is < 1 or > 128) throw new IOException("maa_agent_identifier_failed");
            return Marshal.PtrToStringUTF8(framework.Resolve<GetBuffer>("MaaStringBufferGet")(buffer), checked((int)size))
                ?? throw new IOException("maa_agent_identifier_failed");
        }
        finally { framework.Resolve<DestroyCall>("MaaStringBufferDestroy")(buffer); }
    }
    private T Export<T>(string name) where T : Delegate => Marshal.GetDelegateForFunctionPointer<T>(NativeLibrary.GetExport(module, name));

    public void Dispose()
    {
        if (client != 0) destroy(client);
        client = 0;
        if (module != 0) NativeLibrary.Free(module);
        module = 0; held.Dispose();
    }

    [UnmanagedFunctionPointer(CallingConvention.Cdecl)] private delegate nint CreateTcpCall(ushort port);
    [UnmanagedFunctionPointer(CallingConvention.Cdecl)] private delegate nint CreateCall(nint identifier);
    [UnmanagedFunctionPointer(CallingConvention.Cdecl)] private delegate nint CreateBuffer();
    [UnmanagedFunctionPointer(CallingConvention.Cdecl)] private delegate nint GetBuffer(nint buffer);
    [UnmanagedFunctionPointer(CallingConvention.Cdecl)] private delegate ulong SizeCall(nint buffer);
    [UnmanagedFunctionPointer(CallingConvention.Cdecl)] private delegate void DestroyCall(nint handle);
    [UnmanagedFunctionPointer(CallingConvention.Cdecl)] private delegate byte FlagCall(nint handle);
    [UnmanagedFunctionPointer(CallingConvention.Cdecl)] private delegate byte BindCall(nint client, nint resource);
    [UnmanagedFunctionPointer(CallingConvention.Cdecl)] private delegate byte TimeoutCall(nint client, long milliseconds);
}
