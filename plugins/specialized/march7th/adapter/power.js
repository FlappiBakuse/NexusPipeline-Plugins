'use strict';

function march7thPowerClose(state, mark, event) {
  const group = state.power.group;
  if (!group || group.closed) return;
  group.closed = true;
  if (!group.tainted && (group.exhausted || group.directFailure)) {
    mark(group.owner, 'failed', 'march7th_instance_scope_failed');
    for (const incident of state.incidents.filter(item => item.group === group.id && item.resolution === 'open')) {
      incident.resolution = 'terminal'; incident.end = event.sequence;
    }
  }
}

function march7thPowerStart(state, start, mark, event) {
  const power = state.power, owner = power.root === 'activity_enable' ? power.activity : power.root;
  if (!owner) return;
  const runs = Number(start[3]), units = Number(start[4]), target = JSON.stringify([start[1], start[2]]);
  if (runs > 10000 || units > 10000 || runs * units > 1000000 || target.length > 1024) throw new Error('march7th_instance_header_limit');
  let group = power.group;
  if (!group || group.closed || group.target !== target || !group.retryReady || group.tainted) {
    march7thPowerClose(state, mark, event);
    group = { id: ++power.serial, owner, target, required: runs * units, retries: 0, successful: 0, direct: power.root === 'echo_of_war_enable' };
  }
  Object.assign(group, { runs, units, completed: 0, failed: false, retryReady: false, start: event.sequence, closed: false });
  power.group = group; mark(owner, 'running', 'march7th_instance_started');
}

function march7thPowerIncident(state, reason, event, mark) {
  const group = state.power.group;
  if (state.incidents.length >= 64) throw new Error('march7th_incident_limit');
  state.incidents.push({ epoch: event.epoch, sequence: event.sequence, group: group && !group.closed ? group.id : null,
    task: group && !group.closed ? group.owner : null, reason, resolution: 'open' });
  if (group && !group.closed) { group.failed = true; if (group.direct) group.directFailure = true; }
  if (group?.closed && state.power.root) mark(group.owner, 'failed', 'march7th_late_instance_conflict');
  if (reason === 'activity_exception' && state.power.root === 'activity_enable') {
    mark('activity_enable', 'failed', 'march7th_activity_exception');
    if (group && !group.closed) { group.directFailure = true; march7thPowerClose(state, mark, event); }
  }
}

function march7thPower(state, config, text, level, mark, event) {
  const power = state.power, top = level === 'TITLE' && /^\|\s*(.*?)\s*\|$/.exec(text);
  if (top) {
    march7thPowerClose(state, mark, event);
    power.root = { 开始清体力: 'power_enable', 开始执行体力计划: 'power_enable', 准备历战余响: 'echo_of_war_enable', 开始检测活动: 'activity_enable' }[top[1]] ?? null;
    power.group = null; power.activity = null; power.block = [];
  }
  const activity = level === 'INFO' && /^(花藏繁生|异器盈界(?:300%)?|位面分裂(?:300%)?)剩余次数：[1-9]\d*$/.exec(text);
  if (activity && power.root === 'activity_enable') {
    march7thPowerClose(state, mark, event); power.group = null;
    power.activity = activity[1].startsWith('花藏') ? 'activity_gardenofplenty_enable' :
      activity[1].startsWith('异器') ? 'activity_realmofthestrange_enable' : 'activity_planarfissure_enable';
  }
  const start = level === 'TITLE' && /^[-─━]+\s*开始刷(.+?) - (.+?)，总计([1-9]\d*)轮，每轮包含([1-9]\d*)次\s*[-─━]+$/.exec(text);
  if (start) march7thPowerStart(state, start, mark, event);
  if (level === 'INFO') {
    power.block.push(text.trim()); if (power.block.length > 4) power.block.shift();
    const pattern = march7thFailurePatterns(config).find(item => item.lines.length <= power.block.length &&
      item.lines.every((line, index) => line === power.block[power.block.length - item.lines.length + index]));
    if (pattern) { march7thPowerIncident(state, pattern.reason, event, mark); power.block = []; }
  } else power.block = [];
  if (level === 'ERROR' && text.startsWith('活动处理过程中发生错误:')) march7thPowerIncident(state, 'activity_exception', event, mark);
  const group = power.group;
  if (!group || group.closed) return;
  const retry = level === 'ERROR' && /^检测到该次副本未正常运行，重试：([1-3])\/3$/.exec(text);
  if (retry && !group.direct) {
    const count = Number(retry[1]);
    if (count !== group.retries + 1) { group.tainted = true; return; }
    if (!group.failed) march7thPowerIncident(state, 'unsuccessful', event, mark);
    group.retries = count; group.exhausted = count === 3; group.retryReady = count < 3;
  }
  const completed = level === 'INFO' && /^第([1-9]\d*)次副本完成$/.exec(text);
  if (completed) {
    if (Number(completed[1]) !== group.completed + 1 || Number(completed[1]) > group.runs || group.failed) group.tainted = true;
    else group.completed++;
  }
  if (level === 'INFO' && text === '副本任务完成' && group.completed === group.runs && !group.failed && !group.tainted) {
    group.successful += group.completed * group.units;
    if (group.successful < group.required) return;
    group.closed = true;
    for (const incident of state.incidents.filter(item => item.group === group.id && item.resolution === 'open')) {
      incident.resolution = 'recovered'; incident.end = event.sequence;
    }
  }
}
