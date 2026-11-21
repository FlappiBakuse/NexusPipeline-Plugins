import type { ExtensionSurface, UiElement } from '@nexuspipeline/extension-sdk';
import { createPanel, choice, range, type Panel } from '../../../frontend-ui/src/elements.js';
import { type Translate, bindLocale } from '../../../frontend-ui/src/localize.js';
import type { WallpaperPatch, WallpaperPorts, WallpaperState, WallpaperEffects } from './ports.js';
import type { WallpaperRuntime } from './index.js';
import type { SettingsWrites } from '../../../frontend-ui/src/settings-writes.js';
import { WallpaperAssets } from './wallpaper-assets.js';
import { fieldHelp } from '../../../frontend-ui/src/field-help.js';

export function mountSettings(surface: ExtensionSurface, ports: WallpaperPorts | undefined,
  runtime: WallpaperRuntime | undefined, t: Translate) {
  const panel = createPanel(surface, '自定义壁纸', t);
  panel.card.classList.add('wallpaper-panel');
  panel.card.querySelector('h3')?.remove();
  panel.body.replaceChildren();
  let state: WallpaperState | undefined, writer: SettingsWrites<WallpaperState> | undefined;
  let visible = surface.visible, stopWrites: (() => void) | undefined;
  let presentedError = '';
  const current = () => writer?.value ?? state;
  const queue = (patch: WallpaperPatch) => {
    if (!runtime || !state) return;
    writer = runtime.settingCommands();
    const commands = writer;
    void commands.patch(patch).catch(error => {
      if (visible && !commands.error && !panel.signal.aborted)
        panel.say(error instanceof Error ? error.message : String(error), true);
    });
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
    const writeError = visible ? writer?.error || '' : '';
    if (writeError !== presentedError) {
      presentedError = writeError;
      panel.say(writeError, !!writeError);
    }
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

function switchRow(
  panel: Panel,
  parent: HTMLElement,
  title: string,
  description: string,
  changed: (value: boolean) => void
) {
  const element = document.createElement('nexus-switch-setting') as UiElement<'nexus-switch-setting'>;
  bindLocale(panel.t, panel.signal, element, 'title', () => {
    element.title = panel.t(title);
  });
  bindLocale(panel.t, panel.signal, element, 'description', () => {
    element.description = panel.t(description);
  });
  element.addEventListener(
    'nexus-change',
    (event) => changed((event as CustomEvent<{ value: boolean }>).detail.value),
    { signal: panel.signal }
  );
  parent.append(element);
  return element;
}

function wallpaperControls(
  panel: Panel,
  parent: HTMLElement,
  current: () => WallpaperState | undefined,
  queue: (patch: WallpaperPatch) => void,
  preview: (effects: WallpaperEffects) => void
) {
  const root = document.createElement('nexus-collapsible-card') as UiElement<'nexus-collapsible-card'>;
  root.panelId = 'wallpaper';
  root.className = 'wallpaper-settings';
  bindLocale(panel.t, panel.signal, root, 'title', () => { root.title = panel.t('自定义壁纸'); });
  bindLocale(panel.t, panel.signal, root, 'description', () => {
    root.description = panel.t('同步壁纸、轮换方式和显示效果');
  });
  const body = document.createElement('div');
  body.className = 'wallpaper-content';
  root.append(body);
  parent.append(root);
  const intro = document.createElement('div');
  intro.className = 'wallpaper-intro';
  const note = document.createElement('span');
  bindLocale(panel.t, panel.signal, note, 'textContent', () => {
    note.textContent = panel.t('服务端同步到当前 NexusPipeline 实例的全部浏览器。');
  });
  const badge = document.createElement('nexus-badge') as UiElement<'nexus-badge'>;
  intro.append(note, badge);
  body.append(intro);
  const switches = document.createElement('nexus-switch-list') as UiElement<'nexus-switch-list'>;
  switches.className = 'wallpaper-switches';
  body.append(switches);
  const enabled = switchRow(
    panel,
    switches,
    '启用自定义壁纸',
    '启用后使用自定义壁纸作为页面背景。',
    (value) => queue({ enabled: value })
  );
  const secondary = switchRow(
    panel,
    switches,
    '透明度运用于非主页面',
    '关闭后，二级浮层恢复为完全不透明；主页面一级卡片继续使用透明度设置。',
    (value) => {
      const state = current();
      if (state) queue({ effects: { ...state.effects, secondaryTransparency: value } });
    }
  );
  const rotations = document.createElement('div');
  rotations.className = 'wallpaper-rotation';
  body.append(rotations);
  const mode = choice(
    panel,
    rotations,
    '轮换方式',
    'off',
    [
      { value: 'timer', label: '按时间随机轮换' },
      { value: 'startup', label: '每次启动 Web 随机轮换' },
      { value: 'off', label: '不轮换' }
    ],
    (value) => {
      const state = current();
      if (state)
        queue({
          rotation: { ...state.rotation, mode: value as 'timer' | 'startup' | 'off', epochUnixMs: Date.now() }
        });
    }
  );
  const intervalRow = document.createElement('label');
  fieldHelp(panel, mode, '按时间随机轮换会按设定间隔切换壁纸；每次启动 Web 随机轮换会在新界面会话准备时选择壁纸。');
  intervalRow.className = 'plugin-field';
  const caption = document.createElement('span');
  bindLocale(panel.t, panel.signal, caption, 'textContent', () => {
    caption.textContent = panel.t('轮换间隔（分钟）');
  });
  const interval = document.createElement('nexus-number-input') as UiElement<'nexus-number-input'>;
  interval.min = 1;
  interval.max = 1440;
  interval.step = 1;
  bindLocale(panel.t, panel.signal, interval, 'aria-label', () => {
    interval.setAttribute('aria-label', panel.t('轮换间隔（分钟）'));
  });
  interval.setAttribute('aria-required', 'true');
  interval.addEventListener(
    'nexus-change',
    (event) => {
      const value = (event as CustomEvent<{ value: number }>).detail.value,
        state = current();
      if (state && Number.isInteger(value) && value >= 1 && value <= 1440)
        queue({ rotation: { ...state.rotation, intervalMinutes: value } });
    },
    { signal: panel.signal }
  );
  intervalRow.append(caption, interval);
  rotations.append(intervalRow);
  fieldHelp(panel, interval, '按时间随机轮换时生效，范围为 1–1440 分钟。');
  const effects = document.createElement('div');
  effects.className = 'wallpaper-effects';
  body.append(effects);
  const ranges = effectControls(panel, effects, current, queue, preview);
  const assets = document.createElement('div');
  assets.className = 'wallpaper-assets';
  body.append(assets);
  const update = (state: WallpaperState | undefined, busy: boolean, error: string) => {
    bindLocale(panel.t, panel.signal, badge, 'label', () => {
      badge.label = panel.t(
        busy ? '保存中' : error ? '读取失败' : state?.effectiveEnabled ? '已启用' : '未启用'
      );
    });
    badge.tone = busy ? 'info' : error ? 'danger' : state?.effectiveEnabled ? 'success' : 'neutral';
    if (!state) {
      rotations.inert = switches.inert = effects.inert = true;
      return;
    }
    rotations.inert = switches.inert = effects.inert = busy;
    enabled.value = state.enabled;
    secondary.value = state.effects.secondaryTransparency;
    mode.value = state.rotation.mode;
    interval.value = state.rotation.intervalMinutes;
    for (const [key, control] of ranges) {
      control.value = state.effects[key];
      updateOutput(control, state.effects[key], key === 'blurPx' ? 'px' : '%');
    }
  };
  return { root, body, assets, update };
}

function effectControls(
  panel: Panel,
  parent: HTMLElement,
  current: () => WallpaperState | undefined,
  queue: (patch: WallpaperPatch) => void,
  preview: (effects: WallpaperEffects) => void
) {
  const ranges = new Map<'blurPx' | 'dimPercent' | 'surfaceTransparencyPercent', UiElement<'nexus-range'>>();
  for (const [key, title, maximum] of [
    ['blurPx', '模糊（像素）', 40],
    ['dimPercent', '变暗', 80],
    ['surfaceTransparencyPercent', '卡片与侧边栏透明度', 50]
  ] as const) {
    const element = range(
      panel,
      parent,
      title,
      0,
      0,
      maximum,
      (value) => {
        const state = current();
        if (state) preview({ ...state.effects, [key]: value });
        updateOutput(element, value, key === 'blurPx' ? 'px' : '%');
      },
      (value) => {
        const state = current();
        if (state) queue({ effects: { ...state.effects, [key]: value } });
      }
    ) as UiElement<'nexus-range'>;
    ranges.set(key, element);
    fieldHelp(panel, element, key === 'blurPx' ? '模糊范围为 0–40 像素。' : key === 'dimPercent'
      ? '变暗范围为 0–80%，用于调整壁纸与内容的对比度。'
      : '控制页面卡片、侧边栏和其他表面的透明度，范围为 0–50%。');
  }
  return ranges;
}

function updateOutput(element: HTMLElement, value: number, unit: string): void {
  const output = element.parentElement?.querySelector('output');
  if (output) output.textContent = value + unit;
}
