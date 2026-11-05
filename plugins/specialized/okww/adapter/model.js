'use strict';

const OKWW_FARMS = ['Tacet Suppression', 'Forgery Challenge', 'Simulation Challenge'];
const OKWW_EXTRAS = ['Check Weekly Garden', 'Auto Farm all Nightmare Nest', 'Merge Echo If discarded > 1000', 'Teleport and Farm 4C Echo'];
const okwwObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const okwwOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key);

function okwwRead(input) {
  if (!Array.isArray(input.resources) || new Set(input.resources.map(item => item.resourceId)).size !== input.resources.length)
    throw new Error('okww_resource_identity_invalid');
  const documents = {};
  for (const resource of input.resources.filter(item => ['main', 'farm-4c', 'nightmare', 'devices'].includes(item.resourceId))) {
    const value = resource.value ?? strictConfigurationJson(resource.content, 'okww');
    if (!okwwObject(value)) throw new Error('okww_resource_object_required');
    documents[resource.resourceId] = value;
  }
  const main = input.resources.find(item => item.resourceId === 'main'), document = documents.main;
  if (!main || !document) throw new Error('okww_main_resource_required');
  const farm = document['Which to Farm'] ?? 'Tacet Suppression', echo = document['Farm Nightmare Nest for Daily Echo'] ?? true;
  const extras = document['Additional Tasks to Run After Daily Task'] ?? ['Check Weekly Garden'];
  if (!OKWW_FARMS.includes(farm) || typeof echo !== 'boolean' || !Array.isArray(extras) || extras.length > 64 || extras.some(value => typeof value !== 'string' || value.length > 90))
    throw new Error('okww_daily_configuration_invalid');
  const allNightmares = extras.includes('Auto Farm all Nightmare Nest');
  const rows = [
    ['daily', '日常任务', true], ['nightmare', allNightmares ? '全部梦魇附加任务' : '日常所需梦魇', allNightmares || echo && farm !== 'Tacet Suppression'],
    ['stamina', '日常体力：' + farm, true], ['daily_reward', '领取日常奖励', true], ['mail', '领取邮件', true], ['battle_pass', '领取通行证奖励', true],
    ['garden', '每周花园', extras.includes('Check Weekly Garden')], ['merge', '丢弃声骸合成', extras.includes('Merge Echo If discarded > 1000')],
    ['farm_4c', '日常附加传送刷 4C', extras.includes('Teleport and Farm 4C Echo')]
  ].map(([id, title, enabled]) => ({ id, title, enabled, known: true }));
  extras.forEach((extra, index) => { if (!OKWW_EXTRAS.includes(extra)) rows.push({ id: 'extra:' + index + ':' + extra, title: extra, enabled: true, known: false }); });
  const farmConfig = documents['farm-4c'] ?? {}, nightmare = documents.nightmare ?? {};
  const teleport = farmConfig['Teleport to Boss'] ?? 'No', count = farmConfig['Repeat Farm Count'] ?? 10000;
  const finite4c = ['Weekly Challenge', 'Boss Challenge'].includes(teleport) && Number.isSafeInteger(count) && count > 0 && count <= 1000000;
  const nightmareSelection = nightmare['Which to Farm'] ?? ['Nightmare Purification', 'Tacet Discord Nest'];
  const validNightmare = Array.isArray(nightmareSelection) && nightmareSelection.length > 0 && nightmareSelection.every(value => ['Nightmare Purification', 'Tacet Discord Nest'].includes(value));
  return { main, document, documents, rows, farm, echo, extras, allNightmares, finite4c, validNightmare, teleport, count };
}

function okwwTasks(config) {
  const safe = !config.rows.some(item => !item.known) && !config.extras.includes('Teleport and Farm 4C Echo') &&
    (!config.allNightmares || config.validNightmare);
  const scope = config.rows.filter(row => row.enabled && row.known).map(row => 'okww:' + row.id).sort();
  return config.rows.map(row => ({ taskId: 'okww:' + row.id, title: row.title, isEnabled: row.enabled, isSelected: row.enabled && row.known,
    ...(row.known ? { titleLocales: nexusTaskLocales(row.id === 'stamina' ? { 'Tacet Suppression': 'stamina_tacet',
      'Forgery Challenge': 'stamina_forgery', 'Simulation Challenge': 'stamina_simulation' }[config.farm] : row.id === 'nightmare' ?
      config.allNightmares ? 'nightmare_all' : 'nightmare_daily' : row.id) } : {}),
    retrySafety: row.id === 'daily' && safe ? 'safe' : 'unknown',
    ...(row.id === 'daily' && safe ? { nativeResumeScope: scope } : {}),
    workflowRole: 'business', dependencies: row.id === 'daily' ? [] : ['okww:daily'] }));
}

function okwwFreeze(input, tasks) {
  if (!Array.isArray(input.tasks) || input.tasks.length !== tasks.length || input.tasks.some((task, index) =>
    ['taskId', 'title', 'isSelected', 'isEnabled', 'retrySafety', 'workflowRole'].some(key => task[key] !== tasks[index][key]) ||
    JSON.stringify(task.dependencies) !== JSON.stringify(tasks[index].dependencies) ||
    !nexusTitleEquals(task.titleLocales, tasks[index].titleLocales) ||
    JSON.stringify(task.nativeResumeScope ?? []) !== JSON.stringify(tasks[index].nativeResumeScope ?? []))) throw new Error('okww_frozen_tasks_changed');
}
