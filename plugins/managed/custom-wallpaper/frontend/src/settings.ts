import type { ExtensionSurface } from '@nexuspipeline/extension-sdk';
import { createPanel } from '../../../frontend-ui/src/elements.js';
import type { Translate } from '../../../frontend-ui/src/localize.js';
import type { WallpaperPatch, WallpaperPorts, WallpaperState } from './ports.js';
import type { createRuntime } from './runtime.js';
import { wallpaperControls } from './settings-controls.js';
import { WallpaperAssets } from './wallpaper-assets.js';

type Runtime = ReturnType<typeof createRuntime>;

export function mountSettings(
  surface: ExtensionSurface,
  ports: WallpaperPorts | undefined,
  runtime: Runtime | undefined,
  t: Translate
) {
  const panel = createPanel(surface, '自定义壁纸', t);
  panel.card.classList.add('wallpaper-panel');
  panel.card.querySelector('h3')?.remove();
  panel.body.replaceChildren();
  let state: WallpaperState | undefined,
    draft: WallpaperPatch = {},
    pending: WallpaperPatch | undefined;
  let busy = false,
    visible = surface.visible;
  const current = () =>
    state
      ? {
          ...state,
          ...draft,
          effects: { ...state.effects, ...draft.effects },
          rotation: { ...state.rotation, ...draft.rotation }
        }
      : undefined;
  const merge = (left: WallpaperPatch, right: WallpaperPatch): WallpaperPatch => ({
    ...left,
    ...right,
    ...(left.effects || right.effects ? { effects: { ...left.effects!, ...right.effects } } : {}),
    ...(left.rotation || right.rotation ? { rotation: { ...left.rotation!, ...right.rotation } } : {})
  });
  const flush = async () => {
    if (busy || !ports || !runtime) return;
    busy = true;
    update();
    try {
      while (pending && state && panel.alive()) {
        const patch = pending,
          revision = state.revision;
        pending = undefined;
        try {
          const saved = await ports.saveSettings(patch, revision, panel.signal);
          if (!panel.alive()) return;
          await runtime.publish(saved);
        } catch (error) {
          pending = merge(patch, pending || {});
          panel.say(error instanceof Error ? error.message : String(error), true);
          break;
        }
      }
      if (!pending) {
        draft = {};
        panel.status.textContent = '';
      }
    } finally {
      busy = false;
      if (panel.alive()) update();
    }
  };
  const queue = (patch: WallpaperPatch) => {
    draft = merge(draft, patch);
    pending = merge(pending || {}, patch);
    void flush();
  };
  const controls = wallpaperControls(panel, panel.body, current, queue, (effects) =>
    runtime?.preview(effects)
  );
  controls.body.prepend(panel.status);
  let assets: WallpaperAssets | undefined;
  if (ports && runtime)
    assets = new WallpaperAssets(
      panel,
      controls.assets,
      ports,
      () => state,
      (next) => runtime.publish(next),
      (ids) => queue({ order: ids })
    );
  const update = () => {
    const value = current();
    controls.update(value, busy, runtime?.error || '');
    assets?.render(value);
  };
  controls.root.addEventListener('nexus-toggle', () => assets?.setVisible(visible && controls.root.expanded), {
    signal: panel.signal
  });
  const visibility = surface.onVisibilityChanged((value) => {
    visible = value;
    runtime?.setSettingsVisible(value);
    assets?.setVisible(value && controls.root.expanded);
    if (value) update();
  });
  const unsubscribe = runtime?.listen((next) => {
    state = next;
    if (panel.alive()) update();
  });
  runtime?.setSettingsVisible(visible);
  if (!ports || !runtime) panel.say('壁纸服务尚未接入');
  update();
  return () => {
    visibility();
    runtime?.setSettingsVisible(false);
    unsubscribe?.();
    assets?.dispose();
    runtime?.preview(
      state?.effects || {
        blurPx: 0,
        dimPercent: 0,
        surfaceTransparencyPercent: 0,
        secondaryTransparency: true
      }
    );
    panel.cleanup();
  };
}
