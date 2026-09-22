function observe(text, tasks, emit, result, line, states) {
  const log = parseOkLog(text);
  if (!log || log.thread !== 'TaskExecutor') return;
  const key = line.sourceId + ':' + line.epoch;
  const scopes = result.cursorState.routineScopes || (result.cursorState.routineScopes = {});
  if (log.owner === 'DailyRoutineTask' && log.level === 'INFO' && log.message === '开始执行日常任务') {
    if (Object.keys(scopes).length >= 16 && !scopes[key]) return;
    scopes[key] = { current: null, visited: [], active: true };
    return;
  }
  const scope = scopes[key];
  if (!scope || !scope.active) return;
  const eligible = tasks.filter(t => t.enabled && t.detection !== 'unsupported');
  if (log.owner === 'DailyRoutineTask' && log.level === 'INFO') {
    const start = log.message.match(/^开始任务: (.+)$/);
    if (start) {
      scope.current = null;
      const found = eligible.filter(t => t.name === start[1] && !scope.visited.includes(t.id));
      if (found.length === 1) {
        scope.current = found[0].id;
        scope.visited.push(found[0].id);
        emit(found[0], 'running', 'oknte.item.started');
      }
      return;
    }
    const terminal = log.message.match(/^任务(失败|完成): (.+)$/);
    if (terminal) {
      const task = eligible.find(t => t.id === scope.current && t.name === terminal[2]);
      if (task) emit(task, terminal[1] === '失败' ? 'failed' : 'succeeded',
        terminal[1] === '失败' ? 'oknte.item.failed' : 'oknte.item.completed');
      scope.current = null;
      return;
    }
    const skip = log.message.match(/^任务不支持当前语言，跳过: ([a-z_]+)$/);
    if (skip) {
      const task = eligible.find(t => t.sourceKey === skip[1] && !scope.visited.includes(t.id));
      if (task) {
        scope.visited.push(task.id);
        emit(task, 'skipped', 'oknte.item.language_unsupported', 'inapplicable');
      }
      return;
    }
    if (log.message === '结束执行日常任务') {
      scope.active = false;
      endRun(result, line, 'oknte.routine.ended', false);
    }
  }
  const aborted = log.level === 'ERROR' && (
    log.owner === 'DailyRoutineTask' && /^DailyRoutineTask error(?: |$)/.test(log.message)
    || log.owner === 'TaskExecutor' && /^日常任务 exception stopped(?: |$)/.test(log.message));
  if (aborted) {
    for (const task of eligible) {
      if (task.id === scope.current && states[task.id]?.status === 'running')
        emit(task, 'failed', 'oknte.item.unhandled_exception');
      else if (!scope.visited.includes(task.id) && (!states[task.id] || states[task.id].status === 'pending'))
        emit(task, 'blocked', 'oknte.routine.aborted_before_item');
    }
    scope.active = false;
    endRun(result, line, 'oknte.routine.aborted', true);
  }
}
