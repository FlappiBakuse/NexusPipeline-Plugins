function discover() {
  const config = configOne(r => r.id === 'config:mxu-' + ADAPTER.project + '.json'), d = config.document, plan = createPlan();
  requireValue(Array.isArray(d.instances) && object(d.settings) && typeof d.settings.autoStartInstanceId === 'string');
  const instances = d.instances.filter(i => i.id === d.settings.autoStartInstanceId);
  requireValue(instances.length === 1 && Array.isArray(instances[0].tasks));
  const instance = instances[0], pi = resource('interface');
  behavior(plan, { id: config.id, document: instance }, ['controllerName', 'resourceName'], ['instances', { by: 'id', value: instance.id }]);
  requireValue(pi.name === ADAPTER.project && Array.isArray(pi.task));
  const definitions = pi.task.slice();
  let importsComplete = true;
  for (const path of pi.import || []) {
    const declaredTasks = ADAPTER.importTasks[path];
    if (declaredTasks && !instance.tasks.some(t => declaredTasks.includes(t.taskName))) continue;
    const id = ADAPTER.imports[path];
    if (!id) { importsComplete = false; continue; }
    try { const imported = resource(id); if (Array.isArray(imported.task)) definitions.push(...imported.task); }
    catch { importsComplete = false; }
  }
  const language = d.settings.language === "system" ? (input.locale || "zh-CN") : d.settings.language;
  let translations = {};
  if (ADAPTER.locales[language]) { try { translations = resource(ADAPTER.locales[language]); } catch { /* ID fallback remains visible */ } }
  const controller = instance.controllerName || (pi.controller || [])[0]?.name;
  const selectedResource = instance.resourceName || (pi.resource || [])[0]?.name;
  requireValue(unique(instance.tasks.map(t => t.id)));
  for (const task of instance.tasks) {
    requireValue(typeof task.id === 'string' && typeof task.taskName === 'string' && typeof task.enabled === 'boolean');
    const defs = definitions.filter(t => t.name === task.taskName), def = defs.length === 1 ? defs[0] : null;
    let label = def?.label || task.taskName;
    if (label.startsWith('$')) label = translations[label.slice(1)] || task.taskName;
    const name = task.customName || label;
    const compatible = !def || ((!def.controller?.length || def.controller.includes(controller)) && (!def.resource?.length || def.resource.includes(selectedResource)));
    const enabled = task.enabled && compatible;
    const selector = ['instances', { by: 'id', value: instance.id }, 'tasks', { by: 'id', value: task.id }, 'enabled'];
    behavior(plan, { id: config.id, document: task }, ['optionValues'], selector.slice(0, -1));
    // Controller-specific caches are also selection fields. Older caches disagreeing with enabled are unsafe to patch.
    const cached = task.enabledByController?.[controller];
    const technical = ADAPTER.technical.includes(task.taskName);
    const safe = ADAPTER.safe.includes(task.taskName) && (!object(task.enabledByController) || cached === undefined);
    addTask(plan, config.id, instance.id + '/' + task.id, name, enabled, selector,
      safe ? 'safe' : 'unknown', def && importsComplete ? 'limited' : 'unsupported', technical ? 'technical' : 'business');
  }
  plan.diagnostics.push({ code: 'coverage_limited', message: 'MXU task callbacks cover outer tasks only. Duplicate labels, unsupported resources and silent inner branches remain unknown.' });
  return plan;
}
let mxuAliasCache;
function mxuAliases(tasks) {
  if (mxuAliasCache) return mxuAliasCache;
  const pi = resource('interface'), definitions = (pi.task || []).slice(), locales = [];
  const configured = tasks.length ? nexus.readConfig(tasks[0].configRef).document : { instances: [] };
  const wanted = configured.instances.flatMap(i => i.tasks || []).filter(t => tasks.some(task => task.sourceKey.endsWith('/' + t.id))).map(t => t.taskName);
  for (const path of pi.import || []) {
    const declaredTasks = ADAPTER.importTasks[path];
    if (declaredTasks && !wanted.some(name => declaredTasks.includes(name))) continue;
    const id = ADAPTER.imports[path];
    if (id) { try { definitions.push(...(resource(id).task || [])); } catch { /* unavailable imports stay unsupported */ } }
  }
  const configs = {};
  mxuAliasCache = {};
  for (const task of tasks) {
    const document = configs[task.configRef] || (configs[task.configRef] = nexus.readConfig(task.configRef).document);
    const selected = document.instances.flatMap(instance => (instance.tasks || []).filter(t => instance.id + '/' + t.id === task.sourceKey));
    const names = [task.name];
    if (selected.length === 1 && !selected[0].customName && document.settings.language === 'system') {
      if (!locales.length) for (const id of Object.values(ADAPTER.locales)) { try { locales.push(resource(id)); } catch { /* optional language */ } }
      const defs = definitions.filter(d => d.name === selected[0].taskName);
      if (defs.length === 1 && typeof defs[0].label === 'string' && defs[0].label.startsWith('$'))
        for (const locale of locales) if (typeof locale[defs[0].label.slice(1)] === 'string') names.push(locale[defs[0].label.slice(1)]);
    }
    mxuAliasCache[task.id] = names;
  }
  return mxuAliasCache;
}
function observe(text, tasks, emit, result, line, states) {
  if (line.sourceId !== 'stdout') return;
  if (input.logBatch.hasGap) { result.cursorState = {}; return; }
  // commands/state.rs log_to_stdout prefixes each physical line with local time.
  text = text.replace(/^\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3}\] /, '');
  const patterns = [
    [/^任务开始: (.+)$/, 'running'], [/^任务完成: (.+)$/, 'succeeded'], [/^任务失败: (.+)$/, 'failed'],
    [/^Task started: (.+)$/, 'running'], [/^Task completed: (.+)$/, 'succeeded'], [/^Task failed: (.+)$/, 'failed'],
    [/^任務開始: (.+)$/, 'running'], [/^任務完成: (.+)$/, 'succeeded'], [/^任務失敗: (.+)$/, 'failed']
  ];
  for (const [pattern, status] of patterns) {
    const match = text.match(pattern); if (!match) continue;
    const aliases = mxuAliases(tasks);
    const found = tasks.filter(t => aliases[t.id].includes(match[1]) && t.detection !== 'unsupported');
    if (found.length !== 1 || input.logBatch.hasGap) return;
    const task = found[0];
    const cursor = result.cursorState;
    if (cursor.source !== line.sourceId || cursor.epoch !== line.epoch || input.logBatch.hasGap) {
      cursor.source = line.sourceId; cursor.epoch = line.epoch; cursor.started = {}; cursor.finished = {};
    }
    if (status !== 'running' && (!cursor.started[task.id] || states[task.id]?.status !== 'running')) return;
    if (status === 'running') { cursor.started[task.id] = true; delete cursor.finished[task.id]; }
    else { delete cursor.started[task.id]; cursor.finished[task.id] = true; }
    emit(task, status, 'mxu.task.' + status);
    // All selected outer tasks have paired callbacks in this source/epoch; no process-exit option is needed.
    if (tasks.length && tasks.every(t => cursor.finished[t.id])) endRun(result, line, 'mxu.run.all_selected_terminal');
    return;
  }
}
