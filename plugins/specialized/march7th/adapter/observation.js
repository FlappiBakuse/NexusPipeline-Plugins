'use strict';

function march7thInitial(binding) {
  return { binding, epoch: null, sequence: 0, results: {}, stack: [], incidents: [], power: { root: null, group: null, serial: 0, block: [] },
    lc: false, assetReturned: false, activityReturned: false, rewardReturned: false, noActivities: false, runEnded: false, aborted: false };
}

function march7thMark(state, config, key, outcome, reasonCode, completionKind = 'completed') {
  if (!config.rows.some(row => row.key === key && row.selected)) return;
  const previous = state.results[key];
  if (previous?.state === 'failed' || outcome === 'running' && previous?.state === 'succeeded') return;
  if (outcome === 'succeeded' && state.incidents.some(item => item.resolution === 'open' && item.task === key)) return;
  state.results[key] = { state: outcome, reasonCode, completionKind };
}

function march7thNotification(state, config, text, mark) {
  if (!state.stack.length) return;
  const mapping = [['FightCompleted', 'fight_enable', 'succeeded'], ['FightNotCompleted', 'fight_enable', 'failed'],
    ['SimulatedUniverseCompleted', 'universe_enable', 'succeeded'], ['SimulatedUniverseNotCompleted', 'universe_enable', 'failed']];
  for (const [name, key, outcome] of mapping) {
    const message = config.document.notify_template?.[name] ?? MARCH7TH_DEFAULTS.notify_template[name];
    if (typeof message === 'string' && !/[{}\r\n]/.test(message) && text === message && state.stack.some(scope => scope.key === key))
      mark(key, outcome, 'march7th_literal_notification_' + outcome);
  }
}

function march7thObserve(input, config, tasks) {
  const binding = JSON.stringify([input.runId, input.attemptId, input.planDigest]), initial = march7thInitial(binding);
  let state = initial;
  if (input.observationCheckpoint) {
    state = strictConfigurationJson(input.observationCheckpoint, 'march7th');
    if (state.binding !== binding || !Array.isArray(state.stack) || state.stack.length > 32 || !Array.isArray(state.incidents) ||
        state.incidents.length > 64 || !march7thObject(state.results) || !march7thObject(state.power)) throw new Error('march7th_checkpoint_unbound');
  }
  const mark = (key, outcome, reasonCode, completionKind) => march7thMark(state, config, key, outcome, reasonCode, completionKind);
  for (const event of input.logEvents ?? []) {
    if (event.sourceId !== 'file:0') continue;
    if (!Number.isSafeInteger(event.sequence) || event.sequence < 1 || typeof event.text !== 'string') throw new Error('march7th_log_event_invalid');
    if (state.epoch !== event.epoch || event.sequence !== state.sequence + 1 && event.sequence > state.sequence) {
      const results = Object.fromEntries(Object.entries(state.results).filter(([, result]) => result.state === 'failed' || state.runEnded && result.state === 'succeeded'));
      const incidents = state.incidents, runEnded = state.runEnded, serial = state.power.serial;
      state = { ...march7thInitial(binding), results, incidents, epoch: event.epoch, runEnded };
      state.power.serial = serial;
    }
    if (event.sequence <= state.sequence) continue;
    state.sequence = event.sequence;
    const info = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2},\d{3} \| (INFO|ERROR|WARNING) \| (.*)$/.exec(event.text);
    const text = info ? info[2] : event.text, level = info?.[1] ?? 'TITLE';
    if (!info && !/^(?:\|.*\||[-=+─━].*)$/.test(text)) continue;
    march7thPower(state, config, text, level, mark, event);
    march7thScope(state, text, level, mark);
    march7thResources(state, config, text, mark, level);
    if (info) march7thNotification(state, config, text, mark);
    march7thAggregate(state, config, mark);
  }
  const observations = tasks.map(task => {
    const key = task.taskId.slice(9), result = state.results[key];
    if (result?.state === 'failed') return { taskId: task.taskId, state: 'failed', reasonCode: result.reasonCode };
    if (result?.state === 'succeeded' && state.runEnded && input.logComplete === true && !state.aborted)
      return { taskId: task.taskId, state: 'succeeded', reasonCode: result.reasonCode, completionKind: result.completionKind };
    return { taskId: task.taskId, state: 'unknown', reasonCode: 'march7th_business_scope_incomplete' };
  });
  const observationCheckpoint = JSON.stringify(state);
  if (observationCheckpoint.length > 65536) throw new Error('march7th_checkpoint_limit');
  return { observations, observationCheckpoint };
}
