'use strict';

function maaendObserve(input, config, tasks) {
  tasks = maaObservationTasks(input, tasks, 'maaend');
  const selected = tasks.filter(task => task.isSelected && task.isEnabled), checkpoint = input.observationCheckpoint;
  const state = checkpoint ? strictConfigurationJson(checkpoint, 'maaend') : { version: 1, runId: input.runId, attemptId: input.attemptId,
    planDigest: input.planDigest, selection: input.selectedTaskIds ?? null, processId: input.upstreamProcessId ?? null,
    epoch: -1, sequence: 0, active: [], results: [], repeated: [], prefix: 0, ordered: true, stop: 0,
    native: { epoch: null, sequence: 0, scope: null, tasks: [], active: null, stopId: null, stopped: false, invalid: false } };
  if (state.version !== 1 || ['runId', 'attemptId', 'planDigest'].some(key => state[key] !== input[key]) ||
      JSON.stringify(state.selection ?? null) !== JSON.stringify(input.selectedTaskIds ?? null) ||
      state.processId !== (input.upstreamProcessId ?? null) || !Number.isInteger(state.prefix) || state.prefix < 0 || state.prefix > selected.length ||
      typeof state.ordered !== 'boolean' || ![0, 1, 2].includes(state.stop) || !Array.isArray(state.native?.tasks) ||
      !Array.isArray(state.active) || !Array.isArray(state.results) || !Array.isArray(state.repeated)) throw new Error('maaend_checkpoint_unbound');
  if (!Array.isArray(input.logEvents) || input.logEvents.length > 256) throw new Error('maaend_structured_logs_required');
  const rows = new Map(config.rows.map(row => [row.taskId, row]));
  const stopNames = new Set(['Stop Task', '停止任务', '停止任務', 'タスクを停止', '작업 중지']);
  const patterns = [[/^(?:任务开始|Task started|任務開始|タスクを開始|작업 시작): (.+)$/, 'start', false],
    [/^(?:任务完成|Task completed|任務完成|タスクが完了しました|작업 완료): (.+)$/, 'succeeded', false],
    [/^(?:任务失败|Task failed|任務失敗|タスクが失敗しました|작업 실패): (.+)$/, 'failed', false],
    [/^Running pre-task: (.+)$/, 'start', true], [/^Pre-task completed: (.+)$/, 'succeeded', true]];
  for (const event of input.logEvents) {
    if (event.sourceId === 'file:0' && Number.isSafeInteger(state.processId) && state.processId > 0) {
      maaendNativeStop(state.native, event, state.processId, selected.length);
      continue;
    }
    if (event.sourceId !== 'stdout') continue;
    if (!Number.isSafeInteger(event.epoch) || event.epoch < 0 || !Number.isSafeInteger(event.sequence) || event.sequence < 1 || typeof event.text !== 'string')
      throw new Error('maaend_log_event_invalid');
    if (event.epoch < state.epoch || event.epoch === state.epoch && event.sequence <= state.sequence) continue;
    if (event.epoch !== state.epoch || event.sequence !== state.sequence + 1) {
      state.active = [];
      if (state.epoch !== -1 || event.sequence !== 1) state.ordered = false;
    }
    state.epoch = event.epoch; state.sequence = event.sequence;
    const envelope = event.text.match(/^\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3}\] (.*)$/);
    if (!envelope) continue;
    for (const [pattern, outcome, pretask] of patterns) {
      const match = envelope[1].match(pattern);
      if (!match) continue;
      const candidates = selected.filter(task => {
        const row = rows.get(task.taskId);
        return row.logName === match[1] && (row.definition?.entry === 'MXU_PRETASK') === pretask;
      });
      if (!pretask && !candidates.length && stopNames.has(match[1])) {
        if (outcome === 'start' && state.stop === 0 && state.active.length === 0) state.stop = 1;
        else if (outcome === 'succeeded' && state.stop === 1) state.stop = 2;
        else state.ordered = false;
        break;
      }
      if (candidates.length !== 1) { if (outcome === 'start') state.ordered = false; break; }
      const task = candidates[0], previous = state.results.find(item => item.taskId === task.taskId);
      if (outcome === 'start') {
        if (state.stop === 0 && selected[state.prefix]?.taskId === task.taskId) state.prefix++;
        else state.ordered = false;
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
  const seen = selected.slice(0, state.prefix);
  const reached = seen.map(task => [rows.get(task.taskId).definition?.entry, state.results.find(item => item.taskId === task.taskId)?.state])
    .filter(([entry]) => entry && !entry.startsWith('MXU_'));
  const stopped = input.logComplete === true && state.ordered && state.stop === 2 && state.active.length === 0 &&
    state.repeated.length === 0 && state.native.stopped && !state.native.invalid &&
    JSON.stringify(reached) === JSON.stringify(state.native.tasks) &&
    seen.some(task => state.results.some(item => item.taskId === task.taskId && item.state === 'failed' && item.epoch === state.epoch)) &&
    seen.every(task => state.results.some(item => item.taskId === task.taskId && item.epoch === state.epoch));
  const observations = selected.map((task, index) => {
    if (state.epoch > 0) return { taskId: task.taskId, state: 'unknown', reasonCode: 'maaend_scope_or_stream_incomplete' };
    const result = state.results.find(item => item.taskId === task.taskId);
    if (!result && stopped && index >= state.prefix && task.workflowRole === 'business')
      return { taskId: task.taskId, state: 'unknown', reasonCode: 'maaend_native_stop_before_task', completionKind: 'notExecuted' };
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

function maaendNativeStop(trace, event, processId, limit) {
  if (trace.invalid) return;
  if (!Number.isSafeInteger(event.epoch) || event.epoch < 0 || event.sequence !== trace.sequence + 1 ||
      typeof event.text !== 'string' || trace.epoch !== null && trace.epoch !== event.epoch) { trace.invalid = true; return; }
  trace.epoch = event.epoch; trace.sequence = event.sequence;
  const task = maaDataNativeTask(event.text, processId, 'maaend');
  if (!task) return;
  if (trace.scope !== null && trace.scope !== task.scope) { trace.invalid = true; return; }
  trace.scope = task.scope;
  if (task.entry === 'MaaTaskerPostStop') {
    if (task.kind === 'Starting' && trace.stopId === null && trace.active === null) trace.stopId = task.id;
    else if (task.kind === 'Succeeded' && task.id === trace.stopId && !trace.stopped) trace.stopped = true;
    else trace.invalid = true;
  } else if (task.kind === 'Starting') {
    if (trace.stopId !== null || trace.active !== null || trace.tasks.length >= limit) trace.invalid = true;
    else trace.active = task;
  } else if (trace.active?.id !== task.id || trace.active.entry !== task.entry) {
    trace.invalid = true;
  } else {
    trace.tasks.push([task.entry, task.kind === 'Succeeded' ? 'succeeded' : 'failed']);
    trace.active = null;
  }
}
