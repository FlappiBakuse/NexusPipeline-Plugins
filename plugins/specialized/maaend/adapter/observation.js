'use strict';

function maaendObserve(input, config, tasks) {
  tasks = maaObservationTasks(input, tasks, 'maaend');
  const selected = tasks.filter(task => task.isSelected && task.isEnabled), checkpoint = input.observationCheckpoint;
  const state = checkpoint ? strictConfigurationJson(checkpoint, 'maaend') : { version: 1, runId: input.runId, attemptId: input.attemptId,
    planDigest: input.planDigest, selection: input.selectedTaskIds ?? null,
    epoch: -1, sequence: 0, active: [], results: [], repeated: [] };
  if (state.version !== 1 || ['runId', 'attemptId', 'planDigest'].some(key => state[key] !== input[key]) ||
      JSON.stringify(state.selection ?? null) !== JSON.stringify(input.selectedTaskIds ?? null) ||
      !Array.isArray(state.active) || !Array.isArray(state.results) || !Array.isArray(state.repeated)) throw new Error('maaend_checkpoint_unbound');
  if (!Array.isArray(input.logEvents) || input.logEvents.length > 256) throw new Error('maaend_structured_logs_required');
  const patterns = [[/^(?:任务开始|Task started|任務開始|タスクを開始|작업 시작): (.+)$/, 'start'],
    [/^(?:任务完成|Task completed|任務完成|タスクが完了しました|작업 완료): (.+)$/, 'succeeded'],
    [/^(?:任务失败|Task failed|任務失敗|タスクが失敗しました|작업 실패): (.+)$/, 'failed']];
  for (const event of input.logEvents) {
    if (event.sourceId !== 'stdout') continue;
    if (!Number.isSafeInteger(event.epoch) || event.epoch < 0 || !Number.isSafeInteger(event.sequence) || event.sequence < 1 || typeof event.text !== 'string')
      throw new Error('maaend_log_event_invalid');
    if (event.epoch < state.epoch || event.epoch === state.epoch && event.sequence <= state.sequence) continue;
    if (event.epoch !== state.epoch || event.sequence !== state.sequence + 1) state.active = [];
    state.epoch = event.epoch; state.sequence = event.sequence;
    const envelope = event.text.match(/^\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3}\] (.*)$/);
    if (!envelope) continue;
    for (const [pattern, outcome] of patterns) {
      const match = envelope[1].match(pattern);
      if (!match) continue;
      const candidates = selected.filter(task => config.rows.find(row => row.taskId === task.taskId).logName === match[1]);
      if (candidates.length !== 1) break;
      const task = candidates[0], previous = state.results.find(item => item.taskId === task.taskId);
      if (outcome === 'start') {
        if (previous || state.active.includes(task.taskId)) {
          if (!state.repeated.includes(task.taskId)) state.repeated.push(task.taskId);
        }
        if (!state.active.includes(task.taskId)) state.active.push(task.taskId);
      } else if (state.active.includes(task.taskId) || outcome === 'failed' && previous?.epoch === event.epoch) {
        const result = { taskId: task.taskId, state: outcome, reasonCode: 'maaend_paired_outer_' + outcome, epoch: event.epoch };
        if (previous?.state !== 'failed') {
          if (previous) Object.assign(previous, result);
          else state.results.push(result);
        }
        state.active = state.active.filter(id => id !== task.taskId);
      }
      break;
    }
  }
  const observations = selected.map(task => {
    const result = state.results.find(item => item.taskId === task.taskId);
    if (!result) return { taskId: task.taskId, state: 'unknown', reasonCode: 'maaend_paired_terminal_missing' };
    if (result.state !== 'failed' && (state.repeated.includes(task.taskId) || !input.logComplete))
      return { taskId: task.taskId, state: 'unknown', reasonCode: 'maaend_scope_or_stream_incomplete' };
    return { taskId: result.taskId, state: result.state, reasonCode: result.reasonCode,
      ...(result.state === 'succeeded' ? { completionKind: 'completed' } : {}) };
  });
  const serialized = JSON.stringify(state);
  if (serialized.length > 65536) throw new Error('maaend_checkpoint_limit');
  return { observations, observationCheckpoint: serialized };
}
