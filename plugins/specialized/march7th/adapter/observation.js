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

const march7thRewardNames = { 支援: 'reward_assist_enable', 邮件: 'reward_mail_enable', 委托: 'reward_dispatch_enable',
  每日实训: 'reward_quest_enable', 无名勋礼: 'reward_srpass_enable', 成就: 'reward_achievement_enable', 短信: 'reward_message_enable' };
const march7thEmberNames = { 星轨专票: 'asset_ember_special_pass_enable', 星轨通票: 'asset_ember_regular_pass_enable', 命运的足迹: 'asset_ember_tracks_of_destiny_enable' };

function march7thResources(state, config, text, mark, level) {
  const absent = /^未检测到(支援|邮件|委托|每日实训|无名勋礼|成就|短信)奖励$/.exec(text);
  if (absent) mark(march7thRewardNames[absent[1]], 'succeeded', 'march7th_reward_checked_no_reward', 'satisfied');
  const rewardEnd = level === 'TITLE' && /^[-─━]+\s*(支援|邮件|委托|每日实训|无名勋礼|成就|短信)奖励完成\s*[-─━]+$/.exec(text);
  if (rewardEnd) mark(march7thRewardNames[rewardEnd[1]], 'succeeded', 'march7th_reward_named_completion');
  if (text === '委托派遣中，目前没有可领取的奖励帕！') mark('reward_dispatch_enable', 'succeeded', 'march7th_dispatch_in_progress', 'satisfied');
  if (text === '没有找到有效的兑换码' && state.stack.some(scope => scope.key === 'reward_redemption_code_enable'))
    mark('reward_redemption_code_enable', 'succeeded', 'march7th_redemption_no_new_code', 'satisfied');
  if (level === 'TITLE' && /^[-─━]+\s*准备合成自塑尘脂\s*[-─━]+$/.test(text)) mark('asset_self_molding_resin_enable', 'running', 'march7th_resin_started');
  if (['自塑尘脂合成完成', '自塑尘脂已达上限，无需合成'].includes(text))
    mark('asset_self_molding_resin_enable', 'succeeded', 'march7th_resin_completed', text.includes('上限') ? 'satisfied' : 'completed');
  if (/^自塑尘脂合成失败(?:$|:)/.test(text)) mark('asset_self_molding_resin_enable', 'failed', 'march7th_resin_failed');
  if (level === 'TITLE' && /^[-─━]+\s*准备3星光锥自动叠加\s*[-─━]+$/.test(text)) { state.lc = true; mark('asset_lc3_star_superimpose_enable', 'running', 'march7th_lc_started'); }
  if (text.startsWith('3星光锥自动叠加失败:')) { state.lc = false; mark('asset_lc3_star_superimpose_enable', 'failed', 'march7th_lc_failed'); }
  for (const [name, key] of Object.entries(march7thEmberNames)) {
    if (text === '「' + name + '」自动购买尚未刷新') mark(key, 'succeeded', 'march7th_not_refreshed', 'satisfied');
    if (text === '尝试购买「' + name + '」') mark(key, 'running', 'march7th_ember_started');
    if (text === '「' + name + '」购买完成' || text === '「' + name + '」已售罄，本月视为已处理') mark(key, 'succeeded', 'march7th_ember_checked', text.includes('售罄') ? 'satisfied' : 'completed');
    if (text === '「' + name + '」购买未完成，本次不记录时间' || text === '「' + name + '」下滚补扫后仍未完成，本次不记录时间') mark(key, 'failed', 'march7th_ember_incomplete');
  }
  if (/^(?:进入余烬兑换失败|余烬兑换每月自动购买失败:)/.test(text))
    for (const key of Object.values(march7thEmberNames)) mark(key, 'failed', 'march7th_ember_failed');
  const refresh = { 每日实训: 'daily_enable', 历战余响: 'echo_of_war_enable', '模拟宇宙/差分宇宙': 'universe_enable',
    '「差分宇宙」积分奖励': 'weekly_divergent_enable', '「货币战争」积分奖励': 'currencywars_enable', 锄大地: 'fight_enable',
    忘却之庭: 'forgottenhall_enable', 虚构叙事: 'purefiction_enable', 末日幻影: 'apocalyptic_enable', 自塑尘脂自动合成: 'asset_self_molding_resin_enable' };
  for (const [name, key] of Object.entries(refresh)) if (text === name + '尚未刷新') mark(key, 'succeeded', 'march7th_not_refreshed', 'satisfied');
  if (text === '差分宇宙固定次数已全部完成，记录本轮执行时间') mark('universe_enable', 'succeeded', 'march7th_fixed_count_completed');
  if (text === '差分宇宙固定次数为 0，跳过执行并记录本轮时间' || /^差分宇宙固定次数（.+）已完成 \d+\/\d+，跳过执行$/.test(text))
    mark('universe_enable', 'succeeded', 'march7th_fixed_count_satisfied', 'satisfied');
  if (text.startsWith('差分宇宙本轮未完成，不计入固定次数')) mark('universe_enable', 'failed', 'march7th_current_run_incomplete');
  if (text.startsWith('尝试运行了多轮差分宇宙，但积分奖励仍未完成')) mark('weekly_divergent_enable', 'failed', 'march7th_weekly_incomplete');
  if (/^历战余响设置周\d+后开始执行，当前为周\d+, 跳过执行$/.test(text)) mark('echo_of_war_enable', 'succeeded', 'march7th_echo_not_due', 'satisfied');
  if (text === '未检测到任何活动') state.noActivities = true;
  if (level === 'TITLE' && /^\|\s*(?:开始领取奖励|停止运行)\s*\|$/.test(text)) {
    if (state.lc) mark('asset_lc3_star_superimpose_enable', 'succeeded', 'march7th_daily_return_after_lc');
    state.lc = false;
    if (config.rows.some(row => row.parent === 'asset_manager_enable' && state.results[row.key])) state.assetReturned = true;
  }
}

