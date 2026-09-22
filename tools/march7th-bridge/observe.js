// Isolated prototype only: the caller freezes bridgeSession before consuming any payload.
if (input.protocolVersion !== '1.1' || input.phase !== 'observe') throw new Error('protocol_error: bridge phase/version');
const out = {protocolVersion:'1.1',type:'observation',runId:input.runId,attemptId:input.attemptId,
  observations:[],incidents:[],diagnostics:[],runBoundary:'open',boundaryEvidence:[],cursorState:input.adapterState || {}};
const state = out.cursorState;
const allowed = input.bridgeSession;
function diagnostic(code) { out.diagnostics.push({code:'bridge.'+code,message:code}); }
function invalidate(code) { state.tainted = true; diagnostic(code); }
function evidence(line, ruleId) { return {sourceId:line.sourceId,epoch:line.epoch,sequence:line.sequence,ruleId}; }
function parseEvent(text) {
  if (text.length > 8192) throw new Error('event too large');
  const value = JSON.parse(text);
  // JSON.parse alone accepts duplicate keys. Track decoded member names at each object level.
  const tokens = text.match(/"(?:\\.|[^"\\])*"|[{}\[\]:,]/g) || [];
  const stack = [];
  for (let i=0;i<tokens.length;i++) {
    const token = tokens[i];
    if (token === '{') stack.push([]);
    else if (token === '[') stack.push(null);
    else if (token === '}' || token === ']') stack.pop();
    else if (token[0] === '"' && tokens[i+1] === ':') {
      const name = JSON.parse(token), names = stack[stack.length-1];
      if (!names || names.includes(name)) throw new Error('duplicate member');
      names.push(name);
    }
  }
  return value;
}
if (allowed && allowed.enabled === true) {
  state.tasks = state.tasks || {};
  state.seen = state.seen || {};
  state.last = state.last || 0;
  if (input.logBatch.hasGap) invalidate('log_gap');
  for (const line of input.logBatch.records) {
    if (line.sourceId === allowed.nativeSourceId) {
      // Native duplicates are mapped by the frozen candidate name, never a common prefix.
      const match = line.text.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2},\d{3} \| INFO \| 领取(.+)奖励完成$/);
      if (match) {
        const tasks = input.originalPlan.tasks.filter(t => t.name === match[1] && input.attemptTaskIds.includes(t.id));
        if (tasks.length === 1) {
          const task = state.tasks[tasks[0].sourceKey] || (state.tasks[tasks[0].sourceKey] = {});
          task.native = evidence(line,'bridge.native.reward_collected');
        }
      }
      continue;
    }
    if (line.sourceId !== allowed.sourceId) { diagnostic('wrong_source'); continue; }
    if (state.epoch !== undefined && state.epoch !== line.epoch) invalidate('epoch_changed');
    state.epoch = line.epoch;
    let event;
    try { event = parseEvent(line.text); } catch (_) { invalidate('invalid_json'); continue; }
    if (!event || typeof event !== 'object' || Array.isArray(event)) { invalidate('invalid_envelope'); continue; }
    if (event.runId !== input.runId || event.attemptId !== input.attemptId || event.bindingId !== allowed.bindingId ||
        event.sessionNonce !== allowed.sessionNonce || event.producer !== 'nxp.march7th.checkin.prototype' ||
        event.upstreamCommit !== '7423dea64552f71332cc71f3c02481695aaec151') { diagnostic('identity_rejected'); continue; }
    const fields = ['schemaVersion','producer','upstreamCommit','runId','attemptId','bindingId','sessionNonce',
      'sequence','taskKey','event','branchCode','evidenceBasis','occurredAt'];
    if (event.event === 'task.result') fields.push('result');
    if (Object.keys(event).length !== fields.length || fields.some(key => !Object.prototype.hasOwnProperty.call(event,key)) ||
        event.schemaVersion !== '1.0-prototype' || !Number.isSafeInteger(event.sequence) || event.sequence < 1 || event.sequence > 4096 ||
        typeof event.branchCode !== 'string' || !event.branchCode.length || event.branchCode.length > 160 ||
        typeof event.occurredAt !== 'string' || !Number.isFinite(Date.parse(event.occurredAt))) { invalidate('invalid_envelope'); continue; }
    const serialized = JSON.stringify(event);
    if (state.seen[event.sequence]) {
      if (state.seen[event.sequence] !== serialized) invalidate('conflicting_duplicate');
      continue;
    }
    if (event.sequence !== state.last+1) invalidate('sequence_gap');
    state.last = event.sequence; state.seen[event.sequence] = serialized;
    // Bound cursor size independently from Host's log buffer.
    if (Object.keys(state.seen).length > 128) throw new Error('resource_limit: bridge event ledger');
    if (state.ended) { invalidate('event_after_end'); continue; }
    if (event.event === 'session.started') {
      if (state.started || event.sequence !== 1 || event.taskKey !== null || event.evidenceBasis !== 'bridge_lifecycle') invalidate('invalid_start');
      state.started = true; continue;
    }
    if (!state.started) { invalidate('missing_session_start'); continue; }
    if (event.event === 'session.gap') { invalidate('producer_gap'); continue; }
    if (event.event === 'session.ended') {
      if (event.taskKey !== null || event.evidenceBasis !== 'bridge_lifecycle') invalidate('invalid_end');
      state.ended = true; continue;
    }
    const definition = input.originalPlan.tasks.find(t => t.sourceKey === event.taskKey && input.attemptTaskIds.includes(t.id));
    if (!definition || event.evidenceBasis !== 'upstream_branch') { invalidate('task_out_of_scope'); continue; }
    const task = state.tasks[event.taskKey] || (state.tasks[event.taskKey] = {});
    if (event.event === 'task.started') {
      if (task.started || event.branchCode !== 'checkin_entered') invalidate('invalid_task_start');
      task.started = evidence(line,'bridge.checkin_entered');
    } else if (event.event === 'task.result') {
      const expected = {reward_collected:'succeeded',entry_ready_no_reward:'succeeded',
        entry_not_confirmed:'unknown',collection_not_confirmed:'unknown'};
      if (!task.started || task.result || !Object.prototype.hasOwnProperty.call(expected,event.branchCode) ||
          expected[event.branchCode] !== event.result) { invalidate('invalid_task_result'); continue; }
      task.result = event.result; task.branch = event.branchCode; task.evidence = evidence(line,'bridge.'+event.branchCode);
    } else invalidate('unknown_event');
  }
  if (input.isFinalCall) {
    if (!state.ended) invalidate('missing_session_end');
    for (const definition of input.originalPlan.tasks.filter(t => input.attemptTaskIds.includes(t.id))) {
      const task = state.tasks[definition.sourceKey];
      if (!task || !task.started) continue;
      const conflict = task.native && task.branch !== 'reward_collected';
      if (conflict) diagnostic('native_conflict');
      const status = state.tainted || conflict ? 'unknown' : task.result || 'unknown';
      const proof = [task.started,task.evidence,task.native].filter(Boolean);
      const reason = state.tainted ? 'incomplete_stream' : conflict ? 'native_conflict' : task.branch || 'missing_result';
      out.observations.push({id:'bridge:'+definition.id,taskId:definition.id,executionOrdinal:1,status,
        reasonCode:'bridge.'+reason,reasonText:{kind:'literal',value:reason},evidence:proof});
    }
  }
}
console.log(out);
