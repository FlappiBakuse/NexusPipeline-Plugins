import { createHash } from 'node:crypto';

const entries = [['daily_anomaly', '异象界域', true], ['daily_anomaly_hunter', '异象追猎', false], ['coffee', '一咖舍', false],
  ['daily_claim', '日常领取', true], ['cinema_date', '影院约会', false], ['fountain', '喷泉签到', false], ['furniture', '异象家具', false], ['gift', '羁遇赠礼', false]];
const resource = (document, resourceId = 'main') => { const content = typeof document === 'string' ? document : JSON.stringify(document);
  return { resourceId, revision: 7, content, sha256: createHash('sha256').update(content).digest('hex') }; };
const make = (ids = ['daily_claim']) => ({ 'Routine Items': entries.map(([id]) => ({ id, enabled: ids.includes(id), opaque: { savedCounter: 3 } })),
  '存在失败时发送 BOT 通知': true, frameworkProgress: { date: '2026-10-25', done: 3 } });
const request = (phase, document = make(), extras = {}) => ({ format: 'nexus.task.adapter', version: 1, direction: 'request', phase,
  extensionId: 'oknte', operationId: '009ca3c5-6b90-40e2-a981-53a33ab5c43f', resources: [resource(document)],
  ...(['observe', 'retry'].includes(phase) ? { runId: '582d6b9e-afbe-4aa3-860e-dd208e1915de', attemptId: '05fe2eaf-95a7-49e1-a631-e7abdf73adfa', planDigest: 'a'.repeat(64) } : {}), ...extras });
const events = (lines, { first = 1, epoch = 0, sourceId = 'file:0', thread = 'TaskExecutor', owner = 'DailyRoutineTask' } = {}) =>
  lines.map((line, index) => ({ sourceId, epoch, sequence: first + index,
    text: `2026-10-25 12:00:00,123 ${line.level ?? 'INFO'} ${line.thread ?? thread} ${line.owner ?? owner}:${line.text ?? line}` }));
const rootStart = '开始执行日常任务', rootEnd = '结束执行日常任务';
const index = id => entries.findIndex(item => item[0] === id), state = (id, value) => ({ ['observations.' + index(id) + '.state']: value });
const selection = id => ['Routine Items', { match: { property: 'id', value: id } }, 'enabled'];
const patch = (input, edits, resourceId = 'main') => ({ format: 'nexus.config.patch', version: 1, operationId: input.operationId, resourceId,
  sourceSha256: input.resources.find(item => item.resourceId === resourceId).sha256, expectedRevision: 7, edits });

