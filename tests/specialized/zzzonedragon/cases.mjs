import { createHash } from 'node:crypto';
import { sourceApps } from './source-apps.mjs';

const defaults = sourceApps.filter(row => row[2]), known = id => sourceApps.find(row => row[0] === id);
const technical = ['notify', 'one_dragon', 'auto_battle', 'dodge_assistant', 'operation_debug', 'screenshot_helper', 'mouse_sensitivity_checker', 'predefined_team_checker'];
const resource = (document, resourceId) => { const content = typeof document === 'string' ? document : JSON.stringify(document);
  return { resourceId, revision: 7, content, sha256: createHash('sha256').update(content).digest('hex') }; };
const make = (ids = ['email']) => ({ app_list: ids.map(app_id => ({ app_id, enabled: true, preserved: { progress: 4 } })), nativeStamp: '2026-10-25' });
const request = (phase, document = make(), extras = {}) => ({ format: 'nexus.task.adapter', version: 1, direction: 'request', phase,
  extensionId: 'zzzonedragon', operationId: '009ca3c5-6b90-40e2-a981-53a33ab5c43f', resources: [resource(document, 'group:01'),
    resource({ game_path: 'D:\\Games\\ZZZ.exe', anotherAccountSetting: 'keep' }, 'account:01'), resource({ instance_run: '仅运行当前', after_done: '无',
      instance_list: [{ idx: 1, name: 'selected', active: true, active_in_od: true }, { idx: 2, name: 'other', active: false, active_in_od: true }] }, 'global')],
  ...(['observe', 'retry'].includes(phase) ? { runId: '582d6b9e-afbe-4aa3-860e-dd208e1915de', attemptId: '05fe2eaf-95a7-49e1-a631-e7abdf73adfa', planDigest: 'a'.repeat(64) } : {}), ...extras });
const node = (name, path, status = '成功') => `指令[ ${name} ] 节点 ${path} 返回状态 ${status}`;
const terminal = (name, success = true, status = success ? '成功' : '失败') => ({ text: `指令[ ${name} ] 执行${success ? '成功' : '失败'} 返回状态 ${status}`, level: success ? 'INFO' : 'ERROR' });
const events = (lines, { first = 1, epoch = 0, sourceId = 'file:0', file = 'operation.py' } = {}) => lines.map((line, index) => ({
  sourceId, epoch, sequence: first + index, text: `[12:00:00.123] [${file} 451] [${line.level ?? 'INFO'}]: ${line.text ?? line}` }));
const group = (status, path = '执行应用') => node('执行应用组 one_dragon', path, status);
const prefix = document => [group('成功', '获取应用组配置'), ...defaults.filter(([id]) => !document.app_list.some(row => row.app_id === id)).map(([, name]) => group('应用未启用 ' + name))];
const suffix = [group('全部结束'), terminal('执行应用组 one_dragon'), terminal('一条龙')];
const appFlow = (id, success = true) => [node(known(id)[1], '检测游戏窗口'), terminal(known(id)[1], success), group('下一个')];
const patch = (input, edits, resourceId = 'group:01') => ({ format: 'nexus.config.patch', version: 1, operationId: input.operationId, resourceId,
  sourceSha256: input.resources.find(item => item.resourceId === resourceId).sha256, expectedRevision: 7, edits });
const select = id => ['app_list', { match: { property: 'app_id', value: id } }, 'enabled'];

