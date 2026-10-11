import { computed, ref, shallowRef } from "vue";
import { feedKey, type ActivityHost, type ActivityState, type Feed, type RefreshOperation, type Settings } from "./types";

export function createActivityState(host: ActivityHost) {
  const current = shallowRef<ActivityState | null>(null), feeds = shallowRef<Record<string, Feed>>({});
  const index = ref(0), error = ref(""), busy = ref(false), submitting = ref(false), now = ref(Date.now());
  const result = shallowRef<RefreshOperation | null>(null);
  const manualRefreshing = computed(() => submitting.value || ["queued", "running"].includes(result.value?.status ?? ""));
  const zone = ref(Intl.DateTimeFormat().resolvedOptions().timeZone);
  const refreshing = computed(() => submitting.value || Boolean(current.value?.refreshing) || ["queued", "running"].includes(result.value?.status ?? ""));
  const lifetime = new AbortController();
  let disposed = false, generation = 0, pending = false;
  let inFlight: Promise<void> | null = null, operationId: string | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let serverTime = Date.now(), origin = performance.now();
  const feedRequests = new Map<string, AbortController>();
  function report(reason: unknown) { if (!disposed) error.value = reason instanceof Error ? reason.message : String(reason); }
  function schedule() {
    clearTimeout(timer);
    if (!disposed && !document.hidden) timer = setTimeout(() => void load(), refreshing.value ? 2000 : 60000);
  }
  async function observe() {
    const token = generation;
    if (operationId) {
      try {
        const value = await host.api.get<RefreshOperation>("refresh-status", lifetime.signal, { operationId });
        if (!disposed) { result.value = value; if (!["queued", "running"].includes(value.status)) operationId = null; }
      } catch (reason) { operationId = null; report(reason); }
    }
    const state = await host.api.get<ActivityState>("state", lifetime.signal);
    if (disposed || token !== generation) return;
    if (state.formatVersion !== 3) throw new Error("activity_state_version_invalid");
    const previous = current.value?.selectedFeeds[index.value];
    serverTime = Date.parse(state.serverNowUtc); origin = performance.now(); now.value = serverTime; current.value = state;
    const oldIndex = previous ? state.selectedFeeds.findIndex(s => feedKey(s.gameId, s.progressionId) === feedKey(previous.gameId, previous.progressionId)) : -1;
    index.value = oldIndex >= 0 ? oldIndex : Math.min(index.value, Math.max(0, state.selectedFeeds.length - 1));
    const active = new Set(state.selectedFeeds.map(s => feedKey(s.gameId, s.progressionId)));
    for (const [key, request] of feedRequests) if (!active.has(key)) { request.abort(); feedRequests.delete(key); }
    feeds.value = Object.fromEntries(Object.entries(feeds.value).filter(([key]) => active.has(key)));
    await Promise.all(state.selectedFeeds.map(async summary => {
      const key = feedKey(summary.gameId, summary.progressionId), cached = feeds.value[key];
      if (!summary.snapshotId) return;
      if (cached?.snapshotId === summary.snapshotId) { feeds.value = { ...feeds.value, [key]: { ...cached, health: summary.health } }; return; }
      const request = new AbortController(); feedRequests.get(key)?.abort(); feedRequests.set(key, request);
      const abort = () => request.abort(); lifetime.signal.addEventListener("abort", abort, { once: true });
      try {
        const value = await host.api.get<Feed | null>("feed", request.signal, { gameId: summary.gameId, progressionId: summary.progressionId, contentLocale: summary.contentLocale });
        if (!disposed && token === generation && !request.signal.aborted && active.has(key) && value?.formatVersion === 3
          && value.gameId === summary.gameId && value.progressionId === summary.progressionId && value.contentLocale === summary.contentLocale)
          feeds.value = { ...feeds.value, [key]: { ...value, health: summary.health } };
      } catch (reason) { if (!request.signal.aborted) report(reason); }
      finally { lifetime.signal.removeEventListener("abort", abort); if (feedRequests.get(key) === request) feedRequests.delete(key); }
    }));
  }
  function load(): Promise<void> {
    if (disposed || document.hidden) return Promise.resolve();
    pending = true;
    if (inFlight) return inFlight;
    clearTimeout(timer);
    inFlight = (async () => {
      do { pending = false; try { await observe(); } catch (reason) { report(reason); } } while (pending && !disposed && !document.hidden);
    })().finally(() => { inFlight = null; schedule(); });
    return inFlight;
  }
  async function saveSettings(settings: Settings): Promise<boolean> {
    if (!current.value || busy.value) return false;
    busy.value = true;
    try {
      await host.api.put("settings", { expectedRevision: current.value.settingsRevision, settings: { ...settings, onboardingCompleted: true } }, lifetime.signal);
      generation++; for (const request of feedRequests.values()) request.abort(); await load(); return true;
    } catch (reason) { report(reason); return false; }
    finally { busy.value = false; }
  }
  async function refresh() {
    if (manualRefreshing.value || disposed) return;
    submitting.value = true;
    try {
      const value = await host.api.post<RefreshOperation>("refresh", { selected: true }, lifetime.signal);
      operationId = value.operationId; result.value = { ...value, status: "queued" }; await load();
    } catch (reason) { report(reason); }
    finally { submitting.value = false; schedule(); }
  }
  function visible() {
    clearTimeout(timer);
    if (!document.hidden) { zone.value = Intl.DateTimeFormat().resolvedOptions().timeZone; void load(); }
  }
  document.addEventListener("visibilitychange", visible);
  const ticker = setInterval(() => { if (!document.hidden) now.value = serverTime + performance.now() - origin; }, 1000);
  void load();
  function dispose() {
    if (disposed) return; disposed = true; generation++; lifetime.abort(); clearTimeout(timer); clearInterval(ticker);
    for (const request of feedRequests.values()) request.abort(); feedRequests.clear(); document.removeEventListener("visibilitychange", visible);
  }
  return { current, feeds, index, error, busy, refreshing, manualRefreshing, now, result, zone, saveSettings, refresh, load, dispose };
}
export type ActivityStateModel = ReturnType<typeof createActivityState>;
