'use strict';

const BGI_BUILTINS = ['领取邮件', '合成树脂', '自动秘境', '自动首领讨伐', '自动幽境危战', '自动地脉花', '领取每日奖励', '领取尘歌壶奖励'];
const bgiOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const bgiObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const bgiText = (value, length) => typeof value === 'string' && value.length > 0 && value.length <= length && !/[\u0000-\u001f\u007f]/.test(value);

function readConfiguration(input) {
  const resources = input.resources;
  if (!Array.isArray(resources) || !resources.length || resources.length > 2 ||
      new Set(resources.map(resource => resource.resourceId)).size !== resources.length ||
      resources.some(resource => !['one-dragon', 'extra-user-config'].includes(resource.resourceId)))
    throw new Error('bettergi_configuration_identity_required');
  const resource = resources.find(item => item.resourceId === 'one-dragon');
  if (!resource) throw new Error('bettergi_configuration_identity_required');
  const document = strictConfigurationJson(resource.content, 'bettergi'), enabled = document.TaskEnabledList;
  if (!bgiObject(enabled) || Object.keys(enabled).some(key => !bgiText(key, 100) || typeof enabled[key] !== 'boolean'))
    throw new Error('bettergi_configuration_unknown');
  const definitions = document.TaskDefinitions ?? {};
  if (!bgiObject(definitions) || Object.keys(definitions).some(key => !bgiText(key, 100) || !bgiText(definitions[key], 256)))
    throw new Error('bettergi_configuration_definitions_unknown');
  const named = Object.keys(definitions).length > 0, order = document.TaskOrder;
  if (order !== undefined && (!Array.isArray(order) || order.some(key => !bgiText(key, 100)) || new Set(order).size !== order.length))
    throw new Error('bettergi_configuration_order_unknown');
  const ordered = order && order.length ? order : Object.keys(enabled);
  const keys = [...new Set([...ordered, ...Object.keys(enabled), ...Object.keys(definitions)])];
  if (keys.length > 4096) throw new Error('bettergi_configuration_task_limit');
  const executable = ordered.filter(key => bgiOwn(enabled, key) && (!named || bgiOwn(definitions, key)));
  const cursor = document.NextTaskId ?? '';
  if (typeof cursor !== 'string' || cursor.length > 100) throw new Error('bettergi_configuration_cursor_unknown');
  if (document.CompletionAction !== undefined && typeof document.CompletionAction !== 'string')
    throw new Error('bettergi_completion_action_unknown');
  const extra = resources.find(item => item.resourceId === 'extra-user-config');
  return { document, resource, extra, user: extra ? strictConfigurationJson(extra.content, 'bettergi') : null,
    enabled, definitions, named, ordered, keys, executable, cursor, cursorUnknown: !!cursor && !executable.includes(cursor) };
}

function discoverTasks(config) {
  const start = config.cursor ? config.executable.indexOf(config.cursor) : 0;
  return config.keys.map(key => {
    const title = config.named && bgiOwn(config.definitions, key) ? config.definitions[key] : key;
    const enabled = bgiOwn(config.enabled, key) && config.enabled[key];
    return { taskId: 'bettergi:' + key, title, isEnabled: enabled, dependencies: [],
      ...(BGI_BUILTINS.includes(title) ? { titleLocales: nexusTaskLocales(title) } : {}),
      isSelected: enabled && !config.cursorUnknown && config.executable.includes(key) && config.executable.indexOf(key) >= start,
      retrySafety: BGI_BUILTINS.includes(title) && !config.cursor ? 'safe' : 'unknown',
      ...(bgiOwn(config.enabled, key) ? { projection: { resourceId: config.resource.resourceId,
        relativePath: config.resource.relativePath ?? '', selector: ['TaskEnabledList', key] } } : {}) };
  });
}

function assertFrozenTasks(input, current) {
  if (!Array.isArray(input.tasks) || input.tasks.length !== current.length || input.tasks.some((task, index) => {
    const expected = current[index];
    return ['taskId', 'title', 'isSelected', 'isEnabled', 'retrySafety'].some(key => task[key] !== expected[key]) ||
      !Array.isArray(task.dependencies) || task.dependencies.length ||
      JSON.stringify(task.projection ?? null) !== JSON.stringify(expected.projection ?? null) ||
      !nexusTitleEquals(task.titleLocales, expected.titleLocales);
  })) throw new Error('bettergi_frozen_tasks_changed');
}

