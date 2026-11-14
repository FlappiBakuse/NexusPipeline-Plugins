import { bindLocale } from '../../../frontend-ui/src/localize.js';
import type { UiElement } from '@nexuspipeline/extension-sdk';
import { choice, range, type Panel } from '../../../frontend-ui/src/elements.js';
import type { WallpaperEffects, WallpaperPatch, WallpaperState } from './ports.js';

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

export function wallpaperControls(
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
  }
  return ranges;
}

function updateOutput(element: HTMLElement, value: number, unit: string): void {
  const output = element.parentElement?.querySelector('output');
  if (output) output.textContent = value + unit;
}
