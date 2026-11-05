using System.Text.Json.Nodes;

namespace NexusPipeline.Extensions.MaaFramework;

internal static class MaaWorkerPolicy
{
    internal static void Require(MaaWorkerProject project, string targetKind)
    {
        var plan = project.Plan;
        if (project.IsInitialization)
        {
            if (targetKind != "" || project.InitializationOccurrences.Count == 0)
                throw new MaaInputFailure("maa_initialization_selection_unbound");
            return;
        }
        var controller = plan.Controller;
        if (targetKind == "android" && MaaJson.Required(controller, "type") == "Adb")
        {
            if (controller["adb"] is not null && controller["adb"] is not JsonObject { Count: 0 })
                throw new MaaInputFailure("maa_controller_methods_unavailable");
        }
        else if (targetKind != "pc" || MaaJson.Required(controller, "type") != "Win32" || controller["win32"] is not JsonObject win32 ||
            MaaJson.Required(win32, "screencap") is not ("PrintWindow" or "GDI" or "ScreenDC" or "FramePool") ||
            MaaJson.Required(win32, "mouse") is not ("SendMessage" or "PostMessage" or "SendMessageWithCursorPos" or "Seize") ||
            MaaJson.Required(win32, "keyboard") is not ("SendMessage" or "PostMessage" or "SendMessageWithCursorPos" or "Seize")) throw new MaaInputFailure("maa_controller_methods_unavailable");
        if (project.Tasks.Any(task => task.Kind is not ("native" or "mfa-wait"))) throw new MaaInputFailure("maa_task_kind_unavailable");
    }
}
