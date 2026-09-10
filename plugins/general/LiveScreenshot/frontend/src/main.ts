import { createApp } from "vue";
import LiveScreenshot from "./LiveScreenshot.vue";
import "./style.css";

export function activate(host: any) {
  return host.slots.register("dispatch.running.sidecar", (surface: { element: Element; context: Record<string, unknown> }) => {
    const app = createApp(LiveScreenshot, { host, context: surface.context });
    app.mount(surface.element);
    return () => app.unmount();
  });
}
