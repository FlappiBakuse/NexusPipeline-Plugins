import { button, field, paragraph, type Panel } from '../../../frontend-ui/src/elements.js';
import type { MaaProfile } from './ports.js';
import { record, text } from './project-client.js';
import { bindLocale } from '../../../frontend-ui/src/localize.js';

export function readRuntime(value: unknown): Pick<MaaProfile, 'nativeDirectory' | 'runtimeInputs'> {
  if (value == null) return { nativeDirectory: '', runtimeInputs: null };
  const runtime = record(value);
  if (runtime.Directories != null && !Array.isArray(runtime.Directories)) throw Error('maa_runtime_selection_invalid');
  return { nativeDirectory: runtime.NativeDirectory == null ? '' : text(runtime.NativeDirectory), runtimeInputs: {
    executables: Object.entries(record(runtime.Executables ?? {})).map(([program, path]) => ({ program, path: text(path) })),
    directories: ((runtime.Directories ?? []) as unknown[]).map(text)
  } };
}

export function runtimeSelection(profile: MaaProfile): Record<string, unknown> | undefined {
  const inputs = profile.runtimeInputs;
  if (!profile.nativeDirectory && !inputs?.executables.length && !inputs?.directories.length) return undefined;
  const executables: Record<string, string> = Object.create(null);
  if ((inputs?.executables.length ?? 0) > 32 || (inputs?.directories.length ?? 0) > 32)
    throw Error('运行程序和附加目录分别最多 32 项');
  for (const item of inputs?.executables ?? []) {
    if (!item.program.trim() || !item.path.trim() || Object.hasOwn(executables, item.program))
      throw Error('请填写不重复的程序名称和相对路径');
    executables[item.program] = item.path;
  }
  if (inputs?.directories.some(path => !path.trim())) throw Error('请填写附加运行目录的相对路径');
  return { NativeDirectory: profile.nativeDirectory || null, Executables: executables,
    Directories: [...(inputs?.directories ?? [])] };
}

export function drawRuntime(panel: Panel, parent: HTMLElement, profile: MaaProfile, changed: (redraw?: boolean) => void): void {
  const section = document.createElement('details');
  section.className = 'maa-runtime-inputs';
  const summary = document.createElement('summary');
  bindLocale(panel.t, panel.signal, summary, 'textContent', () => { summary.textContent = panel.t('项目运行文件'); });
  section.append(summary);
  parent.append(section);
  paragraph(section, panel.t('路径相对于所选脚本目录；保存不会启动程序或安装依赖。'));
  const inputs = profile.runtimeInputs ??= { executables: [], directories: [] };
  section.open = inputs.executables.length > 0 || inputs.directories.length > 0;
  inputs.executables.forEach((item, index) => {
    const row = document.createElement('div');
    row.className = 'maa-runtime-program';
    section.append(row);
    field(panel, row, '项目程序名称', item.program, value => { item.program = value; changed(); });
    field(panel, row, '程序或解释器相对路径', item.path, value => { item.path = value; changed(); });
    button(panel, row, '移除程序', () => { inputs.executables.splice(index, 1); changed(true); });
  });
  button(panel, section, '添加运行程序', () => {
    if (inputs.executables.length >= 32) throw Error('运行程序和附加目录分别最多 32 项');
    inputs.executables.push({ program: '', path: '' }); changed(true);
  });
  inputs.directories.forEach((directory, index) => {
    const row = document.createElement('div');
    row.className = 'maa-runtime-directory';
    section.append(row);
    field(panel, row, '附加运行目录', directory, value => { inputs.directories[index] = value; changed(); });
    button(panel, row, '移除目录', () => { inputs.directories.splice(index, 1); changed(true); });
  });
  button(panel, section, '添加运行目录', () => {
    if (inputs.directories.length >= 32) throw Error('运行程序和附加目录分别最多 32 项');
    inputs.directories.push(''); changed(true);
  });
}