function march7thScope(state, text, level, mark) {
  const headings = { 开始日常任务: 'daily_enable', 开始清体力: 'power_enable', 开始执行体力计划: 'power_enable',
    准备历战余响: 'echo_of_war_enable', 开始检测活动: 'activity_enable', 开始领取奖励: 'reward_enable',
    准备忘却之庭: 'forgottenhall_enable', 准备虚构叙事: 'purefiction_enable', 准备末日幻影: 'apocalyptic_enable',
    准备锄大地: 'fight_enable', 准备模拟宇宙: 'universe_enable', 准备货币战争: 'currencywars_enable',
    准备使用兑换码: 'reward_redemption_code_enable', 获取最新兑换码: 'reward_redemption_code_enable' };
  const header = level === 'TITLE' && /^\|\s*(.*?)\s*\|$/.exec(text);
  if (header) {
    if (header[1] === '停止运行') { state.runEnded = true; state.stack = []; return; }
    const key = headings[header[1]] ?? null;
    state.stack.push({ key, failed: false, header: header[1] });
    if (state.stack.length > 32) throw new Error('march7th_scope_depth_limit');
    if (key) mark(key, 'running', 'march7th_scope_started');
    return;
  }
  if (level === 'TITLE' && /^=+\s*开始查询日常任务完成情况\s*=+$/.test(text)) state.stack.push({ key: null, failed: false });
  const reward = level === 'TITLE' && /^=+\s*检测到(支援|邮件|委托|每日实训|无名勋礼|成就|短信)奖励\s*=+$/.exec(text);
  if (reward) {
    const key = march7thRewardNames[reward[1]];
    state.stack.push({ key, reward: reward[1], failed: false }); mark(key, 'running', 'march7th_reward_started');
  }
  const rewardEnd = level === 'TITLE' && /^[-─━]+\s*(支援|邮件|委托|每日实训|无名勋礼|成就|短信)奖励完成\s*[-─━]+$/.exec(text);
  if (rewardEnd && state.stack.at(-1)?.reward === rewardEnd[1]) state.stack.pop();
  if (level === 'ERROR') {
    const owner = state.stack.slice().reverse().find(scope => scope.key);
    if (owner && !['power_enable', 'echo_of_war_enable', 'activity_enable'].includes(owner.key)) {
      owner.failed = true; mark(owner.key, 'failed', 'march7th_scoped_error');
    }
    if (/^发生错误(?:\s|:|：|$)/.test(text)) { state.runEnded = true; state.aborted = true; }
  }
  if (level === 'TITLE' && /^[-─━]+\s*完成\s*[-─━]+$/.test(text)) {
    const scope = state.stack.pop();
    if (!scope?.key || scope.failed) return;
    if (scope.key === 'activity_enable') state.activityReturned = true;
    if (scope.key === 'reward_enable') state.rewardReturned = true;
    if (!['universe_enable', 'fight_enable', 'reward_enable'].includes(scope.key)) mark(scope.key, 'succeeded', 'march7th_scope_returned');
  }
}

function march7thAggregate(state, config, mark) {
  if (state.activityReturned) {
    for (const row of config.rows.filter(row => row.parent === 'activity_enable' && row.role === 'business'))
      mark(row.key, 'succeeded', 'march7th_activity_condition_checked', state.noActivities ? 'inapplicable' : 'completed');
  }
  for (const [parent, returned] of [['reward_enable', state.rewardReturned], ['asset_manager_enable', state.assetReturned],
    ['activity_enable', state.activityReturned]]) {
    if (!returned) continue;
    const children = config.rows.filter(row => row.parent === parent && row.selected && row.role === 'business');
    if (children.some(row => state.results[row.key]?.state === 'failed')) mark(parent, 'failed', 'march7th_required_child_failed');
    else if (children.every(row => state.results[row.key]?.state === 'succeeded'))
      mark(parent, 'succeeded', 'march7th_all_required_children_checked', children.length ? 'completed' : 'inapplicable');
  }
}

