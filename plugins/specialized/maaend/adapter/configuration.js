'use strict';

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
