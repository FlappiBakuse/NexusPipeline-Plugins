'use strict';

const BAAH_BEHAVIOR_FIELDS = ['SERVER_TYPE', 'TIMETABLE_TASK', 'SMART_TIMETABLE', 'CRAFT_TIMES', 'CRAFT_USE_QUICK',
  'BUY_AP_MAX_PRICE', 'BUY_AP_ADD_TIMES', 'CAFE_COLLECT', 'CAFE_TOUCH', 'CAFE1_INVITE_SEQ', 'CAFE2_INVITE_SEQ',
  'CAFE1_BUY_INVITE_TICKET', 'CAFE2_BUY_INVITE_TICKET', 'CAFE1_BUY_INVITE_SEQ', 'CAFE2_BUY_INVITE_SEQ',
  'SHOP_NORMAL', 'SHOP_NORMAL_BUYALL', 'SHOP_CONTEST', 'SHOP_CONTEST_BUYALL', 'SHOP_CONTEST_REFRESH_TIME',
  'SHOP_NORMAL_REFRESH_TIME', 'SHOP_NORMAL_SWITCH', 'SHOP_CONTEST_SWITCH', 'HARD', 'NORMAL', 'EVENT_QUEST_LEVEL',
  'WANTED_HIGHEST_LEVEL', 'SPECIAL_HIGHTEST_LEVEL', 'EXCHANGE_HIGHEST_LEVEL', 'SPEICAL_EVENT_STATUS', 'EXCHANGE_EVENT_STATUS',
  'PUSH_NORMAL_USE_SIMPLE', 'PUSH_NORMAL_QUEST', 'PUSH_NORMAL_QUEST_LEVEL', 'PUSH_HARD_USE_SIMPLE', 'PUSH_HARD_QUEST',
  'PUSH_HARD_QUEST_LEVEL', 'RETRY_WHEN_ERROR', 'RETRY_WHEN_ERROR_FROM_LAST_TASK', 'CLOSE_GAME_FINISH', 'CLOSE_EMULATOR_FINISH',
  'CLOSE_BAAH_FINISH', 'OPEN_GAME_APP_TASK', 'DO_POST_ALL_TASK', 'TARGET_EMULATOR_PATH', 'TARGET_IP_PATH', 'TARGET_PORT', 'ADB_DIRECT_USE_SERIAL_NUMBER'];

function baahEditAllowed(config, resourceId, selector, value) {
  if (!Array.isArray(selector) || !selector.length) return false;
  if (resourceId === 'software-config') return selector.length === 1 && selector[0] === 'SAVE_LOG_TO_FILE' && value === true;
  if (resourceId !== 'main') return false;
  if (selector.length === 1) {
    if (selector[0] === 'POST_COMMAND') return value === '';
    if (selector[0] === 'TARGET_PORT') return Number.isInteger(value) && value >= 1 && value <= 65535;
    if (selector[0] === 'TARGET_IP_PATH') return typeof value === 'string' && value.length > 0 && value.length <= 255 && !/[\s\u0000-\u001f]/.test(value);
    const current = config.document[selector[0]];
    return BAAH_BEHAVIOR_FIELDS.includes(selector[0]) && baahOwn(config.document, selector[0]) &&
      typeof value === typeof current && (typeof value === 'boolean' || typeof value === 'string' && value.length <= 4096 ||
        typeof value === 'number' && Number.isFinite(value) && value >= 0);
  }
  if (JSON.stringify(selector) === '["TASK_ORDER_GROUP","ACTIVATE_IND"]')
    return Number.isInteger(value) && value >= 0 && value < config.document.TASK_ORDER_GROUP.ALL_PIPELINES.length;
  const prefix = ['TASK_ORDER_GROUP', 'ALL_PIPELINES', config.index];
  if (!prefix.every((part, index) => selector[index] === part)) return false;
  if (selector.length === 4 && selector[3] === 'TASK_ONOFF')
    return Array.isArray(value) && value.length === config.pipeline.TASK_ONOFF.length && value.every((enabled, index) =>
      typeof enabled === 'boolean' && (baahOwn(BAAH_CLASSES, config.pipeline.TASK_PIPELINE[index]) || enabled === config.pipeline.TASK_ONOFF[index]));
  return selector.length === 5 && selector[3] === 'TASK_ONOFF' && Number.isInteger(selector[4]) && selector[4] >= 0 &&
    selector[4] < config.pipeline.TASK_ONOFF.length && baahOwn(BAAH_CLASSES, config.pipeline.TASK_PIPELINE[selector[4]]) && typeof value === 'boolean';
}