function march7thInitial(binding) {
  return { binding, epoch: null, sequence: 0, results: {}, stack: [], incidents: [], power: { root: null, group: null, serial: 0, block: [] },
    lc: false, assetReturned: false, activityReturned: false, rewardReturned: false, noActivities: false, runEnded: false, aborted: false };
}

function march7thMark(state, config, key, outcome, reasonCode, completionKind = 'completed') {
  if (!config.rows.some(row => row.key === key && row.selected)) return;
  const previous = state.results[key];
  if (previous?.state === 'failed' || outcome === 'running' && previous?.state === 'succeeded') return;
  if (outcome === 'succeeded' && state.incidents.some(item => item.resolution === 'open' && item.task === key)) return;
  state.results[key] = { state: outcome, reasonCode, completionKind };
}

function march7thNotification(state, config, text, mark) {
  if (!state.stack.length) return;
  const mapping = [['FightCompleted', 'fight_enable', 'succeeded'], ['FightNotCompleted', 'fight_enable', 'failed'],
    ['SimulatedUniverseCompleted', 'universe_enable', 'succeeded'], ['SimulatedUniverseNotCompleted', 'universe_enable', 'failed']];
  for (const [name, key, outcome] of mapping) {
    const message = config.document.notify_template?.[name] ?? MARCH7TH_DEFAULTS.notify_template[name];
    if (typeof message === 'string' && !/[{}\r\n]/.test(message) && text === message && state.stack.some(scope => scope.key === key))
      mark(key, outcome, 'march7th_literal_notification_' + outcome);
  }
}

function march7thObserve(input, config, tasks) {
  const binding = JSON.stringify([input.runId, input.attemptId, input.planDigest]), initial = march7thInitial(binding);
  let state = initial;
  if (input.observationCheckpoint) {
    state = strictConfigurationJson(input.observationCheckpoint, 'march7th');
    if (state.binding !== binding || !Array.isArray(state.stack) || state.stack.length > 32 || !Array.isArray(state.incidents) ||
        state.incidents.length > 64 || !march7thObject(state.results) || !march7thObject(state.power)) throw new Error('march7th_checkpoint_unbound');
  }
  const mark = (key, outcome, reasonCode, completionKind) => march7thMark(state, config, key, outcome, reasonCode, completionKind);
  for (const event of input.logEvents ?? []) {
    if (event.sourceId !== 'file:0') continue;
    if (!Number.isSafeInteger(event.sequence) || event.sequence < 1 || typeof event.text !== 'string') throw new Error('march7th_log_event_invalid');
    if (state.epoch !== event.epoch || event.sequence !== state.sequence + 1 && event.sequence > state.sequence) {
      const results = Object.fromEntries(Object.entries(state.results).filter(([, result]) => result.state === 'failed' || state.runEnded && result.state === 'succeeded'));
      const incidents = state.incidents, runEnded = state.runEnded, serial = state.power.serial;
      state = { ...march7thInitial(binding), results, incidents, epoch: event.epoch, runEnded };
      state.power.serial = serial;
    }
    if (event.sequence <= state.sequence) continue;
    state.sequence = event.sequence;
    const info = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2},\d{3} \| (INFO|ERROR|WARNING) \| (.*)$/.exec(event.text);
    const text = info ? info[2] : event.text, level = info?.[1] ?? 'TITLE';
    if (!info && !/^(?:\|.*\||[-=+─━].*)$/.test(text)) continue;
    march7thPower(state, config, text, level, mark, event);
    march7thScope(state, text, level, mark);
    march7thResources(state, config, text, mark, level);
    if (info) march7thNotification(state, config, text, mark);
    march7thAggregate(state, config, mark);
  }
  const observations = tasks.map(task => {
    const key = task.taskId.slice(9), result = state.results[key];
    if (result?.state === 'failed') return { taskId: task.taskId, state: 'failed', reasonCode: result.reasonCode };
    if (result?.state === 'succeeded' && state.runEnded && input.logComplete === true && !state.aborted)
      return { taskId: task.taskId, state: 'succeeded', reasonCode: result.reasonCode, completionKind: result.completionKind };
    return { taskId: task.taskId, state: 'unknown', reasonCode: 'march7th_business_scope_incomplete' };
  });
  const observationCheckpoint = JSON.stringify(state);
  if (observationCheckpoint.length > 65536) throw new Error('march7th_checkpoint_limit');
  return { observations, observationCheckpoint };
}
