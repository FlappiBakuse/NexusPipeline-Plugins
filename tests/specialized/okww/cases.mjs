import { createHash } from 'node:crypto';

const farms = ['Tacet Suppression', 'Forgery Challenge', 'Simulation Challenge'];
const additions = ['Check Weekly Garden', 'Auto Farm all Nightmare Nest', 'Merge Echo If discarded > 1000', 'Teleport and Farm 4C Echo'];
const ids = ['daily', 'nightmare', 'stamina', 'daily_reward', 'mail', 'battle_pass', 'garden', 'merge', 'farm_4c'];
const resource = (document, resourceId = 'main') => { const content = typeof document === 'string' ? document : JSON.stringify(document);
  return { resourceId, revision: 7, content, sha256: createHash('sha256').update(content).digest('hex') }; };
const make = (farm = farms[0], extras = ['Check Weekly Garden'], echo = true) => ({ 'Which to Farm': farm,
  'Which Tacet Suppression to Farm': 1, 'Which Forgery Challenge to Farm': 1, 'Material Selection': 'Shell Credit',
  'Farm Nightmare Nest for Daily Echo': echo, 'Additional Tasks to Run After Daily Task': extras, nativeProgress: { date: '2026-10-25', usedStamina: 120 } });
const child = () => ({ 'Teleport to Boss': 'Weekly Challenge', 'Boss Level': '80', Boss: 'Other', 'Repeat Farm Count': 3,
  'Combat Wait Time': 0, 'Echo Pickup Method': 'Walk', 'Use Liberation': true, 'Switch to Healer before and after Combat': true,
  'Which Weekly Boss to Teleport': 1, 'Which Boss Challenge to Teleport': 1, 'Which Special Nightmare to Teleport': 1, nativeCounter: 2 });
const request = (phase, document = make(), extras = {}) => ({ format: 'nexus.task.adapter', version: 1, direction: 'request', phase,
  extensionId: 'okww', operationId: '009ca3c5-6b90-40e2-a981-53a33ab5c43f', resources: [resource(document), resource(child(), 'farm-4c'),
    resource({ 'Which to Farm': ['Nightmare Purification', 'Tacet Discord Nest'], preserved: { progress: 2 } }, 'nightmare')],
  ...(['observe', 'retry'].includes(phase) ? { runId: '582d6b9e-afbe-4aa3-860e-dd208e1915de', attemptId: '05fe2eaf-95a7-49e1-a631-e7abdf73adfa', planDigest: 'a'.repeat(64) } : {}), ...extras });
const events = (lines, { first = 1, epoch = 0, sourceId = 'file:0', thread = 'TaskExecutor', owner = 'DailyTask' } = {}) =>
  lines.map((line, index) => ({ sourceId, epoch, sequence: first + index,
    text: `2026-10-25 12:00:00,123 ${line.level ?? 'INFO'} ${line.thread ?? thread} ${line.owner ?? owner}:${line.text ?? line}` }));
const state = (id, value) => ({ ['observations.' + ids.indexOf(id) + '.state']: value });
const patch = (input, edits, resourceId = 'main') => ({ format: 'nexus.config.patch', version: 1, operationId: input.operationId, resourceId,
  sourceSha256: input.resources.find(item => item.resourceId === resourceId).sha256, expectedRevision: 7, edits });
const outer = ['open_daily', 'claim daily reward via  coordinate', 'battle pass', 'Daily Task Completed'];

