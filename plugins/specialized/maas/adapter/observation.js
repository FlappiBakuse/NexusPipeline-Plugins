'use strict';

function maasObserve(input, config, tasks) {
  tasks = maaObservationTasks(input, tasks, 'maas');
  const offsets = maasRepetitionOffsets(input.repetitionOffsets ?? [], tasks);
  const binding = JSON.stringify([input.runId, input.attemptId, input.planDigest, config.id, config.cfg,
    input.selectedTaskIds ?? null, input.upstreamProcessId ?? null, [...offsets]]);
  const expected = config.rows.map((row, index) => ({ row, index, count: row.count - (offsets.get(tasks[index].taskId) ?? 0) }))
    .filter(({ row, index }) => tasks[index].isSelected && !row.special);
  const hasNativeRepetitions = expected.some(({ index }) => tasks[index].projection?.repetitionSelector) &&
    Number.isSafeInteger(input.upstreamProcessId) && input.upstreamProcessId > 0;
  let state = { binding, epoch: null, sequence: 0, pointer: 0, active: null, terminal: false, broken: false,
    monitorInvalid: false, failedTerminal: false, native: hasNativeRepetitions ? maasNativeState(tasks.length) : null,
    rows: tasks.map(() => ({ started: 0, closed: 0, failed: false, proven: false })) };
  if (input.observationCheckpoint) {
    const parsed = strictConfigurationJson(input.observationCheckpoint, 'maas');
    if (parsed.binding !== binding || !Array.isArray(parsed.rows) || parsed.rows.length !== tasks.length ||
        !Number.isInteger(parsed.pointer) || parsed.pointer < 0 || parsed.pointer > tasks.length ||
        parsed.active !== null && (!Number.isInteger(parsed.active) || parsed.active < 0 || parsed.active >= tasks.length) ||
        typeof parsed.terminal !== 'boolean' || typeof parsed.broken !== 'boolean' || typeof parsed.monitorInvalid !== 'boolean' ||
        typeof parsed.failedTerminal !== 'boolean' ||
        hasNativeRepetitions !== (parsed.native !== null) || !Number.isSafeInteger(parsed.sequence) || parsed.sequence < 0 ||
        parsed.rows.some(row => !Array.isArray(row) || row.length !== 4 || !Number.isSafeInteger(row[0]) || row[0] < 0 ||
          !Number.isSafeInteger(row[1]) || row[1] < 0 || typeof row[2] !== 'boolean' || typeof row[3] !== 'boolean'))
      throw new Error('maas_checkpoint_unbound');
    parsed.rows = parsed.rows.map(row => ({ started: row[0], closed: row[1], failed: row[2], proven: row[3] }));
    state = parsed;
  }
  const reset = () => {
    state.active = null; state.pointer = 0; state.terminal = false; state.failedTerminal = false; state.broken = true; state.monitorInvalid = true;
    for (const row of state.rows) if (!row.proven) { row.started = 0; row.closed = 0; }
  };
  const close = () => {
    if (state.active !== null) { state.rows[state.active].closed++; state.active = null; }
  };
  for (const event of input.logEvents ?? []) {
    if (event.sourceId === 'file:1' && state.native) {
      maasNativeEvent(state.native, event, expected, input.upstreamProcessId);
      continue;
    }
    if (event.sourceId !== 'file:0') continue;
    if (!Number.isSafeInteger(event.sequence) || event.sequence < 1 || typeof event.text !== 'string') throw new Error('maas_log_event_invalid');
    if (state.epoch !== event.epoch) { if (state.epoch !== null) reset(); state.epoch = event.epoch; state.sequence = 0; }
    if (event.sequence <= state.sequence) continue;
    if (event.sequence !== state.sequence + 1) reset();
    state.sequence = event.sequence;
    const match = /^\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3}\]\[(?:INF|WRN|ERR)\] \[cfg=([^\]]+)\]\[inst=([^\]]+)\]\[src=Monitor\]\[op=MonitorLog\] (.*)$/.exec(event.text);
    if (!match || match[1] !== config.cfg || match[2] !== config.id && !match[2].endsWith('/' + config.id)) continue;
    const text = match[3], begin = /^(?:开始任务|開始任務|Starting task|タスク開始)[:：]\s*(.+)$/.exec(text);
    const failure = /^(?:任务失败|任務失敗|Task failed|タスクに失敗しました)[:：]\s*(.+)$/.exec(text);
    if (failure) {
      const candidates = expected.filter(({ row }) => row.title === failure[1]);
      if (candidates.length === 1 && state.rows[candidates[0].index].started > 0)
        state.rows[candidates[0].index].failed = true;
      if (candidates.length > 1) {
        state.broken = true; state.monitorInvalid = true;
        for (const { index } of candidates) state.rows[index].proven = false;
      }
      continue;
    }
    if (begin) {
      close();
      if (state.terminal) { state.broken = true; state.monitorInvalid = true; state.terminal = false; }
      let cursor = expected[state.pointer];
      if (cursor && state.rows[cursor.index].started >= cursor.count) cursor = expected[++state.pointer];
      if (!cursor || cursor.row.title !== begin[1]) { state.broken = true; state.monitorInvalid = true; continue; }
      state.rows[cursor.index].started++; state.active = cursor.index;
    } else if (/^(?:任务已全部完成！|任務已全部完成！|All tasks have been completed!|すべてのタスクが完了しました！)(?:\s*$|\s*\(.*$)/.test(text)) {
      close(); state.monitorInvalid ||= state.terminal; state.terminal = true; state.failedTerminal = false;
      if (!state.broken) for (const { count, index } of expected)
        if (state.rows[index].started === count && state.rows[index].closed === count) state.rows[index].proven = true;
    } else if (['任务运行失败！', '任務運行失敗！', 'Task execution failed!', 'タスクの実行に失敗しました！'].includes(text)) {
      // The queue summary can follow successful tasks that ran after a named failure.
      state.active = null; state.monitorInvalid ||= state.terminal; state.terminal = true; state.failedTerminal = true; state.broken = true;
    } else if (['已放弃本次任务', '已放棄本次任務', 'Task has been abandoned', 'タスクは破棄されました'].includes(text)) {
      state.active = null; state.monitorInvalid ||= state.terminal; state.terminal = true; state.failedTerminal = false; state.broken = true;
    }
  }
  const useNative = state.native && !state.native.broken && state.native.active === null && state.terminal &&
    !state.monitorInvalid && input.logComplete === true && expected.every(({ index, count }) =>
      state.rows[index].started === count && state.native.rows[index][0] + state.native.rows[index][1] === count);
  const stopped = maasStoppedQueue(state, expected, config, input.logComplete);
  const observations = tasks.map((task, index) => {
    const row = state.rows[index];
    if (useNative && task.isSelected && task.projection?.repetitionSelector) {
      const [succeeded, failed] = state.native.rows[index];
      return { taskId: task.taskId, state: failed > 0 ? 'failed' : 'succeeded', reasonCode: 'maas_native_repetition_terminal',
        completedRepetitions: (offsets.get(task.taskId) ?? 0) + succeeded, ...(failed === 0 ? { completionKind: 'completed' } : {}) };
    }
    if (stopped?.pending.has(index) && task.workflowRole === 'business')
      return { taskId: task.taskId, state: 'unknown', reasonCode: 'maas_queue_stopped_before_task', completionKind: 'notExecuted',
        ...(task.repetitionLimit !== undefined ? { completedRepetitions: offsets.get(task.taskId) ?? 0 } : {}) };
    if (stopped?.completed.has(index))
      return { taskId: task.taskId, state: 'succeeded', reasonCode: 'maas_queue_completed_before_failure', completionKind: 'completed' };
    const outcome = row.failed ? 'failed' : input.logComplete === true && row.proven ? 'succeeded' : 'unknown';
    return { taskId: task.taskId, state: outcome, reasonCode: row.failed ? 'maas_named_or_queue_failure' :
      outcome === 'succeeded' ? 'maas_native_order_repeat_queue_drained' : 'maas_native_scope_incomplete' };
  });
  const observationCheckpoint = JSON.stringify({ ...state, rows: state.rows.map(row => [row.started, row.closed, row.failed, row.proven]) });
  if (observationCheckpoint.length > 65536) throw new Error('maas_checkpoint_limit');
  return { observations, observationCheckpoint };
}

