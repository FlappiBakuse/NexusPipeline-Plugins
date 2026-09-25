function observe(text, tasks, emit, result, line, states) {
  // Only the pinned logger's original ASCII format is accepted. Quoted/OCR-transcribed
  // issue text is evidence for investigation, never an alternate production syntax.
  text = text.replace(/^\[\d{2}:\d{2}:\d{2}\.\d{3}\] \[operation\.py \d+\] \[(?:INFO|ERROR)\]: /, '');
  const root = text.match(/^指令\[ 一条龙 \] 执行(成功|失败) 返回状态(?: .*)?$/);
  if (root) endRun(result, line, 'zzz.run.' + (root[1] === '成功' ? 'end' : 'abort'), root[1] === '失败');
  if (input.logBatch.hasGap) { result.cursorState = {}; return; }
  const cursor = result.cursorState;
  if (cursor.source !== line.sourceId || cursor.epoch !== line.epoch) {
    cursor.source = line.sourceId; cursor.epoch = line.epoch;
    cursor.group = false; cursor.index = 0; cursor.active = null; cursor.transients = [];
  }
  const pool = input.originalPlan.tasks.slice().sort((a, b) => a.order - b.order);
  const node = text.match(/^指令\[ (.+) \] 节点 (.+) 返回状态(?: (.*))?$/);
  const terminal = text.match(/^指令\[ (.+) \] 执行(成功|失败) 返回状态(?: (.*))?$/);
  const proof = ruleId => ({ sourceId: line.sourceId, epoch: line.epoch, sequence: line.sequence, ruleId });
  if (node?.[1] === '执行应用组 one_dragon') {
    const targetNode = node[2].split(' -> ').at(-1), status = node[3] || '';
    if (targetNode === '获取应用组配置' && status === '成功') {
      cursor.group = true; cursor.index = 0; cursor.active = null;
      // update_full_app_list prepends missing registered defaults as disabled
      // runtime items, without persisting them in _group.yml. They are not
      // business tasks, yet their "应用未启用" lines precede saved apps.
      const saved = new Set(pool.map(t => t.sourceKey));
      cursor.transients = ADAPTER.defaultAppIds.filter(id => !saved.has('one_dragon/' + id));
      return;
    }
    if (!cursor.group || targetNode !== '执行应用') return;
    if (cursor.index === 0 && !cursor.active && status.startsWith('应用未启用 ')) {
      const name = status.slice('应用未启用 '.length);
      const index = cursor.transients.findIndex(id => ADAPTER.apps[id] === name);
      if (index >= 0 && !pool.some(t => t.name === name)) {
        cursor.transients = cursor.transients.slice(index + 1);
        return;
      }
    }
    const expected = pool[cursor.index], task = tasks.find(t => t.id === expected?.id && t.detection !== 'unsupported');
    if (status === '下一个') {
      if (!tasks.some(t => t.id === expected?.id)) { cursor.group = false; cursor.active = null; return; }
      const active = cursor.active;
      // GroupApplication.run_app logs this only after app.execute has returned.
      // Defer the candidate terminal until this boundary so a same-name child cannot win.
      if (task && active?.taskId === task.id && active.terminal) {
        const unresolved = active.unscopedChargeError || active.chargeIssues?.some(i => i.resolution !== 'recovered');
        const status = active.abandoned ? 'failed' : unresolved && active.terminal.status === 'succeeded' ? 'unknown' : active.terminal.status;
        emit(task, status, active.abandoned ? 'zzz.charge.abandoned' : 'zzz.application.terminal');
        result.observations.at(-1).evidence.push(active.started, active.terminal.proof);
      }
    } else if (expected && status === '应用已完成 ' + expected.name) {
      if (task) emit(task, 'skipped', 'zzz.application.already_done', 'satisfied');
    } else if (!expected || status !== '应用未启用 ' + expected.name) {
      cursor.group = false; cursor.active = null; return;
    }
    cursor.index++; cursor.active = null; return;
  }
  if (terminal?.[1] === '执行应用组 one_dragon' || root) {
    cursor.group = false; cursor.active = null; return;
  }
  if (!cursor.group) return;
  const expected = pool[cursor.index];
  const task = tasks.find(t => t.id === expected?.id && t.detection !== 'unsupported');
  if (!task) return;
  if (!cursor.active && node?.[1] === task.name && node[2] === '检测游戏窗口') {
    cursor.active = { taskId: task.id, started: proof('zzz.application.start'), terminal: null };
    emit(task, 'running', 'zzz.application.start');
  }
  if (!cursor.active || cursor.active.taskId !== task.id) return;
  observeCharge(text, node, terminal, task, cursor.active, result, line, states);
  if (terminal?.[1] === task.name)
    cursor.active.terminal = { status: terminal[2] === '成功' ? 'succeeded' : 'failed', proof: proof('zzz.application.outer_return') };
}
