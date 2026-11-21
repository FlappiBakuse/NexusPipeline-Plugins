'use strict';

function okwwRecordOutcome(state, id, outcome, reasonCode, completionKind = 'completed') {
  if (state.results[id]?.state === 'failed' || outcome === 'succeeded' && state.results[id]?.completionKind === 'satisfied') return;
  state.results[id] = { state: outcome, reasonCode, completionKind };
}

function okwwChildLine(state, config, log) {
  const enabled = id => config.rows.some(row => row.id === id && row.enabled);
  const fail = (id, reason) => { if (enabled(id)) okwwRecordOutcome(state, id, 'failed', reason); };
  if (!state.started) return;
  if (log.owner === 'DailyTask') {
    if (log.level === 'ERROR') {
      const caught = /^(NightmareNestTask|GardenTask|MergeEchoTask) Failed(?: |$)/.exec(log.message);
      if (caught) fail({ NightmareNestTask: 'nightmare', GardenTask: 'garden', MergeEchoTask: 'merge' }[caught[1]], 'okww_caught_child_exception');
      if (/^can not battle pass, maybe ended\s*$/.test(log.message)) fail('battle_pass', 'okww_battle_pass_unconfirmed');
    }
    const starts = { 'check weekly garden': 'garden', 'check discarded echo': 'merge', 'battle pass': 'battle_pass',
      'claim daily reward via  coordinate': 'daily_reward', 'Daily task completed, start teleport to farm 4C echo': 'farm_4c' };
    if (log.level === 'INFO' && starts[log.message]) state.markers[starts[log.message]] = true;
    if (log.level === 'INFO' && log.message === 'weekly garden already completed' && enabled('garden'))
      okwwRecordOutcome(state, 'garden', 'succeeded', 'okww_garden_already_completed', 'satisfied');
    if (log.level === 'DEBUG' && ['Auto Farm all Nightmare Nest', 'Farm Nightmare Nest for Daily Echo'].includes(log.message)) state.markers.nightmare = true;
  }
  if (log.owner === 'NightmareNestTask' && enabled('nightmare')) {
    if (log.level === 'INFO' && log.message === 'opened gray_book_boss') state.markers.nightmare = true;
    if (log.level === 'INFO' && /^(?:nightmare nest unreachable, skip this run|nightmare nest: died \d+ times, skip this run)(?::|$)/.test(log.message))
      fail('nightmare', 'okww_nightmare_target_uncompleted');
  }
  const staminaOwner = { 'Tacet Suppression': 'TacetTask', 'Forgery Challenge': 'ForgeryTask', 'Simulation Challenge': 'SimulationTask' }[config.farm];
  if (log.owner === staminaOwner) {
    state.markers.stamina = true;
    if (log.level === 'INFO' && /^farm_(?:tacet|domain): exceeded recovery retries \(\d+\), stop farming\s*$/.test(log.message))
      fail('stamina', 'okww_stamina_recovery_exhausted');
  }
  if (log.owner === 'FarmEchoTask' && enabled('farm_4c') && log.level === 'INFO' && /^farm 4c: exceeded recovery retries \(\d+\), stop farming\s*$/.test(log.message))
    fail('farm_4c', 'okww_4c_recovery_exhausted');
  if (log.owner === 'MergeEchoTask' && enabled('merge')) {
    if (log.level === 'ERROR' && log.message.startsWith('can not open bag with hotkey ')) fail('merge', 'okww_merge_bag_unavailable');
    if (log.level === 'INFO' && log.message === 'All full batches of discarded Echoes have been merged.')
      okwwRecordOutcome(state, 'merge', 'succeeded', 'okww_merge_full_batches_completed');
  }
  if (log.owner === 'GardenTask' && enabled('garden') && log.level === 'INFO' && log.message === '乐园任务完成, 已达到上限')
    okwwRecordOutcome(state, 'garden', 'succeeded', 'okww_garden_target_satisfied', 'satisfied');
}

function okwwClose(state, config) {
  if (!state.active || state.broken) return;
  state.completed = true; state.active = false;
  for (const row of config.rows.filter(row => row.known && row.enabled && row.id !== 'daily'))
    okwwRecordOutcome(state, row.id, 'succeeded', 'okww_authoritative_daily_flow_returned',
      row.id === 'nightmare' && !state.markers.nightmare ? 'inapplicable' : row.id === 'stamina' && !state.markers.stamina ? 'satisfied' : 'completed');
}

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
      state.aborted = true; state.active = false; okwwRecordOutcome(state, 'daily', 'failed', 'okww_daily_executor_exception');
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
