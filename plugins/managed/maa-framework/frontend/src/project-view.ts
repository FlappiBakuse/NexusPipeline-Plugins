import type { MaaOccurrence, MaaOption, MaaProfile, MaaSchema } from './ports.js';
import { record, text } from './project-client.js';
import { readRuntime, runtimeSelection } from './runtime-inputs.js';

function rows(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) throw new Error('maa_editor_response_invalid');
  return value.map(record);
}
function strings(value: unknown): string[] {
  return value == null ? [] : typeof value === 'string' ? [value] : (value as unknown[]).map(text);
}

export function schemaView(index: Record<string, unknown>): MaaSchema {
  const schema = record(index.schema), translations = record(index.translations);
  const label = (row: Record<string, unknown>): string => {
    const value = typeof row.label === 'string' ? row.label : typeof row.name === 'string' ? row.name : '';
    return value.startsWith('$') && typeof translations[value.slice(1)] === 'string' ? text(translations[value.slice(1)]) : value;
  };
  const refs = (row: Record<string, unknown>) => ({ controller: strings(row.controller), resource: strings(row.resource), options: strings(row.option) });
  const task = (row: Record<string, unknown>) => ({ name: text(row.name), label: label(row), ...refs(row),
    defaultCheck: row.default_check === true, repeatable: row.repeatable === true, groups: strings(row.group) });
  const options: Record<string, MaaOption> = Object.create(null);
  for (const [name, value] of Object.entries(record(schema.option))) {
    const option = record(value), type = option.type == null ? 'select' : text(option.type);
    if (!['select', 'switch', 'checkbox', 'input', 'hotkey'].includes(type)) throw new Error('maa_editor_option_unsupported');
    const inputs = (value: unknown) => rows(value ?? []).map(input => ({ name: text(input.name), label: label(input),
      password: input.password === true, default: typeof input.default === 'string' ? input.default : undefined }));
    options[name] = { label: label(option), type: type as MaaOption['type'], ...refs(option),
      defaultCase: option.default_case as string | string[] | undefined,
      cases: rows(option.cases ?? []).map(item => ({ name: text(item.name), label: label(item), options: strings(item.option) })),
      inputs: inputs(option.inputs), hotkeys: inputs(option.hotkeys) };
  }
  return { projectName: label(schema), projectVersion: typeof schema.version === 'string' ? schema.version : '',
    controllers: rows(schema.controller).map(row => ({ name: text(row.name), label: label(row), ...refs(row),
      type: row.type === 'Win32' || row.type === 'Adb' ? row.type : 'Other' })),
    resources: rows(schema.resource).map(row => ({ name: text(row.name), label: label(row), ...refs(row) })),
    tasks: rows(schema.task).map(task), pretasks: rows(schema.pretask ?? []).map(task),
    settings: rows(schema.setting ?? []).map(row => ({ name: text(row.name), label: label(row), options: strings(row.option) })),
    groups: rows(schema.group ?? []).map(row => ({ name: text(row.name), label: label(row) })),
    options, globalOptions: strings(schema.global_option),
    presets: rows(schema.preset ?? []).map(row => ({ name: text(row.name), label: label(row) })) };
}

export function profileView(index: Record<string, unknown>, id: string, revision: string, root: string): MaaProfile {
  const selected = record(index.selection), source = record(selected.Source), saved = record(index.profile);
  const occurrences = (value: unknown): MaaOccurrence[] => rows(value).map(row => ({
    occurrenceId: text(row.Id), taskName: typeof row.Name === 'string' ? row.Name : '未知任务 · ' + text(row.SourceId),
    sourceTaskId: text(row.SourceId), order: Number(row.Order), enabled: row.Enabled === true,
    repeatCount: Number(row.RepeatCount), options: structuredClone(record(row.Options)), pipelineOverride: {},
    definitionKnown: row.DefinitionKnown !== false
  }));
  return { schemaVersion: 1, profileId: id, revision, packageRoot: root,
    interfacePath: text(selected.InterfacePath), ...readRuntime(selected.Runtime), nativeVersion: '5.14.3', language: text(selected.Language),
    controller: text(saved.Controller), resource: text(saved.Resource), taskOccurrences: occurrences(saved.Tasks),
    pretaskOccurrences: occurrences(saved.Pretasks), options: structuredClone(record(saved.GlobalOptions)),
    resourceOptions: structuredClone(record(saved.ResourceOptions)), controllerOptions: structuredClone(record(saved.ControllerOptions)),
    windowSelection: 'exact_process', windowHandle: 0, windowProcessId: 0, windowExecutable: '', windowWaitMilliseconds: 10000,
    adbPath: '', adbSerial: '', sourceBinding: { sourceKind: text(source.Kind), sourcePath: text(source.Path),
      sourceInstanceId: text(source.InstanceId), interfaceRelativePath: text(selected.InterfacePath) },
    sourceSnapshot: { compilation: structuredClone(index.compilation), configurationBindings: structuredClone(index.configurationBindings) } };
}

export function selectionView(profile: MaaProfile): Record<string, unknown> {
  const source = profile.sourceBinding;
  if (!source?.sourcePath) throw new Error('maa_editor_source_required');
  const tasks = (items: readonly MaaOccurrence[]) => items.map(item => {
    const row: Record<string, unknown> = { Id: item.occurrenceId, Order: item.order, Enabled: item.enabled,
      RepeatCount: item.repeatCount, Options: structuredClone(item.options) };
    if (item.sourceTaskId) row.SourceId = item.sourceTaskId;
    if (item.definitionKnown !== false) row.Name = item.taskName;
    if (Object.keys(item.pipelineOverride).length) row.Pipeline = structuredClone(item.pipelineOverride);
    return row;
  });
  const draft: Record<string, unknown> = { Controller: profile.controller, Resource: profile.resource, Tasks: tasks(profile.taskOccurrences),
    GlobalOptions: structuredClone(profile.options), ResourceOptions: structuredClone(profile.resourceOptions),
    ControllerOptions: structuredClone(profile.controllerOptions) };
  if (profile.pretaskOccurrences) draft.Pretasks = tasks(profile.pretaskOccurrences);
  const runtime = runtimeSelection(profile);
  return { InterfacePath: profile.interfacePath, ClientKind: source.sourceKind, Language: profile.language,
    ...(runtime ? { Runtime: runtime } : {}),
    Source: { Kind: source.sourceKind, Path: source.sourcePath, InstanceId: source.sourceInstanceId }, Profile: draft };
}
