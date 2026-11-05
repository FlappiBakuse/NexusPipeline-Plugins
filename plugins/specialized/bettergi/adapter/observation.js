'use strict';

function bgiInitialObservation(input) {
  return { version: 1, runId: input.runId, attemptId: input.attemptId, planDigest: input.planDigest,
    selection: input.selectedTaskIds ?? null,
    upstreamProcessId: input.upstreamProcessId, streams: [], scopes: [], seen: [], results: [], ambiguous: [] };
}

function bgiReadObservation(input, text, tasks) {
  if (!text) return bgiInitialObservation(input);
  const state = strictConfigurationJson(text, 'bettergi');
  if (state.version !== 1 || ['runId', 'attemptId', 'planDigest', 'upstreamProcessId'].some(key => state[key] !== input[key]) ||
      JSON.stringify(state.selection ?? null) !== JSON.stringify(input.selectedTaskIds ?? null) ||
      !Array.isArray(state.streams) || state.streams.length > 16 || !Array.isArray(state.scopes) || state.scopes.length > 16 ||
      !Array.isArray(state.seen) || !Array.isArray(state.results) || !Array.isArray(state.ambiguous))
    throw new Error('bettergi_observation_checkpoint_unbound');
  const selected = tasks.filter(task => task.isEnabled && task.isSelected).map(task => task.taskId);
  if ([...state.seen, ...state.ambiguous].some(id => !selected.includes(id)) || state.results.length > selected.length ||
      new Set(state.results.map(item => item.taskId)).size !== state.results.length ||
      state.results.some(item => !selected.includes(item.taskId) || !['succeeded', 'failed', 'unknown'].includes(item.state)))
    throw new Error('bettergi_observation_checkpoint_tasks_changed');
  return state;
}

function bgiSetObservation(state, taskId, outcome, reasonCode) {
  const previous = state.results.find(item => item.taskId === taskId);
  if (previous && previous.state === 'failed') return;
  const observation = { taskId, state: outcome, reasonCode };
  if (previous) Object.assign(previous, observation);
  else state.results.push(observation);
}

function bgiAmbiguousScope(state, scope, reason) {
  scope.ambiguous = true;
  if (scope.active) bgiSetObservation(state, scope.active, 'unknown', reason);
}

function bgiEnvelope(event, state) {
  let stream = state.streams.find(item => item.sourceId === event.sourceId);
  if (stream && event.epoch < stream.epoch) return null;
  if (stream && event.epoch === stream.epoch && event.sequence <= stream.sequence) return null;
  if (!stream) {
    if (state.streams.length >= 16) throw new Error('bettergi_log_source_limit');
    stream = { sourceId: event.sourceId, epoch: event.epoch, sequence: event.sequence - 1, header: null };
    state.streams.push(stream);
  }
  if (event.epoch !== stream.epoch || event.sequence !== stream.sequence + 1) {
    for (const scope of state.scopes.filter(item => item.sourceId === event.sourceId && !item.closed))
      bgiAmbiguousScope(state, scope, 'bettergi_log_sequence_discontinuous');
    stream.header = null;
  }
  stream.epoch = event.epoch; stream.sequence = event.sequence;
  const text = event.text.trim();
  const match = text.match(/^\[\d{2}:\d{2}:\d{2}\.\d{3}\] \[(INF|ERR|WRN|DBG|FTL)\] \[([^\]]{1,256})\] (BetterGenshinImpact\.[\w.]+)$/);
  if (match) {
    const process = match[2].match(/^[A-Za-z]+:S\d+:P(\d+):T\d+$/);
    stream.header = process && (event.producerProcessId === undefined || Number(process[1]) === event.producerProcessId)
      ? { level: match[1], context: match[2], logger: match[3], consumed: false } : null;
    return null;
  }
  if (!stream.header || stream.header.consumed || !text) return null;
  stream.header.consumed = true;
  return { ...stream.header, text, sourceId: event.sourceId, epoch: event.epoch };
}

function bgiGroupName(value) {
  if (!value.startsWith('"')) return value;
  try { const name = JSON.parse(value); return typeof name === 'string' ? name : null; }
  catch { return null; }
}

