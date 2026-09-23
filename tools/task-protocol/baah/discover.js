function discover() {
  const config = configOne(r => r.format === 'json'), d = config.document, plan = createPlan();
  const group = d.TASK_ORDER_GROUP;
  behavior(plan, config, ['SERVER_TYPE', 'TIMETABLE_TASK', 'WANTED_HIGHEST_LEVEL', 'SPECIAL_HIGHTEST_LEVEL', 'EXCHANGE_HIGHEST_LEVEL',
    'EVENT_QUEST_LEVEL', 'HARD', 'NORMAL', 'SHOP_NORMAL', 'SHOP_NORMAL_BUYALL', 'SHOP_CONTEST', 'SHOP_CONTEST_BUYALL',
    'PUSH_NORMAL_USE_SIMPLE', 'PUSH_NORMAL_QUEST', 'PUSH_NORMAL_QUEST_LEVEL', 'PUSH_HARD_USE_SIMPLE', 'PUSH_HARD_QUEST', 'PUSH_HARD_QUEST_LEVEL',
    'RETRY_WHEN_ERROR', 'RETRY_WHEN_ERROR_FROM_LAST_TASK', 'SMART_TIMETABLE', 'CRAFT_TIMES', 'CRAFT_USE_QUICK',
    'SPEICAL_EVENT_STATUS', 'EXCHANGE_EVENT_STATUS', 'BUY_AP_MAX_PRICE', 'BUY_AP_ADD_TIMES',
    'CAFE_COLLECT', 'CAFE_TOUCH', 'CAFE1_INVITE_SEQ', 'CAFE2_INVITE_SEQ', 'CAFE1_BUY_INVITE_TICKET', 'CAFE2_BUY_INVITE_TICKET',
    'CAFE1_BUY_INVITE_SEQ', 'CAFE2_BUY_INVITE_SEQ', 'SHOP_CONTEST_REFRESH_TIME', 'SHOP_NORMAL_REFRESH_TIME', 'SHOP_NORMAL_SWITCH', 'SHOP_CONTEST_SWITCH']);
  requireValue(object(group) && Array.isArray(group.ALL_PIPELINES) && Number.isInteger(group.ACTIVATE_IND));
  const index = group.ACTIVATE_IND, pipeline = group.ALL_PIPELINES[index];
  requireValue(object(pipeline) && Array.isArray(pipeline.TASK_PIPELINE) && Array.isArray(pipeline.TASK_ONOFF)
    && pipeline.TASK_PIPELINE.length === pipeline.TASK_ONOFF.length);
  const login = typeof d.OPEN_GAME_APP_TASK === 'boolean'
    ? addTask(plan, config.id, 'automatic-login', '自动登录', d.OPEN_GAME_APP_TASK, ['OPEN_GAME_APP_TASK'], 'safe', 'limited', 'technical') : null;
  pipeline.TASK_PIPELINE.forEach((name, i) => {
    requireValue(typeof name === 'string' && typeof pipeline.TASK_ONOFF[i] === 'boolean');
    const task = addTask(plan, config.id, index + '/' + i + '/' + name, name, pipeline.TASK_ONOFF[i], null,
      ADAPTER.safe.includes(name) ? 'safe' : 'unknown', ADAPTER.classes[name] ? 'limited' : 'unsupported', name === '登录游戏' ? 'technical' : 'business');
    if (ADAPTER.taskNameTextKeys?.[name])
      task.nameText = { kind: 'plugin', key: ADAPTER.taskNameTextKeys[name], args: {}, fallback: name };
  });
  if (login?.enabled) plan.tasks.filter(t => t.role === 'business').forEach(t => t.dependencies.push(login.id));
  if (typeof d.DO_POST_ALL_TASK === 'boolean') addTask(plan, config.id, 'automatic-cleanup', '运行收尾', d.DO_POST_ALL_TASK, ['DO_POST_ALL_TASK'], 'unknown', 'limited', 'cleanup');
  plan.selectionFields.push({ resourceId: config.id, purpose: 'selection', selector: ['TASK_ORDER_GROUP', 'ALL_PIPELINES',
    { index, guardKey: 'TASK_PIPELINE', guardValue: pipeline.TASK_PIPELINE }, 'TASK_ONOFF'] });
  plan.diagnostics.push({ code: 'retry.risk_not_verified', message: 'Class aliases, resume cursors and nested Task.run calls require verified identity. Ambiguous precondition skips are unknown, not success.' });
  return plan;
}
