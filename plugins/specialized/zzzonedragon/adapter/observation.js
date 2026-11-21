'use strict';

const zzzCategories = ['区域巡防', '实战模拟室', '专业挑战室', '恶名狩猎', '合成电池'];
const zzzNormalChargeStops = ['电量不足', '周期挑战有剩余次数，本次跳过深度追猎', '特训目标已达成'];

function zzzChargeIssue(state, active, reason, event) {
  if (state.incidents.length >= 64) throw new Error('zzzonedragon_incident_limit');
  const child = active.charge.child, index = state.incidents.length;
  state.incidents.push({ taskId: active.id + '/challenges', scopeStart: child?.start ?? active.start, call: child?.ordinal ?? null,
    name: child?.name ?? null, epoch: event.epoch, sequence: event.sequence, reason, resolution: 'open' });
  if (child) child.issues.push(index); else active.charge.unresolved = true;
}

function zzzChargeResolve(state, active, child, event, normalStop) {
  const recovered = child.returned.success;
  for (const index of child.issues) {
    const issue = state.incidents[index];
    if (issue.resolution === 'open') Object.assign(issue, { resolution: recovered ? 'recovered' : 'terminal', end: event.sequence });
  }
  if (!recovered && (!normalStop || child.issues.length)) active.charge.abandoned = true;
  if (normalStop) active.charge.satisfied = true;
  else if (recovered) active.charge.worked = true;
  active.charge.child = null; active.charge.pending = false;
}

function zzzCharge(state, active, parsed, event) {
  if (!active.charge) return;
  const charge = active.charge, node = parsed.kind === 'node' ? parsed : null, terminal = parsed.kind === 'terminal' ? parsed : null;
  const parentNode = node?.name === active.title ? node.path.split(' -> ').at(-1) : null;
  if (parentNode === '识别副本分类') {
    if (charge.child) { charge.unresolved = true; charge.child = null; }
    charge.category = zzzCategories.includes(node.status) ? node.status : null;
    charge.pending = true;
    if (!charge.category) charge.unresolved = true;
  }
  if (parentNode === '传送' && node.status === '合成电池') { charge.category = '合成电池'; charge.pending = true; }
  const childName = name => charge.category === '合成电池' ? name === '兑换以太电池' : !!charge.category && name.startsWith(charge.category + ' ');
  const concreteName = name => name === '兑换以太电池' || zzzCategories.some(category => name.startsWith(category + ' '));
  if (node && concreteName(node.name) && node.path === '检测游戏窗口' && !charge.category) {
    charge.entered = true; zzzChargeIssue(state, active, 'child_without_parent_category', event);
  }
  if (node && childName(node.name) && node.path === '检测游戏窗口') {
    charge.entered = true;
    if (!charge.child || charge.child.name !== node.name) {
      if (charge.child) charge.unresolved = true;
      charge.child = { name: node.name, start: event.sequence, ordinal: ++charge.serial, issues: [], returned: null, parentAck: false };
    }
  }
  const child = charge.child;
  if (parsed.kind === 'error' && child?.name === parsed.name) zzzChargeIssue(state, active, 'child_exception', event);
  if (!child) {
    if (terminal && !terminal.success && (childName(terminal.name) || concreteName(terminal.name)))
      zzzChargeIssue(state, active, 'terminal_without_child_start', event);
    return;
  }
  if (terminal?.name === child.name) {
    child.returned = { success: terminal.success, status: terminal.status, sequence: event.sequence };
    if (!terminal.success && !zzzNormalChargeStops.includes(terminal.status) && !child.issues.length)
      zzzChargeIssue(state, active, 'child_terminal_failed', event);
  }
  if (parentNode === charge.category && child.returned && node.status === child.returned.status) child.parentAck = true;
  if (!child.returned || !child.parentAck) return;
  const from = node?.path.split(' -> ')[0];
  if (parentNode === '挑战完成' && from === charge.category)
    zzzChargeResolve(state, active, child, event, zzzNormalChargeStops.includes(child.returned.status));
  else if (parentNode === '跳过或结束计划' && from === charge.category && zzzNormalChargeStops.includes(child.returned.status))
    zzzChargeResolve(state, active, child, event, true);
}

