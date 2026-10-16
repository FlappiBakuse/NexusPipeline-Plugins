function discover() {
  const config = configOne(r => r.format === 'json'), d = config.document, plan = createPlan();
  requireValue(object(d.TaskEnabledList));
  behavior(plan, config, ADAPTER.behaviorKeys);
  const modern = object(d.TaskDefinitions) && Object.keys(d.TaskDefinitions).length > 0;
  const ordered = Array.isArray(d.TaskOrder) && d.TaskOrder.length ? d.TaskOrder : Object.keys(d.TaskEnabledList);
  requireValue(unique(ordered));
  const activeKeys = ordered.filter(key => typeof d.TaskEnabledList[key] === 'boolean');
  const keys = Array.from(new Set(activeKeys.concat(Object.keys(d.TaskEnabledList), modern ? Object.keys(d.TaskDefinitions) : [])));
  requireValue(keys.every(k => typeof k === 'string'));
  const start = d.NextTaskId ? activeKeys.indexOf(d.NextTaskId) : 0;
  keys.forEach((key, index) => {
    const name = modern ? d.TaskDefinitions[key] || key : key;
    const declared = typeof d.TaskEnabledList[key] === 'boolean';
    const task = addTask(plan, config.id, key, name, declared && d.TaskEnabledList[key] && activeKeys.includes(key) && (start < 0 || activeKeys.indexOf(key) >= start),
      declared ? ['TaskEnabledList', key] : null,
      (name === '领取邮件' || name === '领取每日奖励') && !d.NextTaskId ? 'safe' : 'unknown',
      ADAPTER.builtInNames.includes(name) || modern && typeof d.TaskDefinitions[key] === 'string' ? 'supported' : 'unsupported');
    if (modern) task.nameText = { kind: 'literal', value: name };
  });
  if (d.NextTaskId && start < 0) plan.verification.opaqueScopes.push({id:ADAPTER.id+':cursor',resourceId:config.id,enabled:true,reasonCode:'unknown_resume_cursor'});
  plan.coverage = 'complete';
  return plan;
}
