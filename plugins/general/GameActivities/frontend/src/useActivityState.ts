import { ref, shallowRef } from "vue";
import { feedKey, type ActivityHost, type ActivityState, type Feed, type RefreshOperation, type Settings } from "./types";

export function createActivityState(host: ActivityHost) {
  const current = shallowRef<ActivityState | null>(null);
  const feeds = shallowRef<Record<string, Feed>>({});
  const index = ref(0);
  const error = ref("");
  const busy = ref(false);
  const refreshing = ref(false);
  const now = ref(Date.now());
  const controller = new AbortController();
  let disposed = false;
  let loading = false;
  let reloadPending = false;
  let generation = 0;
  let serverTime = Date.now();
  let timeOrigin = performance.now();
  let ticker: ReturnType<typeof setInterval> | undefined;
  let poll: ReturnType<typeof setInterval> | undefined;
  let operationPoll: ReturnType<typeof setTimeout> | undefined;
  let nextPollAt = 0;

  function reportError(reason: unknown) {
    if (!controller.signal.aborted) error.value = reason instanceof Error ? reason.message : String(reason);
  }

  async function load() {
    if (disposed || document.hidden) return;
    if (loading) {
      reloadPending = true;
      return;
    }
    loading = true;
    const token = ++generation;
    try {
      const state = await host.api.get<ActivityState>("state", controller.signal);
      if (disposed || token !== generation) return;
      const previous = current.value?.selectedFeeds[index.value];
      serverTime = Date.parse(state.serverNowUtc);
      timeOrigin = performance.now();
      now.value = serverTime;
      current.value = state;
      const oldIndex = previous ? state.selectedFeeds.findIndex(item => feedKey(item.gameId, item.progressionId) === feedKey(previous.gameId, previous.progressionId)) : -1;
      index.value = oldIndex >= 0 ? oldIndex : Math.min(index.value, Math.max(0, state.selectedFeeds.length - 1));

      const active = new Set(state.selectedFeeds.map(summary => feedKey(summary.gameId, summary.progressionId)));
      feeds.value = Object.fromEntries(Object.entries(feeds.value).filter(([id]) => active.has(id)));
      error.value = "";
      await Promise.all(state.selectedFeeds.map(async summary => {
        const id = feedKey(summary.gameId, summary.progressionId);
        if (!summary.snapshotId) return;
        const cached = feeds.value[id];
        if (cached?.snapshotId === summary.snapshotId) {
          feeds.value = { ...feeds.value, [id]: { ...cached, health: { ...cached.health, cacheState: summary.cacheState } } };
          return;
        }
        try {
          const value = await host.api.get<Feed | null>("feed", controller.signal, {
            gameId: summary.gameId,
            progressionId: summary.progressionId,
            contentLocale: summary.contentLocale,
          });
          if (disposed || token !== generation) return;
          if (value?.gameId === summary.gameId && value.progressionId === summary.progressionId) feeds.value = { ...feeds.value, [id]: value };
        } catch (reason) { reportError(reason); }
      }));
      nextPollAt = performance.now() + 60000;
    } catch (reason) {
      reportError(reason);
    } finally {
      loading = false;
      if (reloadPending && !disposed) {
        reloadPending = false;
        void load();
      }
    }
  }

  async function saveSettings(settings: Settings): Promise<boolean> {
    if (!current.value || busy.value) return false;
    busy.value = true;
    try {
      await host.api.put("settings", {
        expectedRevision: current.value.settingsRevision,
        settings: { ...settings, onboardingCompleted: true },
      }, controller.signal);
      generation++;
      await load();
      return true;
    } catch (reason) {
      reportError(reason);
      return false;
    } finally {
      busy.value = false;
    }
  }

  async function pollOperation(operationId: string) {
    try {
      const result = await host.api.get<RefreshOperation>("refresh-status", controller.signal, { operationId });
      if (disposed) return;
      if (["queued", "running"].includes(result.status)) {
        await load();
        operationPoll = setTimeout(() => void pollOperation(operationId), 2000);
      } else {
        operationPoll = undefined;
        refreshing.value = false;
        await load();
      }
    } catch (reason) {
      operationPoll = undefined;
      refreshing.value = false;
      reportError(reason);
    }
  }

  async function refresh() {
    if (refreshing.value || disposed) return;
    refreshing.value = true;
    try {
      const operation = await host.api.post<RefreshOperation>("refresh", { selected: true }, controller.signal);
      if (!disposed) operationPoll = setTimeout(() => void pollOperation(operation.operationId), 2000);
    } catch (reason) {
      refreshing.value = false;
      reportError(reason);
    }
  }

  function visibilityChanged() {
    if (!document.hidden) void load();
  }

  document.addEventListener("visibilitychange", visibilityChanged);
  void load();
  ticker = setInterval(() => {
    if (!document.hidden) now.value = serverTime + performance.now() - timeOrigin;
  }, 1000);
  poll = setInterval(() => {
    const pending = current.value?.refreshing || current.value?.selectedFeeds.some(summary => {
      const feed = feeds.value[feedKey(summary.gameId, summary.progressionId)];
      return !feed || feed.overview?.cover?.assetId === null;
    });
    if (pending || performance.now() >= nextPollAt) void load();
  }, 2000);

  function dispose() {
    if (disposed) return;
    disposed = true;
    generation++;
    controller.abort();
    clearInterval(ticker);
    clearInterval(poll);
    clearTimeout(operationPoll);
    document.removeEventListener("visibilitychange", visibilityChanged);
  }

  return { current, feeds, index, error, busy, refreshing, now, saveSettings, refresh, dispose };
}

export type ActivityStateModel = ReturnType<typeof createActivityState>;
