import { shallowRef, watch, type ComputedRef } from "vue";
import type { ActivityHost } from "./types";
interface CoverSlide { id: string; entityId?: string | null; cover: { assetId: string | null } | null }
interface Entry { assetId: string; state: "loading" | "ready" | "failed"; references: Set<string>; attempts: number; retryAt: number; url?: string; request?: AbortController }
interface Binding { entityId: string | null; desired: string | null; displayed: string | null; generation: number }
export function createCoverAssets(host: ActivityHost, slides: ComputedRef<CoverSlide[]>) {
  const images = shallowRef<Record<string, string>>({});
  const entries = new Map<string, Entry>(), bindings = new Map<string, Binding>();
  let disposed = false, running = 0, timer: ReturnType<typeof setTimeout> | undefined;
  function collect() {
    for (const entry of entries.values()) entry.references.clear();
    for (const [id, binding] of bindings) for (const asset of [binding.desired, binding.displayed]) if (asset) entries.get(asset)?.references.add(id);
    for (const [id, entry] of entries) if (!entry.references.size) { entry.request?.abort(); if (entry.url) URL.revokeObjectURL(entry.url); entries.delete(id); }
    images.value = Object.fromEntries([...bindings].flatMap(([id, binding]) => { const url = binding.displayed ? entries.get(binding.displayed)?.url : null; return url ? [[id, url]] : []; }));
  }
  function bindMany(prefix: string, desired: CoverSlide[]) {
    const active = new Set(desired.map(s => prefix + s.id));
    for (const id of bindings.keys()) if (id.startsWith(prefix) && !active.has(id)) bindings.delete(id);
    for (const slide of desired) {
      const id = prefix + slide.id, entityId = slide.entityId ?? slide.id, asset = slide.cover?.assetId ?? null, previous = bindings.get(id);
      const binding = previous?.entityId === entityId ? previous : { entityId, desired: null, displayed: null, generation: 0 };
      if (binding.desired !== asset) binding.generation++;
      binding.desired = asset; if (!slide.cover) binding.displayed = null; bindings.set(id, binding);
      if (asset && !entries.has(asset)) entries.set(asset, { assetId: asset, state: "failed", references: new Set(), attempts: 0, retryAt: 0 });
      if (asset && entries.get(asset)?.state === "ready") binding.displayed = asset;
    }
    collect(); pump();
  }
  function releaseImage(id: string) { bindings.delete(id); collect(); pump(); }
  function releaseGroup(prefix: string) { for (const id of bindings.keys()) if (id.startsWith(prefix)) bindings.delete(id); collect(); pump(); }
  function retryFailed() { for (const entry of entries.values()) if (entry.state === "failed") { entry.retryAt = 0; entry.attempts = 0; } pump(); }
  function pump() {
    clearTimeout(timer); if (disposed) return;
    for (const entry of entries.values()) {
      if (running >= 4) break;
      if (entry.references.size && entry.state === "failed" && entry.attempts < 4 && entry.retryAt <= Date.now()) void load(entry);
    }
    const due = [...entries.values()].filter(e => e.references.size && e.state === "failed" && e.attempts < 4).map(e => e.retryAt);
    if (due.length && running < 4) timer = setTimeout(pump, Math.max(50, Math.min(...due) - Date.now()));
  }
  async function decode(url: string) { const image = new Image(); image.src = url; await image.decode(); }
  async function load(entry: Entry) {
    entry.state = "loading"; entry.attempts++; running++; const request = new AbortController(); entry.request = request;
    let url: string | undefined;
    try {
      const blob = await host.api.blob("assets", { query: { assetId: entry.assetId }, signal: request.signal });
      url = URL.createObjectURL(blob); await decode(url);
      if (disposed || request.signal.aborted || entries.get(entry.assetId) !== entry) return;
      entry.url = url; url = undefined; entry.state = "ready";
      for (const binding of bindings.values()) if (binding.desired === entry.assetId) binding.displayed = entry.assetId;
    } catch (reason) {
      if (!request.signal.aborted) { entry.state = "failed"; entry.retryAt = Date.now() + [5000, 30000, 120000, 600000][Math.min(entry.attempts - 1, 3)];
        if (/401|403/.test(String(reason))) entry.attempts = 4; }
    } finally { if (url) URL.revokeObjectURL(url); running--; entry.request = undefined; collect(); pump(); }
  }
  const stop = watch(() => slides.value.map(s => `${s.id}:${s.entityId ?? ""}:${s.cover?.assetId ?? ""}`).join("|"), () => bindMany("overview/", slides.value), { immediate: true });
  function dispose() { if (disposed) return; disposed = true; stop(); clearTimeout(timer); for (const entry of entries.values()) { entry.request?.abort(); if (entry.url) URL.revokeObjectURL(entry.url); } entries.clear(); bindings.clear(); images.value = {}; }
  return { images, bindMany, releaseImage, releaseGroup, retryFailed, dispose };
}
export type CoverAssetsModel = ReturnType<typeof createCoverAssets>;
