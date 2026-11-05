'use strict';

const maasObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const maasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const maasSpecial = ['CountdownAction', 'TimedWaitAction', 'SystemNotificationAction', 'CustomProgramAction',
  'KillProcessAction', 'ComputerOperationAction', 'WebhookAction', 'SwitchInstanceAction'];
const maasArray = value => value === undefined || value === null ? [] : typeof value === 'string' ? [value] : value;
const maasKey = task => task.name + '<|||>' + task.entry;

function maasRead(input) {
  const main = maaDataResource(input, 'main', 'maas'), globalResource = maaDataResource(input, 'global', 'maas');
  const instance = strictConfigurationJson(main.content, 'maas'), global = strictConfigurationJson(globalResource.content, 'maas');
  const settings = strictConfigurationJson(maaDataResource(input, 'settings', 'maas').content, 'maas');
  const path = main.sourcePath ?? main.relativePath ?? '', match = path.match(/(?:^|\/)instances\/([A-Za-z0-9_-]{1,128})\.json$/);
  if (!match) throw new Error('maas_stable_instance_required');
  const id = match[1], metadata = maaDataMetadata('maas', 'MaaStellaSora', MAAS_IMPORTS), { pi, translations: locale } = metadata;
  const get = (key, fallback) => {
    if (maasOwn(instance, key) && instance[key] !== null) return instance[key];
    for (const name of ['Instance.' + id + '.' + key, ...(id === 'default' ? [] : ['Instance.default.' + key]), key])
      if (maasOwn(global, name) && global[name] !== null) return global[name];
    return fallback;
  };
  const definitions = pi.task ?? [], options = pi.option ?? {}, byKey = {}, byEntry = {};
  for (const definition of definitions) {
    if (!maasObject(definition) || typeof definition.name !== 'string' || typeof definition.entry !== 'string') throw new Error('maas_task_definition_invalid');
    byKey[maasKey(definition)] = definition;
    if (maasOwn(byEntry, definition.entry)) byEntry[definition.entry] = null; else byEntry[definition.entry] = definition;
  }
  const controllers = (pi.controller ?? []).filter(item => !/playcover|macos|wlroots/i.test(item.type ?? ''));
  const same = (left, right) => typeof left === 'string' && typeof right === 'string' && left.trim().toLowerCase() === right.trim().toLowerCase();
  const controller = controllers.find(item => same(item.name, get('CurrentControllerName'))) ??
    controllers.find(item => same(item.type, get('CurrentController'))) ?? controllers[0];
  const resources = (pi.resource ?? []).filter(item => !maasArray(item.controller).length || maasArray(item.controller).includes(controller?.name));
  const resource = resources.find(item => same(item.name, get('Resource'))) ?? resources[0];
  if (!controller || !resource || !maasObject(options)) throw new Error('maas_controller_resource_required');
  const saved = get('TaskItems', []), currentTasks = get('CurrentTasks', []);
  if (!Array.isArray(saved) || !Array.isArray(currentTasks) || saved.length > 4096) throw new Error('maas_task_items_invalid');
  const localTasks = Array.isArray(instance.TaskItems), rows = saved.map((item, index) => ({ item, index }));
  const existing = new Set(saved.map(maasKey)), presetKey = get('InstancePresetKey', ''), preset = pi.preset?.find(item => item.name === presetKey);
  for (const definition of definitions) {
    const key = maasKey(definition);
    if (existing.has(key) || currentTasks.includes(key) || presetKey && !preset?.task?.some(item => item.name === definition.name)) continue;
    const item = { ...definition }; delete item.option;
    rows.push({ item, index: null }); existing.add(key);
  }
  const projected = rows.map(({ item, index }, position) => ({
    ...maasRow({ item, index, position, id, byKey, byEntry, controller, resource, locale }),
    origin: { Kind: index === null ? 'default' : localTasks ? 'local' : 'inherited' }
  }));
  const requested = settings.DefaultConfig ?? 'Default';
  const globalPath = globalResource.sourcePath ?? globalResource.relativePath;
  const cfg = globalPath === 'config/config.json' ? 'Default' : globalPath?.match(/(?:^|\/)mfa_(.+)\.json$/)?.[1];
  if (typeof cfg !== 'string' || !cfg) throw new Error('maas_global_configuration_unbound');
  return { main, id, instance, settings, cfg, requested, global, pi, options, get, controller, resource,
    rows: projected, localTasks, sourceDiagnostics: metadata.diagnostics,
    resourceBindings: input.resources.map(item => ({ resourceId: item.resourceId, sha256: item.sha256, revision: item.revision, relativePath: item.relativePath })) };
}

