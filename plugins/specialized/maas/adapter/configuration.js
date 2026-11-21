'use strict';

function maasOptionList(value) {
  const list = maasArray(value);
  if (!Array.isArray(list)) throw new Error('maas_option_list_invalid');
  return list.map(item => typeof item === 'string' ? { name: item, index: 0 } : item);
}

function maasInputValue(field, value) {
  if (typeof value !== 'string' || value.length > 4096) return false;
  if (field.pipeline_type === 'int' && (!/^-?\d+$/.test(value) || !Number.isSafeInteger(Number(value)))) return false;
  if (field.pipeline_type === 'float' && (!/^-?\d+(?:\.\d+)?$/.test(value) || !Number.isFinite(Number(value)))) return false;
  if (!field.verify) return true;
  if (field.verify === '^[1-9]\\d*$') return /^[1-9]\d*$/.test(value);
  if (['^\\d+$', '^[0-9]+$'].includes(field.verify)) return /^\d+$/.test(value);
  if (field.verify === '\\d+') return /\d+/.test(value);
  if (field.verify === '^(0|[1-9])(\\.\\d{1,2})?$') return /^(0|[1-9])(\.\d{1,2})?$/.test(value);
  if (field.verify === '^(0(\\.\\d{1,2})?|1(\\.0{1,2})?)$') return /^(0(\.\d{1,2})?|1(\.0{1,2})?)$/.test(value);
  if (field.verify === '^\\d{1,2}$') return /^\d{1,2}$/.test(value);
  return false;
}

function maasOptionChanges(config, oldValue, newValue, allowed, ancestors = []) {
  const before = maasOptionList(oldValue), after = maasOptionList(newValue);
  if (before.length > after.length || after.some(item => !maasObject(item)) || new Set(after.map(item => item.name)).size !== after.length ||
      before.some((item, index) => !maasObject(item) || item.name !== after[index].name)) return false;
  for (let i = 0; i < after.length; i++) {
    const item = after[i], previous = before[i] ?? { name: item.name };
    if (JSON.stringify(previous) === JSON.stringify(item)) continue;
    if (!allowed.includes(item.name) || ancestors.includes(item.name)) return false;
    const definition = config.options[item.name];
    if (!definition || maasArray(definition.controller).length && !maasArray(definition.controller).includes(config.controller.name) ||
        maasArray(definition.resource).length && !maasArray(definition.resource).includes(config.resource.name)) return false;
    const type = definition.type?.toLowerCase() ?? 'select', fields = ['index', 'selected_cases', 'data', 'sub_options'];
    if (Object.keys({ ...previous, ...item }).some(key => !fields.includes(key) && JSON.stringify(previous[key]) !== JSON.stringify(item[key]))) return false;
    const cases = definition.cases ?? [], chosen = [];
    if (['select', 'switch'].includes(type)) {
      const index = item.index ?? Math.max(0, cases.findIndex(row => row.name === definition.default_case));
      if (!Number.isInteger(index) || index < 0 || index >= cases.length) return false;
      chosen.push(cases[index]);
      if (JSON.stringify(previous.selected_cases) !== JSON.stringify(item.selected_cases) || JSON.stringify(previous.data) !== JSON.stringify(item.data)) return false;
    } else if (type === 'checkbox') {
      const selected = maasArray(item.selected_cases ?? definition.default_cases);
      if (!Array.isArray(selected) || new Set(selected).size !== selected.length || selected.some(name => !cases.some(row => row.name === name))) return false;
      chosen.push(...cases.filter(row => selected.includes(row.name)));
      if (JSON.stringify(previous.index) !== JSON.stringify(item.index) || JSON.stringify(previous.data) !== JSON.stringify(item.data)) return false;
    } else if (['input', 'hotkey'].includes(type)) {
      if (!maasObject(item.data) || JSON.stringify(previous.index) !== JSON.stringify(item.index) ||
          JSON.stringify(previous.selected_cases) !== JSON.stringify(item.selected_cases)) return false;
      const inputs = type === 'input' ? definition.inputs ?? [] : definition.hotkeys ?? [];
      for (const key of Object.keys({ ...previous.data, ...item.data })) {
        if (JSON.stringify(previous.data?.[key]) === JSON.stringify(item.data[key])) continue;
        const field = inputs.find(row => row.name === key);
        if (!field || !maasInputValue(field, item.data[key])) return false;
      }
    } else return false;
    const reachable = chosen.flatMap(row => maasArray(row.option));
    if (!maasOptionChanges(config, previous.sub_options, item.sub_options, reachable, [...ancestors, item.name])) return false;
  }
  return true;
}

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

function maasResolve(value, selector) {
  for (const key of selector) {
    if (!(typeof key === 'string' || Number.isInteger(key)) || value === null || value === undefined || !maasOwn(value, key))
      throw new Error('maas_selector_missing');
    value = value[key];
  }
  return value;
}

