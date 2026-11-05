'use strict';

function okwwSet(state, id, outcome, reasonCode, completionKind = 'completed') {
  if (state.results[id]?.state === 'failed' || outcome === 'succeeded' && state.results[id]?.completionKind === 'satisfied') return;
  state.results[id] = { state: outcome, reasonCode, completionKind };
}

function okwwChildLine(state, config, log) {
  const enabled = id => config.rows.some(row => row.id === id && row.enabled);
  const fail = (id, reason) => { if (enabled(id)) okwwSet(state, id, 'failed', reason); };
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
      okwwSet(state, 'garden', 'succeeded', 'okww_garden_already_completed', 'satisfied');
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
      okwwSet(state, 'merge', 'succeeded', 'okww_merge_full_batches_completed');
  }
  if (log.owner === 'GardenTask' && enabled('garden') && log.level === 'INFO' && log.message === '乐园任务完成, 已达到上限')
    okwwSet(state, 'garden', 'succeeded', 'okww_garden_target_satisfied', 'satisfied');
}

function okwwClose(state, config) {
  if (!state.active || state.broken) return;
  state.completed = true; state.active = false;
  for (const row of config.rows.filter(row => row.known && row.enabled && row.id !== 'daily'))
    okwwSet(state, row.id, 'succeeded', 'okww_authoritative_daily_flow_returned',
      row.id === 'nightmare' && !state.markers.nightmare ? 'inapplicable' : row.id === 'stamina' && !state.markers.stamina ? 'satisfied' : 'completed');
}
