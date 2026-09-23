function observe(text, tasks, emit, result, line) {
  // Reviewed bfe5f868: LeyLine throws after this log; Guild retries exactly once.
  // Match a message boundary, not quoted user text or a stack-frame mention.
  const message = text.replace(/^(?:\[\d{2}:\d{2}:\d{2}(?:\.\d+)?\]\s*)?\[(?:ERR|DBG|INF|ERROR|DEBUG|INFO)\]\s*/, '');
  const failures = [
    ['自动地脉花', /^自动地脉花执行失败(?:[:：].*)?$/, 'bettergi.leyline.failed'],
    ['领取每日奖励', /^前往冒险家协会领取奖励执行异常[:：].*$/, 'bettergi.daily.guild_exception'],
    ['合成树脂', /^合成树脂执行异常[:：].*$/, 'bettergi.resin.exception']
  ];
  for (const [name, pattern, code] of failures) {
    const selected = tasks.filter(t => t.name === name);
    if (selected.length === 1 && pattern.test(message)) emit(selected[0], 'failed', code);
  }
  const matches = tasks.filter(t => t.name === '领取邮件');
  if (matches.length === 1) {
    if (/邮件：(?:全部领取|"全部领取")\s*$/.test(text)) emit(matches[0], 'succeeded', 'bettergi.mail.claim');
    else if (/邮件：(?:没有邮件奖励|"没有邮件奖励")\s*$/.test(text)) emit(matches[0], 'succeeded', 'bettergi.mail.empty');
    else if (text.includes('领取邮件奖励异常:')) emit(matches[0], 'failed', 'bettergi.mail.exception');
  }
  if (text.endsWith('自动地脉花未在运行日期内，跳过')) {
    const items = tasks.filter(t => t.name === '自动地脉花');
    if (items.length === 1) emit(items[0], 'skipped', 'bettergi.leyline.not_due', 'inapplicable');
  }
  if (text.endsWith('一条龙和配置组任务结束')) {
    result.runBoundary = 'ended'; result.boundaryEvidence = [{ sourceId: line.sourceId, epoch: line.epoch, sequence: line.sequence, ruleId: 'bettergi.run.end' }];
  }
}
