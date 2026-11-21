'use strict';

function maaendOptionValue(config, row, key, values = row.saved.optionValues ?? {}) {
  const definition = config.options[key];
  if (!definition) return null;
  const saved = values[key], cases = definition.cases ?? [];
  if (definition.type === 'switch') {
    const active = saved?.type === 'switch' && typeof saved.value === 'boolean' ? saved.value :
      definition.default_case === 'Yes' || definition.default_case === cases[0]?.name;
    const accepted = active ? ['Yes', 'yes', 'Y', 'y'] : ['No', 'no', 'N', 'n'];
    return cases.find(item => accepted.includes(item.name)) || null;
  }
  if (!definition.type || definition.type === 'select') {
    const name = saved?.type === 'select' && cases.some(item => item.name === saved.caseName)
      ? saved.caseName : definition.default_case || cases[0]?.name;
    return cases.find(item => item.name === name) || null;
  }
  return null;
}

function maaendReachableOptions(config, row, values = row.saved.optionValues ?? {}) {
  const reachable = [], visiting = new Set();
  function visit(key, depth) {
    if (depth > 32 || visiting.has(key)) throw new Error('maaend_option_dependency_cycle');
    if (reachable.includes(key)) return;
    const definition = config.options[key];
    if (!definition) throw new Error('maaend_option_definition_missing:' + key);
    if (definition.type !== undefined && !['select', 'switch', 'checkbox', 'input', 'hotkey'].includes(definition.type))
      throw new Error('maaend_option_type_unsupported');
    if (definition.controller?.length && !definition.controller.includes(config.controller.name) ||
        definition.resource?.length && !definition.resource.includes(config.resource.name)) return;
    visiting.add(key); reachable.push(key);
    let cases = [];
    if (definition.type === 'checkbox') {
      const saved = values[key], names = saved?.type === 'checkbox' ? saved.caseNames : definition.default_case ?? [];
      if (!Array.isArray(names) || names.some(name => typeof name !== 'string')) throw new Error('maaend_checkbox_value_invalid');
      cases = (definition.cases ?? []).filter(item => names.includes(item.name));
    } else {
      const active = maaendOptionValue(config, row, key, values);
      if (active) cases = [active];
    }
    for (const selected of cases) for (const child of selected.option ?? []) visit(child, depth + 1);
    visiting.delete(key);
  }
  for (const key of row.definition?.option ?? []) visit(key, 0);
  return reachable;
}

function maaendValidOption(config, key, value) {
  const definition = config.options[key];
  if (!definition || !maaendObject(value)) return false;
  if (definition.type === 'switch') return value.type === 'switch' && typeof value.value === 'boolean';
  if (!definition.type || definition.type === 'select')
    return value.type === 'select' && definition.cases?.some(item => item.name === value.caseName);
  if (definition.type === 'checkbox') {
    const names = value.caseNames;
    return value.type === 'checkbox' && Array.isArray(names) && new Set(names).size === names.length &&
      names.every(name => definition.cases?.some(item => item.name === name)) &&
      (definition.min_count === undefined || names.length >= definition.min_count) &&
      (definition.max_count === undefined || names.length <= definition.max_count);
  }
  if (['input', 'hotkey'].includes(definition.type)) {
    const fields = definition.inputs ?? definition.hotkeys ?? [];
    return value.type === definition.type && maaendObject(value.values) && Object.keys(value.values).every(name => fields.some(item => item.name === name)) &&
      fields.every(field => typeof value.values[field.name] === 'string' && value.values[field.name].length <= 4096 &&
        maaendInputConstraint(key, field, value.values[field.name]));
  }
  return false;
}

function maaendInputConstraint(option, field, value) {
  if (!field.verify) return true;
  if (option === 'LaunchGamePCLauncherExe' && field.name === 'LauncherExe')
    return /^"?.+[\\/][Ll]auncher\.exe"?$/.test(value);
  if (field.verify === '^\\d+$') return /^\d+$/.test(value);
  if (field.verify === '^[1-9]\\d*$') return /^[1-9]\d*$/.test(value);
  if (field.verify === '^\\d+(\\.\\d+)?$') return /^\d+(\.\d+)?$/.test(value);
  return false;
}

