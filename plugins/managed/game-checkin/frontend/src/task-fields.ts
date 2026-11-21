import { bindLocale } from '../../../frontend-ui/src/localize.js';
import { fieldHelp } from '../../../frontend-ui/src/field-help.js';
import type { UiElement } from '@nexuspipeline/extension-sdk';
import { field, type Panel, button } from '../../../frontend-ui/src/elements.js';
import type { CredentialFields } from './credential-fields.js';
import type { CheckInState, TaskDraft, CheckInSchedule } from './ports.js';
import { createIdentity } from '../../../frontend-ui/src/identity';
import { draftPresentation } from '../../../frontend-ui/src/draft-presentation.js';

function selection(
  panel: Panel,
  parent: HTMLElement,
  title: string | (() => string),
  values: string[],
  options: { id: string; label: string }[] | (() => { id: string; label: string }[]),
  change: (values: string[]) => void
) {
  const wrapper = label(panel, parent, title),
    control = document.createElement('nexus-select') as UiElement<'nexus-select'>;
  control.multiple = true;
  bindLocale(panel.t, panel.signal, control, 'options', () => {
    control.options = typeof options === 'function' ? options() : options;
  });
  control.value = values;
  bindLocale(panel.t, panel.signal, control, 'aria-label', () => {
    control.setAttribute('aria-label', typeof title === 'function' ? title() : panel.t(title));
  });
  bindLocale(panel.t, panel.signal, control, 'placeholder', () => {
    control.setAttribute('placeholder', panel.t('请选择'));
  });
  control.addEventListener(
    'nexus-change',
    (event) => change((event as CustomEvent<{ value: string[] }>).detail.value),
    { signal: panel.signal }
  );
  wrapper.append(control);
  return control;
}

export function taskFields(
  panel: Panel,
  parent: HTMLElement,
  state: CheckInState,
  draft: TaskDraft,
  credentials: CredentialFields
): void {
  const main = document.createElement('div');
  main.className = 'checkin-main-fields';
  parent.append(main);
  const name = field(panel, main, '任务名称', draft.name, (value) => {
    draft.name = value;
  }) as UiElement<'nexus-text-input'>;
  name.maxLength = 100;
  name.setAttribute('aria-required', 'true');
  name.parentElement!.classList.add('checkin-required');
  const note = document.createElement('nexus-text-area') as UiElement<'nexus-text-area'>;
  note.value = draft.remark;
  note.rows = 3;
  bindLocale(panel.t, panel.signal, note, 'aria-label', () => {
    note.setAttribute('aria-label', panel.t('备注'));
  });
  note.className = 'checkin-note';
  note.setAttribute('data-draft-field', 'remark');
  note.addEventListener(
    'nexus-change',
    (event) => {
      draft.remark = (event as CustomEvent<{ value: string }>).detail.value;
    },
    { signal: panel.signal }
  );
  label(panel, main, '备注').append(note);
  setting(panel, main, '启用此任务', '停用后不会按计划自动签到。', draft.enabled, (value) => {
    draft.enabled = value;
  });
  const group = document.createElement('details');
  group.className = 'checkin-game-section';
  group.dataset.surface = 'collapsible';
  group.open = true;
  const summary = document.createElement('summary'),
    heading = document.createElement('strong'),
    description = document.createElement('small');
  bindLocale(panel.t, panel.signal, heading, 'textContent', () => {
    heading.textContent = panel.t('游戏自动签到');
  });
  bindLocale(panel.t, panel.signal, description, 'textContent', () => {
    description.textContent = panel.t('按需配置各平台的游戏和凭据，本任务触发时将对所选游戏执行签到。');
  });
  const copy = document.createElement('span'),
    icon = document.createElement('nexus-icon') as UiElement<'nexus-icon'>;
  icon.name = 'chevronDown';
  copy.append(heading, description);
  summary.append(copy, icon);
  group.append(summary);
  const body = document.createElement('div');
  body.className = 'checkin-game-body';
  group.append(body);
  parent.append(group);
  const games = document.createElement('div');
  games.className = 'checkin-game-grid';
  body.append(games);
  for (const platform of state.platforms) {
    const control = selection(
      panel,
      games,
      () => panel.t(platform.name) + ' ' + panel.t('签到游戏'),
      draft.games[platform.id] || [],
      () => platform.games.map((game) => ({ id: game.id, label: panel.t(game.name) })),
      (values) => {
        if (values.length) draft.games[platform.id] = values;
        else delete draft.games[platform.id];
      }
    );
    fieldHelp(panel, control, '本任务触发时，仅对所选平台游戏执行签到。');
  }
  for (const platform of state.platforms) credentials.mount(body, platform);
  const notification = document.createElement('div');
  notification.className = 'checkin-notification';
  body.append(notification);
  setting(
    panel,
    notification,
    '启用通知',
    '选择通知任务；不选则不发送。',
    draft.notification.enabled,
    (value) => {
      draft.notification.enabled = value;
    }
  );
  const options = () => {
    const values = state.notificationTasks.map((task) => ({
      id: task.id,
      label:
        task.name +
        (task.type ? ' · ' + task.type.toUpperCase() : '') +
        (!task.configured ? ' · ' + panel.t('配置异常') : !task.enabled ? ' · ' + panel.t('已停用') : '')
    }));
    for (const id of draft.notification.notificationTaskIds)
      if (!values.some((option) => option.id === id)) values.push({ id, label: panel.t('已删除的通知任务') });
    return values;
  };
  selection(
    panel,
    notification,
    '通知任务',
    draft.notification.notificationTaskIds,
    options,
    (values) => {
      draft.notification.notificationTaskIds = values;
    }
  );
  schedules(panel, parent, state, draft);
}

function schedules(panel: Panel, parent: HTMLElement, state: CheckInState, draft: TaskDraft): void {
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
  const existing = new Set(panel.drafts.retain('schedule-baseline',
    () => ({ ids: draft.schedules.map(schedule => schedule.id) })).ids);
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
              if (!existing.has(schedule.id)) draftPresentation(panel.drafts, !!draft.id, panel.t).discardNewItem(schedule.id);
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
  card.dataset.surface = 'collapsible';
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

function label(panel: Panel, parent: HTMLElement, title: string | (() => string)): HTMLLabelElement {
  const element = document.createElement('label'),
    caption = document.createElement('span');
  element.className = 'checkin-label';
  bindLocale(panel.t, panel.signal, caption, 'textContent', () => {
    caption.textContent = typeof title === 'function' ? title() : panel.t(title);
  });
  element.append(caption);
  parent.append(element);
  return element;
}

function setting(
  panel: Panel,
  parent: HTMLElement,
  title: string,
  description: string,
  value: boolean,
  change: (value: boolean) => void
) {
  const control = document.createElement('nexus-switch-setting') as UiElement<'nexus-switch-setting'>;
  bindLocale(panel.t, panel.signal, control, 'title', () => {
    control.title = panel.t(title);
  });
  bindLocale(panel.t, panel.signal, control, 'description', () => {
    control.description = panel.t(description);
  });
  control.value = value;
  control.setAttribute('data-draft-field', title);
  control.className = 'checkin-setting';
  control.addEventListener(
    'nexus-change',
    (event) => change((event as CustomEvent<{ value: boolean }>).detail.value),
    { signal: panel.signal }
  );
  parent.append(control);
  return control;
}
