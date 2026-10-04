function discover() {
  if (input.configResources.some(r => r.id === 'config:mxu-' + ADAPTER.project + '.json')) {
    const legacy = createPlan();
    legacy.coverage = 'unsupported';
    legacy.diagnostics.push({code:'mfa.migration_required',message:'旧 MXU 配置不能用于 MFA；请重启 Host 完成原字节归档后，通过编辑配置重新设置原生实例。'});
    return legacy;
  }
  const plan = createPlan(), id = input.executionContext?.configInputValue
    || input.originalPlan?.tasks[0]?.sourceKey.split('/')[0];
  requireValue(typeof id === 'string' && /^[A-Za-z0-9_-]+$/.test(id));
  const config = instanceConfig(id);
  const d = config.document, pi = resource('interface');
  requireValue(Array.isArray(d.TaskItems) && Array.isArray(d.CurrentTasks) && pi.name === ADAPTER.project);
  const definitions = (pi.task || []).slice(), presets = (pi.preset || []).slice();
  for (const path of pi.import || []) {
    requireValue(ADAPTER.imports[path]);
    const part = resource(ADAPTER.imports[path]);
    if (Array.isArray(part.task)) definitions.push(...part.task);
    if (Array.isArray(part.preset)) presets.push(...part.preset);
  }
  const byKey = new Map(definitions.map(t => [t.name + '<|||>' + t.entry, t]));
  const byEntry = new Map(definitions.map(t => [t.entry, t]));
  const specialActions = ['CountdownAction', 'TimedWaitAction', 'SystemNotificationAction', 'CustomProgramAction',
    'KillProcessAction', 'ComputerOperationAction', 'WebhookAction', 'SwitchInstanceAction'];
  const persisted = d.TaskItems.map((t, index) => ({ saved: t, index,
    def: byKey.get(t.name + '<|||>' + t.entry) || byEntry.get(t.entry) || (specialActions.includes(t.entry) ? t : undefined) })).filter(t => t.def);
  const existing = new Set(persisted.map(t => t.def.name + '<|||>' + t.def.entry));
  const preset = d.InstancePresetKey ? presets.find(p => p.name === d.InstancePresetKey) : null;
  for (const def of byKey.values()) {
    const key = def.name + '<|||>' + def.entry;
    if (existing.has(key) || d.CurrentTasks.includes(key)) continue;
    if (d.InstancePresetKey && !preset?.task?.some(t => t.name === def.name)) continue;
    persisted.push({ saved: def, index: -1, def });
  }
  for (const key of ['CurrentTasks', 'Resource', 'CurrentControllerName', 'CurrentController',
    'ResourceOptionItems', 'GlobalOptionItems', 'ControllerOptionItems', 'InstancePresetKey',
    'BeforeTask', 'AfterTask', 'SoftwarePath', 'WaitSoftwareTime', 'EmulatorConfig',
    'AutoDetectOnConnectionFailed', 'ContinueRunningWhenError', 'AdbDevice', 'DesktopWindowName'])
    if (config.origins[key]) plan.behaviorFields.push(config.origins[key]);
  const compatible = (allowed, selected) => !allowed || !allowed.length || (Array.isArray(allowed) ? allowed : [allowed]).includes(selected);
  const controllers = (pi.controller || []).filter(c => !/playcover|macos|wlroots/i.test(c.type || ''));
  if (!controllers.length) controllers.push({name:'Adb',type:'Adb'}, {name:'Win32',type:'Win32'});
  const same = (a,b) => typeof a === 'string' && typeof b === 'string' && a.trim().toLowerCase() === b.trim().toLowerCase();
  const controller = controllers.find(c => same(c.name,d.CurrentControllerName))
    || controllers.find(c => same(c.type,d.CurrentController)) || controllers[0];
  const resources = (pi.resource || []).filter(r => !r.controller?.length || r.controller.some(c => same(c,controller.name)));
  const selectedResource = resources.find(r => same(r.name,d.Resource))?.name || resources[0]?.name || 'Default';
  for (const { saved, index, def } of persisted) {
    requireValue(typeof saved.name === 'string' && typeof saved.entry === 'string');
    const enabled = saved.default_check !== false && compatible(def.resource, selectedResource)
      && compatible(def.controller, controller.name);
    const count = def.repeatable === true ? saved.repeat_count ?? 1 : 1;
    if (enabled && (!Number.isInteger(count) || count <= 0)) plan.diagnostics.push({code:'mfa.invalid_repeat', message:'日常任务必须配置有限的正整数重复次数。'});
    const taskOrigin = config.origins.TaskItems;
    const selector = index < 0 ? null : taskOrigin.selector.concat({index, guardKey:'entry', guardValue:saved.entry}, 'default_check');
    const key = id + '/' + saved.entry + '/' + plan.tasks.length
      + (count > 1 ? '~repeat' + count : '');
    const nickname = [saved.remark, saved.display_name_override].find(value => typeof value === 'string' && value.trim());
    const task = addTask(plan, index < 0 ? config.id : taskOrigin.resourceId, key, nickname || def.label || def.name, enabled, selector,
      'safe', 'supported', specialActions.includes(saved.entry) || ADAPTER.technical.includes(def.name) ? 'technical' : 'business');
    if (nickname) {
      const key = ADAPTER.taskNameTextKeys?.[def.name];
      task.nameText = key && nickname.length <= 256
        ? { kind: 'plugin', key: key + '.custom_name', args: { nickname }, fallback: (def.label || def.name) + '（“{nickname}”）' }
        : { kind: 'literal', value: (def.label || def.name) + '（“' + nickname + '”）' };
    }
    if (task.role === 'business') task.dependencies = plan.tasks.filter(t => t.enabled
      && t.sourceKey.split('/')[1] === 'CustomProgramAction').map(t => t.id);
    if (index >= 0) behavior(plan, {id:taskOrigin.resourceId, document:saved}, ['name','entry','remark','display_name_override','option','advanced','repeat_count','pipeline_override'], selector.slice(0,-1));
  }
  const enabled = plan.tasks.filter(t => t.enabled);
  if (enabled.some(t => !plan.slots[t.id]))
    for (const task of enabled) task.retryUnitId = enabled[0].id;
  plan.coverage = 'complete';
  return plan;
}
