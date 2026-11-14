import { choice, field, paragraph, type Panel } from '../../../frontend-ui/src/elements.js';
import type { MaaProfile, MaaSchema } from './ports.js';
import type { MaaFields } from './maa-fields.js';
import { taskFields } from './task-fields.js';
import { activeOptions, optionFields } from './option-fields.js';
import type { UiElement } from '@nexuspipeline/extension-sdk';
import { requireSecretBindings, type MaaSecretDrafts } from './secret-drafts.js';

export function maskSchemaSecrets(parent: HTMLElement): void {
  parent.querySelectorAll<UiElement<'nexus-text-input'>>('nexus-text-input').forEach((input) => {
    if (input.type === 'password') input.value = '';
  });
}

export function drawSchema(
  panel: Panel,
  parent: HTMLElement,
  schema: MaaSchema,
  profile: MaaProfile,
  changed: (redraw?: boolean) => void,
  secretDrafts: MaaSecretDrafts,
  isCurrent: () => boolean,
  fields: MaaFields,
  preset: { name: string; select: (value: string) => void },
  allowSecretEdits = true
): void {
  choice(
    panel,
    parent,
    'Controller',
    profile.controller,
    schema.controllers.map((item) => ({ value: item.name, label: item.label })),
    (value) => {
      maskSchemaSecrets(parent);
      profile.controller = value;
      changed(true);
    }
  );
  choice(
    panel,
    parent,
    'Resource',
    profile.resource,
    schema.resources.map((item) => ({ value: item.name, label: item.label })),
    (value) => {
      maskSchemaSecrets(parent);
      profile.resource = value;
      changed(true);
    }
  );
  choice(
    panel,
    parent,
    '任务预设',
    preset.name,
    [
      { value: '', label: '请选择' },
      ...schema.presets.map((item) => ({ value: item.name, label: item.label }))
    ],
    preset.select
  );
  taskFields(panel, parent, schema, profile, changed, fields, () => maskSchemaSecrets(parent));
  const controller = schema.controllers.find((item) => item.name === profile.controller);
  if (controller?.type === 'Win32') {
    choice(
      panel,
      parent,
      '运行时窗口选择',
      profile.windowSelection,
      [
        { value: 'exact_process', label: '只使用已选进程生命期' },
        { value: 'executable', label: '按完整路径重新发现' }
      ],
      (value) => {
        profile.windowSelection = value as MaaProfile['windowSelection'];
        changed();
      }
    );
    fields.number(parent, '窗口等待上限（毫秒）', profile.windowWaitMilliseconds, 1, 30000, (value) => {
      profile.windowWaitMilliseconds = value;
      changed();
    });
    field(panel, parent, '窗口进程完整路径（运行时复核身份）', profile.windowExecutable, (value) => {
      profile.windowExecutable = value;
      changed();
    });
  } else if (controller?.type === 'Adb') {
    field(panel, parent, 'ADB.exe', profile.adbPath, (value) => {
      profile.adbPath = value;
      changed();
    });
    field(panel, parent, '精确 ADB serial/address', profile.adbSerial, (value) => {
      profile.adbSerial = value;
      changed();
    });
  }
  for (const key of activeOptions(schema, profile))
    optionFields(
      panel,
      parent,
      key,
      schema.options[key],
      profile,
      changed,
      secretDrafts,
      isCurrent, 'GlobalOptions', false, allowSecretEdits
    );
  const protectedLayer = (scope: string, label: string, options: Record<string, unknown>, roots: readonly string[]) => {
    const layer = { ...profile, options };
    for (const key of activeOptions(schema, layer, roots))
      optionFields(panel, parent, key, { ...schema.options[key], label: label + ' · ' + schema.options[key].label }, layer,
        changed, secretDrafts, isCurrent, scope, true, allowSecretEdits);
  };
  protectedLayer('ResourceOptions/' + profile.resource, panel.t('资源层选项'), profile.resourceOptions,
    schema.resources.find(item => item.name === profile.resource)?.options ?? []);
  protectedLayer('ControllerOptions/' + profile.controller, panel.t('控制器层选项'), profile.controllerOptions,
    schema.controllers.find(item => item.name === profile.controller)?.options ?? []);
  for (const row of profile.taskOccurrences)
    protectedLayer(row.occurrenceId, row.taskName + ' · ' + row.occurrenceId, row.options,
      schema.tasks.find(task => task.name === row.taskName)?.options ?? []);
  for (const row of profile.pretaskOccurrences ?? [])
    protectedLayer(row.occurrenceId, row.taskName + ' · ' + row.occurrenceId, row.options,
      schema.pretasks?.find(task => task.name === row.taskName || '__MXU_PRETASK__' + task.name === row.taskName)?.options ?? []);
  for (const setting of schema.settings || [])
    paragraph(
      parent,
      setting.label +
        '：' +
        (setting.options || []).map((key) => schema.options[key]?.label || key).join(', ')
    );
  fields.json(parent, '资源层选项覆盖（JSON）', profile.resourceOptions, (value) => {
    requireSecretBindings(schema, value);
    profile.resourceOptions = value;
    changed();
  });
  fields.json(parent, '控制器层选项覆盖（JSON）', profile.controllerOptions, (value) => {
    requireSecretBindings(schema, value);
    profile.controllerOptions = value;
    changed();
  });
}
