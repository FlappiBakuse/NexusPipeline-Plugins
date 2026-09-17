import { createApp } from "vue";
import GameCheckInPage from "./GameCheckInPage.vue";
import "./style.css";

type PluginHost = {
  api: {
    get(route: string, signal?: AbortSignal): Promise<unknown>;
    post(route: string, body: unknown, signal?: AbortSignal): Promise<unknown>;
    put(route: string, body: unknown, signal?: AbortSignal): Promise<unknown>;
    delete(route: string, body: unknown, signal?: AbortSignal): Promise<unknown>;
  };
  routes: { register(route: string, handler: (token: unknown, segments: string[], host: PluginHost) => void): { dispose?: () => void } };
  nav: { register(item: { id: string; title: string; route: string; icon: string; order: number }): { dispose?: () => void } };
  lifecycle: { onDispose(handler: () => void): { dispose?: () => void } };
  i18n: { t(key: string, args?: Record<string, unknown>, fallback?: string): string };
  ui?: { toast(message: string, tone?: string): void };
};

export function activate(host: PluginHost) {
  let app: ReturnType<typeof createApp> | null = null;
  const route = host.routes.register("tasks", (_token, _segments, routeHost) => {
    app?.unmount();
    const target = document.querySelector("#view");
    if (!target) return;
    app = createApp(GameCheckInPage, { host: routeHost || host });
    app.mount(target);
  });
  const nav = host.nav.register({
    id: "check-in-tasks",
    title: host.i18n.t("nav.title", {}, "签到"),
    route: "tasks",
    icon: "check",
    order: -100,
  });
  const lifecycle = host.lifecycle.onDispose(() => {
    app?.unmount();
    app = null;
  });

  return {
    dispose() {
      app?.unmount();
      app = null;
      lifecycle?.dispose?.();
      route?.dispose?.();
      nav?.dispose?.();
    },
  };
}