function maasRow({ item, index, position, id, byKey, byEntry, controller, resource, locale }) {
  if (!maasObject(item) || typeof item.name !== 'string' || typeof item.entry !== 'string' ||
      item.default_check !== undefined && item.default_check !== null && typeof item.default_check !== 'boolean')
    throw new Error('maas_saved_task_invalid');
  const definition = byKey[maasKey(item)] || byEntry[item.entry], special = maasSpecial.includes(item.entry);
  const known = !!definition && MAAS_ENTRIES[definition.name] === definition.entry || special;
  const compatible = known && (!maasArray(definition?.controller).length || maasArray(definition.controller).includes(controller.name)) &&
    (!maasArray(definition?.resource).length || maasArray(definition.resource).includes(resource.name));
  const enabled = item.default_check === undefined || item.default_check === null ? index === null ? definition?.default_check === true : false : item.default_check;
  const count = definition?.repeatable === true ? item.repeat_count ?? 1 : 1;
  if (!Number.isSafeInteger(count) || count < 1 || count > 100000) throw new Error('maas_repeat_count_finite_required');
  let label = definition?.label ?? definition?.name ?? item.name;
  if (label.startsWith('$')) label = locale[label.slice(1)] ?? label;
  const title = [item.remark, item.display_name_override].find(value => typeof value === 'string' && value.trim()) ?? label;
  if (typeof title !== 'string' || !title.trim() || title.length > 256) throw new Error('maas_title_invalid');
  const entry = definition?.entry ?? item.entry, role = entry === 'ComputerOperationAction' || entry === 'KillProcessAction' ? 'cleanup' :
    special || definition?.name === '登录游戏' ? 'technical' : 'business';
  return { item, index, definition, known, compatible, enabled, count, title, role, special,
    taskId: 'maas:' + id + '/' + (index === null ? 'default-' + position : index) };
}

function maasTasks(config) {
  const dependencies = [], preparation = [];
  return config.rows.map(row => {
    const projected = row.known && config.localTasks && row.origin.Kind === 'local' && row.index !== null && typeof row.item.default_check === 'boolean';
    const login = row.known && row.definition?.name === '登录游戏';
    const task = { taskId: row.taskId, executionTaskId: row.executionTaskId, title: row.title, isSelected: row.enabled && row.compatible, isEnabled: row.enabled,
      ...(row.known && !row.item.remark && !row.item.display_name_override ? { titleLocales: nexusTaskLocales(row.definition?.name ?? row.item.name) } : {}),
      retrySafety: row.known && projected && (row.role === 'business' && row.count <= 100 || login && row.count === 1) ? 'safe' : 'unknown',
      ...(row.role === 'business' && row.count > 1 && row.count <= 100 ? { repetitionLimit: row.count } : {}),
      dependencies: row.role === 'business' ? dependencies.slice() : [], workflowRole: row.role,
      ...(projected ? { projection: { resourceId: config.main.resourceId, relativePath: config.main.relativePath ?? '',
        selector: ['TaskItems', row.index, 'default_check'] } } : {}),
      ...(row.role === 'business' && preparation.length ? { retryPrerequisites: preparation.slice().sort() } : {}) };
    if (row.enabled && row.compatible && (row.definition?.name === '登录游戏' || row.item.entry === 'CustomProgramAction')) dependencies.push(row.taskId);
    if (row.enabled && row.compatible && login && task.retrySafety === 'safe') preparation.push(row.taskId);
    return task;
  });
}

function maasFreeze(input, tasks) {
  if (!Array.isArray(input.tasks) || input.tasks.length !== tasks.length || input.tasks.some((task, index) =>
    ['taskId', 'executionTaskId', 'title', 'isSelected', 'isEnabled', 'retrySafety', 'workflowRole', 'repetitionLimit'].some(key => task[key] !== tasks[index][key]) ||
    !nexusTitleEquals(task.titleLocales, tasks[index].titleLocales) ||
    ['dependencies', 'projection', 'retryPrerequisites'].some(key => JSON.stringify(task[key] ?? null) !== JSON.stringify(tasks[index][key] ?? null))))
    throw new Error('maas_frozen_tasks_changed');
}
