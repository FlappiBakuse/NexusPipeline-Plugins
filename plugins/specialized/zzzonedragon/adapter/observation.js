'use strict';

function zzzInitial(binding) {
  return { binding, epoch: null, sequence: 0, groupSeen: false, groupCompleted: false, group: false, index: 0, active: null,
    rootEnded: false, rootFailed: false, broken: false, results: {}, incidents: [] };
}

function zzzActive(row, event) {
  return { id: row.taskId, title: row.title, start: event.sequence, terminal: null, charge: row.id === 'charge_plan' ? {
    category: null, child: null, serial: 0, entered: false, worked: false, satisfied: false, abandoned: false, unresolved: false, pending: false } : null };
}

function zzzLine(state, config, parsed, event) {
  if (parsed.name === '执行应用组 one_dragon') {
    if (parsed.kind === 'node') zzzGroupLine(state, config, parsed);
    else if (parsed.kind === 'terminal') {
      if (!state.groupCompleted) state.broken = true;
      state.group = false; state.active = null;
    }
    return;
  }
  if (parsed.kind === 'terminal' && parsed.name === '一条龙') {
    if (state.active?.charge && !state.results[state.active.id + '/challenges']) state.results[state.active.id + '/challenges'] = zzzChargeResult(state, state.active);
    state.rootEnded = state.groupSeen; state.rootFailed = !parsed.success;
    if (parsed.success && !state.groupCompleted) state.broken = true;
    state.group = false; state.active = null; return;
  }
  if (!state.group) return;
  const expected = config.runtime[state.index];
  if (!expected?.enabled || !expected.taskId) return;
  if (!state.active && parsed.kind === 'node' && parsed.name === expected.title && parsed.path === '检测游戏窗口') state.active = zzzActive(expected, event);
  const active = state.active;
  if (!active || active.id !== expected.taskId) return;
  zzzCharge(state, active, parsed, event);
  if (parsed.kind === 'terminal' && parsed.name === active.title) active.terminal = { success: parsed.success, status: parsed.status, sequence: event.sequence };
}

function zzzObserve(input, config, tasks) {
  const binding = JSON.stringify([input.runId, input.attemptId, input.planDigest, config.id]);
  let state = zzzInitial(binding);
  if (input.observationCheckpoint) {
    state = strictConfigurationJson(input.observationCheckpoint, 'zzzonedragon');
    if (state.binding !== binding || !zzzObject(state.results) || !Array.isArray(state.incidents) || state.incidents.length > 64 ||
        !Number.isInteger(state.index) || state.index < 0 || state.index > config.runtime.length) throw new Error('zzzonedragon_checkpoint_unbound');
  }
  for (const event of input.logEvents ?? []) {
    if (event.sourceId !== 'file:0') continue;
    if (!Number.isSafeInteger(event.sequence) || event.sequence < 1 || typeof event.text !== 'string') throw new Error('zzzonedragon_log_event_invalid');
    if (state.epoch !== event.epoch || event.sequence > state.sequence + 1) {
      const results = Object.fromEntries(Object.entries(state.results).filter(([, item]) => ['failed', 'partial'].includes(item.state) || state.rootEnded));
      const previous = state;
      state = { ...zzzInitial(binding), epoch: event.epoch, results, incidents: previous.incidents,
        ...(previous.groupSeen ? { groupSeen: true, broken: !previous.rootEnded, rootEnded: previous.rootEnded, rootFailed: previous.rootFailed,
          groupCompleted: previous.groupCompleted } : {}) };
    }
    if (event.sequence <= state.sequence) continue;
    state.sequence = event.sequence;
    const parsed = zzzLog(event.text);
    if (parsed) zzzLine(state, config, parsed, event);
  }
  const observations = tasks.map(task => {
    const result = state.results[task.taskId];
    if (result && ['failed', 'partial'].includes(result.state)) return { taskId: task.taskId, state: result.state, reasonCode: result.reasonCode };
    if (result?.state === 'succeeded' && input.logComplete === true && state.rootEnded && !state.rootFailed && !state.broken)
      return { taskId: task.taskId, state: 'succeeded', reasonCode: result.reasonCode, completionKind: result.completionKind };
    return { taskId: task.taskId, state: 'unknown', reasonCode: state.rootFailed ? 'zzzonedragon_root_failed_scope_unqualified' : 'zzzonedragon_outer_group_receipt_missing' };
  });
  const observationCheckpoint = JSON.stringify(state);
  if (observationCheckpoint.length > 65536) throw new Error('zzzonedragon_checkpoint_limit');
  return { observations, observationCheckpoint };
}
