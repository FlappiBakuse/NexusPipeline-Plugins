function discover() {
  const config = configOne(r => r.id === 'config:config.yaml'), d = config.document, plan = createPlan();
  requireValue(object(d));
  if (object(d.notify_template) && Object.prototype.hasOwnProperty.call(d.notify_template, 'InstanceNotCompleted'))
    plan.behaviorFields.push({ resourceId: config.id, selector: ['notify_template', 'InstanceNotCompleted'] });
  const defaults = ADAPTER.defaults;
  behavior(plan, config, Object.keys(d).filter(k => /^(power_|universe_|weekly_|currencywars_|fight_|forgottenhall_|purefiction_|apocalyptic_|asset_|activity_|echo_)/.test(k)
    && !/(?:_time|_timestamp|_last_run|_completed_count|_progress)$/.test(k) && !k.endsWith('_enable')));
  const value = key => Object.prototype.hasOwnProperty.call(d, key) ? d[key] : defaults[key];
  const roots = [
    ['daily_enable', '每日实训'], ['power_enable', '清体力'], ['universe_enable', '模拟宇宙/差分宇宙'],
    ['weekly_divergent_enable', '差分宇宙积分奖励'], ['currencywars_enable', '货币战争积分奖励'], ['fight_enable', '锄大地'],
    ['forgottenhall_enable', '忘却之庭'], ['purefiction_enable', '虚构叙事'], ['apocalyptic_enable', '末日幻影'],
    ['asset_manager_enable', '资产管理'], ['reward_enable', '领取奖励'], ['activity_enable', '活动'], ['build_target_enable', '培养目标']
  ];
  for (const [key, name] of roots) {
    requireValue(typeof value(key) === 'boolean');
    const task = addTask(plan, config.id, key, name, value(key), typeof d[key] === 'boolean' ? [key] : null,
      'unknown', 'limited', key === 'build_target_enable' ? 'technical' : 'business');
    const childKeys = key === 'power_enable' ? ['echo_of_war_enable']
      : key === 'reward_enable' ? ['reward_assist_enable', 'reward_mail_enable', 'reward_dispatch_enable', 'reward_quest_enable', 'reward_srpass_enable', 'reward_achievement_enable', 'reward_message_enable', 'reward_redemption_code_enable']
      : key === 'asset_manager_enable' ? ['asset_self_molding_resin_enable', 'asset_lc3_star_superimpose_enable', 'asset_ember_special_pass_enable', 'asset_ember_regular_pass_enable', 'asset_ember_tracks_of_destiny_enable']
      : key === 'activity_enable' ? ['activity_dailycheckin_enable', 'activity_gardenofplenty_enable', 'activity_realmofthestrange_enable', 'activity_planarfissure_enable', 'activity_journey_highlights_notification_enable'] : [];
    for (const child of childKeys) {
      if (typeof value(child) !== 'boolean') continue;
      addTask(plan, config.id, child, ADAPTER.names[child] || child, task.enabled && value(child),
        typeof d[child] === 'boolean' ? [child] : null, 'unknown', 'limited', undefined, task.id);
    }
  }
  for (const key of Object.keys(d).filter(k => k.endsWith('_enable') && !Object.prototype.hasOwnProperty.call(defaults, k)))
    if (!plan.tasks.some(t => t.sourceKey === key)) addTask(plan, config.id, key, key, d[key] === true, null, 'unknown', 'unsupported');
  plan.diagnostics.push({ code: 'coverage_limited', message: 'Reward wrapper completion and timestamps are not success evidence. Internal randomized daily tasks do not expand the frozen plan.' });
  return plan;
}
