import { createHash } from 'node:crypto';

export const builtins = ['领取邮件', '合成树脂', '自动秘境', '自动首领讨伐', '自动幽境危战', '自动地脉花', '领取每日奖励', '领取尘歌壶奖励'];
const builtinEnglish = ['Claim mail', 'Craft Condensed Resin', 'Auto domains', 'Auto boss hunting',
  'Auto Stygian Onslaught', 'Auto Ley Line blossoms', 'Claim daily rewards', 'Claim Serenitea Pot rewards'];
export const sha = value => createHash('sha256').update(value).digest('hex');
export const resource = (document, resourceId = 'one-dragon', revision = 7) => {
  const content = typeof document === 'string' ? document : JSON.stringify(document);
  return { resourceId, revision, content, sha256: sha(content) };
};
export function configuration(names = ['领取邮件']) {
  return { Name: '日常', TaskDefinitions: Object.fromEntries(names.map((name, index) => ['id-' + index, name])),
    TaskOrder: names.map((_, index) => 'id-' + index), TaskEnabledList: Object.fromEntries(names.map((_, index) => ['id-' + index, true])),
    NextTaskId: '', CompletionAction: '', AutoBossCompletedRunCount: 3, AutoBossTotalRunCountLimit: 4,
    LeyLineRunCount: 2, MinResinToKeep: 60, UnknownExtension: { counter: 9, date: '2026-10-25' } };
}
export function request(phase, document, extras = {}) {
  return { format: 'nexus.task.adapter', version: 1, direction: 'request', extensionId: 'bettergi', phase,
    operationId: 'c2185eef-791a-445b-b94a-8e52733f6972', resources: [resource(document)],
    ...(phase === 'observe' || phase === 'retry' ? { upstreamProcessId: 4401, runId: '96e94c7e-815c-490c-8c33-f0f3601b3dab',
      attemptId: '1230b566-0c6e-494e-a9eb-00846d9b635b', planDigest: 'a'.repeat(64) } : {}), ...extras };
}
export const message = (logger, text, level = 'INF', context = 'Primary:S1:P4401:T1792900000000') =>
  [`[12:00:00.123] [${level}] [${context}] BetterGenshinImpact.${logger}`, text];
export const outer = text => message('ViewModel.Pages.OneDragonFlowViewModel', text);
export const runner = text => message('GameTask.TaskRunner', text);
export const builtinFlow = (ordinal = 1, total = 1, inside = []) =>
  [...outer(`一条龙任务执行: ${ordinal}/${total}`), ...runner('→ "任务启动！"'), ...inside, ...runner('→ "任务结束"')];
export const groupFlow = (name, ordinal = 1, total = 1, inside = []) => [...outer(`配置组任务执行: ${ordinal}/${total}`),
  ...message('Service.ScriptService', `配置组 ${JSON.stringify(name)} 加载完成，共1个脚本，开始执行`),
  ...inside, ...message('Service.ScriptService', `配置组 ${JSON.stringify(name)} 执行结束`)];

