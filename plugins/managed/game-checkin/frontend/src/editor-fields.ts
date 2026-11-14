import { bindLocale } from '../../../frontend-ui/src/localize.js';
import type { UiElement } from '@nexuspipeline/extension-sdk';
import { field, type Panel } from '../../../frontend-ui/src/elements.js';
import { schedules } from './schedule-fields.js';
import { label, setting } from './editor-controls.js';
import type { CredentialFields } from './credential-fields.js';
import type { CheckInState, TaskDraft } from './ports.js';

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
  for (const platform of state.platforms)
    selection(
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
