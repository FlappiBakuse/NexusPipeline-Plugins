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
      exit: 'Exit', close: 'Exit', 退出: 'Exit', 退出程序: 'Exit', 关闭软件: 'Exit',
      关闭游戏和软件: 'CloseGameAndExit', 关闭游戏: 'CloseGameAndExit',
      closegameandexit: 'CloseGameAndExit',
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
    if (action === 'CloseGameAndExit') {
      const queue = input.executionContext?.queue || {};
      if (queue.hasFollowingWork === 'no' || queue.nextTargetRelation === 'different'
        || (queue.nextTargetRelation === 'same'
          && ['host', 'upstream'].includes(queue.nextLaunchOwner)))
        return push(rule, 'satisfied', 'info', 'none', location(rule));
      if (queue.hasFollowingWork === 'yes' && queue.nextTargetRelation === 'same'
        && queue.nextLaunchOwner === 'already_running')
        return push(rule, 'violated', 'error', 'block', location(rule),
          { kind: 'literal', value: '下一项依赖同一游戏保持运行，但本项完成动作将关闭游戏。' },
          [{ kind: 'open_binding_editor' }, { kind: 'refresh_plan' }]);
      return push(rule, 'unknown', 'warning', 'warn', location(rule),
        { kind: 'literal', value: '本项完成后将关闭游戏；下一项启动目标或责任尚未确认。' },
        [{ kind: 'refresh_plan' }]);
    }
    if (action === 'RunScript')
      return push(rule, 'unknown', 'warning', 'warn', location(rule), text(rule), rule.actions || [{ kind: 'open_binding_editor' }, { kind: 'refresh_plan' }]);
    if (action === 'TurnOffDisplay')
      return push(rule, 'unknown', 'warning', 'warn', location(rule),
        { kind: 'literal', value: '关闭显示器不等同整机关机，但可能影响后续依赖屏幕的任务。' },
        [{ kind: 'refresh_plan' }]);
    if (['Loop', 'Shutdown', 'Sleep', 'Hibernate', 'Restart', 'Logoff'].includes(action)) {
      // The upstream performs these actions before Host can finish restoring
      // its configuration transaction, including on the last queue item.
      return push(rule, 'violated', 'error', 'block', location(rule), text(rule), rule.actions || [{ kind: 'open_binding_editor' }, { kind: 'refresh_plan' }]);
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
  const inspectMxuLaunchOwner = rule => {
    const context = input.executionContext || {};
    if (context.mode !== 'pc')
      return push(rule, 'not_applicable', 'info', 'none', location(rule));
    if (context.launchOwner === 'host')
      return typeof context.gameTarget?.value === 'string' && context.gameTarget.value.trim()
        ? push(rule, 'not_applicable', 'info', 'none', location(rule))
        : push(rule, 'violated', 'error', 'block', location(rule), text(rule),
          [{ kind: 'open_script_settings' }, { kind: 'refresh_plan' }]);
    if (context.launchOwner !== 'already_running')
      return push(rule, 'unknown', 'warning', 'warn', location(rule), text(rule), [{ kind: 'refresh_plan' }]);
    if (context.gameTarget?.ready === true)
      return push(rule, 'satisfied', 'info', 'none', location(rule));
    const document = read('config', rule.resourceId);
    const target = document?.settings?.autoStartInstanceId;
    const instances = Array.isArray(document?.instances) ? document.instances.filter(i => i && i.id === target) : [];
    if (instances.length !== 1 || !Array.isArray(instances[0].tasks))
      return push(rule, 'unknown', 'warning', 'warn', location(rule), text(rule), [{ kind: 'refresh_plan' }]);
    const instance = instances[0];
    const expected = context.gameTarget?.value;
    const sameProgram = value => typeof value === 'string' && typeof expected === 'string'
      && value.trim().replace(/\//g, '\\').toLowerCase() === expected.trim().replace(/\//g, '\\').toLowerCase();
    const actions = Array.isArray(instance.preActions) && instance.preActions.length
      ? instance.preActions : instance.preAction ? [instance.preAction] : [];
    const preActionLaunch = actions.some(action => action && action.enabled === true && sameProgram(action.program));
    const taskLaunch = instance.tasks.some(task => task && task.enabled === true
      && task.taskName === '__MXU_LAUNCH__'
      && sameProgram(task.optionValues?.__MXU_LAUNCH_OPTION__?.values?.program));
    if (preActionLaunch || taskLaunch)
      return push(rule, 'satisfied', 'info', 'none', location(rule));
    const possibleLaunch = actions.some(action => action && action.enabled === true)
      || instance.tasks.some(task => task && task.enabled === true
        && (task.taskName === '__MXU_LAUNCH__' || task.taskName.startsWith('__MXU_PRETASK__')));
    if (context.gameTarget?.ready !== false || possibleLaunch)
      return push(rule, 'unknown', 'warning', 'warn', location(rule), text(rule), [{ kind: 'open_binding_editor' }, { kind: 'refresh_plan' }]);
    return push(rule, 'violated', 'error', 'block', location(rule), text(rule),
      [{ kind: 'open_script_settings' }, { kind: 'open_binding_editor' }, { kind: 'refresh_plan' }]);
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
    const selected = select(document, rule.selector);
    const value = selected === undefined ? rule.defaultAction : selected;
    if (value === undefined || value === null) return push(rule, 'unknown', 'warning', 'warn', location(rule), text(rule), rule.actions || [{ kind: 'open_binding_editor' }, { kind: 'refresh_plan' }]);
    if (value === '' && rule.emptyAction === 'None') return finishAction(rule, 'None');
    return finishAction(rule, value);
  };
  const inspectFinishFlags = rule => {
    const id = rule.configResource === 'main' ? mainConfigId() : rule.resourceId;
    const document = read('config', id);
    if (!document || typeof document !== 'object')
      return push(rule, 'unknown', 'warning', 'warn', location(rule), text(rule), [{ kind: 'refresh_plan' }]);
    const value = key => document[key] === undefined ? false : document[key];
    const closeGame = value('CLOSE_GAME_FINISH'), closeTarget = value('CLOSE_EMULATOR_FINISH'), closeScript = value('CLOSE_BAAH_FINISH');
    const postCommand = document.POST_COMMAND === undefined ? '' : document.POST_COMMAND;
    if (![closeGame, closeTarget, closeScript].every(flag => typeof flag === 'boolean')
      || typeof postCommand !== 'string' || postCommand.trim())
      return push(rule, 'unknown', 'warning', 'warn', location(rule), text(rule), [{ kind: 'open_binding_editor' }, { kind: 'refresh_plan' }]);
    const context = input.executionContext || {};
    // Upstream BAAH skips CLOSE_GAME_FINISH in PC mode; CLOSE_EMULATOR_FINISH
    // also closes its PC target. Do not confuse the two similarly named flags.
    if (context.mode === 'pc') return finishAction(rule, closeTarget ? 'CloseGameAndExit' : closeScript ? 'Exit' : 'None');
    if (context.mode === 'emulator' && (closeGame || closeTarget)) {
      if (context.queue?.hasFollowingWork === 'no') return finishAction(rule, 'None');
      return push(rule, 'unknown', 'warning', 'warn', location(rule),
        { kind: 'literal', value: '上游将关闭模拟器或其应用；后继是否共享此实例及重新启动责任需要核对。' }, [{ kind: 'refresh_plan' }]);
    }
    if (closeGame || closeTarget) return push(rule, 'unknown', 'warning', 'warn', location(rule), text(rule), [{ kind: 'refresh_plan' }]);
    return finishAction(rule, closeScript ? 'Exit' : 'None');
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
    if (enabled.length === 1 && enabled[0].sourceKey === 'runtime_unverified') {
      const identity = runtimeIdentity(read('resource', 'runtime-app'), read('resource', 'runtime-head'),
        read('resource', 'runtime-tag'), read('resource', 'runtime-origin'), input.executionContext?.runtimeActivity);
      if (identity.restricted) return push(rule, 'satisfied', 'info', 'none', location(rule));
    }
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
    const origin = read('resource', 'runtime-origin');
    const identity = runtimeIdentity(app, head, tag, origin, input.executionContext?.runtimeActivity);
    if (identity.restricted) return push(rule, 'unknown', 'warning', 'warn', location(rule), identity.reasonText,
      [{ kind: 'refresh_plan' }]);
    if (identity.ready) return push(rule, 'satisfied', 'info', 'none', location(rule));
    return push(rule, 'unknown', 'error', 'block', location(rule), identity.reasonText, rule.actions || [{ kind: 'open_script_settings' }, { kind: 'refresh_plan' }]);
  };
  for (const rule of ADAPTER.configRules || []) {
    try {
      if (rule.kind === 'target_compare') inspectTarget(rule);
      else if (rule.kind === 'autostart') inspectAutostart(rule);
      else if (rule.kind === 'mxu_launch_owner') inspectMxuLaunchOwner(rule);
      else if (rule.kind === 'file_logging') inspectLogging(rule);
      else if (rule.kind === 'finish_action') inspectFinishAction(rule);
      else if (rule.kind === 'finish_flags') inspectFinishFlags(rule);
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
