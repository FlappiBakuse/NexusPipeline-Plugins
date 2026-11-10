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

function maaObservationTasks(input, tasks, prefix) {
  if (input.selectedTaskIds === undefined) return tasks;
  const ids = input.selectedTaskIds;
  if (!Array.isArray(ids) || new Set(ids).size !== ids.length || ids.some(id => !tasks.some(task => task.taskId === id && task.isSelected && task.isEnabled)))
    throw new Error(prefix + '_observation_selection_unbound');
  return tasks.map(task => ({ ...task, isSelected: task.isSelected && ids.includes(task.taskId) }));
}