export function cases(invoke) {
  const rows = [], add = (name, input, expect = {}, error) => rows.push({ name, input, expect, ...(error ? { error } : {}) });
  const observe = (document, lines, extras = {}) => request('observe', document, { tasks: invoke(request('discover', document)).tasks,
    logEvents: events(lines), logComplete: true, ...extras });
  for (const [id, name, isDefault] of sourceApps) {
    const document = make([id]), tasks = invoke(request('discover', document)).tasks;
    add('all registered application identities ' + id, request('discover', document), { 'tasks.0.taskId': 'zzzonedragon:01/' + id,
      'tasks.0.title': name, 'tasks.0.isSelected': true, 'tasks.0.workflowRole': technical.includes(id) ? 'technical' : 'business' });
    if (id === 'charge_plan') add('stamina child retains both frozen title locales', request('discover', document), {
      'tasks.1.titleLocales': { 'zh-CN': '副本挑战与电池合成', 'en-US': 'Dungeon challenges and battery crafting' } });
    if (id === 'one_dragon') {
      add('recursive group app blocked explicitly', request('configuration', document), { 'diagnostics.0.code': 'zzzonedragon_recursive_group_application_unsupported' });
      continue;
    }
    add('paired outer app and group receipt ' + id, observe(document, [...prefix(document), ...appFlow(id), ...suffix]), { 'observations.0.state': 'succeeded' });
    add('paired app failure ' + id, observe(document, [...prefix(document), ...appFlow(id, false), ...suffix]), { 'observations.0.state': 'failed' });
    add('current group already done ' + id, observe(document, [...prefix(document), group('应用已完成 ' + name), ...suffix]),
      { 'observations.0.state': 'succeeded', 'observations.0.completionKind': 'satisfied' });
    add('unpaired terminal not outer identity ' + id, observe(document, [...prefix(document), terminal(name), group('下一个'), ...suffix]), { 'observations.0.state': 'unknown' });
    add('registered finite failed subset ' + id, request('retry', document, { tasks, idempotencyKey: 'finite',
      observations: [{ taskId: tasks[0].taskId, state: 'failed', reasonCode: 'synthetic' }] }), { selectedTaskIds: technical.includes(id) ? [] : [tasks[0].taskId] });
    if (!isDefault) {
      const disabled = make([id, 'email']); disabled.app_list[0].enabled = false;
      add('nondefault disabled removed only from runtime pool ' + id, observe(disabled, [...prefix(disabled), ...appFlow('email'), ...suffix]),
        { 'tasks': undefined, 'observations.0.state': 'unknown', 'observations.1.state': 'succeeded' });
      delete rows.at(-1).expect.tasks;
    }
  }
  const document = make(), name = '邮件', complete = [...prefix(document), ...appFlow('email'), ...suffix];
  const resumeDocument = make(['email', 'notify', 'coffee']);
  add('native continuation retains enabled notification and business scope', request('discover', resumeDocument), {
    'tasks.0.nativeResumeScope': ['zzzonedragon:01/coffee', 'zzzonedragon:01/email', 'zzzonedragon:01/notify'] });
  add('unknown enabled application prevents whole-entry continuation', request('discover', make(['email', 'future_app'])), { 'tasks.0.retrySafety': 'unknown' });
  add('interactive technical tool prevents whole-entry continuation', request('discover', make(['email', 'operation_debug'])), { 'tasks.0.retrySafety': 'unknown' });
  const mixedPartial = make(['email', 'charge_plan']);
  add('partial charge scope also blocks otherwise failed mail on unchanged entry', request('retry', mixedPartial, {
    tasks: invoke(request('discover', mixedPartial)).tasks, idempotencyKey: 'finite', observations: [
      { taskId: 'zzzonedragon:01/email', state: 'failed', reasonCode: 'failed' },
      { taskId: 'zzzonedragon:01/charge_plan', state: 'partial', reasonCode: 'partial' }] }), { selectedTaskIds: [] });
  add('group ended cannot end root', observe(document, complete.slice(0, -1)), { 'observations.0.state': 'unknown' });
  add('same name nested operation waits for actual outer return', observe(document, [...prefix(document), node(name, '检测游戏窗口'), terminal(name), terminal(name, false), group('下一个'), ...suffix]), { 'observations.0.state': 'failed' });
  add('same name nested operation without group receipt is unknown', observe(document, [...prefix(document), node(name, '检测游戏窗口'), terminal(name)]), { 'observations.0.state': 'unknown' });
  add('wrong transient disabled name invalidates cursor', observe(document, [group('成功', '获取应用组配置'), group('应用未启用 未知应用'), ...appFlow('email'), ...suffix]), { 'observations.0.state': 'unknown' });
  add('saved order mismatch invalidates cursor', observe(make(['email', 'coffee']), [...prefix(make(['email', 'coffee'])), ...appFlow('coffee'), ...appFlow('email'), ...suffix]), { 'observations.0.state': 'unknown', 'observations.1.state': 'unknown' });
  const chargeDoc = make(['charge_plan']), parent = '体力刷本';
  const challenge = (category, { fail = false, recover = false, omitStart = false, omitParent = false, omitAdvance = false, status = fail ? '未完成' : '成功', skip = false } = {}) => {
    const name = category === '合成电池' ? '兑换以太电池' : category + ' 目标A';
    return [category === '合成电池' ? node(parent, '传送', category) : node(parent, '识别副本分类', category),
      ...(!omitStart ? [node(name, '检测游戏窗口')] : []), ...(recover ? [{ level: 'ERROR', text: `指令[ ${name} ] 执行出错 相关截图保存至 screenshot.png` }] : []),
      terminal(name, !fail, status), ...(!omitParent ? [node(parent, (category === '合成电池' ? '传送' : '识别副本分类') + ' -> ' + category, status)] : []),
      ...(!omitAdvance ? [node(parent, category + ' -> ' + (skip ? '跳过或结束计划' : '挑战完成'), '成功')] : [])];
  };
  const chargeFlow = middle => [...prefix(chargeDoc), node(parent, '检测游戏窗口'), ...middle, terminal(parent), group('下一个'), ...suffix];
  for (const category of ['区域巡防', '实战模拟室', '专业挑战室', '恶名狩猎', '合成电池']) {
    add('all current charge categories confirmed ' + category, observe(chargeDoc, chargeFlow(challenge(category))),
      { 'observations.0.state': 'succeeded', 'observations.1.state': 'succeeded', 'observations.1.completionKind': 'completed' });
    add('failed plan skipped but parent success partial ' + category, observe(chargeDoc, chargeFlow(challenge(category, { fail: true }))),
      { 'observations.0.state': 'partial', 'observations.1.state': 'failed' });
    add('same call native retry recovers after parent acknowledgment ' + category, observe(chargeDoc, chargeFlow(challenge(category, { recover: true }))),
      { 'observations.0.state': 'succeeded', 'observations.1.state': 'succeeded' });
    for (const missing of ['omitStart', 'omitParent', 'omitAdvance'])
      add('missing source call proof ' + category + '/' + missing, observe(chargeDoc, chargeFlow(challenge(category, { [missing]: true, fail: missing === 'omitStart' }))),
        { 'observations.0.state': 'partial', 'observations.1.state': 'failed' });
  }
  add('other plan success cannot recover abandoned plan', observe(chargeDoc, chargeFlow([...challenge('实战模拟室', { fail: true }), ...challenge('专业挑战室')])),
    { 'observations.0.state': 'partial', 'observations.1.state': 'failed' });
  for (const status of ['电量不足', '周期挑战有剩余次数，本次跳过深度追猎', '特训目标已达成'])
    add('normal plan stop is satisfied ' + status, observe(chargeDoc, chargeFlow(challenge('恶名狩猎', { status, skip: true }))),
      { 'observations.0.state': 'succeeded', 'observations.1.state': 'succeeded', 'observations.1.completionKind': 'satisfied' });
  add('no candidate plan is inapplicable challenge', observe(chargeDoc, chargeFlow([])), { 'observations.1.state': 'succeeded', 'observations.1.completionKind': 'inapplicable' });
  for (const title of ['实战模拟室 目标A', '兑换以太电池'])
    add('missing category cannot turn entered child into no-op ' + title, observe(chargeDoc, chargeFlow([node(title, '检测游戏窗口'), terminal(title)])),
      { 'observations.0.state': 'partial', 'observations.1.state': 'failed' });
  const partialInput = observe(chargeDoc, chargeFlow(challenge('实战模拟室', { fail: true }))), partial = invoke(partialInput).observations;
  add('partial charge family cannot retry original consumption', request('retry', chargeDoc, { tasks: invoke(request('discover', chargeDoc)).tasks,
    idempotencyKey: 'finite', observations: partial }), { selectedTaskIds: [] });
  const streamLines = [...prefix(document), node(name, '检测游戏窗口')], streaming = observe(document, streamLines, { logComplete: false });
  const checkpoint = invoke(streaming).observationCheckpoint;
  add('bounded batches preserve outer identity', { ...streaming, observationCheckpoint: checkpoint,
    logEvents: events([terminal(name), group('下一个'), ...suffix], { first: streamLines.length + 1 }), logComplete: true }, { 'observations.0.state': 'succeeded' });
  add('gap cannot borrow previous outer start', { ...streaming, observationCheckpoint: checkpoint,
    logEvents: events([terminal(name), group('下一个'), ...suffix], { first: streamLines.length + 2 }), logComplete: true }, { 'observations.0.state': 'unknown' });
  add('epoch cannot borrow previous group cursor', { ...streaming, observationCheckpoint: checkpoint,
    logEvents: events([terminal(name), group('下一个'), ...suffix], { epoch: 1 }), logComplete: true }, { 'observations.0.state': 'unknown' });
  for (const options of [{ sourceId: 'stdout' }, { sourceId: 'file:1' }, { file: 'fake.py' }])
    add('strict production file envelope ' + JSON.stringify(options), observe(document, [], { logEvents: events(complete, options) }), { 'observations.0.state': 'unknown' });
  add('bare strings not production aliases', observe(document, [], { logEvents: complete.map((line, index) => ({ sourceId: 'file:0', epoch: 0, sequence: index + 1, text: line.text ?? line })) }), { 'observations.0.state': 'unknown' });
  const legacy = request('discover'); legacy.resources[0] = resource({ app_order: ['coffee', 'email'], app_run_list: ['email'], preserved: 'keep' }, 'legacy:01');
  add('legacy projected in native migration order read only', legacy, { 'tasks.0.taskId': 'zzzonedragon:01/coffee', 'tasks.0.isSelected': false,
    'tasks.1.taskId': 'zzzonedragon:01/email', 'tasks.1.isSelected': true, 'tasks.1.retrySafety': 'unknown' });
  const disabledUnknown = make(); disabledUnknown.app_list.push({ app_id: 'future-app', enabled: false, progress: 8 });
  add('unknown disabled row retained outside runtime pool', request('discover', disabledUnknown), { 'tasks.1.taskId': 'zzzonedragon:01/future-app', 'tasks.1.isSelected': false, 'tasks.1.isEnabled': false });
  const duplicate = make(['email', 'email']); add('duplicate saved app IDs reject ambiguous identity', request('discover', duplicate), {}, 'zzzonedragon_application_identity_ambiguous');
  const input = request('configuration'), p = patch(input, [{ selector: select('email'), expected: true, value: false }]); input.configurationIntents = [p];
  add('stable app-id selection CAS', input, { configPatches: [p] });
  const otherAccount = request('configuration'); otherAccount.resources.push(resource({ game_path: 'other.exe' }, 'account:02'));
  otherAccount.configurationIntents = [patch(otherAccount, [{ selector: ['game_path'], expected: 'other.exe', value: 'changed.exe' }], 'account:02')];
  add('other account never editable through selected instance', otherAccount, {}, 'zzzonedragon_configuration_edit_not_supported');
  const orderDoc = make(['email', 'coffee']), orderInput = request('configuration', orderDoc), orderPatch = patch(orderInput,
    [{ selector: ['app_list'], expected: orderDoc.app_list, value: orderDoc.app_list.toReversed() }]); orderInput.configurationIntents = [orderPatch];
  add('order permutation preserves all saved bytes', orderInput, { configPatches: [orderPatch] });
  const globalInput = request('configuration'); globalInput.resources[2] = resource({ instance_run: '全部实例', after_done: '关机', instance_list: [{ idx: 1 }, { idx: 2 }] }, 'global');
  add('single instance and finish CAS do not remove other account settings', globalInput, { 'configPatches.0.edits': [
    { selector: ['instance_run'], expected: '全部实例', value: '仅运行当前' }, { selector: ['after_done'], expected: '关机', value: '无' }] });
  const progressInput = request('configuration', chargeDoc); progressInput.resources.push(resource({ plan_list: [{ plan_id: 'p', run_times: 3, plan_times: 5 }] }, 'charge:01'));
  progressInput.configurationIntents = [patch(progressInput, [{ selector: ['plan_list'], expected: [{ plan_id: 'p', run_times: 3, plan_times: 5 }], value: [] }], 'charge:01')];
  add('native charge plan progress never reset', progressInput, {}, 'zzzonedragon_configuration_edit_not_supported');
  for (const [field, value] of [['expectedRevision', 8], ['sourceSha256', 'b'.repeat(64)], ['operationId', 'foreign']]) {
    const input = request('configuration'); input.configurationIntents = [{ ...patch(input, [{ selector: select('email'), expected: true, value: false }]), [field]: value }];
    add('CAS binding reject ' + field, input, {}, 'zzzonedragon_configuration_intent_unbound');
  }
  const raw = request('discover'); raw.resources[0] = resource('app_list:\n  - app_id: email\n    enabled: true', 'group:01');
  add('raw YAML requires semantic parser owner', structuredClone(raw), {}, 'zzzonedragon_yaml_semantic_owner_required');
  raw.resources[0].value = make(); raw.resources[0].syntax = 'yaml';
  add('Host YAML value keeps original source identity', raw, { 'tasks.0.isSelected': true });
  const emptyDrain = observe(chargeDoc, chargeFlow(challenge('合成电池', { fail: true })));
  add('final empty drain preserves partial and charge failure', { ...emptyDrain, observationCheckpoint: invoke(emptyDrain).observationCheckpoint,
    logEvents: [], logComplete: true }, { 'observations.0.state': 'partial', 'observations.1.state': 'failed' });
  return rows;
}
