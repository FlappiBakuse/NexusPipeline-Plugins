'use strict';

function oknteLog(text) {
  const match = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2},\d{3} (DEBUG|INFO|WARNING|ERROR|CRITICAL) (\S+) ([A-Za-z_][A-Za-z_0-9]*):(.*)$/.exec(text);
  return match ? { level: match[1], thread: match[2], owner: match[3], message: match[4] } : null;
}

function oknteSet(state, id, outcome, reasonCode, completionKind = 'completed') {
  if (state.results[id]?.state === 'failed') return;
  state.results[id] = { state: outcome, reasonCode, completionKind };
}

function oknteAdvance(state) {
  if (state.current && !state.broken && !state.results[state.current])
    oknteSet(state, state.current, 'succeeded', 'oknte_native_returned_none', 'inapplicable');
  state.current = null;
}

function oknteRoutineLine(state, selected, log) {
  if (log.owner === 'DailyRoutineTask' && log.level === 'INFO' && log.message === '开始执行日常任务') {
    if (state.started) state.broken = true;
    state.started = true; state.active = true; state.ended = false; state.cursor = 0; state.current = null; return;
  }
  if (!state.active) {
    const late = log.owner === 'DailyRoutineTask' && log.level === 'INFO' && /^任务失败: (.+)$/.exec(log.message);
    const row = late && selected.find(item => item.title === late[1] && state.visited.includes(item.id));
    if (row) oknteSet(state, row.id, 'failed', 'oknte_late_formal_failure');
    return;
  }
  if (log.owner === 'DailyRoutineTask' && log.level === 'INFO') {
    const begin = /^开始任务: (.+)$/.exec(log.message), skip = /^任务不支持当前语言[,，] ?跳过: ([a-z_]+)$/.exec(log.message);
    if (begin || skip) {
      oknteAdvance(state);
      const row = selected[state.cursor];
      if (!row || begin && row.title !== begin[1] || skip && row.id !== skip[1]) { state.broken = true; return; }
      state.cursor++; if (!state.visited.includes(row.id)) state.visited.push(row.id);
      if (skip) oknteSet(state, row.id, 'succeeded', 'oknte_language_unsupported', 'inapplicable');
      else state.current = row.id;
      return;
    }
    const terminal = /^任务(失败|完成): (.+)$/.exec(log.message);
    if (terminal) {
      const row = selected.find(item => item.title === terminal[2] && (item.id === state.current || terminal[1] === '失败' && state.visited.includes(item.id)));
      if (row) oknteSet(state, row.id, terminal[1] === '失败' ? 'failed' : 'succeeded', 'oknte_formal_item_' + (terminal[1] === '失败' ? 'failed' : 'completed'));
      else state.broken = true;
      if (row?.id === state.current) state.current = null;
      return;
    }
    if (log.message === '结束执行日常任务') { oknteAdvance(state); state.active = false; state.ended = true; }
  }
  if (log.level !== 'ERROR') return;
  const current = selected.find(item => item.id === state.current);
  if (current && log.owner === 'DailyRoutineTask' && (log.message === '任务运行失败: ' + current.title || log.message.startsWith('任务运行失败: ' + current.title + ' ')))
    oknteSet(state, current.id, 'failed', 'oknte_item_exception');
  if (log.owner === 'DailyRoutineTask' && /^DailyRoutineTask error(?: |$)/.test(log.message) ||
      log.owner === 'TaskExecutor' && /^日常任务 exception stopped(?: |$)/.test(log.message)) {
    if (current) oknteSet(state, current.id, 'failed', 'oknte_routine_aborted_in_item');
    state.aborted = true; state.active = false;
    state.notExecuted = selected.filter(item => !state.visited.includes(item.id)).map(item => item.id);
  }
}

function oknteObserve(input, config, tasks) {
  const ids = input.selectedTaskIds ?? tasks.filter(task => task.isSelected && task.isEnabled).map(task => task.taskId);
  if (!Array.isArray(ids) || new Set(ids).size !== ids.length || ids.some(id => !tasks.some(task => task.taskId === id && task.isSelected && task.isEnabled)))
    throw new Error('oknte_observation_selection_unbound');
  const selected = config.rows.filter(row => row.known && row.enabled && ids.includes('oknte:' + row.id));
  const binding = JSON.stringify([input.runId, input.attemptId, input.planDigest, selected.map(row => row.id)]), fresh = () => ({ binding, epoch: null, sequence: 0,
    active: false, started: false, ended: false, aborted: false, cursor: 0, current: null, broken: false, visited: [], results: {}, notExecuted: [] });
  let state = fresh();
  if (input.observationCheckpoint) {
    state = strictConfigurationJson(input.observationCheckpoint, 'oknte');
    if (state.binding !== binding || !oknteObject(state.results) || !Array.isArray(state.visited) || !Array.isArray(state.notExecuted) ||
        state.visited.length > 8 || state.notExecuted.length > 8) throw new Error('oknte_checkpoint_unbound');
  }
  for (const event of input.logEvents ?? []) {
    if (event.sourceId !== 'file:0') continue;
    if (!Number.isSafeInteger(event.sequence) || event.sequence < 1 || typeof event.text !== 'string') throw new Error('oknte_log_event_invalid');
    if (state.epoch !== event.epoch || event.sequence > state.sequence + 1) {
      const finished = state.ended || state.aborted;
      const results = Object.fromEntries(Object.entries(state.results).filter(([, item]) => item.state === 'failed' || finished && item.state === 'succeeded'));
      const broken = state.started && !state.ended && !state.aborted;
      state = { ...fresh(), results, epoch: event.epoch, broken, ...(finished ? { started: state.started, ended: state.ended,
        aborted: state.aborted, visited: state.visited, notExecuted: state.notExecuted } : {}) };
    }
    if (event.sequence <= state.sequence) continue;
    state.sequence = event.sequence;
    const log = oknteLog(event.text);
    if (log?.thread === 'TaskExecutor') oknteRoutineLine(state, selected, log);
  }
  const observations = tasks.map(task => {
    const id = task.taskId.slice(6), result = state.results[id];
    if (result?.state === 'failed') return { taskId: task.taskId, state: 'failed', reasonCode: result.reasonCode };
    if (result?.state === 'succeeded' && input.logComplete === true && (state.ended || state.aborted) && !state.broken)
      return { taskId: task.taskId, state: 'succeeded', reasonCode: result.reasonCode, completionKind: result.completionKind };
    return { taskId: task.taskId, state: 'unknown', reasonCode: state.notExecuted.includes(id) ? 'oknte_aborted_before_item' : 'oknte_item_scope_incomplete',
      ...(state.notExecuted.includes(id) ? { completionKind: 'notExecuted' } : {}) };
  });
  return { observations, observationCheckpoint: JSON.stringify(state) };
}