function zzzChargeResult(state, active) {
  const charge = active.charge;
  const unresolved = charge.unresolved || charge.child !== null || state.incidents.some(issue => issue.taskId === active.id + '/challenges' &&
    issue.scopeStart >= active.start && issue.resolution !== 'recovered');
  if (charge.abandoned || unresolved || charge.pending) return { state: 'failed', reasonCode: charge.abandoned ? 'zzzonedragon_charge_plan_abandoned' : 'zzzonedragon_charge_call_proof_missing' };
  return { state: 'succeeded', reasonCode: 'zzzonedragon_charge_calls_confirmed',
    completionKind: charge.worked ? 'completed' : charge.entered || charge.satisfied ? 'satisfied' : 'inapplicable' };
}

function zzzLog(text) {
  const envelope = /^\[\d{2}:\d{2}:\d{2}\.\d{3}\] \[operation\.py [1-9]\d*\] \[(INFO|ERROR)\]: (.*)$/.exec(text);
  if (!envelope) return null;
  const level = envelope[1], message = envelope[2];
  const node = /^指令\[ (.+) \] 节点 (.+) 返回状态(?: (.*))?$/.exec(message);
  if (node && level === 'INFO') return { kind: 'node', name: node[1], path: node[2], status: node[3] ?? '' };
  const terminal = /^指令\[ (.+) \] 执行(成功|失败) 返回状态(?: (.*))?$/.exec(message);
  if (terminal && level === (terminal[2] === '成功' ? 'INFO' : 'ERROR'))
    return { kind: 'terminal', name: terminal[1], success: terminal[2] === '成功', status: terminal[3] ?? '' };
  const error = /^指令\[ (.+) \] 执行出错(?: 相关截图保存至 .+)?$/.exec(message);
  return error && level === 'ERROR' ? { kind: 'error', name: error[1] } : null;
}

function zzzCommit(state, config, active) {
  const previous = state.results[active.id], terminal = active.terminal;
  if (!terminal) return false;
  let result = { state: terminal.success ? 'succeeded' : 'failed', reasonCode: 'zzzonedragon_outer_application_confirmed', completionKind: 'completed' };
  if (active.charge) {
    const child = zzzChargeResult(state, active), childId = active.id + '/challenges';
    if (state.results[childId]?.state !== 'failed') state.results[childId] = child;
    if (terminal.success && state.results[childId].state === 'failed')
      result = { state: 'partial', reasonCode: 'zzzonedragon_parent_succeeded_charge_failed_retry_forbidden' };
  }
  if (!previous || !['failed', 'partial'].includes(previous.state)) state.results[active.id] = result;
  return true;
}

function zzzGroupLine(state, config, node) {
  const leaf = node.path.split(' -> ').at(-1);
  if (leaf === '获取应用组配置' && node.status === '成功') {
    if (state.groupSeen) state.broken = true;
    state.groupSeen = true; state.group = true; state.index = 0; state.active = null; return;
  }
  if (!state.group || leaf !== '执行应用') return;
  const expected = config.runtime[state.index];
  if (node.status === '全部结束') {
    if (state.index !== config.runtime.length || state.active) state.broken = true;
    else state.groupCompleted = true;
    state.group = false; state.active = null; return;
  }
  if (!expected) { state.broken = true; state.group = false; return; }
  if (!expected.enabled && node.status === '应用未启用 ' + expected.title) state.index++;
  else if (expected.enabled && node.status === '应用已完成 ' + expected.title && !state.active) {
    if (!['failed', 'partial'].includes(state.results[expected.taskId]?.state))
      state.results[expected.taskId] = { state: 'succeeded', reasonCode: 'zzzonedragon_current_group_already_done', completionKind: 'satisfied' };
    if (expected.id === 'charge_plan' && state.results[expected.taskId + '/challenges']?.state !== 'failed')
      state.results[expected.taskId + '/challenges'] = { state: 'succeeded', reasonCode: 'zzzonedragon_current_group_already_done', completionKind: 'satisfied' };
    state.index++;
  } else if (expected.enabled && node.status === '下一个' && state.active?.id === expected.taskId && zzzCommit(state, config, state.active)) state.index++;
  else { state.broken = true; state.group = false; }
  state.active = null;
}

function zzzInitial(binding) {
  return { binding, epoch: null, sequence: 0, groupSeen: false, groupCompleted: false, group: false, index: 0, active: null,
    rootEnded: false, rootFailed: false, broken: false, results: {}, incidents: [] };
}

