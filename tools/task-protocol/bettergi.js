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
    addTask(plan, config.id, key, name, declared && d.TaskEnabledList[key] && activeKeys.includes(key) && (start < 0 || activeKeys.indexOf(key) >= start),
      declared ? ['TaskEnabledList', key] : null, name === '领取邮件' && !d.NextTaskId ? 'safe' : 'unknown',
      name === '领取邮件' ? 'supported' : 'limited');
  });
  if (d.NextTaskId) plan.diagnostics.push({ code: 'retry.cursor_not_verified', message: 'A one-shot start cursor narrows this run; automatic retry is disabled.' });
  plan.diagnostics.push({ code: 'coverage_limited', message: 'Outer completion does not prove custom scripts, resource consumption or nested actions succeeded.' });
  return plan;
}
function observe(text, tasks, emit, result, line) {
  const matches = tasks.filter(t => t.name === '领取邮件');
  if (matches.length === 1) {
    if (/邮件：(?:全部领取|"全部领取")\s*$/.test(text)) emit(matches[0], 'succeeded', 'bettergi.mail.claim');
    else if (/邮件：(?:没有邮件奖励|"没有邮件奖励")\s*$/.test(text)) emit(matches[0], 'succeeded', 'bettergi.mail.empty');
    else if (text.includes('领取邮件奖励异常:')) emit(matches[0], 'failed', 'bettergi.mail.exception');
  }
  if (text.endsWith('自动地脉花未在运行日期内，跳过')) {
    const items = tasks.filter(t => t.name === '自动地脉花');
    if (items.length === 1) emit(items[0], 'skipped', 'bettergi.leyline.not_due', 'inapplicable');
  }
  if (text.endsWith('一条龙和配置组任务结束')) {
    result.runBoundary = 'ended'; result.boundaryEvidence = [{ sourceId: line.sourceId, epoch: line.epoch, sequence: line.sequence, ruleId: 'bettergi.run.end' }];
  }
}
