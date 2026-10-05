function observeDaily(text, tasks, emit, result, line, states) {
  if (line.sourceId !== 'file' || input.logBatch.hasGap) return;
  const info = text.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2},\d{3} \| (INFO|ERROR|WARNING) \| (.*)$/);
  const message = info ? info[2] : text;
  const cursor = result.cursorState.daily || (result.cursorState.daily = {epoch:line.epoch, stack:[]});
  if (cursor.epoch !== line.epoch) { cursor.epoch = line.epoch; cursor.stack = []; }
  const keys = {'开始日常任务':'daily_enable','开始清体力':'power_enable','开始执行体力计划':'power_enable',
    '准备历战余响':'echo_of_war_enable','开始检测活动':'activity_enable','开始领取奖励':'reward_enable',
    '准备忘却之庭':'forgottenhall_enable','准备虚构叙事':'purefiction_enable','准备末日幻影':'apocalyptic_enable',
    '准备锄大地':'fight_enable','准备模拟宇宙':'universe_enable','准备差分宇宙':'universe_enable',
    '准备货币战争':'currencywars_enable','准备使用兑换码':'reward_redemption_code_enable'};
  const header = message.match(/^\|\s*(.*?)\s*\|$/);
  if ((/^=+\s*开始查询日常任务完成情况\s*=+$/.test(message)
      || /^[-─━]+\s*开始刷.+ - .+，总计[1-9]\d*轮，每轮包含[1-9]\d*次\s*[-─━]+$/.test(message)) && cursor.stack.length) {
    cursor.stack.push({id:null,failed:false});
    requireValue(cursor.stack.length <= 32);
    return;
  }
  const rewardKeys = {支援:'reward_assist_enable',邮件:'reward_mail_enable',委托:'reward_dispatch_enable',
    每日实训:'reward_quest_enable',无名勋礼:'reward_srpass_enable',成就:'reward_achievement_enable',短信:'reward_message_enable'};
  const rewardStart = message.match(/^=+\s*检测到(支援|邮件|委托|每日实训|无名勋礼|成就|短信)奖励\s*=+$/);
  if (rewardStart) {
    const task = tasks.find(t => t.enabled && t.sourceKey === rewardKeys[rewardStart[1]]);
    cursor.stack.push({id:task?.id || null,failed:false,reward:rewardStart[1]});
    requireValue(cursor.stack.length <= 32);
    if (task) emit(task,'running','march7th.scope.started');
    return;
  }
  const rewardEnd = message.match(/^[-─━]+\s*(支援|邮件|委托|每日实训|无名勋礼|成就|短信)奖励完成\s*[-─━]+$/);
  if (rewardEnd && cursor.stack.at(-1)?.reward === rewardEnd[1]) cursor.stack.pop();
  if (header) {
    if (header[1] === '停止运行') { endRun(result,line,'march7th.run.stop'); return; }
    const task = tasks.find(t => t.sourceKey === keys[header[1]]);
    if (task) {
      const active = cursor.stack.at(-1);
      if (active?.id === task.id) return;
      cursor.stack.push({id:task.id,failed:false});
      requireValue(cursor.stack.length <= 32);
      emit(task,'running','march7th.scope.started');
    } else if (cursor.stack.length) {
      cursor.stack.push({id:null,failed:false});
      requireValue(cursor.stack.length <= 32);
    }
    return;
  }
  const scope = cursor.stack.at(-1), owner = cursor.stack.slice().reverse().find(s => s.id);
  const ownedByPower = owner && tasks.some(t => t.id === owner.id && ['power_enable','echo_of_war_enable','activity_enable'].includes(t.sourceKey));
  if (info?.[1] === 'ERROR' && owner && !ownedByPower) {
    owner.failed = true;
    const task = tasks.find(t => t.id === owner.id);
    emit(task,'failed','march7th.flow.failed');
  }
  if (/^[-─━]+\s*完成\s*[-─━]+$/.test(message) && scope) {
    cursor.stack.pop();
    const task = tasks.find(t => t.id === scope.id);
    if (task && !scope.failed && states[task.id]?.status === 'running') emit(task,'succeeded','march7th.flow.ended');
  }
  if (info?.[1] === 'ERROR' && /^发生错误/.test(message)) endRun(result,line,'march7th.run.exception',true);
}