function maasStoppedQueue(state, expected, config, logComplete) {
  if (logComplete !== true || !state.terminal || !state.failedTerminal || state.monitorInvalid || config.get('ContinueRunningWhenError', true) !== false)
    return null;
  const failures = expected.filter(({ index }) => state.rows[index].failed);
  if (failures.length !== 1 || failures[0].count !== 1) return null;
  const failedPosition = expected.indexOf(failures[0]);
  if (expected.some(({ index, count }, position) => state.rows[index].started !== (position <= failedPosition ? count : 0)) ||
      expected.slice(0, failedPosition).some(({ index, count }) => state.rows[index].closed !== count || count !== 1)) return null;
  return { completed: new Set(expected.slice(0, failedPosition).map(({ index }) => index)),
    pending: new Set(expected.slice(failedPosition + 1).map(({ index }) => index)) };
}

function maasRepetitionOffsets(offsets, tasks) {
  const byId = new Map(tasks.filter(task => task.isSelected && task.repetitionLimit !== undefined).map(task => [task.taskId, task]));
  const result = new Map();
  for (const { taskId, completedRepetitions } of offsets) {
    if (result.has(taskId) || !byId.has(taskId) || !Number.isSafeInteger(completedRepetitions) ||
        completedRepetitions < 0 || completedRepetitions >= byId.get(taskId).repetitionLimit)
      throw new Error('maas_repetition_offset_unbound');
    result.set(taskId, completedRepetitions);
  }
  return result;
}

function maasNativeState(count) {
  return { epoch: null, sequence: 0, pointer: 0, active: null, lastId: 0, scope: null, broken: false,
    rows: Array.from({ length: count }, () => [0, 0]) };
}

function maasNativeEvent(trace, event, expected, pid) {
  if (trace.broken) return;
  if (!Number.isSafeInteger(event.epoch) || event.epoch < 0 || !Number.isSafeInteger(event.sequence) || event.sequence < 1 ||
      typeof event.text !== 'string' || trace.epoch !== null && trace.epoch !== event.epoch || event.sequence !== trace.sequence + 1) {
    trace.broken = true; return;
  }
  trace.epoch = event.epoch; trace.sequence = event.sequence;
  const details = maaDataNativeTask(event.text, pid, 'maas');
  if (!details) return;
  const entry = expected[trace.pointer];
  if (!entry || details.entry !== entry.row.entry || trace.scope !== null && trace.scope !== details.scope) { trace.broken = true; return; }
  trace.scope = details.scope;
  if (details.kind === 'Starting') {
    if (trace.active !== null || details.id <= trace.lastId) { trace.broken = true; return; }
    trace.active = details.id; trace.lastId = details.id;
    return;
  }
  if (trace.active !== details.id) { trace.broken = true; return; }
  trace.active = null;
  const result = trace.rows[entry.index];
  result[details.kind === 'Succeeded' ? 0 : 1]++;
  if (result[0] + result[1] === entry.count) trace.pointer++;
}
