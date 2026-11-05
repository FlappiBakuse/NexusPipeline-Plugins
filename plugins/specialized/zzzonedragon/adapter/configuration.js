'use strict';

function zzzResolve(value, selector) {
  for (const step of selector) {
    if (typeof step === 'string' || Number.isInteger(step)) {
      if (value === null || value === undefined || !zzzOwn(value, step)) throw new Error('zzzonedragon_selector_missing');
      value = value[step];
    } else if (Array.isArray(value) && zzzObject(step?.match)) {
      const matches = value.filter(item => item?.[step.match.property] === step.match.value);
      if (matches.length !== 1) throw new Error('zzzonedragon_selector_ambiguous');
      value = matches[0];
    } else throw new Error('zzzonedragon_selector_invalid');
  }
  return value;
}

function zzzAllowed(config, resourceId, selector, value) {
  if (!Array.isArray(selector)) return false;
  if (resourceId === 'account:' + config.id) return selector.length === 1 && selector[0] === 'game_path' && typeof value === 'string' && !!value.trim() && value.length <= 4096;
  if (resourceId === 'global') return selector.length === 1 && (selector[0] === 'after_done' && ['无', '关闭游戏'].includes(value) ||
    selector[0] === 'instance_run' && value === '仅运行当前');
  if (resourceId !== config.main.resourceId || !config.modern) return false;
  if (selector.length === 3 && selector[0] === 'app_list' && selector[2] === 'enabled' && typeof value === 'boolean' && selector[1]?.match?.property === 'app_id') {
    const row = config.rows.find(item => item.id === selector[1].match.value);
    return row?.known && (row.id !== 'one_dragon' || value === false);
  }
  if (selector.length === 1 && selector[0] === 'app_list' && Array.isArray(value) && value.length === config.document.app_list?.length) {
    const remaining = config.document.app_list.map(item => JSON.stringify(item));
    for (const item of value) { const index = remaining.indexOf(JSON.stringify(item)); if (index < 0) return false; remaining.splice(index, 1); }
    return true;
  }
  return false;
}

function zzzIntents(input, config) {
  const patches = input.configurationIntents ?? [], seenResources = new Set();
  if (!Array.isArray(patches) || patches.length > 3) throw new Error('zzzonedragon_configuration_intent_identity');
  for (const patch of patches) {
    const resource = input.resources.find(item => item.resourceId === patch.resourceId), seen = [];
    if (!resource || seenResources.has(resource.resourceId) || patch.format !== 'nexus.config.patch' || patch.version !== 1 || patch.operationId !== input.operationId ||
        !Number.isSafeInteger(resource.revision) || resource.revision < 1 || patch.expectedRevision !== resource.revision || patch.sourceSha256 !== resource.sha256 ||
        !Array.isArray(patch.edits) || !patch.edits.length || patch.edits.length > 256) throw new Error('zzzonedragon_configuration_intent_unbound');
    seenResources.add(resource.resourceId);
    for (const edit of patch.edits) {
      if (!zzzAllowed(config, resource.resourceId, edit.selector, edit.value) || seen.some(selector =>
        selector.length <= edit.selector.length && selector.every((part, index) => JSON.stringify(part) === JSON.stringify(edit.selector[index])) ||
        edit.selector.length <= selector.length && edit.selector.every((part, index) => JSON.stringify(part) === JSON.stringify(selector[index]))))
        throw new Error('zzzonedragon_configuration_edit_not_supported');
      if (JSON.stringify(zzzResolve(config.documents[resource.resourceId], edit.selector)) !== JSON.stringify(edit.expected)) throw new Error('zzzonedragon_configuration_edit_conflict');
      seen.push(edit.selector);
    }
  }
  return patches;
}

function zzzConfiguration(input, config) {
  const diagnostics = [], patches = [], add = (code, resourceId = config.main.resourceId, severity = 'blocking') => diagnostics.push({ code, resourceId, severity });
  if (config.rows.some(row => !row.known && row.enabled)) add('zzzonedragon_unknown_enabled_application_preserved');
  if (config.rows.some(row => row.id === 'one_dragon' && row.enabled)) add('zzzonedragon_recursive_group_application_unsupported');
  if (!config.modern) add('zzzonedragon_legacy_group_read_only', config.main.resourceId, 'warning');
  const global = config.documents.global, account = config.documents['account:' + config.id];
  if (!account || typeof account.game_path !== 'string' || !account.game_path.trim()) add('zzzonedragon_bound_game_path_required', 'account:' + config.id);
  if (!global) add('zzzonedragon_single_instance_global_required', 'global');
  else {
    const edits = [];
    if ((global.instance_run ?? '全部实例') !== '仅运行当前') {
      add('zzzonedragon_single_current_instance_required', 'global');
      if (zzzOwn(global, 'instance_run')) edits.push({ selector: ['instance_run'], expected: global.instance_run, value: '仅运行当前' });
    }
    if (!['无', '关闭游戏'].includes(global.after_done ?? '无')) {
      add('zzzonedragon_finish_action_requires_host_policy', 'global');
      if (typeof global.after_done === 'string') edits.push({ selector: ['after_done'], expected: global.after_done, value: '无' });
    }
    const resource = input.resources.find(item => item.resourceId === 'global');
    if (edits.length && Number.isSafeInteger(resource.revision) && resource.revision > 0) patches.push({ format: 'nexus.config.patch', version: 1,
      operationId: input.operationId, resourceId: 'global', sourceSha256: resource.sha256, expectedRevision: resource.revision, edits });
  }
  const intents = zzzIntents(input, config);
  return { diagnostics, configPatches: intents.length ? intents : patches };
}
