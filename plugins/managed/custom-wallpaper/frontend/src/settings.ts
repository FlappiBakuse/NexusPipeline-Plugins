import type { ExtensionSurface } from '@nexuspipeline/extension-sdk';
import { createPanel } from '../../../frontend-ui/src/elements.js';
import type { Translate } from '../../../frontend-ui/src/localize.js';
import type { WallpaperPatch, WallpaperPorts, WallpaperState } from './ports.js';
import type { createRuntime } from './runtime.js';
import type { SettingsWrites } from '../../../frontend-ui/src/settings-writes.js';
import { wallpaperControls } from './settings-controls.js';
import { WallpaperAssets } from './wallpaper-assets.js';

type Runtime = ReturnType<typeof createRuntime>;

export function mountSettings(surface: ExtensionSurface, ports: WallpaperPorts | undefined,
  runtime: Runtime | undefined, t: Translate) {
  const panel = createPanel(surface, '自定义壁纸', t);
  panel.card.classList.add('wallpaper-panel');
  panel.card.querySelector('h3')?.remove();
  panel.body.replaceChildren();
  let state: WallpaperState | undefined, writer: SettingsWrites<WallpaperState> | undefined;
  let visible = surface.visible, stopWrites: (() => void) | undefined;
  const current = () => writer?.value ?? state;
  const queue = (patch: WallpaperPatch) => {
    if (!runtime || !state) return;
    writer = runtime.settingCommands();
    void writer.patch(patch).catch(error => panel.say(error instanceof Error ? error.message : String(error), true));
  };
  const controls = wallpaperControls(panel, panel.body, current, queue, effects => runtime?.preview(effects));
  controls.body.prepend(panel.status);
  let assets: WallpaperAssets | undefined;
  if (ports && runtime)
    assets = new WallpaperAssets(panel, controls.assets, ports, () => state,
      next => runtime.publish(next), ids => queue({ order: ids }));
  const update = () => {
    const value = current();
    controls.update(value, !!writer?.unknown, runtime?.error || writer?.error || '');
    assets?.render(value);
    panel.say(writer?.error || '', !!writer?.error);
  };
  controls.root.addEventListener('nexus-toggle', () => assets?.setVisible(visible && controls.root.expanded),
    { signal: panel.signal });
  const visibility = surface.onVisibilityChanged(value => {
    visible = value; runtime?.setSettingsVisible(value);
    assets?.setVisible(value && controls.root.expanded);
    if (value) { void writer?.resume(); update(); }
  });
  const unsubscribe = runtime?.listen(next => {
    state = next;
    if (!writer) {
      writer = runtime.settingCommands();
      stopWrites = writer.listen(update);
    } else writer.observe(next);
    if (panel.alive()) update();
  });
  if (runtime?.state) {
    state = runtime.state; writer = runtime.settingCommands(); stopWrites = writer.listen(update);
  }
  runtime?.setSettingsVisible(visible);
  if (!ports || !runtime) panel.say('壁纸服务尚未接入');
  update();
  return () => {
    stopWrites?.(); visibility(); runtime?.setSettingsVisible(false); unsubscribe?.(); assets?.dispose();
    if (state) runtime?.preview(state.effects);
    panel.cleanup();
  };
}
