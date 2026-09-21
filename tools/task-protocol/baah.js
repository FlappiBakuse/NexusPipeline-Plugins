function discover() {
  const config = configOne(r => r.format === 'json'), d = config.document, plan = createPlan();
  const group = d.TASK_ORDER_GROUP;
  behavior(plan, config, ['SERVER_TYPE', 'TIMETABLE_TASK', 'WANTED_HIGHEST_LEVEL', 'SPECIAL_HIGHTEST_LEVEL', 'EXCHANGE_HIGHEST_LEVEL',
    'EVENT_QUEST_LEVEL', 'HARD', 'NORMAL', 'SHOP_NORMAL', 'SHOP_NORMAL_BUYALL', 'SHOP_CONTEST', 'SHOP_CONTEST_BUYALL',
    'PUSH_NORMAL_USE_SIMPLE', 'PUSH_NORMAL_QUEST', 'PUSH_NORMAL_QUEST_LEVEL', 'PUSH_HARD_USE_SIMPLE', 'PUSH_HARD_QUEST', 'PUSH_HARD_QUEST_LEVEL']);
  requireValue(object(group) && Array.isArray(group.ALL_PIPELINES) && Number.isInteger(group.ACTIVATE_IND));
  const index = group.ACTIVATE_IND, pipeline = group.ALL_PIPELINES[index];
  requireValue(object(pipeline) && Array.isArray(pipeline.TASK_PIPELINE) && Array.isArray(pipeline.TASK_ONOFF)
    && pipeline.TASK_PIPELINE.length === pipeline.TASK_ONOFF.length);
  pipeline.TASK_PIPELINE.forEach((name, i) => {
    requireValue(typeof name === 'string' && typeof pipeline.TASK_ONOFF[i] === 'boolean');
    addTask(plan, config.id, index + '/' + i + '/' + name, name, pipeline.TASK_ONOFF[i], null,
      ADAPTER.safe.includes(name) ? 'safe' : 'unknown', ADAPTER.classes[name] ? 'limited' : 'unsupported', name === '登录游戏' ? 'technical' : 'business');
  });
  if (typeof d.OPEN_GAME_APP_TASK === 'boolean') {
    const login = addTask(plan, config.id, 'automatic-login', '自动登录', d.OPEN_GAME_APP_TASK, ['OPEN_GAME_APP_TASK'], 'safe', 'limited', 'technical');
    if (login.enabled) plan.tasks.filter(t => t.role === 'business').forEach(t => t.dependencies.push(login.id));
  }
  if (typeof d.DO_POST_ALL_TASK === 'boolean') addTask(plan, config.id, 'automatic-cleanup', '运行收尾', d.DO_POST_ALL_TASK, ['DO_POST_ALL_TASK'], 'unknown', 'limited', 'cleanup');
  plan.selectionFields.push({ resourceId: config.id, purpose: 'selection', selector: ['TASK_ORDER_GROUP', 'ALL_PIPELINES',
    { index, guardKey: 'TASK_PIPELINE', guardValue: pipeline.TASK_PIPELINE }, 'TASK_ONOFF'] });
  plan.diagnostics.push({ code: 'retry.risk_not_verified', message: 'Class aliases, resume cursors and nested Task.run calls require verified identity. Ambiguous precondition skips are unknown, not success.' });
  return plan;
}
function customRetryPatches(plan, selected) {
  const field = plan.selectionFields.find(f => f.selector.at(-1) === 'TASK_ONOFF'), current = nexus.readConfig(field.resourceId);
  const expected = select(current.document, field.selector);
  const value = expected.map((enabled, index) => selected.has(plan.tasks[index].id));
  const operations = [{ selector: field.selector, expected, value, purpose: 'selection' }];
  for (const task of plan.tasks.filter(t => t.sourceKey.startsWith('automatic-'))) {
    const slot = plan.slots[task.id], old = select(current.document, slot.selector), next = selected.has(task.id);
    if (old !== next) operations.push({ selector: slot.selector, expected: old, value: next, purpose: 'selection' });
  }
  return [{ resourceId: field.resourceId, format: current.format, expectedRevision: current.revision, operations }];
}
function observe(text, tasks, emit, result, line, states) {
  // BAAH_main emits this after my_AllTask.run, before optional closing of game/emulator.
  if (/(?:^|INFO : )(?:所有任务结束|All tasks are finished)$/.test(text)) endRun(result, line, 'baah.run.end');
  if (input.logBatch.hasGap) { result.cursorState = {}; return; }
  const cursor = result.cursorState;
  if (cursor.source !== line.sourceId || cursor.epoch !== line.epoch) { cursor.stack = []; cursor.epoch = line.epoch; cursor.source = line.sourceId; }
  const pre = text.match(/(?:判断任务([^\s]+)是否可以执行$|Judge whether the task ([^\s]+) can be executed$)/);
  if (pre) { if (cursor.stack.length >= 32) throw new Error('resource_limit'); cursor.stack.push(pre[1] || pre[2]); return; }
  const skip = text.match(/(?:任务([^\s]+)执行前条件不成立或超时，跳过此任务$|The condition before the task ([^\s]+) is not met or timed out, skip this task$)/);
  if (skip) { if (cursor.stack.at(-1) === (skip[1] || skip[2])) cursor.stack.pop(); return; }
  if (cursor.stack.length === 1) {
    const active = tasks.filter(t => ADAPTER.classes[t.name] === cursor.stack[0]);
    if (active.length === 1) {
      const task = active[0];
      if (/免费奖励领取成功$|Free award collection succeeded$/.test(text)) emit(task, 'succeeded', 'baah.free_reward.confirmed');
      if (/免费奖励领取失败\(|Free award collection failed \(/.test(text)) emit(task, 'failed', 'baah.free_reward.failed');
      if (/进入统合出席簿失败$|Failed to enter the Attendance page$/.test(text)) emit(task, 'failed', 'baah.attendance.enter_failed');
    }
  }
  const pattern = /(?:执行任务([^\s]+)$|Run task ([^\s]+)$|任务([^\s]+)执行结束$|Task ([^\s]+) execution completed$|任务([^\s]+)执行后条件不成立或超时，且无法正确返回主页，程序退出)/;
  const match = text.match(pattern); if (!match) return;
  const name = match[1] || match[2] || match[3] || match[4] || match[5];
  const depth = cursor.stack.length;
  if (!depth || cursor.stack.at(-1) !== name) return;
  if (!(match[1] || match[2])) cursor.stack.pop();
  if (depth !== 1) return;
  const matches = tasks.filter(t => (t.sourceKey === 'automatic-login' ? 'EnterGame' : t.sourceKey === 'automatic-cleanup' ? 'PostAllTask' : ADAPTER.classes[t.name]) === name);
  if (matches.length !== 1 || input.logBatch.hasGap) return;
  const task = matches[0], start = !!(match[1] || match[2]);
  if (start) { emit(task, 'running', 'baah.task.start'); return; }
  if (states[task.id]?.status !== 'running') return;
  if (match[5]) {
    emit(task, 'failed', 'baah.task.fatal_postcondition');
    result.runBoundary = 'aborted'; result.boundaryEvidence = [{ sourceId: line.sourceId, epoch: line.epoch, sequence: line.sequence, ruleId: 'baah.task.abort' }];
    tasks.filter(t => t.order > task.order && (states[t.id]?.status || 'pending') === 'pending').forEach(t => emit(t, 'blocked', 'baah.run.aborted_before_task'));
  } else if (task.role === 'technical') emit(task, 'succeeded', 'baah.technical.end');
  // Task.run only proves that post_condition returned home. Many on_run methods return early silently.
  // Business success therefore requires a task-specific confirmation above, never the generic end line.
}
