'use strict';

function maasObserve(input, config, tasks) {
  tasks = maaObservationTasks(input, tasks, 'maas');
  const binding = JSON.stringify([input.runId, input.attemptId, input.planDigest, config.id, config.cfg, input.selectedTaskIds ?? null]);
  let state = { binding, epoch: null, sequence: 0, pointer: 0, active: null, terminal: false, broken: false,
    rows: tasks.map(() => ({ started: 0, closed: 0, failed: false, proven: false })) };
  if (input.observationCheckpoint) {
    const parsed = strictConfigurationJson(input.observationCheckpoint, 'maas');
    if (parsed.binding !== binding || !Array.isArray(parsed.rows) || parsed.rows.length !== tasks.length ||
        !Number.isInteger(parsed.pointer) || parsed.pointer < 0 || parsed.pointer > tasks.length ||
        parsed.active !== null && (!Number.isInteger(parsed.active) || parsed.active < 0 || parsed.active >= tasks.length) ||
        typeof parsed.terminal !== 'boolean' || typeof parsed.broken !== 'boolean' || !Number.isSafeInteger(parsed.sequence) || parsed.sequence < 0 ||
        parsed.rows.some(row => !Array.isArray(row) || row.length !== 4 || !Number.isSafeInteger(row[0]) || row[0] < 0 ||
          !Number.isSafeInteger(row[1]) || row[1] < 0 || typeof row[2] !== 'boolean' || typeof row[3] !== 'boolean'))
      throw new Error('maas_checkpoint_unbound');
    parsed.rows = parsed.rows.map(row => ({ started: row[0], closed: row[1], failed: row[2], proven: row[3] }));
    state = parsed;
  }
  const expected = config.rows.map((row, index) => ({ row, index })).filter(({ row, index }) => tasks[index].isSelected && !row.special);
  const reset = () => {
    state.active = null; state.pointer = 0; state.terminal = false; state.broken = true;
    for (const row of state.rows) if (!row.proven) { row.started = 0; row.closed = 0; }
  };
  const close = () => {
    if (state.active !== null) { state.rows[state.active].closed++; state.active = null; }
  };
  for (const event of input.logEvents ?? []) {
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
      for (const { row, index } of expected) if (row.title === failure[1] && state.rows[index].started > 0) state.rows[index].failed = true;
      continue;
    }
    if (begin) {
      close();
      if (state.terminal) { state.broken = true; state.terminal = false; }
      let cursor = expected[state.pointer];
      if (cursor && state.rows[cursor.index].started >= cursor.row.count) cursor = expected[++state.pointer];
      if (!cursor || cursor.row.title !== begin[1]) { state.broken = true; continue; }
      state.rows[cursor.index].started++; state.active = cursor.index;
    } else if (/^(?:任务已全部完成！|任務已全部完成！|All tasks have been completed!|すべてのタスクが完了しました！)(?:\s*$|\s*\(.*$)/.test(text)) {
      close(); state.terminal = true;
      if (!state.broken) for (const { row, index } of expected)
        if (state.rows[index].started === row.count && state.rows[index].closed === row.count) state.rows[index].proven = true;
    } else if (['任务运行失败！', '已放弃本次任务', '任務運行失敗！', '已放棄本次任務', 'Task execution failed!',
      'Task has been abandoned', 'タスクの実行に失敗しました！', 'タスクは破棄されました'].includes(text)) {
      if (state.active !== null) state.rows[state.active].failed = true;
      state.active = null; state.terminal = true; state.broken = true;
    }
  }
  const observations = tasks.map((task, index) => {
    const row = state.rows[index], outcome = row.failed ? 'failed' : input.logComplete === true && row.proven ? 'succeeded' : 'unknown';
    return { taskId: task.taskId, state: outcome, reasonCode: row.failed ? 'maas_named_or_queue_failure' :
      outcome === 'succeeded' ? 'maas_native_order_repeat_queue_drained' : 'maas_native_scope_incomplete' };
  });
  const observationCheckpoint = JSON.stringify({ ...state, rows: state.rows.map(row => [row.started, row.closed, row.failed, row.proven]) });
  if (observationCheckpoint.length > 65536) throw new Error('maas_checkpoint_limit');
  return { observations, observationCheckpoint };
}
