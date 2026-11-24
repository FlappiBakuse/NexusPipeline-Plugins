import { choice, field, paragraph, type Panel, button, toggle } from '../../../frontend-ui/src/elements.js';
import type { MaaProfile, MaaSchema, MaaOption } from './ports.js';
import type { MaaFields } from './maa-fields.js';
import { taskFields } from './task-fields.js';
import type { UiElement } from '@nexuspipeline/extension-sdk';
import { requireSecretBindings, type MaaSecretDrafts, secretKey, projectScope, type MaaSecretDraft } from './secret-drafts.js';
import { fieldHelp } from '../../../frontend-ui/src/field-help.js';
import { bindLocale } from '../../../frontend-ui/src/localize.js';

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
  if (controller?.type === 'Win32' || controller?.type === 'Adb') {
    const guidance = paragraph(parent, '');
    bindLocale(panel.t, panel.signal, guidance, 'text', () => {
      guidance.textContent = panel.t('请在 NexusPipeline 的运行目标配置中选择 PC 窗口或 Android 设备。');
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

function activeOptions(schema: MaaSchema, profile: MaaProfile, selectedRoots?: readonly string[]): string[] {
  const applicable = (item: { controller?: readonly string[]; resource?: readonly string[] }) =>
    (!item.controller?.length || item.controller.includes(profile.controller)) &&
    (!item.resource?.length || item.resource.includes(profile.resource));
  const roots = [
    ...(schema.globalOptions || []),
    ...(schema.controllers.find((item) => item.name === profile.controller)?.options || []),
    ...(schema.resources.find((item) => item.name === profile.resource)?.options || []),
    ...schema.tasks
      .filter(
        (task) =>
          applicable(task) &&
          profile.taskOccurrences.some((item) => item.enabled && item.taskName === task.name)
      )
      .flatMap((task) => task.options || []),
    ...(schema.pretasks || []).filter(applicable).flatMap((task) => task.options || []),
    ...(schema.settings || []).flatMap((item) => item.options || [])
  ];
  const active = new Set<string>();
  const visit = (key: string) => {
    const option = schema.options[key];
    if (!option || active.has(key) || !applicable(option)) return;
    active.add(key);
    const value = profile.options[key] ?? option.defaultCase,
      selected = new Set(Array.isArray(value) ? value : [value]);
    if (profile.sourceBinding?.sourceKind === 'cfa') return;
    for (const item of option.cases || [])
      if (selected.has(item.name)) for (const child of item.options || []) visit(child);
  };
  (selectedRoots ?? (roots.length ? roots : Object.keys(schema.options))).forEach(visit);
  return [...active];
}

function optionFields(
  panel: Panel,
  parent: HTMLElement,
  key: string,
  definition: MaaOption,
  profile: MaaProfile,
  changed: (redraw?: boolean) => void,
  drafts: MaaSecretDrafts,
  isCurrent: () => boolean,
  scope = 'GlobalOptions',
  protectedOnly = false,
  allowSecretEdits = true
): void {
  if (protectedOnly && definition.type !== 'input' && definition.type !== 'hotkey') return;
  if (definition.type === 'select' || definition.type === 'switch') {
    choice(
      panel,
      parent,
      definition.label,
      String(profile.options[key] ?? definition.defaultCase ?? ''),
      (definition.cases || []).map((item) => ({ value: item.name, label: item.label })),
      (value) => {
        profile.options[key] = value;
        changed(true);
      }
    );
    return;
  }
  if (definition.type === 'checkbox') {
    for (const item of definition.cases || []) {
      const values = profile.options[key] ?? definition.defaultCase ?? [],
        selected = new Set(Array.isArray(values) ? values : [values]);
      toggle(panel, parent, definition.label + ' / ' + item.label, selected.has(item.name), (value) => {
        const current = profile.options[key] ?? definition.defaultCase ?? [],
          next = new Set(Array.isArray(current) ? current : [current]);
        if (value) next.add(item.name);
        else next.delete(item.name);
        profile.options[key] = [...next];
        changed(true);
      });
    }
    return;
  }
  const snapshot = profile.sourceSnapshot as { compilation?: { compilationFingerprint?: string } } | undefined;
  for (const input of definition.inputs ?? definition.hotkeys ?? []) {
    const name = (snapshot?.compilation?.compilationFingerprint || profile.profileId) + '\0' + scope + '\0' + key + '\0' + input.name,
      values = profile.options[key] as Record<string, unknown> | undefined;
    const label = definition.label + ' / ' + input.name;
    if (!input.password) {
      if (protectedOnly) continue;
      field(panel, parent, label, String(values?.[input.name] ?? input.default ?? ''), (value) => {
        profile.options[key] = { ...(profile.options[key] as Record<string, unknown>), [input.name]: value };
        changed();
      });
      continue;
    }
    if (!allowSecretEdits) {
      const protectedField = document.createElement('span');
      protectedField.tabIndex = 0;
      protectedField.textContent = label;
      parent.append(protectedField);
      fieldHelp(panel, protectedField, '脚本项目的受保护字段请在账号绑定中配置。');
      continue;
    }
    drafts.activate(name);
    const inputControl = field(
      panel,
      parent,
      label,
      drafts.get(name)?.value || '',
      (value) => drafts.set(name, { value }),
      'password'
    );
    const row = document.createElement('div');
    row.className = 'maa-secret-action';
    parent.append(row);
    const secretState = () => {
      const binding = (profile.options[key] as Record<string, unknown> | undefined)?.[input.name] as { $maaSecret?: string } | undefined;
      return profile.protectedInputs?.find(item => item.key === binding?.$maaSecret);
    };
    const describe = (state = secretState()) => panel.t(drafts.get(name)?.edit?.intent === 'set' ? '新密钥仅在确认保存后写入' :
      drafts.get(name)?.edit?.intent === 'clear' ? '清除仅在确认保存后生效' : state?.isConfigured ?
        state.isReadable ? '已配置受保护密钥' : '受保护密钥当前不可读取' : '未配置受保护密钥');
    const help = fieldHelp(panel, inputControl, () => describe());
    const refresh = () => {
      const state = secretState();
      (inputControl as UiElement<'nexus-text-input'>).placeholder = panel.t(
        drafts.get(name)?.edit?.intent === 'clear' ? '将在保存后清除' : state?.isConfigured ? '已配置，留空保留' : '未配置受保护密钥');
      help.content = describe(state);
    };
    bindLocale(panel.t, panel.signal, inputControl, 'placeholder', refresh);
    drafts.watch(refresh, panel.signal);
    button(panel, row, '使用新密钥草稿', async () => {
      const draft = drafts.get(name);
      if (!draft?.value) return;
      const reference = await secretKey(projectScope(profile, scope), key, input.name);
      if (!panel.alive() || !isCurrent() || !row.isConnected || drafts.get(name) !== draft) return;
      draft.edit = { key: reference, expectedRevision: profile.protectedInputs?.find(item => item.key === reference)?.revision ?? 0, intent: 'set' };
      profile.options[key] = {
        ...(profile.options[key] as Record<string, unknown>),
        [input.name]: { $maaSecret: reference }
      };
      changed(true);
    });
    button(panel, row, '取消密钥修改', () => {
      const draft = drafts.get(name);
      if (draft) draft.value = '';
      drafts.delete(name);
      changed(true);
    });
    button(panel, row, '清除已存密钥', async () => {
      const previous = drafts.get(name);
      if (previous) previous.value = '';
      const draft: MaaSecretDraft = { value: '' };
      drafts.set(name, draft);
      const reference = await secretKey(projectScope(profile, scope), key, input.name);
      if (!panel.alive() || !isCurrent() || !row.isConnected || drafts.get(name) !== draft) return;
      draft.edit = { key: reference,
        expectedRevision: profile.protectedInputs?.find(item => item.key === reference)?.revision ?? 0, intent: 'clear' };
      profile.options[key] = { ...(profile.options[key] as Record<string, unknown>), [input.name]: { $maaSecret: reference } };
      changed(true);
    });
  }
}
