import { createHash } from 'node:crypto';

const classes = {
  '登录游戏': 'EnterGame', '清momotalk': 'InMomotalk', '活动一览': 'InEventRecap', '长期签到': 'Attendance',
  '咖啡馆': 'InCafe', '咖啡馆只摸头': 'InCafe', '课程表': 'InTimeTable', '社团': 'InClub', '制造': 'InCraft', '商店': 'InShop',
  '每日免费奖励': 'InFreeAward', '购买AP': 'BuyAP', '悬赏通缉': 'InWanted', '特殊任务': 'InSpecial', '学园交流会': 'InExchange',
  '战术大赛': 'InContest', '战术测试': 'InExam', '总力战': 'AutoAssault', '大决战': 'AutoGrandAssault', '活动关卡': 'InEvent',
  '推活动关卡剧情和推图': 'InEvent', '每日任务': 'CollectDailyRewards', '邮件': 'CollectMails', '一键扫荡': 'InQuest',
  '普通关卡': 'InQuest', '普通推图': 'InQuest', '困难关卡': 'InQuest', '困难推图': 'InQuest', '主线剧情': 'AutoStory',
  '主线剧情第二部': 'AutoStory', '短篇剧情': 'AutoStory', '支线剧情': 'AutoStory', '挑战任务': 'SolveChallenge', '自定义任务': 'UserTask'
};
const resource = (document, resourceId) => {
  const content = JSON.stringify(document);
  return { resourceId, revision: 7, content, sha256: createHash('sha256').update(content).digest('hex') };
};
const configuration = names => ({ TASK_ORDER_GROUP: { ACTIVATE_IND: 0, ALL_PIPELINES: [{ TASK_PIPELINE: names, TASK_ONOFF: names.map(() => true) }] },
  OPEN_GAME_APP_TASK: false, DO_POST_ALL_TASK: false, BUY_AP_MAX_PRICE: 40, BUY_AP_ADD_TIMES: 3,
  SHOP_NORMAL_REFRESH_TIME: 2, CRAFT_TIMES: 4, CAFE_TOUCH: true, POST_COMMAND: '', unknown: { date: '2026-10-25', progress: 9 } });
const request = (phase, document, extras = {}) => ({ format: 'nexus.task.adapter', version: 1, direction: 'request',
  extensionId: 'baah', phase, operationId: '009ca3c5-6b90-40e2-a981-53a33ab5c43f',
  resources: [resource(document, 'main'), resource({ SAVE_LOG_TO_FILE: true }, 'software-config')],
  ...(['observe', 'retry'].includes(phase) ? { runId: '582d6b9e-afbe-4aa3-860e-dd208e1915de',
    attemptId: '05fe2eaf-95a7-49e1-a631-e7abdf73adfa', planDigest: 'a'.repeat(64) } : {}), ...extras });
const log = (text, level = 'INFO') => `2.5.1 - 00:01 - ${level} : ${text}`;
const eventize = (lines, first = 1, epoch = 0, sourceId = 'file:0') => lines.map((text, index) => ({ sourceId, epoch, sequence: first + index, text }));
const activation = () => log('当前激活: pipeline 1');
const flow = (name, inside = []) => [log(`判断任务${name}是否可以执行`), log(`执行任务${name}`), ...inside,
  log(`判断任务${name}执行结果是否可控`), log(`任务${name}执行结束`)];

