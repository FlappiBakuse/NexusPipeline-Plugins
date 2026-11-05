import { bindLocale } from '../../../frontend-ui/src/localize.js';
import { createIdentity } from '../../../frontend-ui/src/identity';
import type { UiElement } from '@nexuspipeline/extension-sdk';
import { button, type Panel } from '../../../frontend-ui/src/elements.js';
import type { CheckInSchedule, CheckInState, TaskDraft } from './ports.js';
import { label, setting } from './editor-controls.js';

export function schedules(panel: Panel, parent: HTMLElement, state: CheckInState, draft: TaskDraft): void {
  const section = document.createElement('div');
  section.className = 'checkin-schedules';
  const heading = document.createElement('h3');
  bindLocale(panel.t, panel.signal, heading, 'textContent', () => {
    heading.textContent = panel.t('定时列表');
  });
  const help = document.createElement('p');
  bindLocale(panel.t, panel.signal, help, 'textContent', () => {
    help.textContent =
      panel.t('默认收起；展开后编辑周期与执行时间，拖拽左侧把手排序。按本机时区') +
      ' ' +
      state.timeZoneId +
      ' ' +
      panel.t('执行，应用关闭期间错过的时间不会补跑。');
  });
  const list = document.createElement('nexus-sortable-list') as UiElement<'nexus-sortable-list'>;
  list.className = 'checkin-schedule-list';
  const rows = new Map<string, { element: HTMLElement; owner: AbortController; summary: () => void }>();
  const existing = new Set(draft.schedules.map(schedule => schedule.id));
  const refresh = () => {
    list.ids = draft.schedules.map((schedule) => schedule.id);
    draft.schedules.forEach((schedule, index) => {
      if (!rows.has(schedule.id))
        rows.set(
          schedule.id,
          scheduleRow(
            panel,
            schedule,
            () => draft.schedules.indexOf(schedule),
            () => {
              rows.get(schedule.id)?.owner.abort();
              rows.get(schedule.id)?.element.remove();
              rows.delete(schedule.id);
              draft.schedules = draft.schedules.filter((item) => item.id !== schedule.id);
              refresh();
            },
            !existing.has(schedule.id)
          )
        );
      const row = rows.get(schedule.id)!;
      row.summary();
      if (list.children[index] !== row.element) list.insertBefore(row.element, list.children[index] ?? null);
    });
  };
  list.addEventListener(
    'nexus-reorder',
    (event) => {
      const ids = (event as CustomEvent<{ ids: string[] }>).detail.ids;
      if (
        ids.length !== draft.schedules.length ||
        new Set(ids).size !== ids.length ||
        ids.some((id) => !rows.has(id))
      )
        return;
      draft.schedules = ids.map((id) => draft.schedules.find((item) => item.id === id)!);
      refresh();
    },
    { signal: panel.signal }
  );
  section.append(heading, help, list);
  parent.append(section);
  button(panel, section, '+ 添加定时', () => {
    draft.schedules.push({
      id: createIdentity(),
      days: [1, 2, 3, 4, 5],
      time: '09:00',
      enabled: true
    });
    refresh();
  });
  refresh();
}

function scheduleRow(panel: Panel, schedule: CheckInSchedule, index: () => number, remove: () => void, expanded: boolean) {
  const owner = new AbortController(),
    local = { ...panel, signal: AbortSignal.any([panel.signal, owner.signal]) };
  const element = document.createElement('div');
  element.className = 'checkin-schedule-row';
  element.dataset.itemId = schedule.id;
  const handle = document.createElement('nexus-drag-handle') as UiElement<'nexus-drag-handle'>;
  handle.itemId = schedule.id;
  bindLocale(panel.t, local.signal, handle, 'label', () => {
    handle.label = panel.t('调整签到时间顺序');
  });
  const card = document.createElement('details');
  card.className = 'checkin-schedule-card';
  card.open = expanded;
  const heading = document.createElement('summary'),
    title = document.createElement('strong'),
    metadata = document.createElement('span');
  const arrow = document.createElement('nexus-icon') as UiElement<'nexus-icon'>;
  arrow.name = 'chevronDown';
  heading.append(title, metadata, arrow);
  card.append(heading);
  const summary = () => {
    title.textContent = `${panel.t('定时')} ${index() + 1}`;
    metadata.textContent = `${schedule.time} - ${schedule.days.length} ${panel.t('天')}`;
  };
  bindLocale(panel.t, local.signal, title, 'textContent', summary);
  const grid = document.createElement('div');
  grid.className = 'checkin-schedule-grid';
  const days = label(local, grid, '执行周期（可多选）'),
    choices = document.createElement('div');
  choices.className = 'checkin-days';
  days.append(choices);
  for (const [day, caption] of ['日', '一', '二', '三', '四', '五', '六'].entries()) {
    const control = button(local, choices, caption, () => {
      schedule.days = schedule.days.includes(day)
        ? schedule.days.filter((value) => value !== day)
        : [...schedule.days, day].sort();
      control.setAttribute('aria-pressed', String(schedule.days.includes(day)));
      summary();
    });
    control.setAttribute('aria-pressed', String(schedule.days.includes(day)));
  }
  const time = document.createElement('nexus-time-picker') as UiElement<'nexus-time-picker'>;
  time.value = schedule.time;
  bindLocale(panel.t, local.signal, time, 'aria-label', () => {
    time.setAttribute('aria-label', panel.t('执行时间'));
  });
  time.addEventListener(
    'nexus-change',
    (event) => {
      schedule.time = (event as CustomEvent<{ value: string }>).detail.value;
      summary();
    },
    { signal: local.signal }
  );
  label(local, grid, '执行时间').append(time);
  card.append(grid);
  setting(local, card, '启用此计划', '', schedule.enabled, (value) => {
    schedule.enabled = value;
  });
  const actions = document.createElement('div');
  actions.className = 'checkin-schedule-actions';
  const deletion = button(local, actions, '删除定时', remove) as UiElement<'nexus-button'>;
  deletion.tone = 'danger';
  card.append(actions);
  element.append(handle, card);
  summary();
  return { element, owner, summary };
}
