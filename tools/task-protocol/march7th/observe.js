function observe(text, tasks, emit, result, line, states) {
  powerScope(text, tasks, emit, result, line, states);
  // tasks/game.stop logs this top-level header before optional game shutdown and pause/loop.
  // The generic dashed "完成" banner also ends startup and nested modules, so it is never a run boundary.
  if (/^\|\s*停止运行\s*\|$/.test(text)) endRun(result, line, 'march7th.run.stop');
  if (/^(?:\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2},\d{3} \| ERROR \| )?发生错误(?:\s|:|：|$)/.test(text))
    endRun(result, line, 'march7th.run.exception', true);
  const absent = text.match(/(?:^|\| INFO \| )未检测到(邮件|支援|委托|每日实训|无名勋礼|成就|短信)奖励$/);
  const rewards = { 邮件: 'reward_mail_enable', 支援: 'reward_assist_enable', 委托: 'reward_dispatch_enable',
    每日实训: 'reward_quest_enable', 无名勋礼: 'reward_srpass_enable', 成就: 'reward_achievement_enable', 短信: 'reward_message_enable' };
  if (absent) {
    const task = tasks.find(t => t.sourceKey === rewards[absent[1]]);
    if (task) emit(task, 'succeeded', 'march7th.reward.not_available');
  }
  // RewardTemplate emits a named completion even when nothing is available to claim.
  const complete = text.match(/^(?:[-─━]+\s*)?(邮件|支援|委托|每日实训|无名勋礼|成就|短信)奖励完成(?:\s*[-─━]+)?$/);
  if (complete) {
    const task = tasks.find(t => t.sourceKey === rewards[complete[1]]);
    if (task) emit(task, 'succeeded', 'march7th.reward.completed');
  }
  const rules = [
    ['reward_mail_enable', /邮件奖励已领取\s*$/, 'succeeded', 'mail.claimed'],
    ['reward_dispatch_enable', /委托派遣中，目前没有可领取的奖励帕！\s*$/, 'succeeded', 'dispatch.in_progress'],
    ['daily_enable', /实训分数已达标\s*$/, 'succeeded', 'daily.target'],
    ['universe_enable', /差分宇宙固定次数已全部完成，记录本轮执行时间\s*$/, 'succeeded', 'universe.complete'],
    ['universe_enable', /差分宇宙本轮未完成，不计入固定次数/, 'failed', 'universe.incomplete'],
    ['universe_enable', /差分宇宙固定次数为 0，跳过执行并记录本轮时间\s*$/, 'skipped', 'universe.zero'],
    ['universe_enable', /差分宇宙固定次数（.+）已完成 \d+\/\d+，跳过执行\s*$/, 'skipped', 'universe.satisfied'],
    ['weekly_divergent_enable', /尝试运行了多轮差分宇宙，但积分奖励仍未完成/, 'failed', 'weekly.incomplete'],
    ['echo_of_war_enable', /历战余响设置周\d+后开始执行，当前为周\d+, 跳过执行\s*$/, 'skipped', 'echo.not_due']
  ];
  const refresh = { daily_enable: '每日实训', echo_of_war_enable: '历战余响', universe_enable: '模拟宇宙/差分宇宙',
    weekly_divergent_enable: '「差分宇宙」积分奖励', currencywars_enable: '「货币战争」积分奖励', fight_enable: '锄大地',
    forgottenhall_enable: '忘却之庭', purefiction_enable: '虚构叙事', apocalyptic_enable: '末日幻影', asset_self_molding_resin_enable: '自塑尘脂自动合成' };
  for (const task of tasks) {
    if (refresh[task.sourceKey] && text.endsWith(refresh[task.sourceKey] + '尚未刷新')) emit(task, 'skipped', 'march7th.not_due', 'satisfied');
    for (const [key, pattern, status, rule] of rules)
      if (task.sourceKey === key && pattern.test(text)) emit(task, status, 'march7th.' + rule, status === 'skipped' ? 'satisfied' : undefined);
  }
  // Only aggregate this reviewed reward wrapper; unrelated parents may have their own work.
  const parent = tasks.find(t => t.sourceKey === 'reward_enable');
  const children = parent ? tasks.filter(t => t.parentId === parent.id && t.requiredForParent) : [];
  if (parent && children.length && children.every(t => ['succeeded', 'skipped'].includes(states[t.id]?.status))
      && !['succeeded', 'failed'].includes(states[parent.id]?.status))
    emit(parent, 'succeeded', 'march7th.reward.children_completed');

}
