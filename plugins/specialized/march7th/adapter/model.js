'use strict';

const march7thObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const march7thOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key);

function march7thRead(input) {
  if (!Array.isArray(input.resources) || new Set(input.resources.map(item => item.resourceId)).size !== input.resources.length)
    throw new Error('march7th_resource_identity_invalid');
  const main = input.resources.find(item => item.resourceId === 'main');
  if (!main) throw new Error('march7th_main_resource_required');
  let document;
  if (main.value !== undefined) document = main.value;
  else {
    if (typeof main.content !== 'string' || !main.content.trimStart().startsWith('{')) throw new Error('march7th_yaml_semantic_owner_required');
    document = strictConfigurationJson(main.content, 'march7th');
  }
  if (!march7thObject(document)) throw new Error('march7th_configuration_invalid');
  const get = key => march7thOwn(document, key) ? document[key] : MARCH7TH_DEFAULTS[key];
  const rows = MARCH7TH_TASKS.map(definition => {
    if (typeof get(definition.key) !== 'boolean') throw new Error('march7th_task_switch_invalid:' + definition.key);
    return { ...definition, taskId: 'march7th:' + definition.key, enabled: get(definition.key),
      selected: get(definition.key) && (!definition.parent || get(definition.parent)), known: true };
  });
  const historical = ['weekly_relic_smart_discard_enable', 'divergent_auto_save_enable', 'fight_reward_enable', 'notify_qmsg_enable'];
  for (const key of Object.keys(document).filter(key => key.endsWith('_enable') && !march7thOwn(MARCH7TH_DEFAULTS, key) && !historical.includes(key)))
    rows.push({ key, title: key, taskId: 'march7th:' + key, enabled: document[key] === true, selected: false, known: false, role: 'business', parent: null });
  return { main, document, get, rows };
}

function march7thTasks(config) {
  const unknownEnabled = config.rows.some(row => !row.known && row.enabled);
  return config.rows.map(row => ({ taskId: row.taskId, title: row.title, isEnabled: row.enabled, isSelected: row.selected,
    ...(row.known ? { titleLocales: nexusTaskLocales(row.key) } : {}),
    retrySafety: row.known && !unknownEnabled && row.role === 'business' && typeof config.document[row.key] === 'boolean' ? 'safe' : 'unknown',
    workflowRole: row.role, dependencies: row.parent ? ['march7th:' + row.parent] : [],
    retryPrerequisites: row.parent === 'reward_enable' ? ['march7th:reward_enable'] : [],
    ...(row.known && typeof config.document[row.key] === 'boolean' ? {
      projection: { resourceId: config.main.resourceId, relativePath: config.main.relativePath ?? '', selector: [row.key] }
    } : {}) }));
}

function march7thFreeze(input, tasks) {
  if (!Array.isArray(input.tasks) || input.tasks.length !== tasks.length || input.tasks.some((task, index) =>
    ['taskId', 'title', 'isSelected', 'isEnabled', 'retrySafety', 'workflowRole'].some(key => task[key] !== tasks[index][key]) ||
    JSON.stringify(task.dependencies) !== JSON.stringify(tasks[index].dependencies) ||
    !nexusTitleEquals(task.titleLocales, tasks[index].titleLocales) ||
    JSON.stringify(task.projection ?? null) !== JSON.stringify(tasks[index].projection ?? null) ||
    JSON.stringify(task.retryPrerequisites ?? []) !== JSON.stringify(tasks[index].retryPrerequisites ?? []))) throw new Error('march7th_frozen_tasks_changed');
}

function march7thFailurePatterns(config) {
  const template = config.document.notify_template?.InstanceNotCompleted ?? MARCH7TH_DEFAULTS.notify_template.InstanceNotCompleted;
  if (typeof template !== 'string' || template.length > 2048) return [];
  const reasons = ['指定副本未解锁', '未找到指定副本', '传送可能失败', '无法开始挑战'];
  const result = [];
  for (const reason of reasons) {
    let text = '', substitutions = 0;
    for (let i = 0; i < template.length;) {
      if (template.slice(i, i + 2) === '{{') { text += '{'; i += 2; }
      else if (template.slice(i, i + 2) === '}}') { text += '}'; i += 2; }
      else if (template.slice(i, i + 7) === '{error}') { text += reason; substitutions++; i += 7; }
      else if ('{}'.includes(template[i])) return [];
      else text += template[i++];
    }
    const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    if (!substitutions || !lines.length || lines.length > 4) return [];
    result.push({ reason, lines });
  }
  return result;
}