function maaendOptionEdits(config, row, value) {
  if (!maaendObject(value)) return false;
  const previous = row.saved.optionValues ?? {}, reachable = maaendReachableOptions(config, row, value);
  const keys = new Set([...Object.keys(previous), ...Object.keys(value)]);
  for (const key of keys) {
    if (JSON.stringify(previous[key]) === JSON.stringify(value[key])) continue;
    if (!reachable.includes(key) || !maaendValidOption(config, key, value[key])) return false;
  }
  return true;
}

function maaendTaskSelector(config, row, field) {
  return ['instances', { match: { property: 'id', value: config.instance.id } }, 'tasks',
    { match: { property: 'id', value: row.saved.id } }, field];
}

function maaendAllowedEdit(config, selector, value) {
  if (!Array.isArray(selector) || selector.length < 5 || selector[0] !== 'instances' || selector[2] !== 'tasks' ||
      JSON.stringify(selector[1]) !== JSON.stringify({ match: { property: 'id', value: config.instance.id } })) return false;
  const row = config.rows.find(item => JSON.stringify(selector[3]) === JSON.stringify({ match: { property: 'id', value: item.saved.id } }));
  if (!row?.known) return false;
  if (selector.length === 5 && selector[4] === 'enabled') return typeof value === 'boolean';
  if (selector.length === 5 && selector[4] === 'customName') return typeof value === 'string' && value.length <= 256;
  if (selector.length === 5 && selector[4] === 'optionValues') return maaendOptionEdits(config, row, value);
  if (selector.length === 6 && selector[4] === 'enabledByController')
    return typeof row.saved.enabledByController?.[selector[5]] === 'boolean' && typeof value === 'boolean' &&
      (selector[5] === config.controller.name || row.saved.taskName === '__MXU_POWER__' && value === false);
  if (selector.length === 6 && selector[4] === 'optionValues') {
    const values = { ...(row.saved.optionValues ?? {}), [selector[5]]: value };
    return maaendOptionEdits(config, row, values);
  }
  return false;
}

function maaendResolve(document, selector) {
  let value = document;
  for (const step of selector) {
    if (typeof step === 'string' || Number.isInteger(step)) {
      if (value === null || !maaendOwn(value, step)) throw new Error('maaend_selector_missing');
      value = value[step];
    } else if (maaendObject(step?.match) && Array.isArray(value)) {
      const matches = value.filter(item => item?.[step.match.property] === step.match.value);
      if (matches.length !== 1) throw new Error('maaend_selector_ambiguous');
      value = matches[0];
    } else throw new Error('maaend_selector_invalid');
  }
  return value;
}

function maaendIntents(input, config) {
  const intents = input.configurationIntents ?? [];
  if (!Array.isArray(intents) || intents.length > 1) throw new Error('maaend_configuration_intent_identity');
  if (!intents.length) return [];
  const patch = intents[0], resource = config.main;
  if (patch.format !== 'nexus.config.patch' || patch.version !== 1 || patch.operationId !== input.operationId || patch.resourceId !== resource.resourceId ||
      !Number.isSafeInteger(resource.revision) || resource.revision < 1 || patch.expectedRevision !== resource.revision ||
      patch.sourceSha256 !== resource.sha256 || !Array.isArray(patch.edits) || !patch.edits.length || patch.edits.length > 256)
    throw new Error('maaend_configuration_intent_unbound');
  const document = JSON.parse(JSON.stringify(config.document)), seen = [], changedSelection = new Set();
  for (const edit of patch.edits) {
    if (!maaendAllowedEdit(config, edit.selector, edit.value) || seen.some(selector =>
      selector.length <= edit.selector.length && selector.every((part, index) => JSON.stringify(part) === JSON.stringify(edit.selector[index])) ||
      edit.selector.length <= selector.length && edit.selector.every((part, index) => JSON.stringify(part) === JSON.stringify(selector[index]))))
      throw new Error('maaend_configuration_edit_not_supported');
    const previous = maaendResolve(document, edit.selector);
    if (JSON.stringify(previous) !== JSON.stringify(edit.expected)) throw new Error('maaend_configuration_edit_conflict');
    const parent = maaendResolve(document, edit.selector.slice(0, -1));
    parent[edit.selector[edit.selector.length - 1]] = edit.value;
    seen.push(edit.selector);
    if (['enabled', 'enabledByController'].includes(edit.selector[4])) changedSelection.add(edit.selector[3].match.value);
  }
  const instance = document.instances.find(item => item.id === config.instance.id);
  for (const task of instance.tasks.filter(item => changedSelection.has(item.id))) {
    const cached = task.enabledByController?.[config.controller.name];
    if (typeof cached === 'boolean' && cached !== task.enabled) throw new Error('maaend_controller_cache_requires_same_selection');
  }
  return intents;
}

