import { createHash } from 'node:crypto';
import { sourceTasks } from './source-tasks.mjs';

const resource = (document, resourceId = 'main') => {
  const content = typeof document === 'string' ? document : JSON.stringify(document);
  return { resourceId, revision: 7, content, sha256: createHash('sha256').update(content).digest('hex') };
};
const make = (keys = ['daily_enable']) => {
  const document = Object.fromEntries(sourceTasks.map(([key]) => [key, false]));
  for (const key of keys) { document[key] = true; const parent = sourceTasks.find(row => row[0] === key)?.[2]; if (parent) document[parent] = true; }
  return { ...document, game_path: 'D:\\Games\\StarRail.exe', after_finish: 'None', cloud_game_enable: false,
    last_run_timestamp: '2026-10-24T04:00:00', universe_count: 2, divergent_universe_daily_completed_count: 1,
    power_plan: [{ instance_type: '侵蚀隧洞', instance_name: '目标A', count: 6 }], already_used_codes: ['saved'] };
};
const request = (phase, document = make(), extras = {}) => ({ format: 'nexus.task.adapter', version: 1,
  direction: 'request', phase, extensionId: 'march7th', operationId: '009ca3c5-6b90-40e2-a981-53a33ab5c43f', resources: [resource(document)],
  ...(['observe', 'retry'].includes(phase) ? { runId: '582d6b9e-afbe-4aa3-860e-dd208e1915de',
    attemptId: '05fe2eaf-95a7-49e1-a631-e7abdf73adfa', planDigest: 'a'.repeat(64) } : {}), ...extras });
const events = (lines, first = 1, epoch = 0, sourceId = 'file:0') => lines.map((line, index) => ({ sourceId, epoch, sequence: first + index,
  text: typeof line === 'object' ? `2026-10-25 12:00:00,123 | ${line.level ?? 'INFO'} | ${line.text}` :
    /^[|=+-]/.test(line) ? line : '2026-10-25 12:00:00,123 | INFO | ' + line }));
const patch = (input, edits) => ({ format: 'nexus.config.patch', version: 1, operationId: input.operationId, resourceId: 'main',
  sourceSha256: input.resources[0].sha256, expectedRevision: 7, edits });
const title = text => '| ' + text + ' |', stop = title('停止运行'), done = '--- 完成 ---';
const index = key => sourceTasks.findIndex(row => row[0] === key), outcome = (key, state) => ({ ['observations.' + index(key) + '.state']: state });

