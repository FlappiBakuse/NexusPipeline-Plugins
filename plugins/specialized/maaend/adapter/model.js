'use strict';

const maaendObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const maaendOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const maaendTechnical = ['AndroidOpenGame', 'LaunchGameLinux', '__MXU_LAUNCH__', '__MXU_SLEEP__', '__MXU_WAITUNTIL__', '__MXU_NOTIFY__', '__MXU_WEBHOOK__'];
const maaendCleanup = ['CloseGame', 'CloseGamePC', '__MXU_POWER__', '__MXU_KILLPROC__'];

function maaendRead(input) {
  const main = maaDataResource(input, 'main', 'maaend'), document = strictConfigurationJson(main.content, 'maaend');
  const metadata = maaDataMetadata('maaend', 'MaaEnd', MAAEND_IMPORTS), { pi, translations } = metadata;
  if (document.version !== '1.0' || !Array.isArray(document.instances)) throw new Error('maaend_profile_invalid');
  const id = document.settings?.autoStartInstanceId;
  const instances = document.instances.filter(item => item.id === id);
  if (instances.length !== 1 || typeof id !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(id))
    throw new Error('maaend_auto_start_instance_required');
  const instance = instances[0], instanceIndex = document.instances.indexOf(instance);
  if (!Array.isArray(instance.tasks) || instance.tasks.length > 4096 || new Set(instance.tasks.map(task => task.id)).size !== instance.tasks.length)
    throw new Error('maaend_task_identity_invalid');
  const definitions = [...(pi.task ?? [])], pretasks = !pi.pretask ? [] : Array.isArray(pi.pretask) ? pi.pretask : [pi.pretask], options = pi.option ?? {};
  for (const pretask of pretasks)
    if (typeof pretask.name === 'string' && typeof pretask.exec === 'string')
      definitions.push({ ...pretask, name: '__MXU_PRETASK__' + pretask.name, entry: 'MXU_PRETASK' });
  const controller = pi.controller?.find(item => item.name === instance.controllerName) ?? pi.controller?.[0];
  const resources = pi.resource?.filter(item => !item.controller?.length || item.controller.includes(controller?.name)) ?? [];
  const resource = resources.find(item => item.name === instance.resourceName) ?? resources[0];
  if (!controller || !resource || !maaendObject(options)) throw new Error('maaend_controller_resource_required');
  const rows = instance.tasks.map(task => {
    if (typeof task.id !== 'string' || !task.id || task.id.length > 50 || /[\/\u0000-\u001f]/.test(task.id) ||
        typeof task.taskName !== 'string' || typeof task.enabled !== 'boolean' ||
        task.optionValues !== undefined && !maaendObject(task.optionValues) || task.enabledByController !== undefined &&
          (!maaendObject(task.enabledByController) || Object.values(task.enabledByController).some(value => typeof value !== 'boolean')))
      throw new Error('maaend_saved_task_invalid');
    const matches = definitions.filter(definition => definition.name === task.taskName);
    const special = maaendTechnical.includes(task.taskName) || maaendCleanup.includes(task.taskName);
    const definition = matches.length === 1 ? matches[0] : special ? { name: task.taskName, entry: 'MXU_SPECIAL' } : null;
    const known = !!definition && (special || definition.entry === 'MXU_PRETASK' || MAAEND_ENTRIES[task.taskName] === definition.entry);
    const compatible = known && (!definition.controller?.length || definition.controller.includes(controller.name)) &&
      (!definition.resource?.length || definition.resource.includes(resource.name));
    let label = definition?.label || task.taskName;
    if (label.startsWith('$')) label = translations[label.slice(1)] || task.taskName;
    const title = task.customName || label;
    if (typeof title !== 'string' || !title || title.length > 256) throw new Error('maaend_task_title_invalid');
    return { saved: task, definition, known, compatible, title, logName: title.replace(/<[^>]*>/g, '').trim(), taskId: 'maaend:' + instance.id + '/' + task.id,
      role: maaendCleanup.includes(task.taskName) ? 'cleanup' : maaendTechnical.includes(task.taskName) || definition?.entry === 'MXU_PRETASK' ? 'technical' : 'business' };
  });
  return { main, document, instance, pi, definitions, options, controller, resource, rows, translations, sourceDiagnostics: metadata.diagnostics };
}

function maaendTasks(config) {
  const pretask = row => row.definition?.entry === 'MXU_PRETASK';
  const rows = [...config.rows.filter(pretask), ...config.rows.filter(row => !pretask(row))], dependencies = [], preparation = [];
  return rows.map(row => {
    const launch = row.known && ['AndroidOpenGame', 'LaunchGameLinux'].includes(row.saved.taskName) ||
      row.saved.taskName === '__MXU_PRETASK__LaunchGamePC' && row.definition?.exec === 'agent/go-service' &&
      JSON.stringify(row.definition.args) === '["--pretask","LaunchGamePC"]' &&
      (row.saved.optionValues?.LaunchGamePCGameSetting?.caseName ?? config.options.LaunchGamePCGameSetting?.default_case) === 'No';
    const task = { taskId: row.taskId, executionTaskId: row.executionTaskId, title: row.title, isEnabled: row.saved.enabled,
      ...(row.known && !row.saved.customName ? { titleLocales: nexusTaskLocales(row.saved.taskName) } : {}),
      isSelected: row.saved.enabled && row.compatible, retrySafety: row.known && (row.role === 'business' || launch) ? 'safe' : 'unknown',
      dependencies: row.role === 'business' ? dependencies.slice() : [], workflowRole: row.role,
      ...(row.known ? { projection: { resourceId: config.main.resourceId, relativePath: config.main.relativePath ?? '', selector: maaendTaskSelector(config, row, 'enabled') } } : {}),
      ...(row.role === 'business' && preparation.length ? { retryPrerequisites: preparation.slice().sort() } : {}) };
    if (row.saved.enabled && row.compatible && (pretask(row) || launch)) dependencies.push(row.taskId);
    if (row.saved.enabled && row.compatible && launch) preparation.push(row.taskId);
    return task;
  });
}

function maaendFreeze(input, tasks) {
  if (!Array.isArray(input.tasks) || input.tasks.length !== tasks.length || input.tasks.some((task, index) =>
    ['taskId', 'executionTaskId', 'title', 'isSelected', 'isEnabled', 'retrySafety', 'workflowRole'].some(key => task[key] !== tasks[index][key]) ||
    !nexusTitleEquals(task.titleLocales, tasks[index].titleLocales) ||
    ['dependencies', 'projection', 'retryPrerequisites'].some(key => JSON.stringify(task[key] ?? null) !== JSON.stringify(tasks[index][key] ?? null))))
    throw new Error('maaend_frozen_tasks_changed');
}