export function cases(invoke) {
  const rows = [], add = (name, input, expect, error) => rows.push({ name, input, expect, ...(error ? { error } : {}) });
  function observe(name, document, lines, expected = 'succeeded', options = {}) {
    const tasks = options.tasks ?? invoke(request('discover', document)).tasks;
    add(name, request('observe', document, { tasks, logEvents: eventize(lines), logComplete: true, ...options }),
      { 'observations.0.state': expected });
  }
  for (const [title, name] of Object.entries(classes)) {
    const document = configuration([title]), discover = request('discover', document), tasks = invoke(discover).tasks;
    const id = `baah:0/0/${title}`, index = tasks.findIndex(item => item.taskId === id);
    add('discover ' + title, discover, { [`tasks.${index}.taskId`]: id,
      [`tasks.${index}.workflowRole`]: title === '登录游戏' ? 'technical' : 'business' });
    observe('CN closed scope ' + title, document, [activation(), ...flow(name)], 'succeeded', { tasks });
    observe('EN closed scope ' + title, document, [log('Now activated pipeline 1'), log(`Judge whether the task ${name} can be executed`),
      log(`Run task ${name}`), log(`Judge whether the task ${name} execution result is controllable`), log(`Task ${name} execution completed`)], 'succeeded', { tasks });
    observe('precondition failure ' + title, document, [activation(), log(`判断任务${name}是否可以执行`),
      log(`任务${name}执行前条件不成立或超时，跳过此任务`, 'WARN')], 'failed', { tasks });
    observe('postcondition failure survives return home ' + title, document, [activation(), log(`判断任务${name}是否可以执行`),
      log(`执行任务${name}`), log(`判断任务${name}执行结果是否可控`), log(`任务${name}执行后条件不成立或超时`, 'WARN'),
      log('返回主页成功'), log(`任务${name}执行结束`), log('所有任务结束')], 'failed', { tasks });
    observe('final banner cannot supply missing scope ' + title, document, [activation(), log('所有任务结束')], 'unknown', { tasks });
    add('bounded failed subset ' + title, request('retry', document, { tasks, idempotencyKey: 'finite',
      observations: [{ taskId: id, state: 'failed', reasonCode: 'synthetic' }] }),
      { selectedTaskIds: ['自定义任务', '登录游戏'].includes(title) ? [] : [id] });
  }
  const cafe = configuration(['咖啡馆', '咖啡馆只摸头']);
  const mixed = configuration(['登录游戏', '邮件']);
  mixed.OPEN_GAME_APP_TASK = true; mixed.DO_POST_ALL_TASK = true;
  const mixedTasks = invoke(request('discover', mixed)).tasks;
  const mixedIds = ['baah:automatic-login', 'baah:0/0/登录游戏', 'baah:0/1/邮件', 'baah:automatic-cleanup'];
  add('retry excludes failed technical and cleanup steps', request('retry', mixed, { tasks: mixedTasks,
    idempotencyKey: 'mixed-failed', observations: mixedIds.map(taskId => ({ taskId, state: 'failed', reasonCode: 'synthetic' })) }),
    { selectedTaskIds: ['baah:0/1/邮件'], idempotencyKey: 'mixed-failed' });
  add('retry leaves original technical configuration intact', request('configuration', mixed), { configPatches: [] });
  const subset = configuration(['登录游戏', '咖啡馆', '邮件']);
  const subsetTasks = invoke(request('discover', subset)).tasks;
  const subsetIds = ['baah:0/0/登录游戏', 'baah:0/2/邮件'];
  const subsetRequest = request('observe', subset, { tasks: subsetTasks, selectedTaskIds: subsetIds,
    logEvents: eventize([activation(), ...flow('EnterGame'), ...flow('CollectMails')]), logComplete: true });
  add('restart observes only actual frozen retry subset in order', subsetRequest,
    { observations: subsetIds.map(taskId => ({ taskId, state: 'succeeded', reasonCode: 'baah_outer_scope_completed', completionKind: 'completed' })) });
  add('foreign retry observation scope rejected', { ...subsetRequest, selectedTaskIds: ['foreign'] }, {}, 'baah_observation_selection_unbound');
  add('checkpoint cannot move between invocation subsets', { ...subsetRequest, selectedTaskIds: [subsetIds[0]],
    observationCheckpoint: invoke(subsetRequest).observationCheckpoint }, {}, 'baah_observation_checkpoint_unbound');
  const cafeTasks = invoke(request('discover', cafe)).tasks;
  for (const text of ['未能找到最后亮色按钮，结束', 'Can not find the last light button, end',
    '未能打开期望的弹窗或中断关卡连续性，结束', 'Can not open desired popup or previous level broke, end'])
    observe('event PushLevel failure survives outer completion/' + text, configuration(['活动关卡']),
      [activation(), ...flow('InEvent', flow('PushLevel', [log(text, 'ERROR')]))], 'failed');
  add('same class separate occurrence identities', request('observe', cafe, { tasks: cafeTasks,
    logEvents: eventize([activation(), ...flow('InCafe'), ...flow('InCafe', [log('受控错误', 'ERROR')])]), logComplete: true }),
    { 'observations.0.state': 'succeeded', 'observations.1.state': 'failed', 'observations.1.taskId': 'baah:0/1/咖啡馆只摸头' });
  const technical = configuration(['邮件']); technical.OPEN_GAME_APP_TASK = true; technical.DO_POST_ALL_TASK = true;
  add('preparation and cleanup roles remain outside business', request('discover', technical),
    { 'tasks.0.workflowRole': 'technical', 'tasks.0.titleLocales.en-US': 'Automatic login',
      'tasks.1.dependencies': ['baah:automatic-login'], 'tasks.2.workflowRole': 'cleanup', 'tasks.2.titleLocales.en-US': 'Cleanup' });
  const ap = configuration(['购买AP']), apTasks = invoke(request('discover', ap)).tasks;
  for (const [text, level, outcome] of [['未找到购买按钮', 'WARN', 'failed'], ['识别单价失败', 'ERROR', 'failed'],
    ['价格超过限制，不购买', 'INFO', 'succeeded'], ['Price exceeds the limit, not buy', 'INFO', 'succeeded'],
    ['購入ボタンが見つかりません', 'WARN', 'failed']])
    add('AP specific outcome ' + text, request('observe', ap, { tasks: apTasks,
      logEvents: eventize([activation(), ...flow('BuyAP', [log(text, level)])]), logComplete: true }),
      { 'observations.0.state': outcome, ...(outcome === 'succeeded' ? { 'observations.0.completionKind': 'inapplicable' } : {}) });
  const momo = configuration(['清momotalk']), momoTasks = invoke(request('discover', momo)).tasks;
  add('no red dot is satisfied', request('observe', momo, { tasks: momoTasks,
    logEvents: eventize([activation(), ...flow('InMomotalk', [log('未检测到红点标记，跳过此任务')])]), logComplete: true }),
    { 'observations.0.state': 'succeeded', 'observations.0.completionKind': 'satisfied' });
  const mail = configuration(['邮件']), tasks = invoke(request('discover', mail)).tasks;
  observe('wrong pipeline activation ignored', mail, [log('当前激活: pipeline 2'), ...flow('CollectMails')], 'unknown');
  observe('missing activation cannot guess task class', mail, flow('CollectMails'), 'unknown');
  observe('stdout cannot substitute for required file', mail, [activation(), ...flow('CollectMails')], 'unknown',
    { logEvents: eventize([activation(), ...flow('CollectMails')], 1, 0, 'stdout') });
  observe('different version log is not current source', mail, [activation(), ...flow('CollectMails')].map(line => line.replace('2.5.1', '2.4.16')), 'unknown');
  observe('quoted task text cannot supply terminal', mail, [activation(), log('用户脚本引用：任务CollectMails执行结束')], 'unknown');
  const partial = request('observe', mail, { tasks, logEvents: eventize([activation(), ...flow('CollectMails').slice(0, 2)]), logComplete: false });
  const checkpoint = invoke(partial).observationCheckpoint;
  add('scope continues across batches', request('observe', mail, { tasks, observationCheckpoint: checkpoint,
    logEvents: eventize(flow('CollectMails').slice(2), 4), logComplete: true }), { 'observations.0.state': 'succeeded' });
  add('gap cannot join open task', request('observe', mail, { tasks, observationCheckpoint: checkpoint,
    logEvents: eventize(flow('CollectMails').slice(2), 9), logComplete: true }), { 'observations.0.state': 'unknown' });
  add('epoch change cannot join open task', request('observe', mail, { tasks, observationCheckpoint: checkpoint,
    logEvents: eventize(flow('CollectMails').slice(2), 1, 1), logComplete: true }), { 'observations.0.state': 'unknown' });
  const completed = request('observe', mail, { tasks, logEvents: eventize([activation(), ...flow('CollectMails')]), logComplete: true });
  add('duplicate sequence ignored', { ...completed, observationCheckpoint: invoke(completed).observationCheckpoint }, { 'observations.0.state': 'succeeded' });
  const broken = [activation(), log('判断任务CollectMails是否可以执行'), log('执行任务CollectMails'), log('运行出错: synthetic', 'ERROR')];
  observe('new pipeline and full scope can prove recovery', mail, [...broken, activation(), ...flow('CollectMails')]);
  observe('late success without restart cannot clear failure', mail, [...broken, ...flow('CollectMails')], 'failed');
  const unknown = configuration(['未知任务']);
  add('unknown task is preserved but not auto enabled', request('discover', unknown), { 'tasks.1.title': '未知任务', 'tasks.1.isSelected': false, 'tasks.1.isEnabled': true });
  add('unknown task warns without rewriting', request('configuration', unknown),
    { 'diagnostics.baah_unknown_pipeline_task': 'warning', configPatches: [] });
  const loggingOff = request('configuration', mail); loggingOff.resources[1] = resource({ SAVE_LOG_TO_FILE: false }, 'software-config');
  add('file logging false has bound true proposal', loggingOff, { 'configPatches.0.resourceId': 'software-config', 'configPatches.0.edits.0.value': true });
  const invalidLogging = request('configuration', mail); invalidLogging.resources[1] = resource({ SAVE_LOG_TO_FILE: 'true' }, 'software-config');
  add('logging string not coerced', invalidLogging, { configPatches: [], 'diagnostics.baah_file_logging_required': 'blocking' });
  const command = configuration(['邮件']); command.POST_COMMAND = 'shutdown /s';
  add('post command removed by bound proposal only', request('configuration', command), { 'configPatches.0.edits.0.selector': ['POST_COMMAND'], 'configPatches.0.edits.0.value': '' });
  const edit = request('configuration', mail), main = edit.resources[0];
  edit.configurationIntents = [{ format: 'nexus.config.patch', version: 1, operationId: edit.operationId,
    resourceId: 'main', sourceSha256: main.sha256, expectedRevision: 7, edits: [{ selector: ['TASK_ORDER_GROUP', 'ALL_PIPELINES', 0, 'TASK_ONOFF'], expected: [true], value: [false] }] }];
  add('guarded full-resource selection proposal', edit, { 'configPatches.0.edits.0.value': [false], 'configPatches.0.sourceSha256': main.sha256 });
  const stale = structuredClone(edit); stale.configurationIntents[0].expectedRevision = 8;
  add('stale revision rejected', stale, {}, 'baah_configuration_intent_unbound');
  const progress = structuredClone(edit); progress.configurationIntents[0].edits = [{ selector: ['unknown', 'progress'], expected: 9, value: 0 }];
  add('unknown progress cannot be cleared', progress, {}, 'baah_configuration_edit_not_supported');
  const stored = resource({ date: '2026-10-29', bought: 3, claimed: ['mail'], count: 7 }, 'progress');
  const retained = request('configuration', mail); retained.resources.push(stored);
  add('selected persistent progress is retained without a repair patch', retained, { configPatches: [] });
  const storageEdit = structuredClone(retained);
  storageEdit.configurationIntents = [{ format: 'nexus.config.patch', version: 1, operationId: storageEdit.operationId,
    resourceId: 'progress', sourceSha256: stored.sha256, expectedRevision: 7,
    edits: [{ selector: ['count'], expected: 7, value: 0 }] }];
  add('persistent progress reset is refused', storageEdit, {}, 'baah_configuration_edit_not_supported');
  return rows;
}
