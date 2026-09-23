// Configuration checks are deliberately declarative and read-only. The Host owns
// the final assessment identity/readiness; this module only supplies rule facts.
function finalizeAssessment(plan) {
  const checks = [];
  const read = (kind, id) => {
    try { return (kind === 'resource' ? nexus.readResource(id) : nexus.readConfig(id)).document; }
    catch { return undefined; }
  };
  const select = (document, selector) => {
    let current = document;
    for (const token of selector || []) {
      if (typeof token !== 'string' || current === null || typeof current !== 'object' || !(token in current)) return undefined;
      current = current[token];
    }
    return current;
  };
  const mainConfigId = () => {
    const resources = Array.isArray(input.configResources) ? input.configResources : [];
    const found = resources.filter(resource => resource && typeof resource.id === 'string'
      && resource.id.startsWith('config:') && resource.format === 'json');
    return found.length === 1 ? found[0].id : undefined;
  };
  const normalizedAction = value => {
    if (value === undefined || value === null) return undefined;
    const raw = String(value).trim();
    const key = raw.toLowerCase().replace(/[ _-]/g, '');
    return ({
      none: 'None', noneoperation: 'None', 无: 'None', 无操作: 'None',
      exit: 'Exit', close: 'Exit', 退出: 'Exit', 退出程序: 'Exit',
      runscript: 'RunScript', 运行脚本: 'RunScript',
      loop: 'Loop', 循环: 'Loop',
      shutdown: 'Shutdown', 关机: 'Shutdown',
      sleep: 'Sleep', 睡眠: 'Sleep',
      hibernate: 'Hibernate', 休眠: 'Hibernate',
      restart: 'Restart', reboot: 'Restart', 重启: 'Restart',
      logoff: 'Logoff', 注销: 'Logoff',
      turnoffdisplay: 'TurnOffDisplay', screenoff: 'TurnOffDisplay', 关闭显示器: 'TurnOffDisplay',
      mute: 'None', unmute: 'None'
    })[key] || ({
      None: 'None', Exit: 'Exit', RunScript: 'RunScript', Loop: 'Loop',
      Shutdown: 'Shutdown', Sleep: 'Sleep', Hibernate: 'Hibernate',
      Restart: 'Restart', Logoff: 'Logoff', TurnOffDisplay: 'TurnOffDisplay'
    })[raw];
  };
  const finishAction = (rule, value) => {
    const action = normalizedAction(value);
    if (!action) return push(rule, 'unknown', 'warning', 'warn', location(rule), text(rule), rule.actions || [{ kind: 'open_binding_editor' }, { kind: 'refresh_plan' }]);
    if (['None', 'Exit'].includes(action)) return push(rule, 'satisfied', 'info', 'none', location(rule));
    if (action === 'RunScript')
      return push(rule, 'unknown', 'warning', 'warn', location(rule), text(rule), rule.actions || [{ kind: 'open_binding_editor' }, { kind: 'refresh_plan' }]);
    if (['Loop', 'Shutdown', 'Sleep', 'Hibernate', 'Restart', 'Logoff', 'TurnOffDisplay'].includes(action)) {
      const context = input.executionContext || {}, following = context.queue && context.queue.hasFollowingWork;
      if (following === 'yes')
        return push(rule, 'violated', 'error', 'block', location(rule), text(rule), rule.actions || [{ kind: 'open_binding_editor' }, { kind: 'refresh_plan' }]);
      if (following !== 'no')
        return push(rule, 'unknown', 'warning', 'warn', location(rule), text(rule), rule.actions || [{ kind: 'refresh_plan' }]);
      return push(rule, 'satisfied', 'info', 'none', location(rule));
    }
    return push(rule, 'unknown', 'warning', 'warn', location(rule), text(rule), rule.actions || [{ kind: 'open_binding_editor' }, { kind: 'refresh_plan' }]);
  };
  const text = rule => rule.reasonKey
    ? { kind: 'plugin', key: rule.reasonKey, args: {}, fallback: rule.fallback }
    : { kind: 'literal', value: rule.fallback || 'Configuration could not be verified.' };
  const location = rule => {
    const declared = Array.isArray(rule.locations) ? rule.locations : rule.location ? [rule.location] : [];
    const available = new Set((input.configResources || []).map(resource => resource.id));
    // Missing optional files still produce a check, but cannot offer a field
    // location in a config resource the Host has not exposed in this snapshot.
    return declared.filter(item => item.source !== 'config' || available.has(item.resourceId));
  };
  const push = (rule, evaluation, severity, effect, locations, reason, actions) => {
    const value = { ruleId: rule.id, evaluation, severity, executionEffect: effect,
      scope: rule.scope || { kind: 'binding' }, locations: locations || [], actions: actions || [] };
    if (reason) value.reasonText = reason;
    checks.push(value);
  };
  const targetInspectionId = rule => {
    if (rule.inspectionId) return rule.inspectionId;
    const mode = input.executionContext && input.executionContext.mode;
    return rule.inspectionIdByMode?.[mode] || rule.inspectionIdByMode?.unknown;
  };
  const inspectTarget = rule => {
    if (rule.unverifiedWhen && input.executionContext?.mode === rule.unverifiedWhen.mode) {
      const condition = rule.unverifiedWhen;
      const id = condition.resourceId === 'main' ? mainConfigId() : condition.resourceId;
      const value = select(read('config', id), condition.selector);
      if (value === condition.equals || condition.requireBoolean === true && value !== undefined && typeof value !== 'boolean')
        return push(rule, 'unknown', 'warning', 'warn', location(rule), text(condition), [{ kind: 'open_binding_editor' }, { kind: 'refresh_plan' }]);
    }
    if (rule.notApplicableWhen) {
      const condition = rule.notApplicableWhen;
      const value = select(read('config', condition.resourceId), condition.selector);
      if (value === condition.equals) return push(rule, 'not_applicable', 'info', 'none', location(rule));
    }
    const inspectionId = targetInspectionId(rule);
    if (!inspectionId) return push(rule, 'unknown', rule.severity || 'warning', rule.effect || 'warn', location(rule), text(rule), rule.actions || [{ kind: 'refresh_plan' }]);
    let inspection;
    try { inspection = nexus.inspectDeclaredTarget(inspectionId); }
    catch { inspection = { status: 'not_checked' }; }
    const base = location(rule).concat([{ source: 'environment', inspectionId }]);
    if (inspection.status === 'present' && inspection.matchesContext === true)
      return push(rule, 'satisfied', 'info', 'none', base);
    if (inspection.status === 'present' && inspection.matchesContext === false)
      return push(rule, 'violated', 'warning', 'warn', base, text(rule), rule.actions || [{ kind: 'open_binding_editor' }, { kind: 'refresh_plan' }]);
    if (inspection.status === 'present' && inspection.matchesContext == null)
      return push(rule, 'unknown', rule.severity || 'warning', rule.effect || 'warn', base, text(rule), rule.actions || [{ kind: 'refresh_plan' }]);
    if (inspection.status === 'missing' || inspection.status === 'wrong_kind')
      return push(rule, 'violated', rule.severity || 'warning', rule.effect || 'warn', base, text(rule), rule.actions || [{ kind: 'open_binding_editor' }, { kind: 'refresh_plan' }]);
    if (inspection.status === 'unsupported')
      return push(rule, 'unknown', rule.severity || 'warning', rule.effect || 'warn', base, text(rule), rule.actions || [{ kind: 'open_binding_editor' }, { kind: 'refresh_plan' }]);
    return push(rule, 'unknown', rule.severity || 'warning', rule.effect || 'warn', base, text(rule), rule.actions || [{ kind: 'refresh_plan' }]);
  };
  const inspectAutostart = rule => {
    const document = read('config', rule.resourceId);
    if (!document || typeof document !== 'object')
      return push(rule, 'unknown', 'error', 'block', location(rule), text(rule), rule.actions || [{ kind: 'refresh_plan' }]);
    const target = document.settings && document.settings.autoStartInstanceId;
    const instances = document && Array.isArray(document.instances) ? document.instances : null;
    const matches = typeof target === 'string' && target.length > 0 && instances && instances.filter(i => i && i.id === target).length === 1;
    const loc = location(rule);
    if (matches) return push(rule, 'satisfied', 'info', 'none', loc);
    const reasonKey = target === undefined || target === null || target === '' ? rule.missingReasonKey : rule.invalidReasonKey;
    const copy = Object.assign({}, rule, { reasonKey: reasonKey || rule.reasonKey });
    return push(copy, 'violated', 'error', 'block', loc, text(copy), rule.actions || [{ kind: 'open_binding_editor' }, { kind: 'refresh_plan' }]);
  };
  const inspectLogging = rule => {
    const document = read('resource', rule.resourceId);
    if (!document || typeof document !== 'object')
      return push(rule, 'unknown', 'error', 'block', location(rule), text(rule), rule.actions || [{ kind: 'refresh_plan' }]);
    const value = Object.prototype.hasOwnProperty.call(document, 'SAVE_LOG_TO_FILE') ? document.SAVE_LOG_TO_FILE : false;
    if (value === true) return push(rule, 'satisfied', 'info', 'none', location(rule));
    if (value === false) {
      const context = input.executionContext || {};
      const source = context.logSource || {};
      if (source.kind === 'stdout' && source.available === true)
        return push(rule, 'satisfied', 'info', 'none', location(rule));
      return push(rule, 'violated', 'error', 'block', location(rule), text(rule), rule.actions || [{ kind: 'open_binding_editor' }, { kind: 'refresh_plan' }]);
    }
    return push(rule, 'unknown', 'error', 'block', location(rule), text(rule), rule.actions || [{ kind: 'open_binding_editor' }, { kind: 'refresh_plan' }]);
  };
  const inspectFinishAction = rule => {
    const resourceId = rule.configResource === 'main' ? mainConfigId() : rule.resourceId;
    const document = resourceId ? read(rule.readKind === 'resource' ? 'resource' : 'config', resourceId) : undefined;
    if (!document || typeof document !== 'object')
      return push(rule, 'unknown', 'warning', 'warn', location(rule), text(rule), rule.actions || [{ kind: 'refresh_plan' }]);
    const value = select(document, rule.selector);
    if (value === undefined || value === null) return push(rule, 'unknown', 'warning', 'warn', location(rule), text(rule), rule.actions || [{ kind: 'open_binding_editor' }, { kind: 'refresh_plan' }]);
    return finishAction(rule, value);
  };
  const inspectMxuFinishAction = rule => {
    const document = read('config', rule.resourceId);
    if (!document || typeof document !== 'object')
      return push(rule, 'unknown', 'warning', 'warn', location(rule), text(rule), rule.actions || [{ kind: 'refresh_plan' }]);
    const target = document.settings && document.settings.autoStartInstanceId;
    const instances = Array.isArray(document.instances) ? document.instances.filter(item => item && item.id === target) : [];
    if (instances.length !== 1)
      return push(rule, 'unknown', 'warning', 'warn', location(rule), text(rule), rule.actions || [{ kind: 'open_binding_editor' }, { kind: 'refresh_plan' }]);
    if (!Array.isArray(instances[0].tasks))
      return push(rule, 'unknown', 'warning', 'warn', location(rule), text(rule), [{ kind: 'refresh_plan' }]);
    const tasks = instances[0].tasks.filter(task => task && task.taskName === rule.taskName && task.enabled !== false);
    if (tasks.length === 0) return push(rule, 'not_applicable', 'info', 'none', location(rule));
    const values = tasks.map(task => {
      if (task.enabled !== true) return undefined;
      const option = task.optionValues && task.optionValues[rule.optionId];
      const value = option && typeof option === 'object' ? option.caseName : option;
      return normalizedAction(value === undefined ? rule.defaultAction : value);
    });
    const disruptive = values.find(value => ['Shutdown', 'Sleep', 'Hibernate', 'Restart', 'Logoff', 'TurnOffDisplay'].includes(value));
    if (disruptive) return finishAction(rule, disruptive);
    if (values.some(value => !value))
      return push(rule, 'unknown', 'warning', 'warn', location(rule), text(rule), [{ kind: 'open_binding_editor' }, { kind: 'refresh_plan' }]);
    return finishAction(rule, values[0]);
  };
  const inspectProcessExit = rule => {
    const selectors = Array.isArray(rule.selectors) ? rule.selectors : [rule.selector];
    const values = selectors.map(selector => select(read('config', rule.resourceId), selector));
    if (values.length > 0 && values.every(value => typeof value === 'boolean')) return push(rule, 'satisfied', 'info', 'none', location(rule));
    return push(rule, 'unknown', 'warning', 'warn', location(rule), text(rule), rule.actions || [{ kind: 'open_script_settings' }, { kind: 'refresh_plan' }]);
  };
  const inspectControllerResource = rule => {
    const document = read('config', rule.resourceId);
    if (!document || typeof document !== 'object')
      return push(rule, 'unknown', 'warning', 'warn', location(rule), text(rule), rule.actions || [{ kind: 'refresh_plan' }]);
    const target = document && document.settings && document.settings.autoStartInstanceId;
    const instances = document && Array.isArray(document.instances) ? document.instances.filter(item => item && item.id === target) : [];
    if (instances.length !== 1) return push(rule, 'unknown', 'warning', 'warn', location(rule), text(rule), rule.actions || [{ kind: 'open_binding_editor' }, { kind: 'refresh_plan' }]);
    const instance = instances[0];
    if (typeof instance.controllerName === 'string' && instance.controllerName.length > 0
      && typeof instance.resourceName === 'string' && instance.resourceName.length > 0)
      return push(rule, 'satisfied', 'info', 'none', location(rule));
    return push(rule, 'unknown', 'warning', 'warn', location(rule), text(rule), rule.actions || [{ kind: 'open_binding_editor' }, { kind: 'refresh_plan' }]);
  };
  const inspectSingleDaily = rule => {
    const enabled = plan.tasks.filter(task => task.enabled && task.role !== 'technical');
    if (enabled.length === 0) return push(rule, 'not_applicable', 'info', 'none', location(rule));
    const allowed = new Set(rule.allowedTaskKeys || []);
    if (allowed.size > 0 && enabled.every(task => allowed.has(task.sourceKey)))
      return push(rule, 'satisfied', 'info', 'none', location(rule));
    return push(rule, 'violated', 'error', 'block', location(rule), text(rule), rule.actions || [{ kind: 'open_script_settings' }, { kind: 'refresh_plan' }]);
  };
  const inspectFinite = rule => {
    const enabled = plan.tasks.some(t => t.sourceKey === rule.taskKey && t.enabled);
    if (!enabled) return push(rule, 'not_applicable', 'info', 'none', location(rule));
    const document = read('config', rule.resourceId);
    if (!document || typeof document !== 'object')
      return push(rule, 'unknown', 'error', 'block', location(rule), text(rule), rule.actions || [{ kind: 'refresh_plan' }]);
    const mode = document && document['Teleport to Boss'], count = document && document['Repeat Farm Count'];
    if (['Weekly Challenge', 'Boss Challenge'].includes(mode) && Number.isSafeInteger(count) && count > 0)
      return push(rule, 'satisfied', 'info', 'none', location(rule));
    return push(rule, 'violated', 'error', 'block', location(rule), text(rule), rule.actions || [{ kind: 'open_binding_editor' }, { kind: 'refresh_plan' }]);
  };
  const inspectRoutine = rule => {
    const document = read('config', rule.resourceId);
    if (!document || typeof document !== 'object' || Array.isArray(document))
      return push(rule, 'unknown', 'error', 'block', location(rule), text(rule), [{ kind: 'refresh_plan' }]);
    // The same upstream projection governs discovery and admission. Missing
    // defaults/duplicate selections affect patch safety, not initial validity.
    const normalized = normalizeItems(document['Routine Items'], ADAPTER.entries);
    if (normalized.diagnostics.length === 0) return push(rule, 'satisfied', 'info', 'none', location(rule));
    return push(rule, 'violated', 'error', 'block', location(rule), text(rule), rule.actions || [{ kind: 'open_binding_editor' }, { kind: 'refresh_plan' }]);
  };
  const inspectRuntime = rule => {
    const app = read('resource', 'runtime-app');
    const head = read('resource', 'runtime-head');
    const tag = read('resource', 'runtime-tag');
    const identity = runtimeIdentity(app, head, tag);
    if (identity.ready) return push(rule, 'satisfied', 'info', 'none', location(rule));
    return push(rule, 'unknown', 'error', 'block', location(rule), identity.reasonText, rule.actions || [{ kind: 'open_script_settings' }, { kind: 'refresh_plan' }]);
  };
  for (const rule of ADAPTER.configRules || []) {
    try {
      if (rule.kind === 'target_compare') inspectTarget(rule);
      else if (rule.kind === 'autostart') inspectAutostart(rule);
      else if (rule.kind === 'file_logging') inspectLogging(rule);
      else if (rule.kind === 'finish_action') inspectFinishAction(rule);
      else if (rule.kind === 'mxu_finish_action') inspectMxuFinishAction(rule);
      else if (rule.kind === 'process_exit') inspectProcessExit(rule);
      else if (rule.kind === 'controller_resource') inspectControllerResource(rule);
      else if (rule.kind === 'single_daily') inspectSingleDaily(rule);
      else if (rule.kind === 'finite_additions') inspectFinite(rule);
      else if (rule.kind === 'routine_schema') inspectRoutine(rule);
      else if (rule.kind === 'runtime_distribution') inspectRuntime(rule);
      else {
        const critical = rule.required === true && rule.criticality === 'critical_when_applicable';
        push(rule, 'unknown', critical ? 'error' : (rule.severity || 'warning'), critical ? 'block' : (rule.effect || 'warn'),
          location(rule), text(rule), rule.actions || [{ kind: 'refresh_plan' }]);
      }
    } catch {
      const critical = rule.required === true && rule.criticality === 'critical_when_applicable';
      push(rule, 'unknown', critical ? 'error' : (rule.severity || 'warning'), critical ? 'block' : (rule.effect || 'warn'),
        location(rule), text(rule), rule.actions || [{ kind: 'refresh_plan' }]);
    }
  }
  return { schemaVersion: '1', checks };
}
