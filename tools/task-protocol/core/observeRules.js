function observeRules(rule, finish) {
  const result = { protocolVersion: ADAPTER.protocolVersion || '1.0', type: 'observation', runId: input.runId, attemptId: input.attemptId,
    runBoundary: 'open', boundaryEvidence: [], diagnostics: [], observations: [], cursorState: input.adapterState || {} };
  if (result.protocolVersion === '1.1' || result.protocolVersion === '1.2') result.incidents = [];
  if (input.logBatch.hasGap) result.cursorState = {};
  const tasks = input.originalPlan.tasks.filter(t => input.attemptTaskIds.includes(t.id));
  const states = JSON.parse(JSON.stringify(input.acceptedState));
  function emit(task, status, line, ruleId, skipKind) {
    const old = states[task.id] || { status: 'pending', executionOrdinal: 0 };
    let ordinal = old.executionOrdinal || 1;
    if (status === 'running' && old.executionOrdinal > 0 && !['running', 'pending'].includes(old.status)) ordinal++;
    const observation = { id: [line.sourceId, line.epoch, line.sequence, task.id, status].join(':'), taskId: task.id,
      executionOrdinal: ordinal, status, reasonCode: ruleId, evidence: [{ sourceId: line.sourceId, epoch: line.epoch, sequence: line.sequence, ruleId }] };
    if ((ADAPTER.protocolVersion === '1.1' || ADAPTER.protocolVersion === '1.2') && ADAPTER.reasonTexts && ADAPTER.reasonTexts[ruleId])
      observation.reasonText = { kind: 'plugin', key: 'reason.' + ruleId, args: {}, fallback: ADAPTER.reasonTexts[ruleId] };
    if (skipKind) observation.skipKind = skipKind;
    result.observations.push(observation); states[task.id] = { executionOrdinal: ordinal, status };
  }
  for (const line of input.logBatch.records) rule(clean(line.text), tasks, (task, status, ruleId, skipKind) => emit(task, status, line, ruleId, skipKind), result, line, states);
  if (input.isFinalCall && finish) finish(tasks, result, states,
    (task, status, line, ruleId) => emit(task, status, line, ruleId));
  return result;
}
