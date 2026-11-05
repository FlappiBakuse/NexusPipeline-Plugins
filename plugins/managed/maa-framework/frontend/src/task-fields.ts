import { createIdentity } from '../../../frontend-ui/src/identity';
import type { UiElement } from '@nexuspipeline/extension-sdk';
import { button, choice, type Panel } from '../../../frontend-ui/src/elements.js';
import type { MaaProfile, MaaSchema } from './ports.js';
import type { MaaFields } from './maa-fields.js';
import { bindLocale } from '../../../frontend-ui/src/localize.js';
import { requireSecretBindings } from './secret-drafts.js';

export function taskFields(
  panel: Panel,
  parent: HTMLElement,
  schema: MaaSchema,
  profile: MaaProfile,
  changed: (redraw?: boolean) => void,
  fields: MaaFields,
  clearProtected: () => void = () => {}
): void {
  const applicable = schema.tasks.filter(
    (task) =>
      (!task.controller?.length || task.controller.includes(profile.controller)) &&
      (!task.resource?.length || task.resource.includes(profile.resource))
  );
  choice(
    panel,
    parent,
    '添加任务条目',
    '',
    [{ value: '', label: '请选择' }, ...applicable.map((task) => ({ value: task.name, label: task.label }))],
    (name) => {
      if (!applicable.some((task) => task.name === name)) return;
      profile.taskOccurrences.push({
        occurrenceId: createIdentity(),
        taskName: name,
        sourceTaskId: '',
        order: profile.taskOccurrences.length,
        enabled: true,
        repeatCount: 1,
        options: {},
        pipelineOverride: {}
      });
      changed(true);
    }
  );
  const list = document.createElement('nexus-sortable-list') as UiElement<'nexus-sortable-list'>;
  list.className = 'maa-occurrences';
  list.ids = profile.taskOccurrences.map((item) => item.occurrenceId);
  parent.append(list);
  list.addEventListener(
    'nexus-reorder',
    (event) => {
      const ids = (event as CustomEvent<{ ids: string[] }>).detail.ids;
      if (
        ids.length !== profile.taskOccurrences.length ||
        new Set(ids).size !== ids.length ||
        ids.some((id) => !profile.taskOccurrences.some((item) => item.occurrenceId === id))
      )
        return;
      profile.taskOccurrences = ids.map((id, order) => ({
        ...profile.taskOccurrences.find((item) => item.occurrenceId === id)!,
        order
      }));
      changed(true);
    },
    { signal: panel.signal }
  );
  for (const occurrence of profile.taskOccurrences) {
    const row = document.createElement('div');
    row.className = 'maa-occurrence';
    row.dataset.itemId = occurrence.occurrenceId;
    const handle = document.createElement('nexus-drag-handle') as UiElement<'nexus-drag-handle'>;
    handle.itemId = occurrence.occurrenceId;
    bindLocale(panel.t, panel.signal, handle, 'label', () => {
      handle.label = panel.t('调整任务顺序：') + occurrence.taskName;
    });
    const enabled = document.createElement('nexus-switch') as UiElement<'nexus-switch'>;
    enabled.value = occurrence.enabled;
    enabled.setAttribute('aria-label', occurrence.taskName);
    enabled.addEventListener(
      'nexus-change',
      (event) => {
        clearProtected();
        occurrence.enabled = (event as CustomEvent<{ value: boolean }>).detail.value;
        changed();
      },
      { signal: panel.signal }
    );
    const title = document.createElement('span');
    title.textContent = occurrence.taskName;
    row.append(handle, enabled, title);
    button(panel, row, '移除', () => {
      clearProtected();
      fields.remove(occurrence.taskName + ' · ' + occurrence.occurrenceId);
      fields.remove(occurrence.occurrenceId);
      profile.taskOccurrences = profile.taskOccurrences.filter(
        (item) => item.occurrenceId !== occurrence.occurrenceId
      );
      profile.taskOccurrences.forEach((item, order) => {
        item.order = order;
      });
      changed(true);
    });
    list.append(row);
    fields.number(
      parent,
      '重复次数',
      occurrence.repeatCount,
      1,
      schema.tasks.find(task => task.name === occurrence.taskName)?.repeatable === false ? 1 : 100,
      (value) => {
        occurrence.repeatCount = value;
        changed();
      },
      occurrence.occurrenceId,
      () => occurrence.taskName + ' · ' + panel.t('重复次数')
    );
    fields.json(
      parent,
      '选项',
      occurrence.options,
      (value) => {
        requireSecretBindings(schema, value);
        occurrence.options = value;
        changed();
      },
      occurrence.occurrenceId + '/options',
      () => occurrence.taskName + ' · ' + occurrence.occurrenceId + ' · ' + panel.t('选项')
    );
  }
}

export function defaultTasks(schema: MaaSchema, profile: MaaProfile): void {
  profile.taskOccurrences = schema.tasks
    .filter(
      (task) =>
        task.defaultCheck &&
        (!task.controller?.length || task.controller.includes(profile.controller)) &&
        (!task.resource?.length || task.resource.includes(profile.resource))
    )
    .map((task, order) => ({
      occurrenceId: createIdentity(),
      taskName: task.name,
      sourceTaskId: '',
      order,
      enabled: true,
      repeatCount: 1,
      options: {},
      pipelineOverride: {}
    }));
}
