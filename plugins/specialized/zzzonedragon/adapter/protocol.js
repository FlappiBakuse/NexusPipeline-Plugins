'use strict';

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
