'use strict';

function maaDataSame(left, right) {
  if (left === right) return true;
  if (left === null || right === null || typeof left !== 'object' || typeof right !== 'object') return false;
  if (Array.isArray(left) !== Array.isArray(right)) return false;
  const keys = Object.keys(left);
  return keys.length === Object.keys(right).length && keys.every(key =>
    Object.prototype.hasOwnProperty.call(right, key) && maaDataSame(left[key], right[key]));
}

function maaDataResource(input, id, prefix) {
  const resources = input.resources ?? [];
  if (!Array.isArray(resources) || new Set(resources.map(item => item.resourceId)).size !== resources.length)
    throw new Error(prefix + '_resource_identity_invalid');
  const matches = resources.filter(item => item.resourceId === id);
  if (matches.length !== 1) throw new Error(prefix + '_resource_required');
  return matches[0];
}

function maaDataMetadata(prefix, project, imports) {
  if (typeof nexusReadSource !== 'function') throw new Error(prefix + '_readonly_source_required');
  const entries = ['interface.json', 'interface.jsonc', 'assets/interface.json', 'assets/interface.jsonc'];
  const found = entries.map(path => ({ path, text: nexusReadSource(path) })).filter(item => item.text !== 'null');
  if (found.length !== 1) throw new Error(prefix + '_interface_ambiguous_or_missing');
  const root = found[0].path.startsWith('assets/') ? 'assets/' : '';
  const pi = JSON.parse(found[0].text), diagnostics = [], visited = new Set();
  if (pi.name !== project) throw new Error(prefix + '_interface_project_unbound');
  const tasks = [...(pi.task ?? [])], presets = [...(pi.preset ?? [])], options = { ...(pi.option ?? {}) };
  const pretasks = [].concat(pi.pretask ?? []);
  const read = path => {
    if (typeof path !== 'string' || !imports.includes(path)) {
      diagnostics.push(prefix + '_unknown_import_preserved');
      return null;
    }
    if (visited.has(path)) return null;
    visited.add(path);
    const text = nexusReadSource(root + path);
    if (text === 'null') { diagnostics.push(prefix + '_declared_import_unavailable'); return null; }
    return JSON.parse(text);
  };
  const pending = [...(pi.import ?? [])];
  while (pending.length) {
    const part = read(pending.shift());
    if (!part) continue;
    tasks.push(...(part.task ?? [])); presets.push(...(part.preset ?? []));
    pretasks.push(...[].concat(part.pretask ?? []));
    for (const [name, value] of Object.entries(part.option ?? {})) {
      if (Object.prototype.hasOwnProperty.call(options, name) && !maaDataSame(options[name], value))
        throw new Error(prefix + '_option_definition_ambiguous');
      Object.defineProperty(options, name, { value, enumerable: true, configurable: true, writable: true });
    }
    pending.push(...(part.import ?? []));
  }
  if (new Set(tasks.map(task => task.name + '\u0000' + task.entry)).size !== tasks.length)
    throw new Error(prefix + '_task_definition_ambiguous');
  let translations = {};
  const language = pi.languages?.zh_cn;
  if (typeof language === 'string' && imports.includes(language)) {
    const text = nexusReadSource(root + language);
    if (text !== 'null') translations = JSON.parse(text);
  }
  return { pi: { ...pi, task: tasks, preset: presets, option: options }, pretasks, translations, diagnostics };
}

function maaDataDiagnostics(config, prefix) {
  const diagnostics = (config.sourceDiagnostics ?? []).map(code => ({ code, severity: 'warning', resourceId: config.main.resourceId }));
  if (config.rows.some(row => !row.known)) diagnostics.push({ code: prefix + '_unknown_task_preserved', severity: 'warning', resourceId: config.main.resourceId });
  return diagnostics;
}

function maaDataNativeTask(text, processId, prefix) {
  const match = /^\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3}\]\[INF\]\[Px(\d+)\]\[Tx\d+\]\[Utils\/EventDispatcher\.hpp\]\[L\d+\]\[MaaNS::EventDispatcher::notify\] !!!OnEventNotify!!! \[handle=true\] \[msg=Tasker\.Task\.(Starting|Succeeded|Failed)\] \[details=(\{.*\})\]\s*$/.exec(text);
  if (!match || Number(match[1]) !== processId) return null;
  const value = strictConfigurationJson(match[3], prefix);
  if (typeof value.entry !== 'string' || !Number.isSafeInteger(value.task_id) || value.task_id < 1 ||
      typeof value.hash !== 'string' || !/^[0-9a-f]{16}$/i.test(value.hash) ||
      typeof value.uuid !== 'string' || !/^[0-9a-f]{16}$/i.test(value.uuid)) throw new Error(prefix + '_native_task_identity_unbound');
  return { kind: match[2], entry: value.entry, id: value.task_id, scope: JSON.stringify([value.hash, value.uuid]) };
}
