function discover() {
  const plan = createPlan();
  if (!runtimeReady(plan)) return plan;
  const config = configOne(r => r.id === 'config:DailyTask.json');
  requireValue(object(config.document));
  if (plan.runtimeRestricted) {
    addTask(plan, config.id, 'runtime_unverified', '本次基础流程（任务未核验）', true, null, 'unsafe', 'unsupported');
    delete plan.runtimeRestricted;
    return plan;
  }
  const d = config.document;
  const farm = d['Which to Farm'] === undefined ? 'Tacet Suppression' : d['Which to Farm'];
  requireValue(['Tacet Suppression', 'Forgery Challenge', 'Simulation Challenge'].includes(farm));
  const extras = d['Additional Tasks to Run After Daily Task'] === undefined
    ? ['Check Weekly Garden'] : d['Additional Tasks to Run After Daily Task'];
  const echo = d['Farm Nightmare Nest for Daily Echo'] === undefined ? true : d['Farm Nightmare Nest for Daily Echo'];
  requireValue(Array.isArray(extras) && unique(extras) && extras.every(v => typeof v === 'string') && typeof echo === 'boolean');
  const allNightmares = extras.includes('Auto Farm all Nightmare Nest');
  const add = (key, name, enabled = true, detection = 'limited') =>
    addTask(plan, config.id, key, name, enabled, null, 'unknown', detection);
  // Actual call order: conditional nightmare work precedes stamina, despite the option label.
  const nightmare = add('nightmare', allNightmares ? '全部梦魇附加任务' : '日常所需梦魇', allNightmares || echo && farm !== 'Tacet Suppression');
  nightmare.nameText = { kind: 'plugin', key: allNightmares ? 'task.nightmare_all' : 'task.nightmare_daily', args: {}, fallback: nightmare.name };
  const stamina = add('stamina', '日常体力：' + farm);
  stamina.nameText = { kind: 'plugin', key: ADAPTER.staminaTextKeys[farm], args: {}, fallback: stamina.name };
  add('daily_reward', '领取日常奖励');
  add('mail', '领取邮件');
  add('battle_pass', '领取通行证奖励');
  add('garden', '每周花园', extras.includes('Check Weekly Garden'));
  add('merge', '丢弃声骸合成', extras.includes('Merge Echo If discarded > 1000'));
  add('farm_4c', '日常附加传送刷 4C', extras.includes('Teleport and Farm 4C Echo'));
  const known = ['Check Weekly Garden', 'Auto Farm all Nightmare Nest', 'Merge Echo If discarded > 1000', 'Teleport and Farm 4C Echo'];
  for (const extra of extras.filter(v => !known.includes(v))) {
    add('extra:' + extra, extra, true, 'unsupported');
    plan.diagnostics.push({ code: 'okww.unknown_extra', message: 'Unrecognized daily extra: ' + extra });
  }
  behavior(plan, config, ['Which to Farm', 'Which Tacet Suppression to Farm', 'Which Forgery Challenge to Farm',
    'Material Selection', 'Farm Nightmare Nest for Daily Echo', 'Additional Tasks to Run After Daily Task']);
  for (const dependency of ADAPTER.configDependencies) {
    if (!plan.tasks.some(t => t.sourceKey === dependency.task && t.enabled)) continue;
    const resources = input.configResources.filter(r => r.id === 'config:' + dependency.file);
    requireValue(resources.length <= 1);
    if (resources.length) {
      const child = configOne(r => r.id === resources[0].id);
      requireValue(object(child.document));
      behavior(plan, child, dependency.keys);
    }
  }
  if (extras.includes('Teleport and Farm 4C Echo')) {
    const resource = input.configResources.find(r => r.id === 'config:FarmEchoTask.json');
    const child = resource ? configOne(r => r.id === resource.id).document : {};
    const teleport = child['Teleport to Boss'] === undefined ? 'No' : child['Teleport to Boss'];
    const count = child['Repeat Farm Count'] === undefined ? 10000 : child['Repeat Farm Count'];
    // These are the pinned FarmEchoTask dropdown values and finite loop counter, not guessed CLI modes.
    if (!['Weekly Challenge', 'Boss Challenge'].includes(teleport) || !Number.isSafeInteger(count) || count <= 0) {
      plan.coverage = 'unsupported';
      plan.tasks.find(t => t.sourceKey === 'farm_4c').detection = 'unsupported';
      plan.diagnostics.push({ code: 'okww.farm_4c.configuration_unsupported',
        message: 'Daily 4C requires Weekly Challenge or Boss Challenge teleport and a positive finite integer Repeat Farm Count. No settings were changed.',
        reasonText: { kind: 'plugin', key: 'diagnostic.farm_4c.configuration_unsupported', args: {},
          fallback: '日常附加刷 4C 的传送模式或有限次数配置不受支持，未修改配置。' } });
    }
  }
  plan.diagnostics.push({ code: 'okww.conditional_steps', message: 'Stamina and nightmare execution depend on current daily progress. Click-only reward paths have no verified positive terminal evidence.' });
  plan.diagnostics.push({ code: 'okww.retry_coupled', message: 'DailyTask has implicit steps without individual switches. Restarting it may repeat resource-consuming work; automatic retry is not qualified.' });
  return plan;
}
