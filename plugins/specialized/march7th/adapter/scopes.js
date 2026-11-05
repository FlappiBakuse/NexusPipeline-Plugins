'use strict';

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
