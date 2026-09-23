function observeCharge(text, node, terminal, task, active, result, line, states) {
  if (task.sourceKey !== 'one_dragon/charge_plan') return;
  const evidence = ruleId => ({ sourceId: line.sourceId, epoch: line.epoch, sequence: line.sequence, ruleId });
  active.chargeIssues ||= [];
  const parentNode = node?.[1] === task.name ? node[2].split(' -> ').at(-1) : null;
  if (parentNode === '识别副本分类') {
    active.category = ['区域巡防', '实战模拟室', '专业挑战室', '恶名狩猎'].includes(node[3]) ? node[3] : null;
    active.child = null;
    return;
  }
  if (active.category && node?.[1].startsWith(active.category + ' ') && node[2] === '检测游戏窗口') {
    // Each concrete call owns its errors. A later mission, even with the same label,
    // cannot recover an earlier abandoned plan.
    active.child = { name: node[1], started: evidence('zzz.charge.child_start'), ids: [], returned: null, parentReturn: null };
    return;
  }
  const child = active.child;
  if (!child) {
    if (active.category && terminal?.[1].startsWith(active.category + ' ') && terminal[2] === '失败') {
      active.unscopedChargeError = true;
      result.diagnostics.push({ code: 'zzz.charge.missing_child_scope', message: 'Mission failure lacks a paired child start; outer success cannot prove recovery.' });
    }
    return;
  }
  const error = text.match(/^指令\[ (.+) \] 执行出错(?: 相关截图保存至 .+)?$/);
  const returned = terminal?.[1] === child.name;
  if (error?.[1] === child.name || returned && terminal[2] === '失败' && !child.ids.length) {
    if (active.chargeIssues.length >= 64) throw new Error('resource_limit');
    const ordinal = states[task.id]?.executionOrdinal || 1;
    const issue = { id: 'zzz.charge:' + line.sourceId + ':' + line.epoch + ':' + line.sequence,
      taskId: task.id, scopeId: 'zzz.charge:' + line.sourceId + ':' + line.epoch + ':' + child.started.sequence,
      executionOrdinal: ordinal, kind: 'business_error', resolution: 'open', reasonCode: 'zzz.charge.child_error',
      reasonText: { kind: 'plugin', key: 'reason.zzz.charge.child_error', args: {}, fallback: ADAPTER.reasonTexts['zzz.charge.child_error'] },
      evidence: [child.started, evidence('zzz.charge.child_error')] };
    child.ids.push(issue.id); active.chargeIssues.push(issue);
    result.incidents.push({ ...issue, evidence: issue.evidence.slice() });
  }
  if (returned) child.returned = { success: terminal[2] === '成功', status: terminal[3] || '', proof: evidence('zzz.charge.child_return') };
  if (parentNode === active.category && child.returned && node[3] === child.returned.status)
    child.parentReturn = evidence('zzz.charge.parent_return');
  if (parentNode !== '挑战完成' || node[2].split(' -> ')[0] !== active.category || !child.parentReturn) return;
  for (const issue of active.chargeIssues.filter(i => child.ids.includes(i.id) && i.resolution === 'open')) {
    const resolution = child.returned.success ? 'recovered' : 'terminal';
    const resolved = { ...issue, resolution,
      evidence: issue.evidence.concat([child.returned.proof, child.parentReturn, evidence('zzz.charge.plan_advanced')]) };
    result.incidents.push(resolved); issue.resolution = resolution;
  }
  if (!child.returned.success) active.abandoned = true;
  active.child = null;
}
