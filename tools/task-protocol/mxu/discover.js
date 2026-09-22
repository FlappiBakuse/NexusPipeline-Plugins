function discover() {
  const config = configOne(r => r.id === 'config:mxu-' + ADAPTER.project + '.json'), d = config.document, plan = createPlan();
  requireValue(Array.isArray(d.instances) && object(d.settings));
  const target = d.settings.autoStartInstanceId;
  const instances = typeof target === 'string' && target.length ? d.instances.filter(i => i.id === target) : [];
  if (instances.length !== 1) {
    const code = typeof target !== 'string' || !target.length ? 'mxu.autostart_missing' : 'mxu.autostart_invalid';
    plan.coverage = 'unsupported';
    plan.diagnostics.push({ code, message: 'Select a valid automatic-run instance in the bound user configuration. The active tab is not an automatic-run target.',
      reasonText: { kind: 'plugin', key: 'diagnostic.' + code, args: {},
        fallback: '请通过编辑配置，在当前绑定用户的配置中选择有效的自动执行实例；当前打开的配置页不等于自动执行目标。' } });
    return plan;
  }
  requireValue(Array.isArray(instances[0].tasks));
  const instance = instances[0], pi = resource('interface');
  behavior(plan, { id: config.id, document: instance }, ['controllerName', 'resourceName'], ['instances', { by: 'id', value: instance.id }]);
  requireValue(pi.name === ADAPTER.project && Array.isArray(pi.task));
  const definitions = pi.task.slice();
  let options = object(pi.option) ? { ...pi.option } : {};
  let importsComplete = true;
  for (const path of pi.import || []) {
    const declaredTasks = ADAPTER.importTasks[path];
    if (declaredTasks && !instance.tasks.some(t => declaredTasks.includes(t.taskName))) continue;
    const id = ADAPTER.imports[path];
    if (!id) { importsComplete = false; continue; }
    try {
      const imported = resource(id);
      if (Array.isArray(imported.task)) definitions.push(...imported.task);
      if (object(imported.option)) options = { ...options, ...imported.option };
    }
    catch { importsComplete = false; }
  }
  const language = d.settings.language === "system" ? (input.locale || "zh-CN") : d.settings.language;
  let translations = {};
  if (ADAPTER.locales[language]) { try { translations = resource(ADAPTER.locales[language]); } catch { /* ID fallback remains visible */ } }
  // importConfig clears removed names; Toolbar then chooses the first current definition.
  const controller = (pi.controller || []).some(c => c.name === instance.controllerName)
    ? instance.controllerName : (pi.controller || [])[0]?.name;
  const selectedResource = (pi.resource || []).some(r => r.name === instance.resourceName)
    ? instance.resourceName : (pi.resource || [])[0]?.name;
  requireValue(unique(instance.tasks.map(t => t.id)));
  for (const task of instance.tasks) {
    requireValue(typeof task.id === 'string' && typeof task.taskName === 'string' && typeof task.enabled === 'boolean');
    const defs = definitions.filter(t => t.name === task.taskName), def = defs.length === 1 ? defs[0] : null;
    let label = def?.label || task.taskName;
    if (label.startsWith('$')) label = translations[label.slice(1)] || label.slice(1);
    const name = task.customName || label;
    const compatible = !def || ((!controller || !def.controller?.length || def.controller.includes(controller))
      && (!selectedResource || !def.resource?.length || def.resource.includes(selectedResource)));
    const enabled = task.enabled && compatible;
    const selector = ['instances', { by: 'id', value: instance.id }, 'tasks', { by: 'id', value: task.id }, 'enabled'];
    behavior(plan, { id: config.id, document: task }, ['optionValues'], selector.slice(0, -1));
    // Startup uses enabled; a persisted controller cache makes selective retry unsafe to patch.
    const cached = task.enabledByController?.[controller];
    const technical = ADAPTER.technical.includes(task.taskName);
    const safe = ADAPTER.safe.includes(task.taskName) && (!object(task.enabledByController) || cached === undefined);
    const created = addTask(plan, config.id, instance.id + '/' + task.id, name, enabled, selector,
      safe ? 'safe' : 'unknown', def && importsComplete ? 'limited' : 'unsupported', technical ? 'technical' : 'business');
    if (ADAPTER.protocolVersion === '1.1' && def && !task.customName && ADAPTER.taskNameTextKeys?.[task.taskName])
      created.nameText = { kind: 'plugin', key: ADAPTER.taskNameTextKeys[task.taskName], args: {}, fallback: name };
    optionSummary(plan, created, task, def, options);
  }
  plan.diagnostics.push({ code: 'coverage_limited', message: 'MXU task callbacks cover outer tasks only. Duplicate labels, unsupported resources and silent inner branches remain unknown.' });
  return plan;
}
