import { createApp } from "vue";
import WallpaperSettings from "./WallpaperSettings.vue";
import { createWallpaperRuntime } from "./wallpaperRuntime";
import "./style.css";

/**
 * 插件前端入口：壁纸运行时随插件前端模块一起建立，与宿主页面路由无关；
 * settings.cards 只提供设置界面，卡片销毁不影响背景、配色与轮换。
 */
export function activate(host: any) {
  const runtime = createWallpaperRuntime(host);
  void runtime.start();
  const registration = host.slots.register("settings.cards", (surface: { element: Element; context: Record<string, unknown> }) => {
    const app = createApp(WallpaperSettings, { host, runtime, context: surface.context });
    app.mount(surface.element);
    return () => app.unmount();
  });
  return {
    dispose() {
      registration?.dispose?.();
      runtime.dispose();
    },
  };
}