export function cases(invoke) {
  const rows = [], add = (name, input, expect = {}, error) => rows.push({ name, input, expect, ...(error ? { error } : {}) });
  const observe = (keys, lines, extra = {}) => {
    const document = make(Array.isArray(keys) ? keys : [keys]), tasks = extra.tasks ?? invoke(request('discover', document)).tasks;
    return request('observe', document, { tasks, logEvents: events(lines), logComplete: true, ...extra });
  };
  const rewardGate = make(['reward_mail_enable']);
  add('reward gate explicitly authorizes only its frozen parent', request('discover', rewardGate), {
    ['tasks.' + index('reward_mail_enable') + '.retryPrerequisites']: ['march7th:reward_enable'],
    ['tasks.' + index('echo_of_war_enable') + '.retryPrerequisites']: [] });
  const changedGate = invoke(request('discover', rewardGate)).tasks;
  changedGate[index('reward_mail_enable')].retryPrerequisites = [];
  add('removed reward gate declaration cannot replay the frozen task set', request('observe', rewardGate, {
    tasks: changedGate, logEvents: events([stop]), logComplete: true }), {}, 'march7th_frozen_tasks_changed');
  for (const [key, name, parent, role] of sourceTasks) {
    const document = make([key]), tasks = invoke(request('discover', document)).tasks;
    add('discover ' + name, request('discover', document), { ['tasks.' + index(key) + '.taskId']: 'march7th:' + key,
      ['tasks.' + index(key) + '.isSelected']: true, ['tasks.' + index(key) + '.workflowRole']: role,
      ['tasks.' + index(key) + '.projection']: { resourceId: 'main', relativePath: '', selector: [key] } });
    add('failed subset preserves dates and progress ' + key, request('retry', document, { tasks, idempotencyKey: 'finite',
      observations: [{ taskId: 'march7th:' + key, state: 'failed', reasonCode: 'synthetic' }] }), { selectedTaskIds: role === 'business' ? ['march7th:' + key] : [] });
    add('unpaired generic banner cannot complete ' + key, observe(key, [done, stop], { tasks }), outcome(key, 'unknown'));
    if (parent) { const disabled = make([key]); disabled[parent] = false;
      add('parent disables child without clearing saved flag ' + key, request('discover', disabled), {
        ['tasks.' + index(key) + '.isSelected']: false, ['tasks.' + index(key) + '.isEnabled']: true }); }
  }
  const starts = { daily_enable: '开始日常任务', power_enable: '开始清体力', forgottenhall_enable: '准备忘却之庭',
    purefiction_enable: '准备虚构叙事', apocalyptic_enable: '准备末日幻影', currencywars_enable: '准备货币战争', echo_of_war_enable: '准备历战余响' };
  for (const [key, heading] of Object.entries(starts)) {
    add('normal scoped return ' + key, observe(key, [title(heading), done, stop]), outcome(key, 'succeeded'));
    if (!['power_enable', 'echo_of_war_enable'].includes(key)) add('scoped error remains failed ' + key,
      observe(key, [title(heading), { level: 'ERROR', text: '当前模块执行失败' }, done, stop, done]), outcome(key, 'failed'));
  }
  add('daily nested lookup banner not outer completion', observe('daily_enable', [title('开始日常任务'), '=== 开始查询日常任务完成情况 ===', done, stop]), outcome('daily_enable', 'unknown'));
  add('historical target score does not complete range', observe('daily_enable', ['实训分数已达标', stop]), outcome('daily_enable', 'unknown'));
  for (const [key, name] of [['reward_assist_enable', '支援'], ['reward_mail_enable', '邮件'], ['reward_dispatch_enable', '委托'],
    ['reward_quest_enable', '每日实训'], ['reward_srpass_enable', '无名勋礼'], ['reward_achievement_enable', '成就'], ['reward_message_enable', '短信']]) {
    add('normal no reward ' + key, observe(key, ['未检测到' + name + '奖励', stop]), {
      ...outcome(key, 'succeeded'), ['observations.' + index(key) + '.completionKind']: 'satisfied' });
    add('named reward completion ' + key, observe(key, ['=== 检测到' + name + '奖励 ===', '--- ' + name + '奖励完成 ---', stop]), outcome(key, 'succeeded'));
  }
  const rewardKeys = ['reward_mail_enable', 'reward_assist_enable'];
  add('reward wrapper alone not sufficient', observe(rewardKeys, [title('开始领取奖励'), done, stop]), outcome('reward_enable', 'unknown'));
  add('all required reward checks aggregate parent', observe(rewardKeys, [title('开始领取奖励'), '未检测到邮件奖励', '未检测到支援奖励', done, stop]), outcome('reward_enable', 'succeeded'));
  add('redemption no new code satisfies check', observe('reward_redemption_code_enable', [title('获取最新兑换码'), '没有找到有效的兑换码', done, stop]), outcome('reward_redemption_code_enable', 'succeeded'));
  add('fixed count current run complete', observe('universe_enable', ['差分宇宙固定次数已全部完成，记录本轮执行时间', stop]), outcome('universe_enable', 'succeeded'));
  add('fixed count zero satisfies', observe('universe_enable', ['差分宇宙固定次数为 0，跳过执行并记录本轮时间', stop]), {
    ...outcome('universe_enable', 'succeeded'), ['observations.' + index('universe_enable') + '.completionKind']: 'satisfied' });
  add('fixed count historical document not evidence', observe('universe_enable', [stop]), outcome('universe_enable', 'unknown'));
  add('current fixed run incomplete overrides banner', observe('universe_enable', ['差分宇宙本轮未完成，不计入固定次数，下次将从 每日 1/2 继续',
    '差分宇宙固定次数已全部完成，记录本轮执行时间', stop]), outcome('universe_enable', 'failed'));
  add('weekly divergent lacks independent success boundary', observe('weekly_divergent_enable', [title('准备差分宇宙'), done, stop]), outcome('weekly_divergent_enable', 'unknown'));
  for (const [key, name] of [['daily_enable', '每日实训'], ['universe_enable', '模拟宇宙/差分宇宙'], ['weekly_divergent_enable', '「差分宇宙」积分奖励'],
    ['currencywars_enable', '「货币战争」积分奖励'], ['fight_enable', '锄大地'], ['forgottenhall_enable', '忘却之庭'], ['purefiction_enable', '虚构叙事'], ['apocalyptic_enable', '末日幻影']])
    add('native not refreshed ' + key, observe(key, [name + '尚未刷新', stop]), { ...outcome(key, 'succeeded'), ['observations.' + index(key) + '.completionKind']: 'satisfied' });
  for (const [key, start, end] of [['fight_enable', '准备锄大地', '锄大地已完成'], ['universe_enable', '准备模拟宇宙', '模拟宇宙已完成']])
    add('literal configured module notification ' + key, observe(key, [title(start), end, stop]), outcome(key, 'succeeded'));
  for (const key of ['activity_dailycheckin_enable', 'activity_gardenofplenty_enable', 'activity_realmofthestrange_enable', 'activity_planarfissure_enable'])
    add('conditional no event check ' + key, observe(key, [title('开始检测活动'), '未检测到任何活动', done, stop]), {
      ...outcome(key, 'succeeded'), ['observations.' + index(key) + '.completionKind']: 'inapplicable' });
  add('activity explicit exception sticky', observe('activity_dailycheckin_enable', [title('开始检测活动'), { level: 'ERROR', text: '活动处理过程中发生错误: failed' }, done, stop]), outcome('activity_enable', 'failed'));
  add('resin complete', observe('asset_self_molding_resin_enable', ['--- 准备合成自塑尘脂 ---', '自塑尘脂合成完成', title('开始领取奖励'), stop]), outcome('asset_self_molding_resin_enable', 'succeeded'));
  add('resin failure sticky after success', observe('asset_self_molding_resin_enable', ['自塑尘脂合成失败', '自塑尘脂合成完成', stop]), outcome('asset_self_molding_resin_enable', 'failed'));
  add('lc single iteration not complete', observe('asset_lc3_star_superimpose_enable', ['--- 准备3星光锥自动叠加 ---', '3星光锥叠加完成，继续查找']), outcome('asset_lc3_star_superimpose_enable', 'unknown'));
  add('lc Daily return closes complete search', observe('asset_lc3_star_superimpose_enable', ['--- 准备3星光锥自动叠加 ---', '3星光锥叠加完成，继续查找', title('开始领取奖励'), stop]), outcome('asset_lc3_star_superimpose_enable', 'succeeded'));
  for (const [key, name] of [['asset_ember_special_pass_enable', '星轨专票'], ['asset_ember_regular_pass_enable', '星轨通票'], ['asset_ember_tracks_of_destiny_enable', '命运的足迹']]) {
    add('ember complete ' + key, observe(key, ['尝试购买「' + name + '」', '「' + name + '」购买完成', title('开始领取奖励'), stop]), outcome(key, 'succeeded'));
    add('ember incomplete cannot wash by wrapper ' + key, observe(key, ['「' + name + '」购买未完成，本次不记录时间', '「' + name + '」购买完成', stop]), outcome(key, 'failed'));
  }
  const instance = target => '--- 开始刷侵蚀隧洞 - ' + target + '，总计1轮，每轮包含6次 ---';
  const failure = '清体力未完成 未找到指定副本', internal = n => ({ level: 'ERROR', text: '检测到该次副本未正常运行，重试：' + n + '/3' });
  const prefix = [title('开始清体力'), instance('A'), failure];
  add('first internal failure remains open', observe('power_enable', prefix), outcome('power_enable', 'unknown'));
  add('same target full retry recovers incident', observe('power_enable', [...prefix, internal(1), instance('A'), '第1次副本完成', '副本任务完成', done, stop]), outcome('power_enable', 'succeeded'));
  add('different target success does not recover incident', observe('power_enable', [...prefix, internal(1), instance('B'), '第1次副本完成', '副本任务完成', done, stop]), outcome('power_enable', 'unknown'));
  add('banner without per round proof cannot recover', observe('power_enable', [...prefix, internal(1), instance('A'), '副本任务完成', done, stop]), outcome('power_enable', 'unknown'));
  add('third exhausted retry only fails on scope exit', observe('power_enable', [...prefix, internal(1), instance('A'), failure, internal(2), instance('A'), failure, internal(3), stop]), outcome('power_enable', 'failed'));
  add('retry number gap does not infer exhaustion', observe('power_enable', [...prefix, internal(3), done, stop]), outcome('power_enable', 'unknown'));
  add('direct echo named failure terminal on exit', observe('echo_of_war_enable', [title('准备历战余响'), instance('A'), failure, stop]), outcome('echo_of_war_enable', 'failed'));
  for (const reason of ['指定副本未解锁', '未找到指定副本', '传送可能失败', '无法开始挑战']) {
    add('verified notification branch remains open ' + reason, observe('power_enable', [title('开始清体力'), instance('A'), '清体力未完成 ' + reason, done, stop]), outcome('power_enable', 'unknown'));
    add('verified notification branch recovers same target ' + reason, observe('power_enable', [title('开始清体力'), instance('A'), '清体力未完成 ' + reason,
      internal(1), instance('A'), '第1次副本完成', '副本任务完成', done, stop]), outcome('power_enable', 'succeeded'));
  }
  add('late current instance failure conflicts with success', observe('power_enable', [title('开始清体力'), instance('A'), '第1次副本完成', '副本任务完成', failure, done, stop]), outcome('power_enable', 'failed'));
  add('INFO text cannot impersonate title logger scope', observe('daily_enable', [{ text: title('开始日常任务') }, { text: done }, stop]), outcome('daily_enable', 'unknown'));
  const dailyTasks = invoke(request('discover')).tasks;
  for (const key of ['weekly_relic_smart_discard_enable', 'divergent_auto_save_enable', 'fight_reward_enable', 'notify_qmsg_enable']) {
    const document = make(); document[key] = true;
    add('auxiliary switch preserves frozen daily retry ' + key, request('retry', document, {
      tasks: dailyTasks, idempotencyKey: 'auxiliary', observations: [{ taskId: 'march7th:daily_enable', state: 'failed' }]
    }), { selectedTaskIds: ['march7th:daily_enable'] });
  }
  const document = make(['power_enable']); document.notify_template = { InstanceNotCompleted: '提示\n{{副本}} {error}' };
  const tasks = invoke(request('discover', document)).tasks;
  add('configured multiline notification literal', request('observe', document, { tasks,
    logEvents: events([title('开始清体力'), instance('A'), '提示', '{副本} 未找到指定副本', internal(1), instance('A'), '第1次副本完成', '副本任务完成', done, stop]), logComplete: true }), outcome('power_enable', 'succeeded'));
  const streaming = observe('daily_enable', [title('开始日常任务')], { logComplete: false }), checkpoint = invoke(streaming).observationCheckpoint;
  add('bounded log batch closes same epoch', { ...streaming, observationCheckpoint: checkpoint, logEvents: events([done, stop], 2), logComplete: true }, outcome('daily_enable', 'succeeded'));
  add('sequence gap invalidates open scope', { ...streaming, observationCheckpoint: checkpoint, logEvents: events([done, stop], 3), logComplete: true }, outcome('daily_enable', 'unknown'));
  add('epoch rotation cannot close old scope', { ...streaming, observationCheckpoint: checkpoint, logEvents: events([done, stop], 1, 1), logComplete: true }, outcome('daily_enable', 'unknown'));
  for (const sourceId of ['stdout', 'file:1']) add('only declared main file ' + sourceId, observe('daily_enable', [], {
    logEvents: events([title('开始日常任务'), done, stop], 1, 0, sourceId) }), outcome('daily_enable', 'unknown'));
  const configInput = request('configuration'), edit = { selector: ['daily_enable'], expected: true, value: false };
  const intent = patch(configInput, [edit]); configInput.configurationIntents = [intent]; add('boolean CAS proposal', configInput, { configPatches: [intent] });
  const progress = make();
  for (const [field, value] of [['last_run_timestamp', '2026-10-23T04:00:00'], ['divergent_universe_daily_completed_count', 0],
    ['power_plan', []], ['already_used_codes', []]]) {
    const input = request('configuration', progress);
    input.configurationIntents = [patch(input, [{ selector: [field], expected: progress[field], value }])];
    add('never reset native progress ' + field, input, {}, 'march7th_configuration_edit_not_supported');
  }
  const unsafe = make(); unsafe.after_finish = 'Loop';
  add('loop completion action repaired', request('configuration', unsafe), { 'configPatches.0.edits': [{ selector: ['after_finish'], expected: 'Loop', value: 'None' }] });
  const raw = request('discover'); raw.resources[0] = resource('daily_enable: true\ngame_path: D:\\Games\\StarRail.exe');
  add('raw YAML requires Host semantic owner', structuredClone(raw), {}, 'march7th_yaml_semantic_owner_required');
  raw.resources[0].value = make(); add('Host semantic value retains raw YAML CAS identity', raw, { ['tasks.' + index('daily_enable') + '.isSelected']: true });
  for (const parent of ['reward_enable', 'asset_manager_enable', 'activity_enable']) {
    const children = sourceTasks.filter(row => row[2] === parent && row[3] === 'business').slice(0, 2).map(row => row[0]);
    const document = make(children), tasks = invoke(request('discover', document)).tasks;
    const parentId = 'march7th:' + parent, childIds = children.map(key => 'march7th:' + key);
    for (const state of ['all-failed', 'one-failed', 'parent-only']) {
      const observations = [parentId, ...childIds].map(taskId => ({ taskId, reasonCode: 'synthetic',
        state: taskId === parentId || state === 'all-failed' || state === 'one-failed' && taskId === childIds[0] ? 'failed' : 'succeeded' }));
      add('retry only original failed leaves ' + parent + ' ' + state,
        request('retry', document, { tasks, observations, idempotencyKey: 'finite' }),
        { selectedTaskIds: state === 'all-failed' ? childIds : state === 'one-failed' ? childIds.slice(0, 1) : [] });
    }
  }
  const mixedKeys = ['reward_mail_enable', 'build_target_enable', 'activity_journey_highlights_notification_enable'];
  const mixed = make(mixedKeys);
  const mixedTasks = invoke(request('discover', mixed)).tasks;
  add('technical failures never widen the failed business leaf proposal', request('retry', mixed, {
    tasks: mixedTasks, idempotencyKey: 'finite', observations: mixedKeys
      .map(key => ({ taskId: 'march7th:' + key, state: 'failed', reasonCode: 'synthetic' })) }), { selectedTaskIds: ['march7th:reward_mail_enable'] });
  for (const field of ['resourceId', 'relativePath', 'selector', 'retryPrerequisites']) {
    const input = observe('daily_enable', []), task = input.tasks[index('daily_enable')];
    if (field === 'retryPrerequisites') task.retryPrerequisites = ['foreign'];
    else task.projection[field] = field === 'selector' ? ['foreign_enable'] : 'foreign';
    add('frozen task projection rejects ' + field, input, {}, 'march7th_frozen_tasks_changed');
  }
  const nested = request('discover'); nested.resources[0].relativePath = 'profile/config.yaml';
  add('projection preserves exact declared resource file', nested,
    { ['tasks.' + index('daily_enable') + '.projection.relativePath']: 'profile/config.yaml' });
  return rows;
}