function zzzActive(row, event) {
  return { id: row.taskId, title: row.title, start: event.sequence, terminal: null, charge: row.id === 'charge_plan' ? {
    category: null, child: null, serial: 0, entered: false, worked: false, satisfied: false, abandoned: false, unresolved: false, pending: false } : null };
}

function zzzLine(state, config, parsed, event) {
  if (parsed.name === '执行应用组 one_dragon') {
    if (parsed.kind === 'node') zzzGroupLine(state, config, parsed);
    else if (parsed.kind === 'terminal') {
      if (!state.groupCompleted) state.broken = true;
      state.group = false; state.active = null;
    }
    return;
  }
  if (parsed.kind === 'terminal' && parsed.name === '一条龙') {
    if (state.active?.charge && !state.results[state.active.id + '/challenges']) state.results[state.active.id + '/challenges'] = zzzChargeResult(state, state.active);
    state.rootEnded = state.groupSeen; state.rootFailed = !parsed.success;
    if (parsed.success && !state.groupCompleted) state.broken = true;
    state.group = false; state.active = null; return;
  }
  if (!state.group) return;
  const expected = config.runtime[state.index];
  if (!expected?.enabled || !expected.taskId) return;
  if (!state.active && parsed.kind === 'node' && parsed.name === expected.title && parsed.path === '检测游戏窗口') state.active = zzzActive(expected, event);
  const active = state.active;
  if (!active || active.id !== expected.taskId) return;
  zzzCharge(state, active, parsed, event);
  if (parsed.kind === 'terminal' && parsed.name === active.title) active.terminal = { success: parsed.success, status: parsed.status, sequence: event.sequence };
}

function zzzObserve(input, config, tasks) {
  const binding = JSON.stringify([input.runId, input.attemptId, input.planDigest, config.id]);
  let state = zzzInitial(binding);
  if (input.observationCheckpoint) {
    state = strictConfigurationJson(input.observationCheckpoint, 'zzzonedragon');
    if (state.binding !== binding || !zzzObject(state.results) || !Array.isArray(state.incidents) || state.incidents.length > 64 ||
        !Number.isInteger(state.index) || state.index < 0 || state.index > config.runtime.length) throw new Error('zzzonedragon_checkpoint_unbound');
  }
  for (const event of input.logEvents ?? []) {
    if (event.sourceId !== 'file:0') continue;
    if (!Number.isSafeInteger(event.sequence) || event.sequence < 1 || typeof event.text !== 'string') throw new Error('zzzonedragon_log_event_invalid');
    if (state.epoch !== event.epoch || event.sequence > state.sequence + 1) {
      const results = Object.fromEntries(Object.entries(state.results).filter(([, item]) => ['failed', 'partial'].includes(item.state) || state.rootEnded));
      const previous = state;
      state = { ...zzzInitial(binding), epoch: event.epoch, results, incidents: previous.incidents,
        ...(previous.groupSeen ? { groupSeen: true, broken: !previous.rootEnded, rootEnded: previous.rootEnded, rootFailed: previous.rootFailed,
          groupCompleted: previous.groupCompleted } : {}) };
    }
    if (event.sequence <= state.sequence) continue;
    state.sequence = event.sequence;
    const parsed = zzzLog(event.text);
    if (parsed) zzzLine(state, config, parsed, event);
  }
  const observations = tasks.map(task => {
    const result = state.results[task.taskId];
    if (result && ['failed', 'partial'].includes(result.state)) return { taskId: task.taskId, state: result.state, reasonCode: result.reasonCode };
    if (result?.state === 'succeeded' && input.logComplete === true && state.rootEnded && !state.rootFailed && !state.broken)
      return { taskId: task.taskId, state: 'succeeded', reasonCode: result.reasonCode, completionKind: result.completionKind };
    return { taskId: task.taskId, state: 'unknown', reasonCode: state.rootFailed ? 'zzzonedragon_root_failed_scope_unqualified' : 'zzzonedragon_outer_group_receipt_missing' };
  });
  const observationCheckpoint = JSON.stringify(state);
  if (observationCheckpoint.length > 65536) throw new Error('zzzonedragon_checkpoint_limit');
  return { observations, observationCheckpoint };
}
