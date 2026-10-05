function observe(text, tasks, emit, result, line, states) {
  if (line.sourceId !== 'file' || input.logBatch.hasGap) return;
  const envelope = text.match(/^\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3}\]\[(INF|WRN|ERR)\] (?:\[cfg=[^\]]*\])?\[inst=([^\]]+)\]\[src=MonitorLog\]\[op=Monitor\] (.*)$/);
  if (!envelope) return;
  const instance = tasks[0]?.sourceKey.split('/')[0];
  if (envelope[2] !== instance && !envelope[2].endsWith('/' + instance)) return;
  const message = envelope[3], cursor = result.cursorState;
  if (cursor.epoch !== line.epoch) {
    cursor.epoch = line.epoch; cursor.scopes = {}; cursor.active = null; cursor.index = 0;
    delete cursor.terminal; delete cursor.aborted; delete cursor.cancelled;
  }
  const start = message.match(/^开始任务[：:]\s*(.+)$/);
  const failure = message.match(/^任务失败[：:]\s*(.+)$/);
  if (start) {
    const ordered = tasks.filter(t => t.enabled).sort((a,b) => a.order-b.order);
    const repeats = task => Number(task.sourceKey.match(/~repeat(\d+)$/)?.[1] || 1);
    let task = ordered[cursor.index];
    if (task && (cursor.scopes[task.id]?.iterations >= repeats(task) || cursor.scopes[task.id]?.failure)) task = ordered[++cursor.index];
    if (!task || task.name !== start[1]) return;
    if (cursor.active && cursor.active !== task.id) cursor.scopes[cursor.active].end = line;
    cursor.active = task.id;
    if (!cursor.scopes[task.id]) { cursor.scopes[task.id] = {start:line,iterations:0,expected:repeats(task)}; emit(task,'running','mfa.scope_started'); }
    cursor.scopes[task.id].iterations++;
  } else if (failure) {
    const matches = tasks.filter(t => t.name === failure[1] && cursor.scopes[t.id]);
    // MonitorLog has no task ID: an asynchronous same-name failure cannot prove either scope successful.
    for (const task of matches) {
      cursor.scopes[task.id].failure = line;
      emit(task, 'failed', 'mfa.business_failed');
    }
  } else if (/^任务已全部完成！/.test(message)) {
    if (cursor.active) cursor.scopes[cursor.active].end = line;
    cursor.terminal = line;
    endRun(result, line, 'mfa.queue_completed');
  } else if (message === '任务运行失败！' || message === '已放弃本次任务') {
    cursor.terminal = line;
    cursor.aborted = true;
    cursor.cancelled = message === '已放弃本次任务';
    endRun(result,line,'mfa.queue_aborted',true);
  }
}

function finalizeObserve(tasks, result, states, emit) {
  const cursor = result.cursorState;
  if (!cursor.terminal || input.logBatch.hasGap) return;
  if (cursor.aborted && cursor.active && !cursor.scopes[cursor.active].failure) {
    const last = tasks.find(t => t.id === cursor.active);
    if (!cursor.cancelled && Object.values(cursor.scopes).some(s => s.failure))
      cursor.scopes[cursor.active].end = cursor.terminal;
    else emit(last,'failed',cursor.terminal,cursor.cancelled ? 'mfa.upstream_cancelled' : 'mfa.business_failed');
  }
  // Named failures are dispatched asynchronously; close flows only after the Host's final drain.
  for (const task of tasks) {
    const scope = cursor.scopes?.[task.id];
    if (scope?.end && scope.iterations === scope.expected && !scope.failure && states[task.id]?.status === 'running')
      emit(task,'succeeded',scope.end,'mfa.scope_completed');
  }
}
