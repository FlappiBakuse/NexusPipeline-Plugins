function observe(text, tasks, emit, result, line, states) {
  text = text.replace(/^[^\r\n]{1,80} - \d{2}:\d{2} - (?:INFO|WARN|WARNING|ERROR|DEBUG) : /, '');
  // BAAH_main emits this after my_AllTask.run, before optional closing of game/emulator.
  if (/^(?:所有任务结束|All tasks are finished)$/.test(text)) endRun(result, line, 'baah.run.end');
  if (input.logBatch.hasGap) { result.cursorState = {}; return; }
  const cursor = result.cursorState;
  if (cursor.source !== line.sourceId || cursor.epoch !== line.epoch) {
    cursor.stack = []; cursor.owners = []; cursor.ordered = false; cursor.next = 0;
    cursor.postPending = null; cursor.profileMismatch = false; cursor.pendingAbort = null;
    cursor.failureEvents = []; cursor.restartEvidence = null;
    cursor.epoch = line.epoch; cursor.source = line.sourceId;
  }
  const evidence = ruleId => ({ sourceId: line.sourceId, epoch: line.epoch, sequence: line.sequence, ruleId });
  const recordFailure = (task, reasonCode) => {
    if (cursor.failureEvents.length >= 64) throw new Error('resource_limit');
    const ordinal = task ? states[task.id]?.executionOrdinal || 1 : 1;
    const incident = { id: 'baah.error:' + line.sourceId + ':' + line.epoch + ':' + line.sequence,
      taskId: task?.id || null, scopeId: 'baah.scope:' + line.sourceId + ':' + line.epoch + ':' + (task?.order ?? 'unattributed') + ':' + ordinal,
      executionOrdinal: ordinal, kind: task ? 'business_error' : 'unattributed_error', resolution: 'open', reasonCode,
      reasonText: { kind: 'plugin', key: 'reason.' + reasonCode, args: {}, fallback: ADAPTER.reasonTexts[reasonCode] },
      evidence: [evidence(reasonCode)] };
    result.incidents.push({ ...incident, evidence: incident.evidence.slice() }); cursor.failureEvents.push(incident);
  };
  const resolveFailures = (task, resolution) => {
    for (const incident of cursor.failureEvents.filter(i => i.resolution === 'open' && (!task || i.taskId === task.id))) {
      if (resolution === 'recovered' && (!cursor.restartEvidence
          || cursor.restartEvidence.sequence <= incident.evidence[0].sequence
          || states[task.id].executionOrdinal <= incident.executionOrdinal)) continue;
      const proof = resolution === 'recovered' ? [cursor.restartEvidence, evidence('baah.task.recovered')] : [evidence('baah.run.error_auto_close')];
      const next = { ...incident, resolution, evidence: incident.evidence.concat(proof) };
      result.incidents.push(next); incident.resolution = resolution;
    }
  };
  const classOf = task => task.sourceKey === 'automatic-login' ? 'EnterGame'
    : task.sourceKey === 'automatic-cleanup' ? 'PostAllTask' : ADAPTER.classes[task.name];
  const ordered = tasks.slice().sort((a, b) => a.order - b.order);
  const activation = text.match(/^(?:当前激活: pipeline |Now activated pipeline )(\d+)$/);
  if (activation) {
    const configured = input.originalPlan.tasks.find(t => /^\d+\//.test(t.sourceKey));
    cursor.ordered = !!configured && Number(configured.sourceKey.split('/')[0]) + 1 === Number(activation[1]);
    cursor.profileMismatch = !!configured && !cursor.ordered;
    cursor.pool = ordered.map(t => t.id); cursor.next = 0; cursor.stack = []; cursor.owners = []; cursor.postPending = null;
    cursor.pendingAbort = null;
    cursor.restartEvidence = cursor.ordered ? evidence('baah.pipeline.started') : null;
    return;
  }
  if (cursor.profileMismatch) return;
  // The root handler catches exceptions from nested Task.run calls too. Its owner is
  // the outer pipeline occurrence, not the innermost class named by the exception.
  const rootError = text.match(/^(?:运行出错: |Error occurred: )(.+)$/);
  if (rootError) {
    const task = tasks.find(t => t.id === cursor.owners[0]);
    const reason = /^任务[^\s]+执行后条件不成立或超时，且无法正确返回主页，程序退出$/.test(rootError[1])
      ? 'baah.task.fatal_postcondition' : 'baah.task.unhandled_exception';
    if (task) emit(task, 'failed', reason);
    recordFailure(task, reason);
    cursor.pendingAbort = { taskId: task?.id || null, order: cursor.ordered ? task?.order ?? null : null,
      line: { sourceId: line.sourceId, epoch: line.epoch, sequence: line.sequence } };
    cursor.stack = []; cursor.owners = []; cursor.postPending = null;
    return;
  }
  if (cursor.pendingAbort && /^(?:10秒后自动关闭|Auto close in 10 seconds)$/.test(text)) {
    endRun(result, line, 'baah.run.error_auto_close', true);
    tasks.filter(t => Number.isInteger(cursor.pendingAbort.order) && t.order > cursor.pendingAbort.order && (states[t.id]?.status || 'pending') === 'pending')
      .forEach(t => emit(t, 'blocked', 'baah.run.aborted_before_task'));
    resolveFailures(null, 'terminal');
    return;
  }
  const resume = text.match(/^CURRENT_PERIOD_TASK_INDEX = (\d+)(?:，继续运行|, continue run)$/);
  if (resume) {
    if (cursor.ordered && !cursor.stack.length && Number(resume[1]) < ordered.length) {
      cursor.pool = ordered.filter((t, i) => i >= Number(resume[1]) || classOf(t) === 'EnterGame').map(t => t.id);
      cursor.next = 0;
    } else cursor.ordered = false;
    return;
  }
  const pre = text.match(/^(?:判断任务([^\s]+)是否可以执行|Judge whether the task ([^\s]+) can be executed)$/);
  if (pre) {
    if (cursor.stack.length >= 32) throw new Error('resource_limit');
    const name = pre[1] || pre[2]; let owner = null;
    if (!cursor.stack.length) {
      const expected = cursor.ordered ? tasks.find(t => t.id === cursor.pool[cursor.next]) : null;
      if (expected && classOf(expected) === name) { owner = expected; cursor.next++; }
      else {
        cursor.ordered = false;
        const matches = tasks.filter(t => classOf(t) === name);
        if (matches.length === 1) owner = matches[0];
      }
    }
    cursor.stack.push(name); cursor.owners.push(owner?.id || null); return;
  }
  const pop = () => { cursor.stack.pop(); cursor.owners.pop(); cursor.postPending = null; };
  const skip = text.match(/^(?:任务([^\s]+)执行前条件不成立或超时，跳过此任务|The condition before the task ([^\s]+) is not met or timed out, skip this task)$/);
  if (skip) { if (cursor.stack.at(-1) === (skip[1] || skip[2])) pop(); return; }
  if (cursor.stack.length === 1) {
    const active = tasks.filter(t => t.id === cursor.owners[0]);
    if (active.length === 1) {
      const task = active[0];
      if (states[task.id]?.status === 'running') {
        const outcome = (ADAPTER.outcomeRules || []).find(r => r.classes.includes(classOf(task)) && r.texts.includes(text));
        if (outcome) {
          emit(task, outcome.status, outcome.reason, outcome.skipKind);
          if (outcome.status === 'failed') recordFailure(task, outcome.reason);
          if (outcome.status === 'succeeded' || outcome.skipKind === 'satisfied') resolveFailures(task, 'recovered');
        }
        if (classOf(task) === 'InFreeAward' && /^(?:免费奖励领取成功|Free award collection succeeded)$/.test(text)) {
          emit(task, 'succeeded', 'baah.free_reward.confirmed'); resolveFailures(task, 'recovered');
        }
        if (classOf(task) === 'InFreeAward' && /^(?:免费奖励领取失败\(|Free award collection failed \()/.test(text)) {
          emit(task, 'failed', 'baah.free_reward.failed'); recordFailure(task, 'baah.free_reward.failed');
        }
        if (classOf(task) === 'Attendance' && /^(?:进入统合出席簿失败|Failed to enter the Attendance page)$/.test(text)) {
          emit(task, 'failed', 'baah.attendance.enter_failed'); recordFailure(task, 'baah.attendance.enter_failed');
        }
      }
    }
  }
  const post = text.match(/^(?:任务([^\s]+)执行后条件不成立或超时|The condition after the task ([^\s]+) is not met or timed out)$/);
  if (post && cursor.stack.at(-1) === (post[1] || post[2])) {
    cursor.postPending = cursor.stack.length;
    return;
  }
  if (/^(?:返回主页成功|Successfully returned to the home page)$/.test(text)
      && cursor.postPending === cursor.stack.length) {
    const task = cursor.stack.length === 1 ? tasks.find(t => t.id === cursor.owners[0]) : null;
    if (task && states[task.id]?.status === 'running') emit(task, 'unknown', 'baah.task.postcondition_unverified');
    pop(); return;
  }
  const pattern = /^(?:执行任务([^\s]+)|Run task ([^\s]+)|任务([^\s]+)执行结束|Task ([^\s]+) execution completed|(?:运行出错: |Error occurred: )?任务([^\s]+)执行后条件不成立或超时，且无法正确返回主页，程序退出)$/;
  const match = text.match(pattern); if (!match) return;
  const name = match[1] || match[2] || match[3] || match[4] || match[5];
  const depth = cursor.stack.length;
  if (!depth || cursor.stack.at(-1) !== name) return;
  const ownerId = cursor.owners.at(-1);
  if (!(match[1] || match[2])) pop();
  if (depth !== 1) return;
  const matches = tasks.filter(t => t.id === ownerId);
  if (matches.length !== 1 || input.logBatch.hasGap) return;
  const task = matches[0], start = !!(match[1] || match[2]);
  if (start) {
    if (states[task.id]?.status === 'failed' && !cursor.restartEvidence) return;
    const prior = cursor.failureEvents.filter(i => i.taskId === task.id && i.resolution === 'open');
    if (prior.some(i => !cursor.restartEvidence || cursor.restartEvidence.sequence <= i.evidence[0].sequence)) return;
    emit(task, 'running', 'baah.task.start'); return;
  }
  if (match[5]) {
    emit(task, 'failed', 'baah.task.fatal_postcondition');
    recordFailure(task, 'baah.task.fatal_postcondition');
    // BAAH_main can catch this and rerun. Keep the attempt open until explicit error-close or process exit.
    cursor.pendingAbort = { taskId: task.id, order: cursor.ordered ? task.order : null,
      line: { sourceId: line.sourceId, epoch: line.epoch, sequence: line.sequence } };
  } else if (task.role === 'technical' && states[task.id]?.status === 'running') {
    emit(task, 'succeeded', 'baah.technical.end'); resolveFailures(task, 'recovered');
  }
  // Task.run only proves that post_condition returned home. Many on_run methods return early silently.
  // Business success therefore requires a task-specific confirmation above, never the generic end line.
}
