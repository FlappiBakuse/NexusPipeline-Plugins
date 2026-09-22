function observe(text, tasks, emit, result, line) {
  const log = parseOkLog(text);
  if (!log || log.thread !== 'TaskExecutor') return;
  const scopes = result.cursorState.dailyScopes || (result.cursorState.dailyScopes = {});
  const key = line.sourceId + ':' + line.epoch;
  if (log.owner === 'DailyTask' && log.level === 'INFO' && log.message === 'open_daily') {
    if (Object.keys(scopes).length >= 16 && !scopes[key]) return;
    scopes[key] = { active: true };
    return;
  }
  const scope = scopes[key];
  if (!scope || !scope.active || log.owner !== 'DailyTask') return;
  const task = key => tasks.find(t => t.sourceKey === key && t.enabled);
  const send = (key, status, reason, skipKind) => { const found = task(key); if (found) emit(found, status, reason, skipKind); };
  if (log.level === 'INFO') {
    const starts = { 'check weekly garden': 'garden', 'check discarded echo': 'merge', 'battle pass': 'battle_pass',
      'claim daily reward via  coordinate': 'daily_reward', 'Daily task completed, start teleport to farm 4C echo': 'farm_4c' };
    if (starts[log.message]) send(starts[log.message], 'running', 'okww.step.started');
    if (log.message === 'weekly garden already completed') send('garden', 'skipped', 'okww.garden.already_done', 'satisfied');
    if (log.message === 'Daily Task Completed') {
      scope.active = false;
      endRun(result, line, 'okww.daily.ended', false);
    }
  }
  if (log.level === 'DEBUG' && ['Auto Farm all Nightmare Nest', 'Farm Nightmare Nest for Daily Echo'].includes(log.message))
    send('nightmare', 'running', 'okww.nightmare.started');
  if (log.level === 'ERROR') {
    const failed = log.message.match(/^(NightmareNestTask|GardenTask|MergeEchoTask) Failed(?: |$)/);
    if (failed) send({ NightmareNestTask: 'nightmare', GardenTask: 'garden', MergeEchoTask: 'merge' }[failed[1]],
      'failed', 'okww.step.caught_failure');
    if (log.message.trim() === 'can not battle pass, maybe ended')
      send('battle_pass', 'failed', 'okww.battle_pass.not_found');
  }
}