export function cases(invoke) {
  const rows = [], add = (name, input, expect = {}, error) => rows.push({ name, input, expect, ...(error ? { error } : {}) });
  const observe = (document, lines, extras = {}) => request('observe', document, { tasks: invoke(request('discover', document)).tasks,
    logEvents: events(lines), logComplete: true, ...extras });
  for (const farm of farms) for (let bits = 0; bits < 16; bits++) for (const echo of [false, true]) {
    const extras = additions.filter((_, index) => bits & 1 << index), document = make(farm, extras, echo), nightmare = extras.includes(additions[1]) || echo && farm !== farms[0];
    add('all native combinations ' + farm + '/' + bits + '/' + echo, request('discover', document), {
      'tasks.0.titleLocales': { 'zh-CN': '日常任务', 'en-US': 'Daily tasks' },
      'tasks.0.retrySafety': extras.includes(additions[3]) ? 'unknown' : 'safe', 'tasks.1.isSelected': nightmare, 'tasks.2.title': '日常体力：' + farm,
      'tasks.6.isSelected': extras.includes(additions[0]), 'tasks.7.isSelected': extras.includes(additions[2]), 'tasks.8.isSelected': extras.includes(additions[3]) });
    add('authoritative flow branch ' + farm + '/' + bits + '/' + echo, observe(document, outer), state('daily', 'succeeded'));
  }
  const full = make(farms[1], additions), tasks = invoke(request('discover', full)).tasks;
  for (const [id, message] of [['nightmare', 'NightmareNestTask Failed Traceback (most recent call last):'], ['garden', 'GardenTask Failed Traceback (most recent call last):'],
    ['merge', 'MergeEchoTask Failed Traceback (most recent call last):'], ['battle_pass', 'can not battle pass, maybe ended ']]) {
    add('caught failure survives authoritative parent ' + id, observe(full, ['open_daily', { level: 'ERROR', text: message }, ...outer.slice(1)]),
      { ...state(id, 'failed'), ...state('daily', 'partial') });
    add('late caught failure after parent still partial ' + id, observe(full, [...outer, { level: 'ERROR', text: message }]),
      { ...state(id, 'failed'), ...state('daily', 'partial') });
  }
  for (const [id, owner, text] of [['nightmare', 'NightmareNestTask', 'nightmare nest unreachable, skip this run: target-a'],
    ['nightmare', 'NightmareNestTask', 'nightmare nest: died 3 times, skip this run: target-a'],
    ['stamina', 'ForgeryTask', 'farm_domain: exceeded recovery retries (3), stop farming'],
    ['farm_4c', 'FarmEchoTask', 'farm 4c: exceeded recovery retries (3), stop farming']])
    add('current source silent-return negative ' + id + '/' + text, observe(full, ['open_daily', { owner, text }, ...outer.slice(1)]),
      { ...state(id, 'failed'), ...state('daily', 'partial') });
  add('merge bag failure without thrown exception survives', observe(full, ['open_daily', { owner: 'MergeEchoTask', level: 'ERROR', text: 'can not open bag with hotkey b ' }, ...outer.slice(1)]),
    { ...state('merge', 'failed'), ...state('daily', 'partial') });
  add('garden current satisfied check', observe(full, ['open_daily', 'check weekly garden', 'weekly garden already completed', ...outer.slice(1)]), {
    ...state('garden', 'succeeded'), 'observations.6.completionKind': 'satisfied' });
  add('garden actual source target reached', observe(full, ['open_daily', { owner: 'GardenTask', text: '乐园任务完成, 已达到上限' }, ...outer.slice(1)]), {
    ...state('garden', 'succeeded'), 'observations.6.completionKind': 'satisfied' });
  add('merge current full batch result', observe(full, ['open_daily', 'check discarded echo', { owner: 'MergeEchoTask', text: 'All full batches of discarded Echoes have been merged.' }, ...outer.slice(1)]), state('merge', 'succeeded'));
  const dailyNightmare = make(farms[1], [], true);
  add('conditional nightmare not called is inapplicable', observe(dailyNightmare, outer), { ...state('nightmare', 'succeeded'), 'observations.1.completionKind': 'inapplicable' });
  add('nightmare INFO proves entered when DEBUG disabled', observe(dailyNightmare, ['open_daily', { owner: 'NightmareNestTask', text: 'opened gray_book_boss' }, ...outer.slice(1)]),
    { ...state('nightmare', 'succeeded'), 'observations.1.completionKind': 'completed' });
  add('daily executor abort is parent failure', observe(full, ['open_daily', { owner: 'TaskExecutor', level: 'ERROR', text: '📅 Daily Task exception stopped Traceback (most recent call last):' }]),
    { ...state('daily', 'failed'), ...state('mail', 'unknown') });
  add('other task executor exception not daily failure', observe(full, ['open_daily', { owner: 'TaskExecutor', level: 'ERROR', text: 'Another Task exception stopped Traceback' }]), state('daily', 'unknown'));
  add('unpaired authority banner cannot prove daily', observe(full, ['Daily Task Completed']), state('daily', 'unknown'));
  add('launcher/framework finished cannot prove daily', observe(full, [{ owner: 'LauncherTask', text: 'Daily Task Completed' }, { owner: 'TaskExecutor', text: 'finished' }]), state('daily', 'unknown'));
  for (const extras of [{ sourceId: 'stdout' }, { sourceId: 'file:1' }, { thread: 'MainThread' }])
    add('foreign log context ' + JSON.stringify(extras), observe(full, [], { logEvents: events(outer, extras) }), state('daily', 'unknown'));
  const partialObservations = invoke(observe(full, ['open_daily', { level: 'ERROR', text: 'GardenTask Failed Traceback' }, ...outer.slice(1)])).observations;
  add('partial family cannot retry implicit consumption', request('retry', full, { tasks, observations: partialObservations, idempotencyKey: 'finite' }), { selectedTaskIds: [] });
  add('4C process-local counter cannot be reset by a new invocation', request('retry', full, { tasks,
    observations: [{ taskId: 'okww:daily', state: 'failed', reasonCode: 'synthetic' }], idempotencyKey: 'finite' }), { selectedTaskIds: [] });
  const resume = make(farms[0], ['Check Weekly Garden']), resumeTasks = invoke(request('discover', resume)).tasks;
  add('failed authority resumes unchanged daily scope', request('retry', resume, { tasks: resumeTasks,
    observations: [{ taskId: 'okww:daily', state: 'failed', reasonCode: 'synthetic' }], idempotencyKey: 'finite' }), { selectedTaskIds: ['okww:daily'] });
  add('native resume declares every selected implicit child', request('discover', resume), {
    'tasks.0.nativeResumeScope': resumeTasks.filter(task => task.isSelected).map(task => task.taskId).sort() });
  add('child alone does not create independent switch retry', request('retry', full, { tasks,
    observations: [{ taskId: 'okww:merge', state: 'failed', reasonCode: 'synthetic' }], idempotencyKey: 'finite' }), { selectedTaskIds: [] });
  const streaming = observe(full, ['open_daily'], { logComplete: false }), checkpoint = invoke(streaming).observationCheckpoint;
  add('bounded batch paired parent', { ...streaming, observationCheckpoint: checkpoint, logEvents: events(outer.slice(1), { first: 2 }), logComplete: true }, state('daily', 'succeeded'));
  add('gap cannot close previous flow', { ...streaming, observationCheckpoint: checkpoint, logEvents: events(outer.slice(1), { first: 3 }), logComplete: true }, state('daily', 'unknown'));
  add('rotation cannot close previous flow', { ...streaming, observationCheckpoint: checkpoint, logEvents: events(outer.slice(1), { epoch: 1 }), logComplete: true }, state('daily', 'unknown'));
  for (const mode of ['Weekly Challenge', 'Boss Challenge']) {
    const input = request('discover', make(farms[0], [additions[3]])), farm = child(); farm['Teleport to Boss'] = mode;
    input.resources[1] = resource(farm, 'farm-4c'); add('all current finite teleport branches ' + mode, input, { 'tasks.8.isSelected': true, 'tasks.0.retrySafety': 'unknown' });
  }
  for (const mode of ['No', 'Special Nightmare', 'future-mode']) {
    const input = request('configuration', make(farms[0], [additions[3]])), farm = child(); farm['Teleport to Boss'] = mode;
    input.resources[1] = resource(farm, 'farm-4c');
    add('unsupported enabled 4c scope blocks without rewriting ' + mode, structuredClone(input),
      { 'diagnostics.0.code': 'okww_finite_4c_configuration_required', configPatches: [] });
    input.resources[0] = resource(make(farms[0], []));
    add('disabled 4c preserves unsupported mode ' + mode, structuredClone(input), { diagnostics: [], configPatches: [] });
  }
  for (const count of [0, -1, 1.5, 1000001]) {
    const input = request('configuration', make(farms[0], [additions[3]])), farm = child(); farm['Repeat Farm Count'] = count;
    input.resources[1] = resource(farm, 'farm-4c'); add('invalid 4c count blocks ' + count, input, { 'diagnostics.0.code': 'okww_finite_4c_configuration_required' });
  }
  const unknown = make(farms[0], ['future-extra']);
  add('unknown addition kept and blocks safe retry', request('discover', unknown), { 'tasks.9.taskId': 'okww:extra:0:future-extra', 'tasks.9.isSelected': false, 'tasks.9.isEnabled': true, 'tasks.0.retrySafety': 'unknown' });
  const changes = [['main', 'Which to Farm', farms[0], farms[2]], ['main', 'Which Tacet Suppression to Farm', 1, 21],
    ['main', 'Which Forgery Challenge to Farm', 1, 20], ['main', 'Material Selection', 'Shell Credit', 'Weapon EXP'],
    ['main', 'Farm Nightmare Nest for Daily Echo', true, false], ['farm-4c', 'Teleport to Boss', 'Weekly Challenge', 'Boss Challenge'],
    ['farm-4c', 'Repeat Farm Count', 3, 4], ['farm-4c', 'Which Boss Challenge to Teleport', 1, 20], ['farm-4c', 'Boss Level', '80', '90'],
    ['farm-4c', 'Combat Wait Time', 0, 1], ['farm-4c', 'Echo Pickup Method', 'Walk', 'Yolo'], ['farm-4c', 'Use Liberation', true, false]];
  for (const [resourceId, key, before, after] of changes) {
    const input = request('configuration'), p = patch(input, [{ selector: [key], expected: before, value: after }], resourceId);
    input.configurationIntents = [p]; add('explicit option CAS ' + resourceId + '/' + key, input, { configPatches: [p] });
  }
  for (const [resourceId, key, before, after] of [['main', 'nativeProgress', { date: '2026-10-25', usedStamina: 120 }, {}],
    ['farm-4c', 'nativeCounter', 2, 0], ['farm-4c', 'Teleport to Boss', 'Weekly Challenge', 'Special Nightmare'],
    ['farm-4c', 'Which Special Nightmare to Teleport', 1, 10], ['farm-4c', 'Repeat Farm Count', 3, 0]]) {
    const input = request('configuration'); input.configurationIntents = [patch(input, [{ selector: [key], expected: before, value: after }], resourceId)];
    add('reject progress reset or invalid option ' + key, input, {}, 'okww_configuration_edit_not_supported');
  }
  const unknownEdit = request('configuration', unknown);
  unknownEdit.configurationIntents = [patch(unknownEdit, [{ selector: ['Additional Tasks to Run After Daily Task'], expected: ['future-extra'], value: [] }])];
  add('unknown additions cannot be silently removed', unknownEdit, {}, 'okww_configuration_edit_not_supported');
  for (const [field, value] of [['expectedRevision', 8], ['sourceSha256', 'b'.repeat(64)], ['operationId', 'foreign']]) {
    const input = request('configuration'); input.configurationIntents = [{ ...patch(input, [{ selector: ['Which to Farm'], expected: farms[0], value: farms[1] }]), [field]: value }];
    add('CAS binding reject ' + field, input, {}, 'okww_configuration_intent_unbound');
  }
  const partialFirst = observe(full, ['open_daily', { level: 'ERROR', text: 'GardenTask Failed Traceback' }, ...outer.slice(1)]);
  add('final empty drain cannot wash partial', { ...partialFirst, observationCheckpoint: invoke(partialFirst).observationCheckpoint,
    logEvents: [], logComplete: true }, { ...state('daily', 'partial'), ...state('garden', 'failed') });
  return rows;
}
