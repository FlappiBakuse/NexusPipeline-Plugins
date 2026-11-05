'use strict';

const OKNTE_ITEMS = [
  { id: 'daily_anomaly', title: '异象界域', defaultEnabled: true, group: 'anomaly' },
  { id: 'daily_anomaly_hunter', title: '异象追猎', defaultEnabled: false, group: 'anomaly' },
  { id: 'coffee', title: '一咖舍', defaultEnabled: false }, { id: 'daily_claim', title: '日常领取', defaultEnabled: true },
  { id: 'cinema_date', title: '影院约会', defaultEnabled: false }, { id: 'fountain', title: '喷泉签到', defaultEnabled: false },
  { id: 'furniture', title: '异象家具', defaultEnabled: false }, { id: 'gift', title: '羁遇赠礼', defaultEnabled: false }
];
const oknteObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const oknteOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const oknteTruth = value => Array.isArray(value) ? value.length > 0 : oknteObject(value) ? Object.keys(value).length > 0 : Boolean(value);

function oknteRead(input) {
  if (!Array.isArray(input.resources) || new Set(input.resources.map(item => item.resourceId)).size !== input.resources.length)
    throw new Error('oknte_resource_identity_invalid');
  const documents = {};
  for (const resource of input.resources.filter(item => ['main', 'routine-configs', 'devices'].includes(item.resourceId))) {
    const value = resource.value ?? strictConfigurationJson(resource.content, 'oknte');
    if (!oknteObject(value)) throw new Error('oknte_resource_object_required');
    documents[resource.resourceId] = value;
  }
  const main = input.resources.find(item => item.resourceId === 'main'), document = documents.main;
  if (!main || !document) throw new Error('oknte_main_resource_required');
  const raw = document['Routine Items'], list = Array.isArray(raw) ? raw : [], seen = new Set(), rows = [], unknown = [];
  if (list.length > 256) throw new Error('oknte_routine_item_limit');
  for (let index = 0; index < list.length; index++) {
    const item = list[index], definition = OKNTE_ITEMS.find(entry => entry.id === item?.id);
    if (typeof item?.id === 'string' && item.id.length > 100) throw new Error('oknte_item_identity_limit');
    if (!oknteObject(item) || !definition) { unknown.push({ item, index }); continue; }
    if (seen.has(item.id)) continue;
    rows.push({ ...definition, enabled: oknteTruth(item.enabled), savedIndex: index, known: true }); seen.add(item.id);
  }
  for (const definition of OKNTE_ITEMS.filter(item => !seen.has(item.id))) rows.push({ ...definition, enabled: definition.defaultEnabled, savedIndex: null, known: true });
  const groups = new Set();
  for (const row of rows) if (row.enabled && row.group) {
    if (groups.has(row.group)) row.enabled = false; else groups.add(row.group);
  }
  for (const { item, index } of unknown) rows.push({ id: 'unknown/' + index + '/' + (typeof item?.id === 'string' ? item.id : 'invalid'),
    title: typeof item?.id === 'string' ? item.id : '未识别日常项 ' + index, enabled: oknteTruth(item?.enabled), savedIndex: index, known: false });
  const complete = Array.isArray(raw) && OKNTE_ITEMS.every(entry => {
    const matches = list.filter(item => item?.id === entry.id);
    return matches.length === 1 && typeof matches[0].enabled === 'boolean';
  });
  return { main, document, documents, rows, complete };
}

function oknteTasks(config) {
  const unknownEnabled = config.rows.some(row => !row.known && row.enabled);
  return config.rows.map(row => ({ taskId: 'oknte:' + row.id, title: row.title,
    ...(row.known ? { titleLocales: nexusTaskLocales(row.id) } : {}),
    isEnabled: config.complete && row.known ? config.document['Routine Items'][row.savedIndex].enabled : row.enabled,
    isSelected: row.enabled && row.known, retrySafety: row.known && config.complete && !unknownEnabled ? 'safe' : 'unknown', workflowRole: 'business', dependencies: [],
    ...(row.known && config.complete ? { projection: { resourceId: config.main.resourceId,
      relativePath: config.main.relativePath ?? '', selector: ['Routine Items', { match: { property: 'id', value: row.id } }, 'enabled'] } } : {}) }));
}

function oknteFreeze(input, tasks) {
  if (!Array.isArray(input.tasks) || input.tasks.length !== tasks.length || input.tasks.some((task, index) =>
    ['taskId', 'title', 'isSelected', 'isEnabled', 'retrySafety', 'workflowRole'].some(key => task[key] !== tasks[index][key]) ||
    JSON.stringify(task.dependencies) !== JSON.stringify(tasks[index].dependencies) ||
    !nexusTitleEquals(task.titleLocales, tasks[index].titleLocales) ||
    JSON.stringify(task.projection ?? null) !== JSON.stringify(tasks[index].projection ?? null))) throw new Error('oknte_frozen_tasks_changed');
}
