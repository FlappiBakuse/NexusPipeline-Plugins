'use strict';

function oknteResolve(value, selector) {
  for (const step of selector) {
    if (typeof step === 'string' || Number.isInteger(step)) {
      if (value === null || value === undefined || !oknteOwn(value, step)) throw new Error('oknte_selector_missing');
      value = value[step];
    } else if (Array.isArray(value) && oknteObject(step?.match)) {
      const matches = value.filter(item => item?.[step.match.property] === step.match.value);
      if (matches.length !== 1) throw new Error('oknte_selector_ambiguous');
      value = matches[0];
    } else throw new Error('oknte_selector_invalid');
  }
  return value;
}

function oknteAllowed(config, resourceId, selector, value) {
  if (!Array.isArray(selector)) return false;
  if (resourceId === 'devices') return selector.length === 1 && selector[0] === 'pc_full_path' && typeof value === 'string' && !!value.trim() && value.length <= 4096;
  if (resourceId === 'routine-configs') return selector.length === 2 && OKNTE_ITEMS.some(item => item.id === selector[0]) && oknteChildOption(selector[0], selector[1], value);
  if (resourceId !== 'main') return false;
  if (selector.length === 1 && selector[0] === '存在失败时发送 BOT 通知') return typeof value === 'boolean';
  if (selector.length === 3 && selector[0] === 'Routine Items' && selector[2] === 'enabled')
    return config.complete && typeof value === 'boolean' && selector[1]?.match?.property === 'id' && OKNTE_ITEMS.some(item => item.id === selector[1].match.value);
  if (selector.length === 1 && selector[0] === 'Routine Items' && config.complete && Array.isArray(value) && value.length === config.document['Routine Items'].length) {
    const remaining = config.document['Routine Items'].map(item => JSON.stringify(item));
    for (const item of value) { const index = remaining.indexOf(JSON.stringify(item)); if (index < 0) return false; remaining.splice(index, 1); }
    return true;
  }
  return false;
}

function oknteIntents(input, config) {
  const patches = input.configurationIntents ?? [], resources = new Set();
  if (!Array.isArray(patches) || patches.length > 3) throw new Error('oknte_configuration_intent_identity');
  for (const patch of patches) {
    const resource = input.resources.find(item => item.resourceId === patch.resourceId), seen = [];
    if (!resource || resources.has(resource.resourceId) || patch.format !== 'nexus.config.patch' || patch.version !== 1 || patch.operationId !== input.operationId ||
        !Number.isSafeInteger(resource.revision) || resource.revision < 1 || patch.expectedRevision !== resource.revision || patch.sourceSha256 !== resource.sha256 ||
        !Array.isArray(patch.edits) || !patch.edits.length || patch.edits.length > 256) throw new Error('oknte_configuration_intent_unbound');
    resources.add(resource.resourceId);
    const document = JSON.parse(JSON.stringify(config.documents[resource.resourceId]));
    for (const edit of patch.edits) {
      if (!oknteAllowed(config, resource.resourceId, edit.selector, edit.value) || seen.some(selector =>
        selector.length <= edit.selector.length && selector.every((part, index) => JSON.stringify(part) === JSON.stringify(edit.selector[index])) ||
        edit.selector.length <= selector.length && edit.selector.every((part, index) => JSON.stringify(part) === JSON.stringify(selector[index]))))
        throw new Error('oknte_configuration_edit_not_supported');
      if (JSON.stringify(oknteResolve(document, edit.selector)) !== JSON.stringify(edit.expected)) throw new Error('oknte_configuration_edit_conflict');
      const parent = oknteResolve(document, edit.selector.slice(0, -1)); parent[edit.selector.at(-1)] = edit.value; seen.push(edit.selector);
    }
    if (patch.resourceId === 'main' && patch.edits.some(edit => edit.selector[0] === 'Routine Items') &&
        document['Routine Items'].filter(item => ['daily_anomaly', 'daily_anomaly_hunter'].includes(item?.id) && item.enabled === true).length > 1)
      throw new Error('oknte_exclusive_group_requires_explicit_other_disable');
  }
  return patches;
}

function oknteConfiguration(input, config) {
  const diagnostics = [], add = (code, severity = 'blocking') => diagnostics.push({ code, resourceId: 'main', severity });
  if (!config.complete) add('oknte_complete_explicit_selection_required_for_retry', 'warning');
  if (config.rows.some(row => !row.known && row.enabled)) add('oknte_unknown_enabled_routine_item_preserved', 'warning');
  if (!config.documents['routine-configs']) add('oknte_dedicated_routine_config_defaults_used', 'warning');
  if (config.documents.devices && (typeof config.documents.devices.pc_full_path !== 'string' || !config.documents.devices.pc_full_path.trim()))
    diagnostics.push({ code: 'oknte_game_target_path_required', resourceId: 'devices', severity: 'blocking' });
  return { diagnostics, configPatches: oknteIntents(input, config) };
}
