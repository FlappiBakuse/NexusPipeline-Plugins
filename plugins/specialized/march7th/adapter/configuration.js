'use strict';

function march7thAllowed(config, selector, value) {
  if (!Array.isArray(selector) || selector.length !== 1 || typeof selector[0] !== 'string') return false;
  const key = selector[0];
  if (config.rows.some(row => row.known && row.key === key)) return typeof value === 'boolean';
  if (key === 'game_path') return config.get('cloud_game_enable') !== true && typeof value === 'string' && !!value.trim() && value.length <= 4096;
  if (key === 'after_finish') return ['None', 'Exit', '无操作', '退出程序'].includes(value);
  if (key === 'universe_count') return Number.isSafeInteger(value) && value >= 0 && value <= 10000;
  if (key === 'universe_frequency') return ['daily', 'weekly'].includes(value);
  if (key === 'universe_category') return ['universe', 'divergent'].includes(value);
  return false;
}

function march7thIntents(input, config) {
  const intents = input.configurationIntents ?? [];
  if (!Array.isArray(intents) || intents.length > 1) throw new Error('march7th_configuration_intent_identity');
  if (!intents.length) return [];
  const patch = intents[0], resource = config.main, seen = new Set();
  if (patch.format !== 'nexus.config.patch' || patch.version !== 1 || patch.operationId !== input.operationId || patch.resourceId !== 'main' ||
      !Number.isSafeInteger(resource.revision) || resource.revision < 1 || patch.expectedRevision !== resource.revision ||
      patch.sourceSha256 !== resource.sha256 || !Array.isArray(patch.edits) || !patch.edits.length || patch.edits.length > 256)
    throw new Error('march7th_configuration_intent_unbound');
  for (const edit of patch.edits) {
    if (!march7thAllowed(config, edit.selector, edit.value) || seen.has(edit.selector[0])) throw new Error('march7th_configuration_edit_not_supported');
    const key = edit.selector[0];
    if (!march7thOwn(config.document, key) || JSON.stringify(config.document[key]) !== JSON.stringify(edit.expected))
      throw new Error('march7th_configuration_edit_conflict');
    seen.add(key);
  }
  return intents;
}

function march7thConfiguration(input, config) {
  const diagnostics = [], edits = [], add = (code, severity = 'blocking') => diagnostics.push({ code, resourceId: 'main', severity });
  if (config.rows.some(row => !row.known && row.enabled)) add('march7th_unknown_enabled_task_preserved', 'warning');
  const finish = config.get('after_finish');
  if (!['None', 'Exit', '无操作', '退出程序'].includes(finish)) {
    add('march7th_finish_action_requires_host_policy');
    if (typeof config.document.after_finish === 'string') edits.push({ selector: ['after_finish'], expected: finish, value: 'None' });
  }
  if (config.get('cloud_game_enable') !== true && (typeof config.get('game_path') !== 'string' || !config.get('game_path').trim())) add('march7th_game_path_required');
  if (!march7thFailurePatterns(config).length) add('march7th_failure_notification_template_unrecognized');
  if (config.rows.some(row => row.selected && !march7thOwn(config.document, row.key))) add('march7th_default_selection_requires_projection', 'warning');
  const intents = march7thIntents(input, config);
  return { diagnostics, configPatches: intents.length ? intents : edits.length && Number.isSafeInteger(config.main.revision) && config.main.revision > 0 ? [{
    format: 'nexus.config.patch', version: 1, operationId: input.operationId, resourceId: 'main', sourceSha256: config.main.sha256,
    expectedRevision: config.main.revision, edits }] : [] };
}