export function cases(invoke) {
  const rows = [], add = (name, input, expect = {}, error) => rows.push({ name, input, expect, ...(error ? { error } : {}) });
  const observe = (ids, lines, extras = {}) => { const document = make(Array.isArray(ids) ? ids : [ids]);
    return request('observe', document, { tasks: invoke(request('discover', document)).tasks, logEvents: events(lines), logComplete: true, ...extras }); };
  add('retry observation excludes prior completed routine', observe(['coffee', 'daily_claim'],
    [rootStart, '开始任务: 日常领取', '任务完成: 日常领取', rootEnd], { selectedTaskIds: ['oknte:daily_claim'] }),
    { ...state('daily_claim', 'succeeded'), ...state('coffee', 'unknown') });
  const exclusiveSaved = make(['daily_anomaly', 'daily_anomaly_hunter']);
  add('projection preserves original exclusive switch while distinguishing normalized selection', request('discover', exclusiveSaved),
    { 'tasks.1.isEnabled': true, 'tasks.1.isSelected': false, 'tasks.1.projection.selector': selection('daily_anomaly_hunter') });
  for (const [id, title] of entries) {
    add('discover routine ' + id, request('discover', make([id])), { ['tasks.' + index(id) + '.taskId']: 'oknte:' + id,
      ['tasks.' + index(id) + '.isSelected']: true, ['tasks.' + index(id) + '.retrySafety']: 'safe' });
    for (const [name, lines, result] of [['paired completion', [rootStart, '开始任务: ' + title, '任务完成: ' + title, rootEnd], 'succeeded'],
      ['paired failure', [rootStart, '开始任务: ' + title, '任务失败: ' + title, rootEnd], 'failed'],
      ['language unsupported', [rootStart, '任务不支持当前语言, 跳过: ' + id, rootEnd], 'succeeded'],
      ['None is native skipped result', [rootStart, '开始任务: ' + title, rootEnd], 'succeeded'],
      ['unpaired success', [rootStart, '任务完成: ' + title, rootEnd], 'unknown'],
      ['outer completion only', [rootStart, rootEnd], 'unknown'],
      ['outside daily scope', ['开始任务: ' + title, '任务完成: ' + title], 'unknown'],
      ['late formal failure', [rootStart, '开始任务: ' + title, '任务完成: ' + title, rootEnd, '任务失败: ' + title], 'failed']])
      add(name + ' ' + id, observe(id, lines), state(id, result));
    const document = make([id]), tasks = invoke(request('discover', document)).tasks;
    add('all daily failed items eligible finite subset ' + id, request('retry', document, { tasks, idempotencyKey: 'finite',
      observations: [{ taskId: 'oknte:' + id, state: 'failed', reasonCode: 'synthetic' }] }), { selectedTaskIds: ['oknte:' + id] });
  }
  add('language unsupported is inapplicable', observe('coffee', [rootStart, '任务不支持当前语言, 跳过: coffee', rootEnd]), {
    ...state('coffee', 'succeeded'), ['observations.' + index('coffee') + '.completionKind']: 'inapplicable' });
  add('None is inapplicable without claiming actual work', observe('coffee', [rootStart, '开始任务: 一咖舍', rootEnd]), {
    ...state('coffee', 'succeeded'), ['observations.' + index('coffee') + '.completionKind']: 'inapplicable' });
  add('summary text cannot produce task success', observe('daily_claim', [rootStart, '成功 1 项 | 失败 0 项 | 跳过 0 项', '✅ 成功', '日常领取', rootEnd]), state('daily_claim', 'unknown'));
  add('child standalone owner cannot close daily item', observe('daily_claim', [rootStart, '开始任务: 日常领取', { owner: 'DailyClaimTask', text: '任务完成: 日常领取' }]), state('daily_claim', 'unknown'));
  add('scoped item exception sticky despite success', observe('daily_claim', [rootStart, '开始任务: 日常领取', { level: 'ERROR', text: '任务运行失败: 日常领取 Traceback (most recent call last):' }, '任务完成: 日常领取', rootEnd]), state('daily_claim', 'failed'));
  const aborted = observe(['daily_claim', 'gift'], [rootStart, '开始任务: 日常领取', { owner: 'TaskExecutor', level: 'ERROR', text: '日常任务 exception stopped Traceback (most recent call last):' }]);
  add('aborted active failure and future not executed', aborted, { ...state('daily_claim', 'failed'), ...state('gift', 'unknown'), ['observations.' + index('gift') + '.completionKind']: 'notExecuted' });
  add('routine exception owner proves abort', observe('daily_claim', [rootStart, '开始任务: 日常领取', { level: 'ERROR', text: 'DailyRoutineTask error Traceback (most recent call last):' }]), state('daily_claim', 'failed'));
  add('None before next item is paired native skip', observe(['coffee', 'daily_claim'], [rootStart, '开始任务: 一咖舍', '开始任务: 日常领取', '任务完成: 日常领取', rootEnd]), { ...state('coffee', 'succeeded'), ...state('daily_claim', 'succeeded') });
  add('unexplained wrong order is unknown', observe(['coffee', 'daily_claim'], [rootStart, '开始任务: 日常领取', '任务完成: 日常领取', rootEnd]), state('daily_claim', 'unknown'));
  const absent = { frameworkProgress: { done: 8 } };
  const defaultTasks = invoke(request('discover', absent)).tasks;
  add('defaults selected without manufacturing persisted safety', request('discover', absent), { 'tasks.0.isSelected': true, 'tasks.0.retrySafety': 'unknown', 'tasks.3.isSelected': true });
  add('implicit selection cannot independently retry', request('retry', absent, { tasks: defaultTasks, idempotencyKey: 'finite', observations: [{ taskId: 'oknte:daily_claim', state: 'failed', reasonCode: 'synthetic' }] }), { selectedTaskIds: [] });
  const mutual = make(['daily_anomaly', 'daily_anomaly_hunter']); mutual['Routine Items'].reverse();
  add('mutual group first in stored native order wins', request('discover', mutual), { 'tasks.6.taskId': 'oknte:daily_anomaly_hunter', 'tasks.6.isSelected': true, 'tasks.7.taskId': 'oknte:daily_anomaly', 'tasks.7.isSelected': false });
  const duplicate = make(['daily_claim']); duplicate['Routine Items'].unshift({ id: 'daily_claim', enabled: false });
  add('upstream first duplicate retained no independent retry', request('discover', duplicate), { 'tasks.0.taskId': 'oknte:daily_claim', 'tasks.0.isSelected': false, 'tasks.0.retrySafety': 'unknown' });
  for (const [value, enabled] of [[[], false], [{}, false], ['false', true], [0, false], [-1, true], [null, false]]) {
    const document = make([]); document['Routine Items'][3].enabled = value;
    add('Python truth projection ' + JSON.stringify(value), request('discover', document), { 'tasks.3.isSelected': enabled, 'tasks.3.retrySafety': 'unknown' });
  }
  const unknown = make(); unknown['Routine Items'].push({ id: 'future', enabled: true, progress: 9 });
  add('unknown row retained read only', request('discover', unknown), { 'tasks.8.taskId': 'oknte:unknown/8/future', 'tasks.8.isEnabled': true, 'tasks.8.isSelected': false });
  const unrelated = request('discover'); unrelated.resources.push(resource('unparseable standalone configuration', 'CoffeeTask'));
  add('standalone config never supplies routine child options', unrelated, { tasks: invoke(request('discover')).tasks });
  const streaming = observe('daily_claim', [rootStart, '开始任务: 日常领取'], { logComplete: false }), checkpoint = invoke(streaming).observationCheckpoint;
  add('bounded batches preserve current item', { ...streaming, observationCheckpoint: checkpoint, logEvents: events(['任务完成: 日常领取', rootEnd], { first: 3 }), logComplete: true }, state('daily_claim', 'succeeded'));
  add('gap cannot infer None or completed', { ...streaming, observationCheckpoint: checkpoint, logEvents: events([rootEnd], { first: 4 }), logComplete: true }, state('daily_claim', 'unknown'));
  add('rotation cannot close old item', { ...streaming, observationCheckpoint: checkpoint, logEvents: events(['任务完成: 日常领取', rootEnd], { epoch: 1 }), logComplete: true }, state('daily_claim', 'unknown'));
  const completedInput = observe('daily_claim', [rootStart, '开始任务: 日常领取', '任务完成: 日常领取', rootEnd]);
  const completedCheckpoint = invoke(completedInput).observationCheckpoint;
  add('completed queue proof survives later file rotation', { ...completedInput, observationCheckpoint: completedCheckpoint,
    logEvents: events(['framework idle'], { epoch: 2 }), logComplete: true }, state('daily_claim', 'succeeded'));
  add('late failure in final drained batch remains failed', { ...completedInput, observationCheckpoint: completedCheckpoint,
    logEvents: events(['任务失败: 日常领取'], { first: 5 }), logComplete: true }, state('daily_claim', 'failed'));
  for (const override of [{ sourceId: 'stdout' }, { sourceId: 'file:1' }, { thread: 'MainThread' }, { owner: 'LauncherTask' }])
    add('reject foreign log context ' + JSON.stringify(override), observe('daily_claim', [], { logEvents: events([rootStart, '开始任务: 日常领取', '任务完成: 日常领取', rootEnd], override) }), state('daily_claim', 'unknown'));
  const configInput = request('configuration'), selectionPatch = patch(configInput, [{ selector: selection('daily_claim'), expected: true, value: false }]);
  configInput.configurationIntents = [selectionPatch]; add('explicit scalar selection CAS', configInput, { configPatches: [selectionPatch] });
  const exclusive = request('configuration', make(['daily_anomaly'])); exclusive.configurationIntents = [patch(exclusive, [{ selector: selection('daily_anomaly_hunter'), expected: false, value: true }])];
  add('exclusive sibling cannot silently change beyond intent', exclusive, {}, 'oknte_exclusive_group_requires_explicit_other_disable');
  const explicit = request('configuration', make(['daily_anomaly'])), explicitPatch = patch(explicit, [
    { selector: selection('daily_anomaly'), expected: true, value: false }, { selector: selection('daily_anomaly_hunter'), expected: false, value: true }]);
  explicit.configurationIntents = [explicitPatch]; add('exclusive pair changed only as explicit CAS', explicit, { configPatches: [explicitPatch] });
  for (const [field, value] of [['expectedRevision', 8], ['sourceSha256', 'b'.repeat(64)], ['operationId', 'foreign']]) {
    const input = request('configuration'); input.configurationIntents = [{ ...patch(input, [{ selector: selection('daily_claim'), expected: true, value: false }]), [field]: value }];
    add('CAS binding reject ' + field, input, {}, 'oknte_configuration_intent_unbound');
  }
  const childValues = [['daily_anomaly', '任务类型', '经验与甲硬币', '空幕'], ['daily_anomaly', '空幕序号', 1, 6], ['daily_anomaly', '目标消耗体力', 180, 0],
    ['daily_anomaly_hunter', '追猎目标', '音霸魔王', '斑蝶'], ['coffee', '补货时长', 'auto', '24小时'], ['coffee', '优化商品', false, true],
    ['daily_claim', '邮件', true, false], ['cinema_date', '约会目标', '', '目标'], ['fountain', '签到方式', '签到', '捞币'], ['furniture', '挑战玛门', true, false]];
  for (const [id, key, before, after] of childValues) {
    const input = request('configuration'); input.resources.push(resource({ [id]: { [key]: before, nativeProgress: 7 } }, 'routine-configs'));
    const p = patch(input, [{ selector: [id, key], expected: before, value: after }], 'routine-configs'); input.configurationIntents = [p];
    add('dedicated source option CAS ' + id + '/' + key, input, { configPatches: [p] });
  }
  for (const [id, key, before, after] of [['coffee', '补货时长', 'auto', '12小时'], ['daily_anomaly', '空幕序号', 1, 7],
    ['gift', 'nativeProgress', 1, 0], ['daily_claim', '邮件', true, 'true']]) {
    const input = request('configuration'); input.resources.push(resource({ [id]: { [key]: before } }, 'routine-configs'));
    input.configurationIntents = [patch(input, [{ selector: [id, key], expected: before, value: after }], 'routine-configs')];
    add('reject invalid or progress option ' + id + key, input, {}, 'oknte_configuration_edit_not_supported');
  }
  const devices = request('configuration'); devices.resources.push(resource({ pc_full_path: 'old.exe', 'Launcher Path': 'unchanged.exe' }, 'devices'));
  const devicePatch = patch(devices, [{ selector: ['pc_full_path'], expected: 'old.exe', value: 'D:\\Games\\NTE.exe' }], 'devices'); devices.configurationIntents = [devicePatch];
  add('game path CAS preserves Launcher Path', devices, { configPatches: [devicePatch] });
  return rows;
}
