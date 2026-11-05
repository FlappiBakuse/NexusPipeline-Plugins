using System.Runtime.InteropServices;
using System.Text;
using System.Text.Json.Nodes;

namespace NexusPipeline.Extensions.MaaFramework;

internal sealed class MaaNativeQueries(MaaNative native)
{
    internal void CheckResource(nint resource, bool outputScope)
    {
        var create = native.Resolve<Create>("MaaStringListBufferCreate"); var destroy = native.Resolve<Destroy>("MaaStringListBufferDestroy");
        var list = create(); if (list == 0) throw new IOException("maa_node_list_create_failed");
        try
        {
            if (native.Resolve<ListNodes>("MaaResourceGetNodeList")(resource, list) == 0) throw new IOException("maa_node_list_failed");
            var count = native.Resolve<Size>("MaaStringListBufferSize")(list);
            if (count > 65536) throw new IOException("maa_node_count_budget");
            long total = 0;
            for (ulong index = 0; index < count; index++)
            {
                var name = Read(native.Resolve<At>("MaaStringListBufferAt")(list, index));
                var data = ReadNode(resource, name); total += Encoding.UTF8.GetByteCount(data);
                if (total > 64 * 1024 * 1024) throw new IOException("maa_node_data_budget");
                var node = MaaJson.Read(Encoding.UTF8.GetBytes(data));
                MaaPipelineGuard.Check(node, outputScope);
                if (node["action"]?["type"]?.GetValue<string>() == "Screencap") MaaScreencapPolicy.Name(name);
            }
            if (outputScope)
            {
                using var buffer = new Buffer(native);
                if (native.Resolve<GetNode>("MaaResourceGetDefaultActionParam")(resource, "Screencap", buffer.Handle) == 0)
                    throw new IOException("maa_screencap_defaults_failed");
                MaaScreencapPolicy.Parameters(MaaJson.Read(Encoding.UTF8.GetBytes(Read(buffer.Handle))));
            }
        }
        finally { destroy(list); }
    }
    private string ReadNode(nint resource, string name)
    {
        using var buffer = new Buffer(native);
        if (native.Resolve<GetNode>("MaaResourceGetNodeData")(resource, name, buffer.Handle) == 0) throw new IOException("maa_node_data_failed");
        return Read(buffer.Handle);
    }
    internal MaaNativeAction ReadAction(nint tasker, string node)
    {
        if (native.Resolve<Latest>("MaaTaskerGetLatestNode")(tasker, node, out var id) == 0) throw new IOException("maa_node_history_missing");
        using var name = new Buffer(native); using var action = new Buffer(native); using var detail = new Buffer(native);
        if (native.Resolve<NodeDetail>("MaaTaskerGetNodeDetail")(tasker, id, name.Handle, out _, out var actionId, out _) == 0)
            throw new IOException("maa_node_history_failed");
        if (native.Resolve<ActionDetail>("MaaTaskerGetActionDetail")(tasker, actionId, name.Handle, action.Handle, out _, out var success, detail.Handle) == 0)
            throw new IOException("maa_action_history_failed");
        return new(Read(name.Handle), Read(action.Handle), success != 0, Read(detail.Handle));
    }
    private string Read(nint buffer)
    {
        var size = native.Resolve<Size>("MaaStringBufferSize")(buffer);
        if (size > 262144) throw new IOException("maa_node_string_budget");
        var pointer = native.Resolve<Get>("MaaStringBufferGet")(buffer);
        if (pointer == 0 && size != 0) throw new IOException("maa_node_string_missing");
        var bytes = new byte[(int)size]; if (size != 0) Marshal.Copy(pointer, bytes, 0, bytes.Length);
        return new UTF8Encoding(false, true).GetString(bytes);
    }
    private sealed class Buffer : IDisposable
    {
        private readonly Destroy destroy;
        internal nint Handle { get; }
        internal Buffer(MaaNative native)
        {
            destroy = native.Resolve<Destroy>("MaaStringBufferDestroy"); Handle = native.Resolve<Create>("MaaStringBufferCreate")();
            if (Handle == 0) throw new IOException("maa_string_buffer_create_failed");
        }
        public void Dispose() => destroy(Handle);
    }
    [StructLayout(LayoutKind.Sequential)] private struct Rect { public int X, Y, Width, Height; }
    [UnmanagedFunctionPointer(CallingConvention.Cdecl)] private delegate nint Create();
    [UnmanagedFunctionPointer(CallingConvention.Cdecl)] private delegate void Destroy(nint handle);
    [UnmanagedFunctionPointer(CallingConvention.Cdecl)] private delegate ulong Size(nint handle);
    [UnmanagedFunctionPointer(CallingConvention.Cdecl)] private delegate nint Get(nint handle);
    [UnmanagedFunctionPointer(CallingConvention.Cdecl)] private delegate nint At(nint handle, ulong index);
    [UnmanagedFunctionPointer(CallingConvention.Cdecl)] private delegate byte ListNodes(nint resource, nint list);
    [UnmanagedFunctionPointer(CallingConvention.Cdecl)] private delegate byte GetNode(nint resource, [MarshalAs(UnmanagedType.LPUTF8Str)] string node, nint buffer);
    [UnmanagedFunctionPointer(CallingConvention.Cdecl)] private delegate byte Latest(nint tasker, [MarshalAs(UnmanagedType.LPUTF8Str)] string node, out long id);
    [UnmanagedFunctionPointer(CallingConvention.Cdecl)] private delegate byte NodeDetail(nint tasker, long id, nint node, out long reco, out long action, out byte completed);
    [UnmanagedFunctionPointer(CallingConvention.Cdecl)] private delegate byte ActionDetail(nint tasker, long id, nint node, nint action, out Rect box, out byte success, nint detail);
}