function bgiScopeMessage(message, tasks, state) {
  let scope = state.scopes.find(item => item.sourceId === message.sourceId && item.context === message.context);
  if (!scope) {
    if (state.scopes.length >= 16) throw new Error('bettergi_log_scope_limit');
    scope = { sourceId: message.sourceId, context: message.context, active: null, closed: true, depth: 0 };
    state.scopes.push(scope);
  }
  const outer = message.logger === 'BetterGenshinImpact.ViewModel.Pages.OneDragonFlowViewModel';
  const runner = message.logger === 'BetterGenshinImpact.GameTask.TaskRunner';
  const service = message.logger === 'BetterGenshinImpact.Service.ScriptService';
  const marker = outer && message.text.match(/^(一条龙|配置组)任务执行: (\d+)\/(\d+)$/);
  if (marker) {
    if (scope.active && !scope.closed) bgiAmbiguousScope(state, scope, 'bettergi_scope_terminal_missing');
    const builtin = marker[1] === '一条龙', pool = tasks.filter(task => BGI_BUILTINS.includes(task.title) === builtin);
    const task = pool[Number(marker[2]) - 1];
    if (!task || Number(marker[3]) !== (builtin ? tasks.length : pool.length)) {
      scope.active = null;
      return;
    }
    const repeated = state.seen.includes(task.taskId);
    if (repeated) {
      if (!state.ambiguous.includes(task.taskId)) state.ambiguous.push(task.taskId);
      bgiSetObservation(state, task.taskId, 'unknown', 'bettergi_scope_repeated');
    } else state.seen.push(task.taskId);
    Object.assign(scope, { active: task.taskId, builtin, closed: false, depth: 0,
      failed: false, ambiguous: repeated, groupStarted: false });
    return;
  }
  if (!scope.active) return;
  const task = tasks.find(item => item.taskId === scope.active);
  if (scope.closed) {
    if (['ERR', 'FTL'].includes(message.level))
      bgiSetObservation(state, task.taskId, 'unknown', 'bettergi_late_error_scope_unbound');
    return;
  }
  if (outer && message.text === '一条龙和配置组任务结束') {
    bgiAmbiguousScope(state, scope, 'bettergi_outer_end_without_task_terminal');
    scope.closed = true;
    return;
  }
  const cancelled = outer && /^(任务被取消，退出执行|一条龙在启动阶段被取消)$/.test(message.text) ||
    runner && message.text === '任务中断:任务被取消' || service && message.text.startsWith('取消执行配置组: ');
  if (['ERR', 'FTL'].includes(message.level) || outer && message.text === '执行配置组任务时失败' || cancelled) {
    scope.failed = true;
    bgiSetObservation(state, task.taskId, 'failed', cancelled ? 'bettergi_scope_cancelled' : 'bettergi_scope_failed');
  }
  if (runner && message.text.startsWith('任务中断:') && !cancelled)
    bgiAmbiguousScope(state, scope, 'bettergi_interruption_not_proven_normal');
  if (scope.builtin && runner && /^→ (?:"任务启动！"|任务启动！)$/.test(message.text)) {
    if (++scope.depth > 16) throw new Error('bettergi_runner_nesting_limit');
  }
  let ended = false;
  if (scope.builtin && runner && /^→ (?:"任务结束"|任务结束)$/.test(message.text) && scope.depth > 0)
    ended = --scope.depth === 0;
  if (!scope.builtin && service) {
    const start = message.text.match(/^配置组 (.+) 加载完成，共\d+个脚本，开始执行$/);
    if (start && bgiGroupName(start[1]) === task.title) scope.groupStarted = true;
    const end = message.text.match(/^配置组 (.+) 执行结束$/);
    ended = !!end && scope.groupStarted && bgiGroupName(end[1]) === task.title;
  }
  if (ended) {
    bgiSetObservation(state, task.taskId, scope.failed ? 'failed' : scope.ambiguous ? 'unknown' : 'succeeded',
      scope.failed ? 'bettergi_scope_failed' : scope.ambiguous ? 'bettergi_scope_ambiguous' : 'bettergi_outer_scope_completed');
    scope.closed = true;
  }
}

function bgiObserveRecords(input, tasks, events, checkpoint) {
  const selected = tasks.filter(task => task.isSelected && task.isEnabled);
  const state = bgiReadObservation(input, checkpoint, tasks);
  if (!Array.isArray(events) || events.length > 256) throw new Error('bettergi_log_event_limit');
  for (const event of events) {
    if (!bgiText(event.sourceId, 120) || !Number.isSafeInteger(event.epoch) || event.epoch < 0 ||
        !Number.isSafeInteger(event.sequence) || event.sequence < 1 || typeof event.text !== 'string' || event.text.length > 65536)
      throw new Error('bettergi_log_event_invalid');
    if (event.sourceId !== 'file:0') continue;
    const envelope = bgiEnvelope({ ...event, producerProcessId: input.upstreamProcessId }, state);
    if (envelope) bgiScopeMessage(envelope, selected, state);
  }
  const observations = selected.map(task => state.results.find(item => item.taskId === task.taskId) ||
    { taskId: task.taskId, state: 'unknown', reasonCode: 'bettergi_task_terminal_missing' });
  const next = JSON.stringify(state);
  if (next.length > 65536) throw new Error('bettergi_observation_checkpoint_limit');
  return { observations, checkpoint: next };
}

function observeTasks(input, tasks) {
  if (input.selectedTaskIds !== undefined) {
    const ids = input.selectedTaskIds;
    if (!Array.isArray(ids) || new Set(ids).size !== ids.length || ids.some(id => !tasks.some(task => task.taskId === id && task.isEnabled && task.isSelected)))
      throw new Error('bettergi_observation_selection_unbound');
    tasks = tasks.filter(task => ids.includes(task.taskId));
  }
  if (!Number.isSafeInteger(input.upstreamProcessId) || input.upstreamProcessId < 1)
    return { observations: tasks.filter(task => task.isSelected && task.isEnabled).map(task =>
      ({ taskId: task.taskId, state: 'unknown', reasonCode: 'bettergi_upstream_process_identity_required' })) };
  if (input.logEvents !== undefined) {
    if (input.logLines?.length) throw new Error('bettergi_log_inputs_ambiguous');
    const result = bgiObserveRecords(input, tasks, input.logEvents, input.observationCheckpoint);
    const observations = result.observations.map(item => item.state === 'succeeded' && input.logComplete !== true
      ? { ...item, state: 'unknown', reasonCode: 'bettergi_log_stream_not_complete' } : item);
    return { observations, observationCheckpoint: result.checkpoint };
  }
  if (input.observationCheckpoint) throw new Error('bettergi_log_checkpoint_requires_events');
  const events = (input.logLines ?? []).map((text, index) => ({ sourceId: 'file:0', epoch: 0, sequence: index + 1, text }));
  return { observations: bgiObserveRecords(input, tasks, events).observations };
}
