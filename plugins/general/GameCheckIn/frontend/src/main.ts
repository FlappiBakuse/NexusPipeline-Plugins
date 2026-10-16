import { createApp } from "vue";
import GameCheckInPage from "./GameCheckInPage.vue";
import "./style.css";
import type { TaskState } from './types';

type PluginHost = {
  api: {
    get(route: string, signal?: AbortSignal): Promise<unknown>;
    post(route: string, body: unknown, signal?: AbortSignal): Promise<unknown>;
    put(route: string, body: unknown, signal?: AbortSignal): Promise<unknown>;
    delete(route: string, body: unknown, signal?: AbortSignal): Promise<unknown>;
  };
  routes: { register(route: string, handler: (surface: { element: HTMLElement; token: number; segments: readonly string[]; signal: AbortSignal }, host: PluginHost) => Promise<() => void>): { dispose?: () => void } };
  nav: { register(item: { id: string; title: string; titleKey?: string; route: string; icon: string; order: number }): { dispose?: () => void } };
  i18n: { t(key: string, args?: Record<string, unknown>, fallback?: string): string };
  ui?: { toast(message: string, tone?: string): void };
};

export function activate(host: PluginHost) {
  const pages = new Set<() => void>();
  const disposePages = () => { for (const dispose of [...pages]) dispose(); };
  const route = host.routes.register("tasks", async (surface, routeHost) => {
    const pageHost = routeHost || host;
    const initialState = await pageHost.api.get('state', surface.signal) as Partial<TaskState>;
    if (surface.signal.aborted) throw new DOMException('', 'AbortError');
    const target = surface.element;
    const app = createApp(GameCheckInPage, { host: pageHost, initialState: initialState || {}, deferPolling: true, signal: surface.signal });
    const mounted = app.mount(target) as unknown as { startPolling: () => void };
    let cleaned = false;
    let observer: MutationObserver | undefined;
    const start = () => { if (target.isConnected && !cleaned) { observer?.disconnect(); mounted.startPolling(); } };
    if (target.isConnected) start();
    else { observer = new MutationObserver(start); observer.observe(document.documentElement, { childList: true, subtree: true }); }
    const dispose = () => {
      if (cleaned) return;
      cleaned = true; observer?.disconnect(); surface.signal.removeEventListener('abort', dispose);
      app.unmount(); pages.delete(dispose);
    };
    pages.add(dispose);
    surface.signal.addEventListener('abort', dispose, { once: true });
    if (surface.signal.aborted) dispose();
    return dispose;
  });
  const nav = host.nav.register({
    id: "check-in-tasks",
    title: host.i18n.t("nav.title", {}, "签到"),
    titleKey: "nav.title",
    route: "tasks",
    icon: "check",
    order: -100,
  });
  return {
    dispose() {
      disposePages();
      route?.dispose?.();
      nav?.dispose?.();
    },
  };
}
