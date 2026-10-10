import { shallowRef, watch, type ComputedRef } from "vue";
import type { ActivityHost } from "./types";

interface CoverSlide {
  id: string;
  cover: { assetId: string | null } | null;
}

export function createCoverAssets(host: ActivityHost, slides: ComputedRef<CoverSlide[]>) {
  const images = shallowRef<Record<string, string>>({});
  const requests = new Map<string, AbortController>();
  const assetIds = new Map<string, string>();
  let disposed = false;

  function releaseImage(id: string) {
    requests.get(id)?.abort();
    requests.delete(id);
    assetIds.delete(id);
    if (images.value[id]) {
      URL.revokeObjectURL(images.value[id]);
      const next = { ...images.value };
      delete next[id];
      images.value = next;
    }
  }

  function loadImages() {
    const active = new Set(slides.value.map(slide => slide.id));
    for (const id of assetIds.keys()) if (!active.has(id)) releaseImage(id);
    for (const slide of slides.value) {
      if (disposed) return;
      const assetId = slide.cover?.assetId;
      if (!assetId) {
        releaseImage(slide.id);
        continue;
      }
      if (assetIds.get(slide.id) === assetId) continue;
      releaseImage(slide.id);
      assetIds.set(slide.id, assetId);
      void loadImage(slide.id, assetId);
    }
  }

  async function loadImage(id: string, assetId: string) {
    const request = new AbortController();
    requests.set(id, request);
    try {
      const blob = await host.api.blob("assets", { query: { assetId }, signal: request.signal });
      if (!disposed && !request.signal.aborted && assetIds.get(id) === assetId) images.value = { ...images.value, [id]: URL.createObjectURL(blob) };
    } catch {
      if (!request.signal.aborted) assetIds.delete(id);
    } finally {
      if (requests.get(id) === request) requests.delete(id);
    }
  }

  const stopWatch = watch(() => slides.value.map(slide => `${slide.id}:${slide.cover?.assetId ?? ""}`).join("|"), loadImages, { immediate: true });
  function dispose() {
    if (disposed) return;
    disposed = true;
    stopWatch();
    for (const id of assetIds.keys()) releaseImage(id);
  }
  return { images, releaseImage, dispose };
}

export type CoverAssetsModel = ReturnType<typeof createCoverAssets>;
