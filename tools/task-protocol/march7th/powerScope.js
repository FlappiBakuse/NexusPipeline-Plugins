function powerScope(text, tasks, emit, result, line, states) {
  const store = result.cursorState.m7Power || (result.cursorState.m7Power = {});
  const source = JSON.stringify([line.sourceId, line.epoch]);
  for (const key of Object.keys(store)) if (store[key].sourceId === line.sourceId && key !== source) delete store[key];
  if (!store[source]) {
    requireValue(Object.keys(store).length < 16);
    store[source] = { sourceId: line.sourceId, root: null, serial: 0, block: [] };
  }
  const context = store[source];
  const info = text.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2},\d{3} \| (INFO|ERROR|WARNING) \| (.*)$/);
  const message = info ? info[2] : text;
  const evidence = ruleId => ({ sourceId: line.sourceId, epoch: line.epoch, sequence: line.sequence, ruleId });
  const taskFor = key => tasks.find(t => t.sourceKey === key);
  function diagnostic(code, message) {
    if (!result.diagnostics.some(d => d.code === code)) result.diagnostics.push({ code, message });
  }
  function record(group, reason, proof) {
    const reasonKey = { '指定副本未解锁': 'locked', '未找到指定副本': 'not_found', '传送可能失败': 'teleport_failed',
      '无法开始挑战': 'start_failed', '副本执行未成功': 'unsuccessful', '活动处理异常': 'activity_error',
      '活动处理异常（缺少执行范围）': 'activity_unattributed' }[reason];
    const incident = { id: 'm7.instance:' + line.sourceId + ':' + line.epoch + ':' + line.sequence,
      taskId: group ? group.taskId : null, scopeId: group ? group.id : 'm7.unattributed:' + line.sourceId + ':' + line.epoch,
      executionOrdinal: group ? group.ordinal : 1, kind: group ? 'business_error' : 'unattributed_error', resolution: 'open',
      reasonCode: 'march7th.instance.' + reasonKey,
      reasonText: { kind: 'plugin', key: 'reason.march7th.instance.' + reasonKey, args: {}, fallback: reason }, evidence: proof };
    result.incidents.push({ ...incident, evidence: incident.evidence.slice() });
    if (group) { requireValue(group.failures.length < 64); group.failures.push(incident); group.hadFailure = true; }
    else diagnostic('march7th.instance.unattributed', 'Instance failure retained without a unique task scope.');
  }
  function resolve(group, resolution, proof) {
    for (const incident of group.failures.filter(i => i.resolution === 'open')) {
      const next = { ...incident, resolution, evidence: incident.evidence.concat(proof.slice(-(8 - incident.evidence.length)))
        .filter((e, i, all) => all.findIndex(x => x.sourceId === e.sourceId && x.epoch === e.epoch && x.sequence === e.sequence && x.ruleId === e.ruleId) === i).slice(0, 8) };
      result.incidents.push(next); incident.resolution = resolution;
    }
  }
  function closeGroup(group) {
    if (!group || group.closed) return;
    group.closed = true;
    if ((group.exhausted || group.directFailure) && !group.tainted) {
      resolve(group, 'terminal', [evidence('march7th.instance.scope_exit')]);
      const task = tasks.find(t => t.id === group.taskId);
      if (task) emit(task, 'failed', group.exhausted ? 'march7th.instance.exhausted' : 'march7th.instance.abandoned');
    }
  }
  const top = text.match(/^\|\s*(.*?)\s*\|$/);
  if (top) {
    const knownBoundary = ['开始清体力', '开始执行体力计划', '准备历战余响', '开始检测活动', '开始日常任务', '停止运行'].includes(top[1]);
    if (context.root && knownBoundary) closeGroup(context.root.current);
    else if (context.root) diagnostic('march7th.scope.unknown_boundary', 'Unreviewed scope header invalidated task attribution without declaring failure.');
    const key = { '开始清体力': 'power_enable', '开始执行体力计划': 'power_enable',
      '准备历战余响': 'echo_of_war_enable', '开始检测活动': 'activity_enable' }[top[1]];
    const task = key && taskFor(key);
    context.root = task ? { key, taskId: task.id, id: 'm7.scope:' + line.sourceId + ':' + line.epoch + ':' + line.sequence,
      evidence: evidence('march7th.scope.started'), current: null, activityKey: null } : null;
    context.block = [];
    if (task && (!states[task.id] || ['pending', 'running'].includes(states[task.id].status))) emit(task, 'running', 'march7th.scope.started');
    return;
  }
  const root = context.root;
  const activity = info && info[1] === 'INFO' && message.match(/^(花藏繁生|异器盈界(?:300%)?|位面分裂(?:300%)?)剩余次数：[1-9]\d*$/);
  if (activity && root && root.key === 'activity_enable') {
    closeGroup(root.current); root.current = null;
    root.activityKey = { '花藏繁生': 'activity_gardenofplenty_enable', '异器盈界': 'activity_realmofthestrange_enable',
      '异器盈界300%': 'activity_realmofthestrange_enable', '位面分裂': 'activity_planarfissure_enable', '位面分裂300%': 'activity_planarfissure_enable' }[activity[1]];
  }
  const start = text.match(/^[-─━]+\s*开始刷(.+?) - (.+?)，总计([1-9]\d*)轮，每轮包含([1-9]\d*)次\s*[-─━]+$/);
  if (start) {
    context.block = [];
    if (!root) return;
    if (start[1].length + start[2].length > 512 || Number(start[3]) > 10000 || Number(start[4]) > 10000
        || Number(start[3]) * Number(start[4]) > 1000000) {
      root.current = null; diagnostic('march7th.instance.invalid_header', 'Instance header exceeds the reviewed limits.'); return;
    }
    const owner = root.key === 'activity_enable' ? taskFor(root.activityKey) : tasks.find(t => t.id === root.taskId);
    if (!owner) { closeGroup(root.current); root.current = null; return; }
    const target = JSON.stringify([start[1], start[2]]);
    const previous = root.current;
    const retry = previous && !previous.closed && previous.target === target && previous.retryReady && !previous.tainted;
    if (!retry) closeGroup(previous);
    const group = retry ? previous : { id: root.id + ':' + (++context.serial), taskId: owner.id, target, ordinal: 0,
      failures: [], failedRuns: 0, successfulUnits: 0, requiredUnits: Number(start[3]) * Number(start[4]), direct: root.key === 'echo_of_war_enable' };
    group.ordinal++; group.retryReady = false; group.hadFailure = false;
    group.runs = Number(start[3]); group.units = Number(start[4]); group.completed = 0;
    group.start = evidence('march7th.instance.started'); group.parentStart = root.evidence;
    requireValue(group.runs <= 10000 && group.units <= 10000 && group.requiredUnits <= 1000000);
    root.current = group;
    return;
  }
  const group = root && root.current && !root.current.closed ? root.current : null;
  const patterns = instanceTemplate();
  if (!patterns.length) diagnostic('march7th.instance.template_unsupported', 'InstanceNotCompleted template cannot be matched safely; native failure coverage is limited.');
  if (info && info[1] === 'INFO' && message.length <= 2048) {
    context.block.push({ text: message.trim(), evidence: evidence('march7th.instance.failed') });
    if (context.block.length > 4) context.block.shift();
    const matched = patterns.find(p => p.lines.length <= context.block.length && p.lines.every((part, i) => part === context.block[context.block.length - p.lines.length + i].text));
    if (matched) {
      const proof = context.block.slice(-matched.lines.length).map(p => p.evidence);
      record(group, matched.reason, group ? [group.parentStart, group.start, ...proof].slice(0, 7) : proof);
      if (group && group.direct) group.directFailure = true;
      context.block = [];
    }
  } else context.block = [];
  if (info && info[1] === 'ERROR' && /^活动处理过程中发生错误:/.test(message)) {
    if (root && root.key === 'activity_enable') {
      if (group) {
        record(group, '活动处理异常', [group.parentStart, group.start, evidence('march7th.activity.exception')]);
        group.directFailure = true; closeGroup(group);
      }
      const task = taskFor('activity_enable');
      if (task) emit(task, 'failed', 'march7th.activity.exception');
    } else record(null, '活动处理异常（缺少执行范围）', [evidence('march7th.activity.exception')]);
  }
  if (!group || !info) return;
  const retry = info[1] === 'ERROR' && message.match(/^检测到该次副本未正常运行，重试：([1-3])\/3$/);
  if (retry && !group.direct) {
    const number = Number(retry[1]);
    if (number !== group.failedRuns + 1) {
      group.tainted = true;
      diagnostic('march7th.instance.retry_gap', 'Internal retry sequence is incomplete; no exhaustion verdict is inferred.');
      return;
    }
    if (!group.hadFailure) record(group, '副本执行未成功', [group.parentStart, group.start, evidence('march7th.instance.retry')]);
    group.failedRuns = number; group.exhausted = number === 3; group.retryReady = number < 3;
    return;
  }
  const completed = info[1] === 'INFO' && message.match(/^第([1-9]\d*)次副本完成$/);
  if (completed) {
    const number = Number(completed[1]);
    if (number !== group.completed + 1 || number > group.runs || group.hadFailure) group.tainted = true;
    else { group.completed = number; group.successfulUnits += group.units; group.lastSuccess = evidence('march7th.instance.round_completed'); }
  }
  if (info[1] === 'INFO' && message === '副本任务完成' && group.completed === group.runs && !group.tainted && !group.hadFailure
      && group.successfulUnits >= group.requiredUnits) {
    resolve(group, 'recovered', [group.start, group.lastSuccess, evidence('march7th.instance.completed')]);
    group.closed = true;
    // This proves this target's requested rounds only. It never proves all Power plans or activity candidates.
  }
}
