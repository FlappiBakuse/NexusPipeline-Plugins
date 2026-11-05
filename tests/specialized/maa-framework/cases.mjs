import { request } from '../maa-fixture.mjs';

const compilation = (repeat = 1, preparation = false) => ({ fingerprint: 'a'.repeat(64),
  view: { format: 'maa-internal-execution', version: 1,
    Tasks: [{ Id: 'daily', Name: 'Daily', Enabled: true, RepeatCount: repeat, Role: 'business' }],
    Pretasks: preparation ? [{ Id: 'launch', Name: 'Launch', Enabled: true, RepeatCount: 1 }] : [] } });
const input = (phase, compiled = compilation(), extra = {}) => request('maa-framework', phase, [], { compiled, ...extra });
const event = (body, sequence = 1, epoch = 0, sourceId = 'stdout') => ({ sourceId, sequence, epoch, text: JSON.stringify(body) });
const native = (extra = {}) => ({ format: 'nexus.maa.native-fact', version: 1,
  runId: '582d6b9e-afbe-4aa3-860e-dd208e1915de', attemptId: '05fe2eaf-95a7-49e1-a631-e7abdf73adfa', planDigest: 'a'.repeat(64),
  projectFingerprint: 'a'.repeat(64), consumerExtensionId: 'maa-framework', taskId: 'daily', executionTaskId: 'daily',
  repetition: 1, nativeTaskId: 1, status: 3000, sequence: 1, ...extra });
const program = (outcome = 'succeeded') => ({ format: 'nexus.maa.program-fact', version: 1,
  runId: '582d6b9e-afbe-4aa3-860e-dd208e1915de', attemptId: '05fe2eaf-95a7-49e1-a631-e7abdf73adfa', planDigest: 'a'.repeat(64),
  projectFingerprint: 'a'.repeat(64), consumerExtensionId: 'maa-framework', taskId: 'launch', executionTaskId: 'launch', sequence: 1, outcome });

export function cases(invoke) {
  const rows = [], add = (name, value, expect, error) => rows.push({ name, input: value, expect, ...(error ? { error } : {}) });
  const compiled = compilation(), tasks = invoke(input('discover')).tasks;
  const observe = (logEvents = [], extra = {}) => input('observe', compiled, { tasks, logEvents, logComplete: true, ...extra });
  add('current direct driver exposes frozen native occurrence', input('discover'), { 'tasks.0.executionTaskId': 'daily', 'tasks.0.retrySafety': 'unknown' });
  add('current direct driver does not edit configuration', input('configuration'), { configPatches: [] });
  const initial = observe([], { logComplete: false }), checkpoint = invoke(initial).observationCheckpoint;
  add('first empty observation produces a reusable unknown checkpoint', initial, { 'observations.0.state': 'unknown' });
  add('first native fact after empty checkpoint succeeds', observe([event(native())], { observationCheckpoint: checkpoint }), { 'observations.0.state': 'succeeded' });
  add('native failure remains failed', observe([event(native({ status: 4000 }))]), { 'observations.0.state': 'failed' });
  add('native success before final drain remains unknown', observe([event(native())], { logComplete: false }), { 'observations.0.state': 'unknown' });
  add('foreign source cannot supply facts', observe([event(native(), 1, 0, 'file:0')]), { 'observations.0.state': 'unknown' });
  for (const [field, value] of Object.entries({ runId: 'foreign', attemptId: 'foreign', planDigest: 'b'.repeat(64),
    projectFingerprint: 'b'.repeat(64), consumerExtensionId: 'maas', nativeTaskId: 0, status: 0, repetition: 0, sequence: 2 }))
    add('native identity rejects ' + field, observe([event(native({ [field]: value }))]), {}, 'native_fact_unbound');
  for (const field of ['taskId', 'executionTaskId']) add('native occurrence rejects ' + field,
    observe([event(native({ [field]: 'foreign' }))]), {}, 'native_task_unbound');
  add('invalid event epoch rejected', observe([event(native(), 1, -1)]), {}, 'native_event_invalid');
  add('extra native fact field rejected', observe([event(native({ extra: true }))]), {}, 'native_fact_unbound');
  const repeated = compilation(2), repeatedTasks = invoke(input('discover', repeated)).tasks;
  const first = input('observe', repeated, { tasks: repeatedTasks, logEvents: [event(native())], logComplete: false });
  const saved = JSON.stringify({ format: 'nexus.maa.native-observation', version: 1,
    binding: JSON.stringify([first.runId, first.attemptId, first.planDigest, repeated.fingerprint, null, null]),
    epoch: 0, sourceSequence: 1, sequence: 1, nativeTaskId: 1, pointer: 0, failed: false, rows: [[1, false]],
    programs: { epoch: -1, sourceSequence: 0, rows: [] } });
  add('missing repeated occurrence cannot manufacture success', { ...first, logComplete: true }, { 'observations.0.state': 'unknown', 'observations.0.completedRepetitions': 1 });
  add('all repetitions and final drain prove success', input('observe', repeated, { tasks: repeatedTasks,
    observationCheckpoint: saved, logEvents: [event(native({ repetition: 2, nativeTaskId: 2, sequence: 2 }), 2)], logComplete: true }),
    { 'observations.0.state': 'succeeded', 'observations.0.completedRepetitions': 2 });
  add('checkpoint cannot move to another epoch', input('observe', repeated, { tasks: repeatedTasks,
    observationCheckpoint: saved, logEvents: [event(native({ repetition: 2, nativeTaskId: 2, sequence: 2 }), 2, 1)], logComplete: true }), {}, 'native_epoch_changed');
  add('duplicate captured source event is not applied twice', { ...first, observationCheckpoint: saved }, { 'observations.0.completedRepetitions': 1 });
  const prepared = compilation(1, true), all = invoke(input('discover', prepared)).tasks;
  const preparedObserve = (events, extra = {}) => input('observe', prepared, { tasks: all, logEvents: events, logComplete: true, ...extra });
  add('native task cannot precede preparation proof', preparedObserve([event(native())]), {}, 'native_preparation_unconfirmed');
  add('program and native facts close in frozen order', preparedObserve([event(program()), event(native(), 2)]),
    { 'observations.0.state': 'succeeded', 'observations.1.state': 'succeeded' });
  add('failed preparation leaves native task not executed', preparedObserve([event(program('failed'))]),
    { 'observations.0.state': 'failed', 'observations.1.state': 'unknown', 'observations.1.completionKind': 'notExecuted' });
  add('unknown text cannot invent native progress', observe([event({ arbitrary: 'text' })]), { 'observations.0.state': 'unknown' });
  add('direct driver never invents safe automatic retry', input('retry', compiled, { tasks, idempotencyKey: 'bounded',
    observations: [{ taskId: 'daily', state: 'failed' }] }), { selectedTaskIds: [] });
  add('foreign selected occurrence is rejected', observe([], { selectedTaskIds: ['foreign'] }), {}, 'observation_selection_unbound');
  return rows;
}
