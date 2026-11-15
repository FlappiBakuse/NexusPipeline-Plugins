import { bindLocale } from '../../../frontend-ui/src/localize.js';
import { fieldHelp } from '../../../frontend-ui/src/field-help.js';
import type { Panel } from '../../../frontend-ui/src/elements.js';
import type { UiElement } from '@nexuspipeline/extension-sdk';
import { button } from '../../../frontend-ui/src/elements.js';
import { createModal } from '../../../frontend-ui/src/modal.js';
import type { ActivityFeed, ActivityState } from './ports.js';
import { activityGames, gameName } from './activity-labels.js';
import type { SettingsWrites } from '../../../frontend-ui/src/settings-writes.js';

export function openActivitySettings(
  panel: Panel,
  state: ActivityState,
  locale: string,
  writer: SettingsWrites<ActivityState>,
  update: (state: ActivityState) => void,
  onClose: () => void
) {
  const modal = createModal(panel, '活动设置', true, onClose);
  modal.body.className = 'activity-settings';
  const settings = (value: ActivityState) => ({ selectedFeedIds: [...value.selectedFeedIds],
    gameOrder: [...(value.gameOrder || [])], progressions: { ...value.progressions }, rotationSeconds: value.rotationSeconds });
  let saving = false;
  const draft = settings(state);
  const heading = document.createElement('h3');
  bindLocale(panel.t, modal.signal, heading, 'textContent', () => {
    heading.textContent = panel.t('游戏订阅');
  });
  modal.body.append(heading);
  const list = document.createElement('nexus-sortable-list') as UiElement<'nexus-sortable-list'>;
  list.className = 'activity-game-list';
  modal.body.append(list);
  const known = [...activityGames.map((item) => item[0] as string), ...state.feeds.map((item) => item.game)];
  const order = [...new Set([...(draft.gameOrder ?? []), ...known])];
  list.ids = order;
  const rows = new Map<string, HTMLElement>();
  for (const game of order) {
    const row = document.createElement('div');
    row.className = 'activity-game-row';
    row.dataset.itemId = game;
    rows.set(game, row);
    list.append(row);
    const handle = document.createElement('nexus-drag-handle') as UiElement<'nexus-drag-handle'>;
    handle.itemId = game;
    bindLocale(panel.t, modal.signal, handle, 'label', () => {
      handle.label = panel.t('调整') + gameName(game, panel.t) + panel.t('的顺序');
    });
    row.append(handle);
    fieldHelp(panel, handle, '所有游戏均可排序，未订阅游戏也可调整；聚焦把手后可用上下方向键排序，保存后生效。', modal.signal);
    const title = document.createElement('strong');
    bindLocale(panel.t, modal.signal, title, 'textContent', () => {
      title.textContent = gameName(game, panel.t);
    });
    row.append(title);
    const feeds = state.feeds.filter((item) => item.game === game);
    let selected: ActivityFeed | undefined =
      feeds.find((item) => draft.selectedFeedIds.includes(item.id)) ??
      feeds.find((item) => item.progressionId === draft.progressions[game]) ?? feeds[0];
    const options = state.progressionOptions?.[game] ?? [];
    const enabled = document.createElement('nexus-switch') as UiElement<'nexus-switch'>;
    enabled.value = !!selected && draft.selectedFeedIds.includes(selected.id);
    enabled.disabled = !selected;
    bindLocale(panel.t, modal.signal, enabled, 'aria-label', () => {
      enabled.setAttribute('aria-label', gameName(game, panel.t));
    });
    const select = document.createElement('nexus-select') as UiElement<'nexus-select'>;
    select.value = draft.progressions[game] ?? selected?.progressionId ?? '';
    select.options = options.map((item) => ({ id: item.value, label: item.label }));
    bindLocale(panel.t, modal.signal, select, 'aria-label', () => {
      select.setAttribute('aria-label', gameName(game, panel.t) + ' ' + panel.t('内容进度'));
    });
    const change = () => {
      draft.selectedFeedIds = draft.selectedFeedIds.filter((id) => !feeds.some((item) => item.id === id));
      if (enabled.value && selected) draft.selectedFeedIds.push(selected.id);
    };
    enabled.addEventListener('nexus-change', change, { signal: modal.signal });
    select.addEventListener(
      'nexus-change',
      (event) => {
        const progression = (event as CustomEvent<{ value: string }>).detail.value;
        draft.progressions[game] = progression;
        selected = feeds.find((item) => item.progressionId === progression);
        change();
      },
      { signal: modal.signal }
    );
    if (options.length > 1) {
      row.append(select);
      fieldHelp(panel, select, '选择该游戏的内容进度；显示语言不会改变区服，保存后生效。', modal.signal);
    }
    row.append(enabled);
  }
  list.addEventListener(
    'nexus-reorder',
    (event) => {
      if (writer.unknown) return;
      const ids = (event as CustomEvent<{ ids: string[] }>).detail.ids;
      if (ids.length !== rows.size || new Set(ids).size !== ids.length || ids.some((id) => !rows.has(id)))
        return;
      list.ids = ids;
      draft.gameOrder = ids;
      for (const id of ids) list.append(rows.get(id)!);
    },
    { signal: modal.signal }
  );
  const label = document.createElement('label');
  label.className = 'activity-frequency';
  const caption = document.createElement('span');
  bindLocale(panel.t, modal.signal, caption, 'textContent', () => {
    caption.textContent = panel.t('轮播频率（秒）');
  });
  label.append(caption);
  const interval = document.createElement('nexus-number-input') as UiElement<'nexus-number-input'>;
  interval.value = draft.rotationSeconds;
  interval.min = -1;
  interval.max = 120;
  interval.setAttribute('aria-required', 'true');
  bindLocale(panel.t, modal.signal, interval, 'aria-label', () => {
    interval.setAttribute('aria-label', panel.t('轮播频率（秒）'));
  });
  label.append(interval);
  modal.body.append(label);
  fieldHelp(panel, interval, '填写 10–120 秒；-1 关闭自动轮播，保存后生效。', modal.signal);
  const selectedFeed = state.feeds.find((item) => state.selectedFeedIds.includes(item.id));
  if (selectedFeed?.lastGoodAt) {
    const help = document.createElement('p');
    help.className = 'activity-settings-cache';
    const zone = state.displayZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
    bindLocale(panel.t, modal.signal, help, 'textContent', () => {
      help.textContent =
        panel.t(selectedFeed.cacheState === 'stale' ? '缓存待更新' : '缓存有效') +
        ' · ' +
        panel.t('最近成功') +
        ' ' +
      new Intl.DateTimeFormat(panel.t.locale?.() ?? locale, { dateStyle: 'medium', timeStyle: 'short', timeZone: zone }).format(
        new Date(selectedFeed.lastGoodAt!)
        ) +
        ' (' +
        zone +
        ')';
    });
    modal.body.append(help);
  }
  const error = document.createElement('p');
  error.className = 'activity-error';
  error.setAttribute('role', 'alert');
  error.hidden = true;
  modal.body.append(error);
  function valid(): boolean {
    const seconds = interval.value;
    if (interval.getAttribute('aria-invalid') === 'true' || seconds === null ||
        !Number.isInteger(seconds) || seconds !== -1 && (seconds < 10 || seconds > 120)) {
      error.textContent = panel.t('请输入 10–120 之间的整数，或 -1。'); error.hidden = false;
      return false;
    }
    draft.rotationSeconds = seconds;
    return true;
  }
  button(panel, modal.footer, '取消', () => modal.close('cancel'), modal.signal);
  const save = button(panel, modal.footer, '保存', async () => {
    if (saving || writer.unknown) return;
    if (!valid()) { interval.focus(); return; }
    saving = true; synchronize();
    try {
      const saved = await writer.patch({ ...draft });
      update(saved);
      if (!writer.error && modal.alive()) modal.close('saved');
    } catch (reason) {
      if (modal.alive()) { error.textContent = panel.t(reason instanceof Error ? reason.message : String(reason)); error.hidden = false; }
    } finally { saving = false; synchronize(); }
  }, modal.signal);
  save.setAttribute('tone', 'info');
  const synchronize = () => {
    if (!modal.alive()) return;
    list.disabled = saving || writer.unknown; modal.body.inert = saving || writer.unknown;
    save.toggleAttribute('disabled', saving || writer.unknown);
    if (writer.error) {
      error.textContent = panel.t(writer.error); error.hidden = false;
    }
  };
  const stop = writer.listen(synchronize);
  modal.signal.addEventListener('abort', stop, { once: true });
  void writer.resume(); synchronize();
  modal.element.append(modal.footer);
  return modal;
}
