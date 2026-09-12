import { assetBlob, ensurePalette, loadState, type WallpaperAsset, type WallpaperHost, type WallpaperState } from "./wallpaperApi";

/** 运行时快照：当前壁纸状态与最近一次应用失败的原因。 */
export interface WallpaperRuntimeSnapshot {
  state: WallpaperState | null;
  error: string;
}

export interface WallpaperRuntime {
  snapshot(): WallpaperRuntimeSnapshot;
  start(): Promise<void>;
  refresh(): Promise<void>;
  apply(next: WallpaperState | null): Promise<void>;
  subscribe(listener: (snapshot: WallpaperRuntimeSnapshot) => void): () => void;
  dispose(): void;
}

export interface WallpaperRuntimeOptions {
  /** 低频对账间隔，用于同步其他浏览器写入的插件状态。 */
  pollIntervalMs?: number;
}

function currentAsset(state: WallpaperState | null): WallpaperAsset | null {
  if (!state?.effectiveEnabled || !state.currentId) return null;
  return (state.assets || []).find(asset => asset.id === state.currentId) || null;
}

function effectChanged(left: WallpaperState | null, right: WallpaperState | null): boolean {
  return left?.effects?.blurPx !== right?.effects?.blurPx
    || left?.effects?.dimPercent !== right?.effects?.dimPercent
    || left?.effects?.surfaceTransparencyPercent !== right?.effects?.surfaceTransparencyPercent
    || left?.effects?.applyTransparencyToSecondarySurfaces !== right?.effects?.applyTransparencyToSecondarySurfaces;
}

function surfaceChanged(left: WallpaperState | null, right: WallpaperState | null): boolean {
  return left?.revision !== right?.revision
    || left?.currentId !== right?.currentId
    || left?.effectiveEnabled !== right?.effectiveEnabled
    || effectChanged(left, right);
}

/**
 * 插件级壁纸运行时：生命周期跟随插件前端模块，而不是某个页面或设置卡片。
 * 只要插件处于启用状态，它就负责背景、配色、轮换计时与低频对账；
 * 设置卡片只读取快照并提交修改。
 */
export function createWallpaperRuntime(host: WallpaperHost, options: WallpaperRuntimeOptions = {}): WallpaperRuntime {
  const pollIntervalMs = Math.max(1000, Number(options.pollIntervalMs) || 30_000);
  const listeners = new Set<(snapshot: WallpaperRuntimeSnapshot) => void>();
  let state: WallpaperState | null = null;
  let error = "";
  let rotationTimer: ReturnType<typeof setTimeout> | null = null;
  let pollTimer: ReturnType<typeof setInterval> | null = null;
  let inFlight: Promise<void> | null = null;
  let generation = 0;
  let disposed = false;

  function snapshot(): WallpaperRuntimeSnapshot {
    return { state, error };
  }

  function publish(next: WallpaperState | null, nextError = ""): void {
    state = next;
    error = nextError;
    const current = snapshot();
    listeners.forEach(listener => {
      try {
        listener(current);
      } catch {
        // 单个订阅者异常不影响运行时自身的轮换与对账。
      }
    });
  }

  function clearRotation(): void {
    if (rotationTimer) clearTimeout(rotationTimer);
    rotationTimer = null;
  }

  function scheduleRotation(next: WallpaperState | null): void {
    clearRotation();
    const nextSwitchAt = next?.rotation?.nextSwitchAt;
    if (next?.rotation?.mode !== "timer" || !nextSwitchAt) return;
    const delay = Math.max(1000, new Date(nextSwitchAt).getTime() - Date.now());
    rotationTimer = setTimeout(() => {
      rotationTimer = null;
      void refresh();
    }, delay);
  }

  async function applyState(next: WallpaperState | null, changed: boolean): Promise<void> {
    if (disposed) return;
    publish(next);
    if (!changed) return;
    const myGeneration = ++generation;
    clearRotation();
    const asset = currentAsset(next);
    if (!asset) {
      host.appearance.clearBackground();
      host.appearance.clearTokens();
      return;
    }
    try {
      const blob = await assetBlob(host, asset.id);
      if (disposed || myGeneration !== generation) return;
      // 背景地址交给宿主外观表面托管：替换或清除时由宿主释放上一个 Blob URL。
      host.appearance.setBackground({
        url: URL.createObjectURL(blob),
        blurPx: next?.effects?.blurPx,
        dimPercent: next?.effects?.dimPercent,
        surfaceTransparencyPercent: next?.effects?.surfaceTransparencyPercent,
        secondarySurfaceTransparency: next?.effects?.applyTransparencyToSecondarySurfaces !== false,
      });
      const palette = await ensurePalette(host, asset, blob);
      if (disposed || myGeneration !== generation) return;
      if (palette) host.appearance.setTokens(palette);
      scheduleRotation(next);
    } catch (cause) {
      if (disposed || myGeneration !== generation) return;
      publish(next, cause instanceof Error ? cause.message : String(cause));
    }
  }

  async function load(force: boolean): Promise<void> {
    if (disposed) return;
    try {
      const next = await loadState(host);
      if (disposed) return;
      await applyState(next, force || surfaceChanged(state, next));
    } catch (cause) {
      if (disposed) return;
      publish(state, cause instanceof Error ? cause.message : String(cause));
    }
  }

  async function refresh(): Promise<void> {
    if (inFlight) return inFlight;
    inFlight = load(false).finally(() => {
      inFlight = null;
    });
    return inFlight;
  }

  return {
    snapshot,
    async start(): Promise<void> {
      if (disposed) return;
      await load(true);
      if (disposed || pollTimer) return;
      pollTimer = setInterval(() => {
        void refresh();
      }, pollIntervalMs);
    },
    refresh,
    async apply(next: WallpaperState | null): Promise<void> {
      await applyState(next, true);
    },
    subscribe(listener: (snapshot: WallpaperRuntimeSnapshot) => void): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      generation += 1;
      clearRotation();
      if (pollTimer) clearInterval(pollTimer);
      pollTimer = null;
      listeners.clear();
      host.appearance.clearBackground();
      host.appearance.clearTokens();
      state = null;
      error = "";
    },
  };
}