function bgiConfiguration(input, config) {
  const diagnostics = [], configPatches = [];
  const add = (code, severity, resourceId = 'one-dragon') => diagnostics.push({ code, resourceId, severity });
  if (config.cursorUnknown) add('bettergi_cursor_unknown', 'blocking');
  if (config.named && config.keys.some(key => !bgiOwn(config.definitions, key) || !bgiOwn(config.enabled, key)))
    add('bettergi_undeclared_tasks_preserved', 'warning');
  if (config.keys.some(key => !config.executable.includes(key))) add('bettergi_omitted_tasks_preserved', 'warning');
  if (config.user) {
    const selected = config.user.selectedOneDragonFlowConfigName;
    if (typeof selected !== 'string' || !bgiText(config.document.Name, 256) || selected !== config.document.Name) {
      const correcting = input.configurationIntents?.some(patch => patch.resourceId === 'extra-user-config' && patch.edits?.some(edit =>
        JSON.stringify(edit.selector) === '["selectedOneDragonFlowConfigName"]' && edit.value === config.document.Name));
      add('bettergi_selected_configuration_mismatch', correcting ? 'warning' : 'blocking', 'extra-user-config');
    }
  }
  const action = config.document.CompletionAction;
  const supported = ['', 'None', '无', '关闭游戏', '关闭软件', '关闭游戏和软件'];
  if (action !== undefined && !supported.includes(action)) {
    add('bettergi_completion_action_requires_host_policy', 'warning');
    const resource = config.resource;
    if (!input.configurationIntents?.length && Number.isSafeInteger(resource.revision) && resource.revision >= 1)
      configPatches.push({ format: 'nexus.config.patch', version: 1, operationId: input.operationId,
        resourceId: resource.resourceId, sourceSha256: resource.sha256, expectedRevision: resource.revision,
        edits: [{ selector: ['CompletionAction'], expected: action, value: '无' }] });
  }
  const intents = bgiConfigurationIntents(input, config);
  return { diagnostics, configPatches: intents.length ? intents : configPatches };
}

function bgiEditAllowed(config, resourceId, selector, value) {
  if (!Array.isArray(selector) || selector.some(step => typeof step !== 'string')) return false;
  if (resourceId === 'extra-user-config') {
    if (selector.length === 1 && selector[0] === 'selectedOneDragonFlowConfigName')
      return bgiText(config.document.Name, 256) && value === config.document.Name;
    return selector.length === 2 && selector[0] === 'genshinStartConfig' && selector[1] === 'installPath' && bgiText(value, 1024);
  }
  if (resourceId !== 'one-dragon') return false;
  if (selector.length === 1 && selector[0] === 'CompletionAction')
    return ['', 'None', '无', '关闭游戏', '关闭软件', '关闭游戏和软件'].includes(value);
  if (selector.length === 1 && selector[0] === 'TaskOrder')
    return !config.cursor && Array.isArray(value) && value.length === config.ordered.length &&
      new Set(value).size === value.length && value.every(key => config.ordered.includes(key));
  const [field, key] = selector;
  if (selector.length !== 2 || !config.executable.includes(key)) return false;
  if (field === 'TaskEnabledList') return typeof value === 'boolean';
  return field === 'TaskDefinitions' && bgiOwn(config.definitions, key) && bgiText(value, 256) &&
    (BGI_BUILTINS.includes(value) || Object.values(config.definitions).includes(value));
}

function bgiConfigurationIntents(input, config) {
  const intents = input.configurationIntents ?? [];
  if (!Array.isArray(intents) || intents.length > 2 || new Set(intents.map(item => item.resourceId)).size !== intents.length)
    throw new Error('bettergi_configuration_intent_duplicate_resource');
  const resources = input.resources.map(resource => ({ ...resource }));
  for (const intent of intents) {
    const resource = input.resources.find(item => item.resourceId === intent.resourceId);
    if (!resource || intent.format !== 'nexus.config.patch' || intent.version !== 1 || intent.operationId !== input.operationId ||
        !Number.isSafeInteger(resource.revision) || resource.revision < 1 || intent.expectedRevision !== resource.revision ||
        intent.sourceSha256 !== resource.sha256 || !Array.isArray(intent.edits) || !intent.edits.length || intent.edits.length > 256)
      throw new Error('bettergi_configuration_intent_unbound');
    const document = strictConfigurationJson(resource.content, 'bettergi'), paths = [];
    for (const edit of intent.edits) {
      const selector = edit.selector;
      if (!bgiEditAllowed(config, resource.resourceId, selector, edit.value) ||
          paths.some(path => path.length <= selector.length && path.every((step, index) => selector[index] === step) ||
            selector.length <= path.length && selector.every((step, index) => path[index] === step)))
        throw new Error('bettergi_configuration_edit_not_supported');
      let parent = document;
      for (const step of selector.slice(0, -1)) {
        if (!bgiObject(parent) || !bgiOwn(parent, step)) throw new Error('bettergi_configuration_edit_missing');
        parent = parent[step];
      }
      const last = selector[selector.length - 1];
      if (!bgiObject(parent) || !bgiOwn(parent, last) || JSON.stringify(parent[last]) !== JSON.stringify(edit.expected))
        throw new Error('bettergi_configuration_edit_conflict');
      parent[last] = edit.value;
      paths.push(selector);
    }
    resources.find(item => item.resourceId === intent.resourceId).content = JSON.stringify(document);
  }
  if (intents.length) readConfiguration({ resources });
  return intents;
}

function retryTasks(input, config, tasks) {
  if (config.cursor) return [];
  const observations = input.observations ?? [];
  if (!Array.isArray(observations) || new Set(observations.map(item => item.taskId)).size !== observations.length ||
      observations.some(item => !tasks.some(task => task.taskId === item.taskId) ||
        !['succeeded', 'partial', 'failed', 'unknown'].includes(item.state)))
    throw new Error('bettergi_observation_identity_unknown');
  return tasks.filter(task => task.isSelected && task.isEnabled && task.retrySafety === 'safe' &&
    observations.some(item => item.taskId === task.taskId && item.state === 'failed')).map(task => task.taskId);
}
