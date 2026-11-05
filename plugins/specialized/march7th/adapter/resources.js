'use strict';

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