function maasAllowed(config, selector, value) {
  if (!Array.isArray(selector)) return false;
  if (selector.length === 1) {
    if (['TaskItems', 'CurrentTasks'].includes(selector[0])) {
      const plan = maasOverlayPlan(config);
      if (plan && maaDataSame(value, plan.values[selector[0]])) return true;
    }
    if (selector[0] === 'TaskItems' && config.localTasks && Array.isArray(value) && value.length === config.instance.TaskItems.length) {
      const remaining = config.instance.TaskItems.map(item => JSON.stringify(item));
      for (const item of value) { const index = remaining.indexOf(JSON.stringify(item)); if (index < 0) return false; remaining.splice(index, 1); }
      return remaining.length === 0;
    }
    if (selector[0] === 'SoftwarePath') return typeof value === 'string' && !!value.trim() && value.length <= 4096;
    if (selector[0] === 'BeforeTask') return ['None', 'StartupSoftwareAndScript', 'StartupScriptOnly'].includes(value);
    if (selector[0] === 'AfterTask') return ['None', 'CloseMFA', 'CloseEmulator', 'CloseEmulatorAndMFA'].includes(value);
    return false;
  }
  if (selector.length !== 3 || selector[0] !== 'TaskItems' || !Number.isInteger(selector[1]) || !config.localTasks) return false;
  const row = config.rows.find(item => item.index === selector[1]);
  if (!row?.known) return false;
  if (selector[2] === 'default_check') return typeof value === 'boolean' && (row.item.entry !== 'ComputerOperationAction' || value === false);
  if (selector[2] === 'repeat_count') return row.definition?.repeatable === true && Number.isSafeInteger(value) && value > 0 && value <= 100;
  if (['remark', 'display_name_override'].includes(selector[2])) return typeof value === 'string' && value.length <= 256;
  if (selector[2] === 'option') return maasOptionChanges(config, row.item.option, value,
    maasOptionList(row.definition?.option).map(item => item.name));
  return false;
}

function maasIntents(input, config) {
  const intents = input.configurationIntents ?? [];
  if (!Array.isArray(intents) || intents.length > 1) throw new Error('maas_configuration_intent_identity');
  if (!intents.length) return [];
  const patch = intents[0], resource = config.main, seen = [];
  if (patch.format !== 'nexus.config.patch' || patch.version !== 1 || patch.operationId !== input.operationId ||
      patch.resourceId !== resource.resourceId || patch.expectedRevision !== resource.revision || !Number.isSafeInteger(resource.revision) ||
      resource.revision < 1 || patch.sourceSha256 !== resource.sha256 || !Array.isArray(patch.edits) || !patch.edits.length || patch.edits.length > 256)
    throw new Error('maas_configuration_intent_unbound');
  for (const edit of patch.edits) {
    if (!maasAllowed(config, edit.selector, edit.value) || seen.some(selector =>
      selector.length <= edit.selector.length && selector.every((part, index) => part === edit.selector[index]) ||
      edit.selector.length <= selector.length && edit.selector.every((part, index) => part === selector[index])))
      throw new Error('maas_configuration_edit_not_supported');
    const missing = edit.expectedExists === false;
    if (missing && (edit.selector.length !== 1 || maasOwn(config.instance, edit.selector[0]) || edit.expected !== null ||
        !['TaskItems', 'CurrentTasks', 'AfterTask'].includes(edit.selector[0]))) throw new Error('maas_configuration_edit_conflict');
    const previous = missing ? null : maasResolve(config.instance, edit.selector);
    if (!maaDataSame(previous, edit.expected)) throw new Error('maas_configuration_edit_conflict');
    seen.push(edit.selector);
  }
  return intents;
}

function maasConfiguration(input, config) {
  const diagnostics = maaDataDiagnostics(config, 'maas'), edits = [], add = (code, severity = 'blocking') => diagnostics.push({ code, severity, resourceId: config.main.resourceId });
  if (config.requested !== config.cfg) add('maas_missing_profile_default_used', 'warning');
  if (!config.localTasks) add('maas_local_task_items_required');
  if (config.rows.some(row => row.index === null)) add('maas_new_defaults_require_native_materialization');
  if (config.rows.some(row => !row.known && row.enabled)) add('maas_unknown_task_preserved', 'warning');
  if (config.controller.type === 'PlayCover') add('maas_controller_unsupported_on_windows');
  const finish = config.get('AfterTask', 'None');
  if (!['None', 'CloseMFA', 'CloseEmulator', 'CloseEmulatorAndMFA'].includes(finish)) {
    add('maas_finish_action_requires_host_policy');
    edits.push({ selector: ['AfterTask'], expected: config.instance.AfterTask ?? null, ...(maasOwn(config.instance, 'AfterTask') ? {} : { expectedExists: false }), value: 'None' });
  }
  for (const row of config.rows) {
    if (row.item.entry === 'ComputerOperationAction' && row.enabled) {
      add('maas_computer_operation_requires_host_policy');
      if (config.localTasks && row.index !== null && maasOwn(row.item, 'default_check'))
        edits.push({ selector: ['TaskItems', row.index, 'default_check'], expected: row.item.default_check, value: false });
    }
  }
  const intents = maasIntents(input, config);
  const overlay = maasOverlayPlan(config);
  if (!intents.length && !edits.length && overlay) for (const key of ['TaskItems', 'CurrentTasks']) {
    const before = overlay.reads.find(item => item.key === key);
    if (!before.exists || !maaDataSame(before.before, overlay.values[key])) edits.push({ selector: [key],
      expected: before.exists ? before.before : null, ...(before.exists ? {} : { expectedExists: false }), value: overlay.values[key] });
  }
  const configPatches = intents.length ? intents : edits.length && Number.isSafeInteger(config.main.revision) && config.main.revision > 0 ? [{
    format: 'nexus.config.patch', version: 1, operationId: input.operationId, resourceId: config.main.resourceId,
    sourceSha256: config.main.sha256, expectedRevision: config.main.revision, edits }] : [];
  return { diagnostics, configPatches };
}
