import { button, choice, field, paragraph, toggle, type Panel } from '../../../frontend-ui/src/elements.js';
import type { MaaOption, MaaProfile, MaaSchema } from './ports.js';
import { secretKey, projectScope, type MaaSecretDraft, type MaaSecretDrafts } from './secret-drafts.js';
import { bindLocale } from '../../../frontend-ui/src/localize.js';

export function activeOptions(schema: MaaSchema, profile: MaaProfile, selectedRoots?: readonly string[]): string[] {
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

export function optionFields(
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
    if (!allowSecretEdits) { paragraph(parent, label + '：' + panel.t('脚本项目的受保护字段请在账号绑定中配置。')); continue; }
    drafts.activate(name);
    field(
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
    const status = paragraph(row, '');
    const refresh = () => {
      const binding = (profile.options[key] as Record<string, unknown> | undefined)?.[input.name] as { $maaSecret?: string } | undefined;
      const state = profile.protectedInputs?.find(item => item.key === binding?.$maaSecret);
      status.textContent = panel.t(drafts.get(name)?.edit?.intent === 'set' ? '新密钥仅在确认保存后写入' :
        drafts.get(name)?.edit?.intent === 'clear' ? '清除仅在确认保存后生效' : state?.isConfigured ?
          state.isReadable ? '已配置受保护密钥' : '受保护密钥当前不可读取' : '未配置受保护密钥');
    };
    bindLocale(panel.t, panel.signal, status, 'text', refresh);
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
