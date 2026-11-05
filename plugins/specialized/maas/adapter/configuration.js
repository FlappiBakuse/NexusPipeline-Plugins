'use strict';

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