function baahIntents(input, config) {
  const intents = input.configurationIntents ?? [], resources = input.resources.map(item => ({ ...item }));
  if (!Array.isArray(intents) || new Set(intents.map(item => item.resourceId)).size !== intents.length)
    throw new Error('baah_configuration_intent_duplicate_resource');
  for (const patch of intents) {
    const resource = resources.find(item => item.resourceId === patch.resourceId);
    if (!resource || patch.format !== 'nexus.config.patch' || patch.version !== 1 || patch.operationId !== input.operationId ||
        !Number.isSafeInteger(resource.revision) || resource.revision < 1 || patch.expectedRevision !== resource.revision ||
        patch.sourceSha256 !== resource.sha256 || !Array.isArray(patch.edits) || !patch.edits.length)
      throw new Error('baah_configuration_intent_unbound');
    const document = strictConfigurationJson(resource.content, 'baah'), seen = [];
    for (const edit of patch.edits) {
      if (!baahEditAllowed(config, resource.resourceId, edit.selector, edit.value) || seen.some(selector =>
        selector.every((part, index) => part === edit.selector[index]) || edit.selector.every((part, index) => part === selector[index])))
        throw new Error('baah_configuration_edit_not_supported');
      let parent = document;
      for (const part of edit.selector.slice(0, -1)) {
        if (parent === null || !baahOwn(parent, part)) throw new Error('baah_configuration_selector_missing');
        parent = parent[part];
      }
      const key = edit.selector[edit.selector.length - 1];
      if (!parent || !baahOwn(parent, key) || JSON.stringify(parent[key]) !== JSON.stringify(edit.expected))
        throw new Error('baah_configuration_edit_conflict');
      parent[key] = edit.value; seen.push(edit.selector);
    }
    resource.content = JSON.stringify(document);
  }
  if (intents.length) baahRead({ resources });
  return intents;
}

function baahConfiguration(input, config) {
  const diagnostics = [], automatic = [];
  const add = (code, resourceId = 'main', severity = 'blocking') => diagnostics.push({ code, resourceId, severity });
  const propose = (resource, selector, expected, value) => {
    if (input.configurationIntents?.length || !Number.isSafeInteger(resource?.revision) || resource.revision < 1) return;
    automatic.push({ format: 'nexus.config.patch', version: 1, operationId: input.operationId, resourceId: resource.resourceId,
      sourceSha256: resource.sha256, expectedRevision: resource.revision, edits: [{ selector, expected, value }] });
  };
  if (config.pipeline.TASK_PIPELINE.some(name => !baahOwn(BAAH_CLASSES, name))) add('baah_unknown_pipeline_task', 'main', 'warning');
  if (!config.software) add('baah_software_configuration_required');
  else if (config.softwareDocument.SAVE_LOG_TO_FILE !== true) {
    add('baah_file_logging_required', 'software-config');
    if (config.softwareDocument.SAVE_LOG_TO_FILE === false) propose(config.software, ['SAVE_LOG_TO_FILE'], false, true);
  }
  const document = config.document;
  if (document.POST_COMMAND !== undefined && typeof document.POST_COMMAND !== 'string') add('baah_post_command_invalid');
  else if (document.POST_COMMAND) { add('baah_post_command_requires_host_policy', 'main', 'warning'); propose(config.resource, ['POST_COMMAND'], document.POST_COMMAND, ''); }
  if (document.TARGET_IP_PATH !== undefined && (typeof document.TARGET_IP_PATH !== 'string' || !document.TARGET_IP_PATH)) add('baah_target_ip_invalid');
  if (document.TARGET_PORT !== undefined && (!Number.isInteger(document.TARGET_PORT) || document.TARGET_PORT < 1 || document.TARGET_PORT > 65535)) add('baah_target_port_invalid');
  if (document.ADB_DIRECT_USE_SERIAL_NUMBER === true) add('baah_direct_adb_serial_not_endpoint_proof', 'main', 'warning');
  else if (document.ADB_DIRECT_USE_SERIAL_NUMBER !== undefined && typeof document.ADB_DIRECT_USE_SERIAL_NUMBER !== 'boolean') add('baah_adb_mode_invalid');
  const intents = baahIntents(input, config);
  return { diagnostics, configPatches: intents.length ? intents : automatic };
}