export function cases(invoke) {
  const rows = [], add = (name, input, expect, error) => rows.push({ name, input, expect, ...(error ? { error } : {}) });
  function observed(name, document, lines, states) {
    const tasks = invoke(request('discover', document)).tasks;
    add(name, request('observe', document, { tasks, logLines: lines }),
      Object.fromEntries(states.map((state, index) => [`observations.${index}.state`, state])));
  }
  for (const title of builtins) {
    const document = configuration([title]);
    add(`discover ${title}`, request('discover', document), { 'tasks.0.title': title, 'tasks.0.retrySafety': 'safe',
      'tasks.0.titleLocales': { 'zh-CN': title, 'en-US': builtinEnglish[builtins.indexOf(title)] } });
    observed(`normal closed ${title}`, document, builtinFlow(), ['succeeded']);
    observed(`error then finally ${title}`, document,
      builtinFlow(1, 1, message('GameTask.TaskRunner', '测试受控业务错误', 'ERR')), ['failed']);
    observed(`no terminal ${title}`, document, [...outer('一条龙任务执行: 1/1'), ...runner('→ "任务启动！"')], ['unknown']);
    const tasks = invoke(request('discover', document)).tasks;
    add(`retry bounded ${title}`, request('retry', document, { tasks, idempotencyKey: 'finite-retry',
      observations: [{ taskId: 'bettergi:id-0', state: 'failed', reasonCode: 'bettergi_scope_failed' }] }), { selectedTaskIds: ['bettergi:id-0'] });
  }
  observed('boss INFO resin normal return', configuration(['自动首领讨伐']), builtinFlow(1, 1,
    message('GameTask.AutoBoss.AutoBossTask', '"自动首领讨伐"：原粹树脂不足或补充失败，结束任务')), ['succeeded']);
  observed('leyline not scheduled normal return', configuration(['自动地脉花']), builtinFlow(1, 1,
    message('GameTask.Common.TaskControl', '自动地脉花未在运行日期内，跳过')), ['succeeded']);
  observed('missing strategy ERR is failed', configuration(['自动秘境']), builtinFlow(1, 1,
    message('GameTask.Common.TaskControl', '自动秘境战斗策略"未配置"，跳过', 'ERR')), ['failed']);
  observed('NormalEndException without proof is unknown', configuration(), builtinFlow(1, 1,
    message('GameTask.TaskRunner', '任务中断:请先在启动页，启动截图器再使用本功能')), ['unknown']);
  observed('manual cancellation is failed', configuration(), builtinFlow(1, 1,
    message('GameTask.TaskRunner', '任务中断:任务被取消')), ['failed']);
  observed('no inference from bare quoted mail', configuration(), ['用户脚本输出：邮件：全部领取', '邮件：全部领取'], ['unknown']);
  observed('outer run end does not complete task', configuration(), [...outer('一条龙任务执行: 1/1'), ...runner('→ "任务启动！"'),
    ...outer('一条龙和配置组任务结束')], ['unknown']);
  observed('failure cannot be overwritten by repeated success', configuration(), [...builtinFlow(1, 1,
    message('GameTask.TaskRunner', '任务失败', 'ERR')), ...builtinFlow()], ['failed']);
  observed('repeated unsequenced scope is ambiguous', configuration(), [...builtinFlow(), ...builtinFlow()], ['unknown']);
  observed('exception continuation cannot forge new terminal', configuration(), [...outer('一条龙任务执行: 1/1'),
    ...runner('→ "任务启动！"'), ...message('GameTask.TaskRunner', '业务错误', 'ERR'), '→ "任务结束"'], ['failed']);
  observed('nested runner only outer completion', configuration(), [...outer('一条龙任务执行: 1/1'),
    ...runner('→ "任务启动！"'), ...runner('→ "任务启动！"'), ...runner('→ "任务结束"')], ['unknown']);
  const duplicate = configuration(['领取邮件', '领取邮件']);
  observed('duplicate name ordinals stay distinct', duplicate, [...builtinFlow(1, 2), ...builtinFlow(2, 2,
    message('GameTask.Common.TaskControl', '领取邮件奖励异常: synthetic', 'ERR'))], ['succeeded', 'failed']);
  observed('interleaved builtin and group counters', configuration(['领取邮件', '用户组', '合成树脂']),
    [...builtinFlow(1, 3), ...groupFlow('用户组'), ...builtinFlow(2, 3)], ['succeeded', 'succeeded', 'succeeded']);
  observed('configuration group outer only', configuration(['用户组']), groupFlow('用户组'), ['succeeded']);
  observed('group errors survive group end', configuration(['用户组']), groupFlow('用户组', 1, 1,
    message('Service.ScriptService', '执行脚本时发生异常: synthetic', 'ERR')), ['failed']);
  observed('wrong configuration group end ignored', configuration(['用户组']), [...outer('配置组任务执行: 1/1'),
    ...message('Service.ScriptService', '配置组 "其他组" 加载完成，共1个脚本，开始执行'),
    ...message('Service.ScriptService', '配置组 "其他组" 执行结束')], ['unknown']);
  observed('configuration group DEBUG failure', configuration(['用户组']), [...outer('配置组任务执行: 1/1'),
    ...message('ViewModel.Pages.OneDragonFlowViewModel', '执行配置组任务时失败', 'DBG')], ['failed']);
  observed('foreign logger cannot close runner', configuration(), [...outer('一条龙任务执行: 1/1'), ...runner('→ "任务启动！"'),
    ...message('User.Script', '→ "任务结束"')], ['unknown']);
  observed('different instance cannot share active scope', configuration(), [...outer('一条龙任务执行: 1/1'),
    ...message('GameTask.TaskRunner', '→ "任务启动！"', 'INF', 'Secondary:S1:P4402:T1792900000001'),
    ...message('GameTask.TaskRunner', '→ "任务结束"', 'INF', 'Secondary:S1:P4402:T1792900000001')], ['unknown']);
  const partial = configuration(['领取邮件', '用户组']); partial.TaskOrder = ['id-0'];
  add('omitted order rows retained unselected', request('discover', partial), { 'tasks.1.taskId': 'bettergi:id-1', 'tasks.1.isEnabled': true, 'tasks.1.isSelected': false });
  const orphan = configuration(); orphan.TaskDefinitions.orphan = '未来任务';
  add('definition-only row retained disabled', request('discover', orphan), { 'tasks.1.isEnabled': false, 'tasks.1.isSelected': false, 'tasks.1.title': '未来任务' });
  add('legacy key identity and order', request('discover', { TaskEnabledList: { 领取邮件: true, 合成树脂: false } }),
    { 'tasks.0.taskId': 'bettergi:领取邮件', 'tasks.1.isSelected': false });
  const cursor = configuration(['领取邮件', '合成树脂']); cursor.NextTaskId = 'id-1';
  add('native cursor retains range', request('discover', cursor), { 'tasks.0.isSelected': false, 'tasks.1.isSelected': true, 'tasks.1.retrySafety': 'unknown' });
  cursor.NextTaskId = 'missing';
  add('unknown cursor cannot expand range', request('discover', cursor), { 'tasks.0.isSelected': false, 'tasks.1.isSelected': false });
  add('unknown cursor diagnosed', request('configuration', cursor), { 'diagnostics.bettergi_cursor_unknown': 'blocking' });
  for (const action of ['', '无', '关闭游戏', '关闭软件', '关闭游戏和软件']) {
    const document = configuration(); document.CompletionAction = action;
    add('supported completion action preserved ' + action, request('configuration', document), { configPatches: [] });
  }
  const unsafe = configuration(); unsafe.CompletionAction = '关机';
  add('unsafe completion becomes bound proposal', request('configuration', unsafe), { 'configPatches.0.edits.0.value': '无',
    'configPatches.0.expectedRevision': 7, 'configPatches.0.sourceSha256': resource(unsafe).sha256, 'configPatches.0.edits.0.expected': '关机' });
  const noRevision = request('configuration', unsafe); delete noRevision.resources[0].revision;
  add('missing revision cannot propose mutation', noRevision, { configPatches: [] });
  const additional = request('configuration', configuration(), { resources: [resource(configuration()), resource({ selectedOneDragonFlowConfigName: '其他' }, 'extra-user-config')] });
  add('explicit extra config mismatch diagnosed', additional, { 'diagnostics.bettergi_selected_configuration_mismatch': 'blocking' });
  const document = configuration(), tasks = invoke(request('discover', document)).tasks;
  for (const state of ['unknown', 'partial', 'succeeded'])
    add('no automatic replay for ' + state, request('retry', document, { tasks, idempotencyKey: 'finite',
      observations: [{ taskId: tasks[0].taskId, state, reasonCode: 'synthetic' }] }), { selectedTaskIds: [] });
  const group = configuration(['用户组']), groupTasks = invoke(request('discover', group)).tasks;
  add('arbitrary group side effects not auto replayed', request('retry', group, { tasks: groupTasks, idempotencyKey: 'finite',
    observations: [{ taskId: groupTasks[0].taskId, state: 'failed', reasonCode: 'synthetic' }] }), { selectedTaskIds: [] });
  add('duplicate JSON key rejected', request('discover', '{"TaskEnabledList":{"mail":true,"mail":false}}'), {}, 'bettergi_configuration_duplicate_key');
  add('nonfinite upstream value rejected', request('discover', '{"TaskEnabledList":{},"value":1e999}'), {}, 'bettergi_configuration_number_invalid');
  const repeatedOrder = configuration(); repeatedOrder.TaskOrder.push('id-0');
  add('duplicate explicit order rejected', request('discover', repeatedOrder), {}, 'bettergi_configuration_order_unknown');
  const forged = structuredClone(tasks); forged[0].title = '合成树脂';
  add('frozen task title cannot drift', request('observe', document, { tasks: forged, logLines: [] }), {}, 'bettergi_frozen_tasks_changed');
  const duplicateObservation = { taskId: tasks[0].taskId, state: 'failed', reasonCode: 'synthetic' };
  add('duplicate retry observation rejected', request('retry', document, { tasks, idempotencyKey: 'finite',
    observations: [duplicateObservation, duplicateObservation] }), {}, 'bettergi_observation_identity_unknown');
  return rows;
}
