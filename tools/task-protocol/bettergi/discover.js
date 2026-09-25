function discover() {
  const config = configOne(r => r.format === 'json'), d = config.document, plan = createPlan();
  requireValue(object(d.TaskEnabledList));
  behavior(plan, config, Object.keys(d).filter(k => !['Name', 'NextTaskId', 'TaskEnabledList', 'TaskDefinitions', 'TaskOrder'].includes(k)));
  const modern = object(d.TaskDefinitions) && Object.keys(d.TaskDefinitions).length > 0;
  const ordered = Array.isArray(d.TaskOrder) && d.TaskOrder.length ? d.TaskOrder : Object.keys(d.TaskEnabledList);
  requireValue(unique(ordered));
  const activeKeys = ordered.filter(key => typeof d.TaskEnabledList[key] === 'boolean' && (!modern || typeof d.TaskDefinitions[key] === 'string'));
  const keys = Array.from(new Set(activeKeys.concat(Object.keys(d.TaskEnabledList), modern ? Object.keys(d.TaskDefinitions) : [])));
  requireValue(keys.every(k => typeof k === 'string'));
  const start = d.NextTaskId ? activeKeys.indexOf(d.NextTaskId) : 0;
  keys.forEach((key, index) => {
    const name = modern ? d.TaskDefinitions[key] || key : key;
    const declared = typeof d.TaskEnabledList[key] === 'boolean';
    const task = addTask(plan, config.id, key, name, declared && d.TaskEnabledList[key] && activeKeys.includes(key) && (start < 0 || activeKeys.indexOf(key) >= start),
      declared ? ['TaskEnabledList', key] : null,
      (name === '领取邮件' || name === '领取每日奖励') && !d.NextTaskId ? 'safe' : 'unknown',
      name === '领取邮件' || name === '领取每日奖励' ? 'supported' : 'limited');
    if (modern) task.nameText = { kind: 'literal', value: name };
  });
  if (d.NextTaskId) plan.diagnostics.push({ code: 'retry.cursor_not_verified', message: 'A one-shot start cursor narrows this run; automatic retry is disabled.' });
  plan.diagnostics.push({ code: 'coverage_limited', message: 'Outer completion does not prove custom scripts, resource consumption or nested actions succeeded.' });
  return plan;
}
