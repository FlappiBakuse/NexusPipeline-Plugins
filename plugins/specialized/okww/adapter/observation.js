'use strict';

function okwwLog(text) {
  const match = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2},\d{3} (DEBUG|INFO|WARNING|ERROR|CRITICAL) (\S+) ([A-Za-z_][A-Za-z_0-9]*):(.*)$/.exec(text);
  return match ? { level: match[1], thread: match[2], owner: match[3], message: match[4] } : null;
}

function okwwObserve(input, config, tasks) {
  const binding = JSON.stringify([input.runId, input.attemptId, input.planDigest]), fresh = () => ({ binding, epoch: null, sequence: 0,
    active: false, started: false, completed: false, aborted: false, broken: false, results: {}, markers: {} });
  let state = fresh();
  if (input.observationCheckpoint) {
    state = strictConfigurationJson(input.observationCheckpoint, 'okww');
    if (state.binding !== binding || !okwwObject(state.results) || !okwwObject(state.markers) ||
        typeof state.active !== 'boolean' || typeof state.completed !== 'boolean' || typeof state.broken !== 'boolean') throw new Error('okww_checkpoint_unbound');
  }
  for (const event of input.logEvents ?? []) {
    if (event.sourceId !== 'file:0') continue;
    if (!Number.isSafeInteger(event.sequence) || event.sequence < 1 || typeof event.text !== 'string') throw new Error('okww_log_event_invalid');
    if (state.epoch !== event.epoch || event.sequence > state.sequence + 1) {
      const previous = state, results = Object.fromEntries(Object.entries(state.results).filter(([, item]) => item.state === 'failed' || state.completed));
      state = { ...fresh(), epoch: event.epoch, results, broken: state.started && !state.completed && !state.aborted,
        ...(state.completed ? { completed: true, started: true, markers: previous.markers } : {}) };
    }
    if (event.sequence <= state.sequence) continue;
    state.sequence = event.sequence;
    const log = okwwLog(event.text);
    if (!log || log.thread !== 'TaskExecutor') continue;
    if (log.owner === 'DailyTask' && log.level === 'INFO' && log.message === 'open_daily') {
      if (state.started) state.broken = true;
      state.active = true; state.started = true; state.completed = false;
    }
    if (log.owner === 'TaskExecutor' && log.level === 'ERROR' && /^📅 Daily Task exception stopped(?: |$)/.test(log.message)) {
      state.aborted = true; state.active = false; okwwSet(state, 'daily', 'failed', 'okww_daily_executor_exception');
    }
    if (!state.active && !state.completed) continue;
    okwwChildLine(state, config, log);
    if (log.owner === 'DailyTask' && log.level === 'INFO' && log.message === 'Daily Task Completed') okwwClose(state, config);
  }
  const childFailure = config.rows.some(row => row.id !== 'daily' && row.enabled && state.results[row.id]?.state === 'failed');
  const observations = tasks.map(task => {
    const id = task.taskId.slice(5), result = state.results[id];
    if (id === 'daily' && state.completed && (childFailure || result?.state === 'failed'))
      return { taskId: task.taskId, state: 'partial', reasonCode: 'okww_parent_completed_child_failure_retry_forbidden' };
    if (result?.state === 'failed') return { taskId: task.taskId, state: 'failed', reasonCode: result.reasonCode };
    if (id === 'daily' && state.completed && !state.broken && input.logComplete === true)
      return { taskId: task.taskId, state: 'succeeded', reasonCode: 'okww_authoritative_daily_completed', completionKind: 'completed' };
    if (result?.state === 'succeeded' && state.completed && !state.broken && input.logComplete === true)
      return { taskId: task.taskId, state: 'succeeded', reasonCode: result.reasonCode, completionKind: result.completionKind };
    return { taskId: task.taskId, state: 'unknown', reasonCode: state.aborted && id !== 'daily' ? 'okww_daily_aborted_child_unproven' : 'okww_daily_flow_incomplete' };
  });
  return { observations, observationCheckpoint: JSON.stringify(state) };
}
