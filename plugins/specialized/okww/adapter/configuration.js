'use strict';

function okwwAllowed(config, resourceId, key, value) {
  const integer = (min, max) => Number.isSafeInteger(value) && value >= min && value <= max;
  if (resourceId === 'devices') return key === 'pc_full_path' && typeof value === 'string' && !!value.trim() && value.length <= 4096;
  if (resourceId === 'main') {
    if (key === 'Which to Farm') return OKWW_FARMS.includes(value);
    if (key === 'Material Selection') return ['Resonator EXP', 'Weapon EXP', 'Shell Credit'].includes(value);
    if (key === 'Which Tacet Suppression to Farm') return integer(1, 21);
    if (key === 'Which Forgery Challenge to Farm') return integer(1, 20);
    if (key === 'Farm Nightmare Nest for Daily Echo') return typeof value === 'boolean';
    if (key === 'Additional Tasks to Run After Daily Task') {
      const unknown = config.extras.filter(item => !OKWW_EXTRAS.includes(item));
      return Array.isArray(value) && new Set(value).size === value.length && value.every(item => typeof item === 'string') &&
        JSON.stringify(value.filter(item => !OKWW_EXTRAS.includes(item))) === JSON.stringify(unknown);
    }
  }
  if (resourceId === 'nightmare' && key === 'Which to Farm') return Array.isArray(value) && new Set(value).size === value.length &&
    value.every(item => ['Nightmare Purification', 'Tacet Discord Nest'].includes(item));
  if (resourceId !== 'farm-4c') return false;
  if (key === 'Teleport to Boss') return ['No', 'Weekly Challenge', 'Boss Challenge'].includes(value);
  if (key === 'Boss Level') return ['50', '60', '70', '80', '90'].includes(value);
  if (key === 'Boss') return ['Other', 'Hyvatia', 'Fallacy of No Return', 'Sentry Construct', 'Lorelei', 'Lioness of Glory', 'Nightmare: Hecate', 'Fenrico', 'Nameless Explorer'].includes(value);
  if (key === 'Repeat Farm Count') return integer(1, 1000000);
  if (key === 'Combat Wait Time') return integer(0, 3600);
  if (key === 'Echo Pickup Method') return ['Yolo', 'Run in Circle', 'Walk'].includes(value);
  if (['Use Liberation', 'Switch to Healer before and after Combat'].includes(key)) return typeof value === 'boolean';
  if (key === 'Which Weekly Boss to Teleport') return integer(1, 9);
  if (key === 'Which Boss Challenge to Teleport') return integer(1, 20);
  return false;
}

function okwwIntents(input, config) {
  const patches = input.configurationIntents ?? [], seenResources = new Set(), after = JSON.parse(JSON.stringify(config.documents));
  if (!Array.isArray(patches) || patches.length > 4) throw new Error('okww_configuration_intent_identity');
  for (const patch of patches) {
    const resource = input.resources.find(item => item.resourceId === patch.resourceId), seenKeys = new Set();
    if (!resource || seenResources.has(resource.resourceId) || patch.format !== 'nexus.config.patch' || patch.version !== 1 || patch.operationId !== input.operationId ||
        !Number.isSafeInteger(resource.revision) || resource.revision < 1 || patch.expectedRevision !== resource.revision || patch.sourceSha256 !== resource.sha256 ||
        !Array.isArray(patch.edits) || !patch.edits.length || patch.edits.length > 256) throw new Error('okww_configuration_intent_unbound');
    seenResources.add(resource.resourceId);
    for (const edit of patch.edits) {
      if (!Array.isArray(edit.selector) || edit.selector.length !== 1 || !okwwAllowed(config, resource.resourceId, edit.selector[0], edit.value) || seenKeys.has(edit.selector[0]))
        throw new Error('okww_configuration_edit_not_supported');
      const key = edit.selector[0], document = after[resource.resourceId];
      if (!document || !okwwOwn(document, key) || JSON.stringify(document[key]) !== JSON.stringify(edit.expected)) throw new Error('okww_configuration_edit_conflict');
      document[key] = edit.value; seenKeys.add(key);
    }
  }
  const extras = after.main['Additional Tasks to Run After Daily Task'] ?? ['Check Weekly Garden'];
  if (patches.length && extras.includes('Teleport and Farm 4C Echo') && (!['Weekly Challenge', 'Boss Challenge'].includes(after['farm-4c']?.['Teleport to Boss']) ||
      !Number.isSafeInteger(after['farm-4c']?.['Repeat Farm Count']) || after['farm-4c']['Repeat Farm Count'] < 1 || after['farm-4c']['Repeat Farm Count'] > 1000000))
    throw new Error('okww_finite_4c_configuration_required');
  const nightmare = after.nightmare?.['Which to Farm'] ?? ['Nightmare Purification', 'Tacet Discord Nest'];
  if (patches.length && extras.includes('Auto Farm all Nightmare Nest') && (!Array.isArray(nightmare) || !nightmare.length))
    throw new Error('okww_nightmare_selection_required');
  return patches;
}

function okwwConfiguration(input, config) {
  const diagnostics = [], add = code => diagnostics.push({ code, resourceId: 'main', severity: 'blocking' });
  if (config.rows.some(row => !row.known)) diagnostics.push({ code: 'okww_unknown_daily_addition_preserved', resourceId: 'main', severity: 'warning' });
  if (config.extras.includes('Teleport and Farm 4C Echo') && !config.finite4c) add('okww_finite_4c_configuration_required');
  if (config.allNightmares && !config.validNightmare) add('okww_nightmare_selection_required');
  const requiredMain = config.farm === 'Tacet Suppression' ? ['Which Tacet Suppression to Farm'] :
    config.farm === 'Forgery Challenge' ? ['Which Forgery Challenge to Farm'] : ['Material Selection'];
  for (const key of requiredMain) if (okwwOwn(config.document, key) && !okwwAllowed(config, 'main', key, config.document[key]))
    add('okww_stamina_option_invalid');
  if (config.extras.includes('Teleport and Farm 4C Echo')) {
    const document = config.documents['farm-4c'] ?? {}, indexKey = { 'Weekly Challenge': 'Which Weekly Boss to Teleport',
      'Boss Challenge': 'Which Boss Challenge to Teleport' }[config.teleport];
    for (const key of [indexKey, 'Boss Level', 'Boss', 'Combat Wait Time', 'Echo Pickup Method', 'Use Liberation', 'Switch to Healer before and after Combat'].filter(Boolean))
      if (okwwOwn(document, key) && !okwwAllowed(config, 'farm-4c', key, document[key])) add('okww_4c_option_invalid');
  }
  if (config.documents.devices && (typeof config.documents.devices.pc_full_path !== 'string' || !config.documents.devices.pc_full_path.trim()))
    diagnostics.push({ code: 'okww_game_target_path_required', resourceId: 'devices', severity: 'blocking' });
  return { diagnostics, configPatches: okwwIntents(input, config) };
}
