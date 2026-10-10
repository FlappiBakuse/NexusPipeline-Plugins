import { computed, createApp } from "vue";
import ActivityCarousel from "./ActivityCarousel.vue";
import type { ActivityHost } from "./types";
import { feedKey } from "./types";
import { createActivityState } from "./useActivityState";
import { createCoverAssets } from "./useCoverAssets";
import "./style.css";

interface DashboardHost extends ActivityHost {
  dashboard: {
    registerCard(id: string, render: (surface: { element: HTMLElement; signal: AbortSignal }) => () => void): { dispose(): void };
  };
}

export function activate(host: DashboardHost) {
  const state = createActivityState(host);
  const slides = computed(() => (state.current.value?.selectedFeeds ?? []).map(summary => {
    const id = feedKey(summary.gameId, summary.progressionId);
    return { id, cover: state.feeds.value[id]?.overview?.cover ?? null };
  }));
  const covers = createCoverAssets(host, slides);
  const registration = host.dashboard.registerCard("carousel", (surface: { element: HTMLElement; signal: AbortSignal }) => {
    const app = createApp(ActivityCarousel, { host, state, covers });
    let disposed = false;
    const cleanup = () => {
      if (disposed) return;
      disposed = true;
      surface.signal.removeEventListener("abort", cleanup);
      app.unmount();
    };
    if (surface.signal.aborted) return cleanup;
    app.mount(surface.element);
    surface.signal.addEventListener("abort", cleanup, { once: true });
    return cleanup;
  });
  return { dispose() { registration.dispose(); covers.dispose(); state.dispose(); } };
}
