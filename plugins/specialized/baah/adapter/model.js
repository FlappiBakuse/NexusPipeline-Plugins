'use strict';

const BAAH_CLASSES = {
  '登录游戏': 'EnterGame', '清momotalk': 'InMomotalk', '活动一览': 'InEventRecap', '长期签到': 'Attendance',
  '咖啡馆': 'InCafe', '咖啡馆只摸头': 'InCafe', '课程表': 'InTimeTable', '社团': 'InClub', '制造': 'InCraft',
  '商店': 'InShop', '每日免费奖励': 'InFreeAward', '购买AP': 'BuyAP', '悬赏通缉': 'InWanted',
  '特殊任务': 'InSpecial', '学园交流会': 'InExchange', '战术大赛': 'InContest', '战术测试': 'InExam',
  '总力战': 'AutoAssault', '大决战': 'AutoGrandAssault', '活动关卡': 'InEvent', '推活动关卡剧情和推图': 'InEvent',
  '每日任务': 'CollectDailyRewards', '邮件': 'CollectMails', '一键扫荡': 'InQuest', '普通关卡': 'InQuest',
  '普通推图': 'InQuest', '困难关卡': 'InQuest', '困难推图': 'InQuest', '主线剧情': 'AutoStory',
  '主线剧情第二部': 'AutoStory', '短篇剧情': 'AutoStory', '支线剧情': 'AutoStory', '挑战任务': 'SolveChallenge', '自定义任务': 'UserTask'
};
const baahOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const baahObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);

function baahRead(input) {
  if (!Array.isArray(input.resources) || new Set(input.resources.map(item => item.resourceId)).size !== input.resources.length ||
      input.resources.some(item => !['main', 'software-config', 'progress'].includes(item.resourceId))) throw new Error('baah_resource_identity_required');
  const resource = input.resources.find(item => item.resourceId === 'main');
  if (!resource) throw new Error('baah_resource_identity_required');
  const document = strictConfigurationJson(resource.content, 'baah'), group = document.TASK_ORDER_GROUP;
  if (!baahObject(group) || !Array.isArray(group.ALL_PIPELINES) || group.ALL_PIPELINES.length > 64 ||
      !Number.isInteger(group.ACTIVATE_IND) || group.ACTIVATE_IND < 0 || group.ACTIVATE_IND >= group.ALL_PIPELINES.length)
    throw new Error('baah_pipeline_identity_invalid');
  const index = group.ACTIVATE_IND, pipeline = group.ALL_PIPELINES[index];
  if (!baahObject(pipeline) || !Array.isArray(pipeline.TASK_PIPELINE) || !Array.isArray(pipeline.TASK_ONOFF) ||
      pipeline.TASK_PIPELINE.length !== pipeline.TASK_ONOFF.length || pipeline.TASK_PIPELINE.length > 1024 ||
      pipeline.TASK_PIPELINE.some(name => typeof name !== 'string' || !name || name.length > 70) ||
      pipeline.TASK_ONOFF.some(value => typeof value !== 'boolean')) throw new Error('baah_parallel_task_arrays_invalid');
  for (const key of ['OPEN_GAME_APP_TASK', 'DO_POST_ALL_TASK'])
    if (document[key] !== undefined && typeof document[key] !== 'boolean') throw new Error('baah_preparation_flags_invalid');
  const software = input.resources.find(item => item.resourceId === 'software-config');
  return { resource, document, index, pipeline, software,
    softwareDocument: software ? strictConfigurationJson(software.content, 'baah') : null };
}

function baahTasks(config) {
  const tasks = [], login = config.document.OPEN_GAME_APP_TASK === true;
  const unknownEnabled = config.pipeline.TASK_PIPELINE.some((name, index) => !baahOwn(BAAH_CLASSES, name) && config.pipeline.TASK_ONOFF[index]);
  const projection = selector => ({ resourceId: config.resource.resourceId,
    relativePath: config.resource.relativePath ?? '', selector });
  const prerequisites = login ? ['baah:automatic-login'] : [];
  if (config.document.OPEN_GAME_APP_TASK !== undefined) tasks.push({ taskId: 'baah:automatic-login', title: '自动登录',
    titleLocales: nexusTaskLocales('automatic_login'),
    isSelected: login, isEnabled: login, dependencies: [], retrySafety: 'safe', workflowRole: 'technical',
    projection: projection(['OPEN_GAME_APP_TASK']) });
  config.pipeline.TASK_PIPELINE.forEach((name, index) => {
    const known = baahOwn(BAAH_CLASSES, name), enabled = config.pipeline.TASK_ONOFF[index];
    tasks.push({ taskId: `baah:${config.index}/${index}/${name}`, title: name, isSelected: known && enabled,
      isEnabled: enabled, dependencies: known && enabled ? [...prerequisites] : [],
      retryPrerequisites: known && enabled ? [...prerequisites].sort() : [],
      retrySafety: known && !unknownEnabled && name !== '自定义任务' ? 'safe' : 'unknown',
      workflowRole: name === '登录游戏' ? 'technical' : 'business',
      ...(known ? { titleLocales: nexusTaskLocales(name), projection: projection(['TASK_ORDER_GROUP', 'ALL_PIPELINES', config.index, 'TASK_ONOFF', index]) } : {}) });
    if (name === '登录游戏' && enabled) prerequisites.push(`baah:${config.index}/${index}/${name}`);
  });
  if (config.document.DO_POST_ALL_TASK !== undefined) tasks.push({ taskId: 'baah:automatic-cleanup', title: '运行收尾',
    titleLocales: nexusTaskLocales('cleanup'),
    isSelected: config.document.DO_POST_ALL_TASK, isEnabled: config.document.DO_POST_ALL_TASK, dependencies: [], retrySafety: 'safe', workflowRole: 'cleanup' });
  return tasks;
}

function baahClass(task) {
  if (task.taskId === 'baah:automatic-login') return 'EnterGame';
  if (task.taskId === 'baah:automatic-cleanup') return 'PostAllTask';
  return BAAH_CLASSES[task.title];
}

function baahFreeze(input, tasks) {
  if (!Array.isArray(input.tasks) || input.tasks.length !== tasks.length || input.tasks.some((task, index) =>
    ['taskId', 'title', 'isSelected', 'isEnabled', 'retrySafety', 'workflowRole'].some(key => task[key] !== tasks[index][key]) ||
    JSON.stringify(task.dependencies) !== JSON.stringify(tasks[index].dependencies) ||
    !nexusTitleEquals(task.titleLocales, tasks[index].titleLocales) ||
    JSON.stringify(task.projection ?? null) !== JSON.stringify(tasks[index].projection ?? null) ||
    JSON.stringify(task.retryPrerequisites ?? []) !== JSON.stringify(tasks[index].retryPrerequisites ?? []))) throw new Error('baah_frozen_tasks_changed');
}
