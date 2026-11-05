'use strict';

function maasDefaultOptions(config, names, ancestors = []) {
  if (ancestors.length > 32) throw new Error('maas_option_dependency_cycle');
  return names.map(name => {
    if (ancestors.includes(name)) throw new Error('maas_option_dependency_cycle');
    const definition = config.options[name];
    if (!definition) throw new Error('maas_option_definition_missing:' + name);
    const type = definition.type?.toLowerCase() ?? 'select', option = { name }, cases = definition.cases ?? [];
    let active = [];
    if (type === 'checkbox') {
      const selected = maasArray(definition.default_case ?? definition.default_cases);
      if (!Array.isArray(selected) || selected.some(value => typeof value !== 'string' || !cases.some(item => item.name === value)))
        throw new Error('maas_default_case_invalid');
      option.selected_cases = selected.slice(); active = cases.filter(item => selected.includes(item.name));
    } else if (['select', 'switch'].includes(type)) {
      const index = cases.findIndex(item => item.name === definition.default_case);
      if (!cases.length) throw new Error('maas_default_case_invalid');
      option.index = Math.max(0, index); active = [cases[option.index]];
    } else if (['input', 'hotkey'].includes(type)) {
      option.data = {};
      for (const field of type === 'input' ? definition.inputs ?? [] : definition.hotkeys ?? []) {
        if (typeof field.name !== 'string' || field.password === true) throw new Error('maas_default_input_requires_owner');
        const value = field.default ?? '';
        if (typeof value !== 'string') throw new Error('maas_default_input_invalid');
        Object.defineProperty(option.data, field.name, { value, enumerable: true, configurable: true, writable: true });
      }
    } else throw new Error('maas_option_type_unsupported');
    const children = [...new Set(active.flatMap(item => maasArray(item.option)))];
    if (cases.length) option.sub_options = maasDefaultOptions(config, children, [...ancestors, name]);
    return option;
  });
}

function maasOverlayPlan(config) {
  if (!Number.isSafeInteger(config.main.revision) || config.main.revision < 1 || !/^[a-f0-9]{64}$/.test(config.main.sha256))
    throw new Error('maas_overlay_resource_unbound');
  if (config.localTasks && !config.rows.some(row => row.index === null)) return null;
  const tasks = config.rows.map(row => {
    const task = JSON.parse(JSON.stringify(row.item));
    if (row.index === null) {
      task.default_check = row.enabled;
      task.option = maasDefaultOptions(config, maasArray(row.definition.option));
    }
    return task;
  });
  const history = [], add = text => {
    const value = text.includes('<|||>') ? text : text.replace(':', '<|||>');
    if (!history.includes(value)) history.push(value);
  };
  for (const item of config.get('CurrentTasks', [])) add(item);
  for (const task of tasks) add(maasKey(task));
  const read = key => ({ key, exists: maasOwn(config.instance, key),
    ...(maasOwn(config.instance, key) ? { before: JSON.parse(JSON.stringify(config.instance[key])) } : {}) });
  if (config.resourceBindings.some(item => !/^[a-f0-9]{64}$/.test(item.sha256))) throw new Error('maas_overlay_source_unbound');
  return { resourceId: config.main.resourceId, revision: config.main.revision, sourceSha256: config.main.sha256,
    sources: JSON.parse(JSON.stringify(config.resourceBindings)),
    reads: [read('TaskItems'), read('CurrentTasks')], values: { TaskItems: tasks, CurrentTasks: history } };
}
