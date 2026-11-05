'use strict';

function maaObservationTasks(input, tasks, prefix) {
  if (input.selectedTaskIds === undefined) return tasks;
  const ids = input.selectedTaskIds;
  if (!Array.isArray(ids) || new Set(ids).size !== ids.length ||
      ids.some(id => !tasks.some(task => task.taskId === id && task.isSelected && task.isEnabled)))
    throw new Error(prefix + '_observation_selection_unbound');
  return tasks.map(task => ({ ...task, isSelected: task.isSelected && ids.includes(task.taskId) }));
}

function maaNativeObservations(input, config, tasks, prefix) {
  const marker = '{"format":"nexus.maa.native-fact",';
  const nativeEvents = (input.logEvents ?? []).filter(event => event.sourceId === 'stdout' &&
    typeof event.text === 'string' && event.text.startsWith(marker));
  let checkpoint = input.observationCheckpoint ? strictConfigurationJson(input.observationCheckpoint, 'maa-framework') : null;
  if (checkpoint && checkpoint.format !== 'nexus.maa.native-observation') throw new Error(prefix + '_checkpoint_invalid');

  const binding = JSON.stringify([input.runId, input.attemptId, input.planDigest, config.compilation.fingerprint,
    input.selectedTaskIds ?? null, input.repetitionOffsets ?? null]);
  const occurrences = [...config.compilation.view.Tasks, ...config.compilation.view.Pretasks];
  const bound = tasks.map(task => {
    const matches = occurrences.filter(row => row.Id === task.executionTaskId);
    if (matches.length !== 1 || !Number.isSafeInteger(matches[0].RepeatCount) || matches[0].RepeatCount < 1 || matches[0].RepeatCount > 100)
      throw new Error(prefix + '_native_occurrence_unbound');
    return matches[0];
  });
  const offsets = tasks.map(() => 0), supplied = input.repetitionOffsets ?? [];
  if (!Array.isArray(supplied) || new Set(supplied.map(item => item.taskId)).size !== supplied.length)
    throw new Error(prefix + '_native_repetition_unbound');
  for (const offset of supplied) {
    const index = tasks.findIndex(task => task.taskId === offset.taskId);
    if (index < 0 || !tasks[index].isSelected || tasks[index].workflowRole !== 'business' ||
        tasks[index].repetitionLimit !== bound[index].RepeatCount || !Number.isSafeInteger(offset.completedRepetitions) ||
        offset.completedRepetitions < 0 || offset.completedRepetitions >= bound[index].RepeatCount)
      throw new Error(prefix + '_native_repetition_unbound');
    offsets[index] = offset.completedRepetitions;
  }
  const programs = maaProgramObservations(input, config, tasks, prefix, checkpoint?.programs);
  const selected = tasks.map((task, index) => ({ task, index })).filter(item => item.task.isSelected && item.task.isEnabled && !programs.ids.has(item.task.executionTaskId));
  const state = checkpoint ?? { format: 'nexus.maa.native-observation', version: 1, binding,
    epoch: -1, sourceSequence: 0, sequence: 0, nativeTaskId: 0, pointer: 0, failed: false, rows: offsets.map(value => [value, false]) };
  state.programs = programs.state;
  if (state.format !== 'nexus.maa.native-observation' || state.version !== 1 || state.binding !== binding ||
      !Number.isSafeInteger(state.epoch) || state.epoch < -1 || !Number.isSafeInteger(state.sourceSequence) || state.sourceSequence < 0 ||
      !Number.isSafeInteger(state.sequence) || state.sequence < 0 || !Number.isSafeInteger(state.nativeTaskId) || state.nativeTaskId < 0 ||
      !Number.isSafeInteger(state.pointer) || state.pointer < 0 || state.pointer > selected.length || typeof state.failed !== 'boolean' ||
      !Array.isArray(state.rows) || state.rows.length !== tasks.length || state.rows.some((row, index) =>
        !Array.isArray(row) || row.length !== 2 || !Number.isSafeInteger(row[0]) || row[0] < offsets[index] || row[0] > bound[index].RepeatCount || typeof row[1] !== 'boolean'))
    throw new Error(prefix + '_native_checkpoint_unbound');
  const firstOpen = selected.findIndex(({ index }) => state.rows[index][1] || state.rows[index][0] < bound[index].RepeatCount);
  const pointer = firstOpen < 0 ? selected.length : firstOpen;
  if (state.pointer !== pointer || state.failed !== state.rows.some(row => row[1]) ||
      state.sourceSequence < state.sequence || state.sequence < state.rows.reduce((sum, row, index) => sum + row[0] - offsets[index], 0) ||
      (state.sequence === 0) !== (state.epoch === -1) || (state.sequence === 0) !== (state.nativeTaskId === 0) ||
      state.rows.some((row, index) => !tasks[index].isSelected && (row[0] !== 0 || row[1])) ||
      selected.slice(pointer + 1).some(({ index }) => state.rows[index][0] !== offsets[index] || state.rows[index][1]))
    throw new Error(prefix + '_native_checkpoint_inconsistent');
  const fields = ['format', 'version', 'runId', 'attemptId', 'planDigest', 'projectFingerprint', 'consumerExtensionId',
    'taskId', 'executionTaskId', 'repetition', 'nativeTaskId', 'status', 'sequence'];
  for (const event of nativeEvents) {
    if (!programs.ready || programs.state.epoch !== -1 && (programs.state.epoch !== event.epoch || programs.state.sourceSequence >= event.sequence))
      throw new Error(prefix + '_native_preparation_unconfirmed');
    if (!Number.isSafeInteger(event.epoch) || event.epoch < 0 || !Number.isSafeInteger(event.sequence) || event.sequence < 1 || event.text.length > 2048)
      throw new Error(prefix + '_native_event_invalid');
    if (event.epoch < state.epoch || event.epoch === state.epoch && event.sequence <= state.sourceSequence) continue;
    if (state.epoch !== -1 && event.epoch !== state.epoch) throw new Error(prefix + '_native_epoch_changed');
    const fact = strictConfigurationJson(event.text, 'maa-framework');
    if (Object.keys(fact).length !== fields.length || fields.some(key => !Object.prototype.hasOwnProperty.call(fact, key)) ||
        fact.format !== 'nexus.maa.native-fact' || fact.version !== 1 || fact.runId !== input.runId || fact.attemptId !== input.attemptId ||
        fact.planDigest !== input.planDigest || fact.projectFingerprint !== config.compilation.fingerprint || fact.consumerExtensionId !== input.extensionId ||
        fact.sequence !== state.sequence + 1 || !Number.isSafeInteger(fact.nativeTaskId) || fact.nativeTaskId <= state.nativeTaskId ||
        !Number.isSafeInteger(fact.repetition) || fact.repetition < 1 || ![3000, 4000].includes(fact.status))
      throw new Error(prefix + '_native_fact_unbound');
    const index = tasks.findIndex(task => task.taskId === fact.taskId);
    if (index < 0 || bound[index].Id !== fact.executionTaskId || fact.repetition > bound[index].RepeatCount)
      throw new Error(prefix + '_native_task_unbound');
    state.epoch = event.epoch; state.sourceSequence = event.sequence; state.sequence = fact.sequence; state.nativeTaskId = fact.nativeTaskId;
    if (!tasks[index].isSelected || !tasks[index].isEnabled) throw new Error(prefix + '_native_task_unbound');
    if (state.failed || selected[state.pointer]?.index !== index || fact.repetition !== state.rows[index][0] + 1)
      throw new Error(prefix + '_native_order_invalid');
    state.rows[index][0]++; state.rows[index][1] = fact.status === 4000;
    if (fact.status === 4000) state.failed = true;
    else if (state.rows[index][0] === bound[index].RepeatCount) state.pointer++;
  }
  const observations = selected.map(({ task, index }) => {
    const row = state.rows[index], outcome = row[1] ? 'failed' : input.logComplete === true && row[0] === bound[index].RepeatCount ? 'succeeded' : 'unknown';
    const notExecuted = input.logComplete === true && row[0] === offsets[index] && (state.failed || programs.state.rows.includes('failed'));
    return { taskId: task.taskId, state: outcome, reasonCode: prefix + '_native_' + (outcome === 'unknown' ? 'incomplete' : outcome),
      ...(task.repetitionLimit === undefined ? {} : { completedRepetitions: row[0] - (row[1] ? 1 : 0) }),
      ...(outcome === 'succeeded' ? { completionKind: 'completed' } : notExecuted ? { completionKind: 'notExecuted' } : {}) };
  });
  const observationCheckpoint = JSON.stringify(state);
  if (observationCheckpoint.length > 65536) throw new Error(prefix + '_native_checkpoint_limit');
  const results = [...programs.observations, ...observations];
  return { observations: tasks.filter(task => task.isSelected && task.isEnabled).map(task => results.find(item => item.taskId === task.taskId)),
    diagnostics: [], observationCheckpoint };
}
