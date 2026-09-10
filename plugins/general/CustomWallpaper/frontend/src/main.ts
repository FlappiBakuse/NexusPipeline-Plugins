import { createApp } from "vue";
import WallpaperSettings from "./WallpaperSettings.vue";
import "./style.css";

export function activate(host: any) {
  return host.slots.register("settings.cards", (surface: { element: Element; context: Record<string, unknown> }) => {
    const app = createApp(WallpaperSettings, { host, context: surface.context });
    app.mount(surface.element);
    return () => app.unmount();
  });
}
