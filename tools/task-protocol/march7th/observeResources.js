function observeResources(message, tasks, emit, result, line, states) {
  const task = key => tasks.find(t => t.enabled && t.sourceKey === key);
  const send = (key, status, rule, skipKind) => {
    const found = task(key);
    if (!found) return;
    if (status === 'succeeded' && states[found.id]?.status === 'pending') emit(found,'running','march7th.scope.started');
    emit(found,status,rule,skipKind);
  };
  const cursor = result.cursorState.resources || (result.cursorState.resources = {epoch:line.epoch});
  if (cursor.epoch !== line.epoch) { result.cursorState.resources = {epoch:line.epoch}; return; }
  const activity = task('activity_enable');
  const activityChildren = tasks.filter(t => t.enabled && t.parentId === activity?.id && t.role === 'business');
  if (/^\|\s*开始检测活动\s*\|$/.test(message)) {
    cursor.activity = true; cursor.noActivities = false;
    for (const child of activityChildren) emit(child,'running','march7th.scope.started');
  }
  if (cursor.activity && message === '未检测到任何活动') cursor.noActivities = true;
  // ActivityManager's outer return closes the enabled conditional checks, including absent events.
  if (cursor.activity && states[activity?.id]?.status === 'succeeded') {
    for (const child of activityChildren.filter(t => states[t.id]?.status === 'running'))
      emit(child,cursor.noActivities ? 'skipped' : 'succeeded',
        cursor.noActivities ? 'march7th.resources.inapplicable' : 'march7th.flow.ended',cursor.noActivities ? 'inapplicable' : undefined);
    cursor.activity = false;
  }
  const resin = 'asset_self_molding_resin_enable', lc = 'asset_lc3_star_superimpose_enable';
  if (/^[-─━]+\s*准备合成自塑尘脂\s*[-─━]+$/.test(message)) send(resin,'running','march7th.scope.started');
  if (message === '自塑尘脂合成完成' || message === '自塑尘脂已达上限，无需合成') send(resin,'succeeded','march7th.resources.completed');
  if (/^自塑尘脂合成失败(?:$|:)/.test(message)) send(resin,'failed','march7th.flow.failed');
  if (/^[-─━]+\s*准备3星光锥自动叠加\s*[-─━]+$/.test(message)) { cursor.lc = true; send(lc,'running','march7th.scope.started'); }
  if (/^3星光锥自动叠加失败:/.test(message)) { cursor.lc = false; send(lc,'failed','march7th.flow.failed'); }
  const ember = {星轨专票:'asset_ember_special_pass_enable',星轨通票:'asset_ember_regular_pass_enable',命运的足迹:'asset_ember_tracks_of_destiny_enable'};
  if (/^[-─━]+\s*准备进行余烬兑换每月购买\s*[-─━]+$/.test(message)) {
    cursor.ember = true;
    for (const key of Object.values(ember)) if (states[task(key)?.id]?.status === 'pending') send(key,'running','march7th.scope.started');
  }
  for (const [name,key] of Object.entries(ember)) {
    if (message === '「' + name + '」自动购买尚未刷新') send(key,'skipped','march7th.not_due','satisfied');
    if (message === '尝试购买「' + name + '」') send(key,'running','march7th.scope.started');
    if (message === '「' + name + '」购买完成' || message === '「' + name + '」已售罄，本月视为已处理') send(key,'succeeded','march7th.resources.completed');
    if (message === '「' + name + '」购买未完成，本次不记录时间'
        || message === '「' + name + '」下滚补扫后仍未完成，本次不记录时间') send(key,'failed','march7th.flow.failed');
  }
  if (cursor.ember && /^(?:进入余烬兑换失败|余烬兑换每月自动购买失败:)/.test(message))
    for (const key of Object.values(ember)) if (states[task(key)?.id]?.status === 'running') send(key,'failed','march7th.flow.failed');
  const asset = task('asset_manager_enable');
  const children = tasks.filter(t => t.enabled && t.parentId === asset?.id);
  if (asset && states[asset.id]?.status === 'pending' && children.some(t => states[t.id]?.status !== 'pending'))
    emit(asset,'running','march7th.scope.started');
  // The default main entry returns from Daily.start before reward.start; routine does not enter assets.
  if (/^\|\s*(?:开始领取奖励|停止运行)\s*\|$/.test(message)) {
    if (cursor.lc && states[task(lc)?.id]?.status === 'running') send(lc,'succeeded','march7th.flow.ended');
    cursor.lc = false; cursor.ember = false;
    if (asset && children.length && children.every(t => ['succeeded','skipped'].includes(states[t.id]?.status))) {
      if (children.every(t => states[t.id]?.status === 'skipped')) emit(asset,'skipped','march7th.resources.inapplicable','satisfied');
      else emit(asset,'succeeded','march7th.flow.ended');
    } else if (asset && !children.length) emit(asset,'skipped','march7th.resources.inapplicable','inapplicable');
  }
}
