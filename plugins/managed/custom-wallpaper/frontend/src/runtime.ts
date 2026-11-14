import { SettingsWrites } from '../../../frontend-ui/src/settings-writes.js';
import type { WallpaperPorts, WallpaperState } from './ports.js';
import { boundedImage } from '../../../frontend-ui/src/image-bound.js';

export interface AppearanceFrame {
  readonly blob: Blob;
  readonly effects: WallpaperState['effects'];
  readonly palette?: Readonly<Record<string, string>>;
}

export function createRuntime(ports: WallpaperPorts, signal: AbortSignal) {
  let state: WallpaperState | undefined;
  let error = '';
  let serial = 0;
  let currentBlob: Blob | undefined;
  let assetKey = '';
  let assetOwner: AbortController | undefined;
  let assetWork: Promise<Blob> | undefined;
  let appearanceVisible = false;
  let settingsVisible = false;
  let appearance: AppearanceFrame | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let overdueSlot = '';
  let overdueReads = 0;
  let inFlight: Promise<void> | undefined;
  let unsubscribe: (() => void) | undefined;
  const listeners = new Set<(state: WallpaperState) => void>();
  const appearanceListeners = new Set<(frame: AppearanceFrame | undefined) => void>();
  const showAppearance = (frame: AppearanceFrame | undefined) => {
    if (
      frame?.blob === appearance?.blob &&
      JSON.stringify([frame?.effects, frame?.palette]) ===
        JSON.stringify([appearance?.effects, appearance?.palette])
    )
      return;
    appearance = frame;
    appearanceListeners.forEach((listener) => listener(frame));
  };
  const releaseAsset = () => {
    assetOwner?.abort();
    assetOwner = undefined;
    assetWork = undefined;
    assetKey = '';
    currentBlob = undefined;
  };
  const scheduleRotation = (next: WallpaperState) => {
    if (timer) clearTimeout(timer);
    timer = undefined;
    if (
      (!appearanceVisible && !settingsVisible) ||
      next.rotation.mode !== 'timer' ||
      !next.rotation.nextSwitchAt ||
      !next.effectiveEnabled ||
      !next.assets.some((asset) => asset.id === next.currentId)
    ) {
      overdueSlot = '';
      overdueReads = 0;
      return;
    }
    const due = Date.parse(next.rotation.nextSwitchAt);
    if (!Number.isFinite(due)) return;
    if (overdueSlot !== next.rotation.nextSwitchAt) {
      overdueSlot = next.rotation.nextSwitchAt;
      overdueReads = 0;
    }
    if (due <= Date.now() && overdueReads++ >= 8) return;
    timer = setTimeout(
      () => {
        void refresh().catch(() => {});
      },
      Math.min(Math.max(1000, due - Date.now()), 2_147_483_647)
    );
  };
  const publish = async (next: WallpaperState) => {
    if (signal.aborted || (state && next.revision < state.revision)) return;
    const notify = !state || next.revision !== state.revision || next.currentId !== state.currentId ||
      next.rotation.nextSwitchAt !== state.rotation.nextSwitchAt || !!error;
    error = '';
    state = next;
    if (notify) listeners.forEach((listener) => listener(next));
    scheduleRotation(next);
    const own = ++serial;
    const asset = next.assets.find((item) => item.id === next.currentId);
    if (!next.effectiveEnabled || !asset) {
      releaseAsset();
      showAppearance(undefined);
      return;
    }
    try {
      const key = JSON.stringify([asset.id, asset.sizeBytes]);
      if (key !== assetKey) {
        releaseAsset();
        assetKey = key;
        assetOwner = new AbortController();
        const owner = AbortSignal.any([signal, assetOwner.signal]);
        assetWork = ports
          .readAsset(asset.id, owner)
          .then((blob) => {
            owner.throwIfAborted();
            return boundedImage(blob);
          })
          .then((blob) => {
            owner.throwIfAborted();
            return blob;
          });
      }
      const blob = currentBlob ?? (await assetWork!);
      if (!signal.aborted && own === serial) {
        currentBlob = blob;
        showAppearance({ blob, effects: next.effects, palette: asset.palette });
      }
    } catch (reason) {
      if (!signal.aborted && own === serial) {
        releaseAsset();
        showAppearance(undefined);
        error = reason instanceof Error ? reason.message : String(reason);
        listeners.forEach((listener) => listener(next));
      }
    }
  };
  const refresh = (readState = () => ports.readState(signal)) => {
    if (inFlight) return inFlight;
    const pending = (async () => {
      try {
        await publish(await readState());
      } catch (reason) {
        if (!signal.aborted) {
          error = reason instanceof Error ? reason.message : String(reason);
          if (state) {
            scheduleRotation(state);
            listeners.forEach((listener) => listener(state!));
          }
        }
        throw reason;
      }
    })().finally(() => {
      if (inFlight === pending) inFlight = undefined;
    });
    inFlight = pending;
    return pending;
  };
  const observeVisibility = () => {
    if (signal.aborted) return;
    if (appearanceVisible || settingsVisible) {
      if (unsubscribe) return;
      unsubscribe = ports.subscribe((next) => { void publish(next); });
      void refresh().catch(() => {});
    } else {
      if (timer) clearTimeout(timer);
      timer = undefined;
      unsubscribe?.();
      unsubscribe = undefined;
    }
  };
  signal.addEventListener(
    'abort',
    () => {
      serial++;
      if (timer) clearTimeout(timer);
      unsubscribe?.();
      listeners.clear();
      releaseAsset();
      showAppearance(undefined);
    },
    { once: true }
  );
  let settings: SettingsWrites<WallpaperState> | undefined;
  const settingCommands = () => {
    if (!state) throw Error('wallpaper_state_unavailable');
    settings ??= new SettingsWrites(state, { signal, read: async () => {
      const saved = await ports.readState(signal); await publish(saved); return saved;
    },
      write: async (value, before, id) => {
        const saved = await ports.saveSettings({ enabled: value.enabled, selectedId: value.selectedId, order: [...value.order],
          rotation: value.rotation, effects: value.effects }, before.revision, signal, id);
        await publish(saved); return saved;
      },
      inspect: id => ports.readSettingsResult?.(id, signal) ?? Promise.resolve(false) });
    settings.observe(state);
    return settings;
  };
  return {
    settingCommands,
    get state() {
      return state;
    },
    get error() {
      return error;
    },
    publish,
    refresh,
    preview(effects: WallpaperState['effects']) {
      const asset = state?.assets.find((item) => item.id === state?.currentId);
      if (currentBlob && state?.effectiveEnabled)
        showAppearance({ blob: currentBlob, effects, palette: asset?.palette });
    },
    setAppearanceVisible(visible: boolean) {
      if (appearanceVisible === visible) return;
      appearanceVisible = visible;
      observeVisibility();
      if (visible) void refresh().catch(() => {});
    },
    setSettingsVisible(visible: boolean) {
      settingsVisible = visible;
      observeVisibility();
    },
    listen(listener: (next: WallpaperState) => void) {
      listeners.add(listener);
      if (state) listener(state);
      return () => listeners.delete(listener);
    },
    listenAppearance(listener: (frame: AppearanceFrame | undefined) => void) {
      appearanceListeners.add(listener);
      listener(appearance);
      return () => appearanceListeners.delete(listener);
    }
  };
}