function maaendConfiguration(input, config, targetReady) {
  const diagnostics = maaDataDiagnostics(config, 'maaend'), configPatches = [], edits = [];
  const add = (code, severity = 'blocking') => diagnostics.push({ code, resourceId: config.main.resourceId, severity });
  if (config.instance.controllerName !== config.controller.name) add('maaend_controller_default_used', 'warning');
  if (config.instance.resourceName !== config.resource.name) add('maaend_resource_default_used', 'warning');
  for (const row of config.rows) {
    if (!row.known && row.saved.enabled) add(MAAEND_RETIRED.includes(row.saved.taskName) ? 'maaend_retired_task_not_imported' : 'maaend_task_definition_missing', 'warning');
    if (row.known && !row.compatible && row.saved.enabled) add('maaend_task_incompatible', 'warning');
    if (row.known && row.compatible && row.saved.enabled) maaendReachableOptions(config, row);
    if (row.saved.taskName === '__MXU_POWER__') {
      if (row.saved.enabled) edits.push({ selector: maaendTaskSelector(config, row, 'enabled'), expected: true, value: false });
      for (const [controller, enabled] of Object.entries(row.saved.enabledByController ?? {}))
        if (enabled === true) edits.push({ selector: [...maaendTaskSelector(config, row, 'enabledByController'), controller], expected: true, value: false });
    }
  }
  if (edits.length) {
    add('maaend_power_action_requires_host_policy');
    if (!input.configurationIntents?.length && Number.isSafeInteger(config.main.revision) && config.main.revision >= 1)
      configPatches.push({ format: 'nexus.config.patch', version: 1, operationId: input.operationId, resourceId: config.main.resourceId,
        sourceSha256: config.main.sha256, expectedRevision: config.main.revision, edits });
  }
  if (config.controller.type === 'Win32' && targetReady !== true) {
    const launch = config.rows.filter(row => row.saved.taskName === '__MXU_PRETASK__LaunchGamePC' && row.saved.enabled && row.compatible);
    if (launch.length !== 1) add('maaend_launch_game_pc_pretask_required');
    else {
      const choice = maaendOptionValue(config, launch[0], 'LaunchGamePCLauncherPath');
      if (choice?.name === 'Manual') {
        const path = launch[0].saved.optionValues?.LaunchGamePCLauncherExe?.values?.LauncherExe;
        if (typeof path !== 'string' || !/^"?.+[\\/][Ll]auncher\.exe"?$/.test(path.trim())) add('maaend_manual_launcher_invalid');
      } else if (choice?.name !== 'Auto') add('maaend_launcher_mode_unknown');
    }
  }
  if (config.document.instances.some(instance => instance.id !== config.instance.id && instance.schedulePolicies?.some(policy => policy.enabled)))
    add('maaend_other_instance_schedule_ambiguous');
  const intents = maaendIntents(input, config);
  return { diagnostics, configPatches: intents.length ? intents : configPatches };
}
