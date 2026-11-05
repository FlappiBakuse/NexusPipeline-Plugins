'use strict';

function maaProgramObservations(input, config, tasks, prefix, saved) {
  const ids = new Set(config.compilation.view.Pretasks.map(row => row.Id));
  const selected = tasks.filter(task => task.isEnabled && task.isSelected && ids.has(task.executionTaskId));
  const state = saved ?? { epoch: -1, sourceSequence: 0, rows: [] };
  if (!Number.isSafeInteger(state.epoch) || state.epoch < -1 || !Number.isSafeInteger(state.sourceSequence) || state.sourceSequence < 0 ||
      !Array.isArray(state.rows) || state.rows.length > selected.length || state.rows.some((outcome, index) =>
        !['succeeded', 'failed'].includes(outcome) || outcome === 'failed' && index !== state.rows.length - 1) ||
      (state.rows.length === 0) !== (state.epoch === -1) || (state.rows.length === 0) !== (state.sourceSequence === 0))
    throw new Error(prefix + '_program_checkpoint_unbound');
  const fields = ['format', 'version', 'runId', 'attemptId', 'planDigest', 'projectFingerprint', 'consumerExtensionId',
    'taskId', 'executionTaskId', 'sequence', 'outcome'];
  for (const event of input.logEvents ?? []) {
    if (event.sourceId !== 'stdout' || typeof event.text !== 'string' || !event.text.startsWith('{"format":"nexus.maa.program-fact",')) continue;
    if (!Number.isSafeInteger(event.epoch) || event.epoch < 0 || !Number.isSafeInteger(event.sequence) || event.sequence < 1 || event.text.length > 2048)
      throw new Error(prefix + '_program_event_invalid');
    if (event.epoch < state.epoch || event.epoch === state.epoch && event.sequence <= state.sourceSequence) continue;
    const fact = strictConfigurationJson(event.text, 'maa-framework'), task = selected[state.rows.length];
    if (!task || state.rows.includes('failed') || state.epoch !== -1 && state.epoch !== event.epoch ||
        Object.keys(fact).length !== fields.length || fields.some(key => !Object.prototype.hasOwnProperty.call(fact, key)) ||
        fact.format !== 'nexus.maa.program-fact' || fact.version !== 1 || fact.runId !== input.runId || fact.attemptId !== input.attemptId ||
        fact.planDigest !== input.planDigest || fact.projectFingerprint !== config.compilation.fingerprint || fact.consumerExtensionId !== input.extensionId ||
        fact.sequence !== state.rows.length + 1 || fact.taskId !== task.taskId || fact.executionTaskId !== task.executionTaskId ||
        !['succeeded', 'failed'].includes(fact.outcome)) throw new Error(prefix + '_program_fact_unbound');
    state.epoch = event.epoch; state.sourceSequence = event.sequence; state.rows.push(fact.outcome);
  }
  return { ids, state, ready: selected.length === state.rows.length && state.rows.every(outcome => outcome === 'succeeded'),
    observations: selected.map((task, index) => {
      const outcome = state.rows[index] === 'failed' ? 'failed' : input.logComplete === true && state.rows[index] === 'succeeded' ? 'succeeded' : 'unknown';
      const notExecuted = input.logComplete === true && state.rows[index] === undefined && state.rows.includes('failed');
      return { taskId: task.taskId, state: outcome, reasonCode: prefix + '_program_' + outcome,
        ...(outcome === 'succeeded' ? { completionKind: 'completed' } : notExecuted ? { completionKind: 'notExecuted' } : {}) };
    }) };
}
