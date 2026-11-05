'use strict';

const zzzObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const zzzOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const zzzTechnical = ['notify', 'one_dragon', 'auto_battle', 'dodge_assistant', 'operation_debug', 'screenshot_helper', 'mouse_sensitivity_checker', 'predefined_team_checker'];

function zzzDocument(resource) {
  if (resource.value !== undefined) return resource.value;
  if (typeof resource.content !== 'string' || !resource.content.trimStart().startsWith('{')) throw new Error('zzzonedragon_yaml_semantic_owner_required');
  return strictConfigurationJson(resource.content, 'zzzonedragon');
}

function zzzRead(input) {
  if (!Array.isArray(input.resources) || new Set(input.resources.map(item => item.resourceId)).size !== input.resources.length)
    throw new Error('zzzonedragon_resource_identity_invalid');
  const modern = input.resources.filter(item => /^group:\d{2}$/.test(item.resourceId));
  const legacy = input.resources.filter(item => /^legacy:\d{2}$/.test(item.resourceId));
  if (modern.length > 1 || legacy.length > 1 || !modern.length && !legacy.length) throw new Error('zzzonedragon_explicit_instance_required');
  const main = modern[0] ?? legacy[0], id = main.resourceId.split(':')[1], documents = {};
  if (modern.length && legacy.length && legacy[0].resourceId.split(':')[1] !== id) throw new Error('zzzonedragon_instance_identity_conflict');
  for (const resource of input.resources.filter(item => [main.resourceId, 'account:' + id, 'charge:' + id, 'global'].includes(item.resourceId))) {
    const document = zzzDocument(resource);
    if (!zzzObject(document)) throw new Error('zzzonedragon_configuration_object_required');
    documents[resource.resourceId] = document;
  }
  const document = documents[main.resourceId], defaults = ZZZ_APPS.filter(item => item.default);
  let apps = document.app_list ?? [];
  if (!modern.length) {
    const order = document.app_order ?? [], selected = document.app_run_list ?? [];
    if (![order, selected].every(list => Array.isArray(list) && new Set(list).size === list.length && list.every(value => typeof value === 'string' && value && value.length <= 64)))
      throw new Error('zzzonedragon_legacy_application_identity_invalid');
    const registered = defaults.map(item => item.id), knownOrder = order.filter(value => registered.includes(value));
    const unknown = [...order, ...selected].filter((value, index, all) => !registered.includes(value) && all.indexOf(value) === index);
    apps = [...knownOrder, ...registered.filter(value => !knownOrder.includes(value)), ...unknown].map(app_id => ({ app_id, enabled: selected.includes(app_id) }));
  }
  if (!Array.isArray(apps) || apps.length > 256 || new Set(apps.map(item => item?.app_id)).size !== apps.length)
    throw new Error('zzzonedragon_application_identity_ambiguous');
  const rows = apps.map((saved, index) => {
    if (!zzzObject(saved) || typeof saved.app_id !== 'string' || !saved.app_id || saved.app_id.length > 64 || saved.enabled !== undefined && typeof saved.enabled !== 'boolean')
      throw new Error('zzzonedragon_application_invalid');
    const definition = ZZZ_APPS.find(item => item.id === saved.app_id), known = !!definition && (modern.length > 0 || definition.default);
    const enabled = saved.enabled ?? false, runtime = known && (definition.default || enabled);
    return { saved, index, id: saved.app_id, title: known ? definition.name : saved.app_id, known, enabled, runtime,
      role: zzzTechnical.includes(saved.app_id) ? 'technical' : 'business', taskId: 'zzzonedragon:' + id + '/' + saved.app_id };
  });
  const transient = modern.length ? defaults.filter(item => !apps.some(saved => saved.app_id === item.id)) : [];
  const runtime = [...transient.map(item => ({ id: item.id, title: item.name, enabled: false, transient: true })), ...rows.filter(row => row.runtime)];
  return { main, id, modern: modern.length > 0, document, documents, rows, runtime };
}

function zzzTasks(config) {
  const tasks = [];
  for (const row of config.rows) {
    tasks.push({ taskId: row.taskId, title: row.title, isSelected: row.enabled && row.runtime, isEnabled: row.enabled,
      ...(row.known ? { titleLocales: nexusTaskLocales(row.id) } : {}),
      retrySafety: config.modern && row.known && row.role === 'business' && typeof row.saved.enabled === 'boolean' ? 'safe' : 'unknown',
      workflowRole: row.role, dependencies: [] });
    if (row.id === 'charge_plan') tasks.push({ taskId: row.taskId + '/challenges', title: '副本挑战与电池合成',
      titleLocales: nexusTaskLocales('charge_plan_challenges'), isSelected: row.enabled && row.runtime,
      isEnabled: row.enabled, retrySafety: 'unknown', workflowRole: 'business', dependencies: [row.taskId] });
  }
  const resumable = config.modern && config.rows.every(row => !row.enabled || row.known &&
    (row.role === 'business' || row.id === 'notify'));
  const scope = tasks.filter(task => task.isSelected && task.isEnabled).map(task => task.taskId).sort();
  for (const task of tasks) if (task.isSelected && task.retrySafety === 'safe') {
    if (resumable) task.nativeResumeScope = scope;
    else task.retrySafety = 'unknown';
  }
  return tasks;
}

function zzzFreeze(input, tasks) {
  if (!Array.isArray(input.tasks) || input.tasks.length !== tasks.length || input.tasks.some((task, index) =>
    ['taskId', 'title', 'isSelected', 'isEnabled', 'retrySafety', 'workflowRole'].some(key => task[key] !== tasks[index][key]) ||
    JSON.stringify(task.dependencies) !== JSON.stringify(tasks[index].dependencies) ||
    !nexusTitleEquals(task.titleLocales, tasks[index].titleLocales) ||
    JSON.stringify(task.nativeResumeScope ?? []) !== JSON.stringify(tasks[index].nativeResumeScope ?? []))) throw new Error('zzzonedragon_frozen_tasks_changed');
}
