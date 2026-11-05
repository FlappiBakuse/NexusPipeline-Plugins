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
