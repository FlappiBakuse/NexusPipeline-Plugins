function discover() {
  const plan = createPlan();
  const modern = input.configResources.filter(r => r.id === 'config:one_dragon/_group.yml');
  const config = modern.length ? configOne(r => r.id === 'config:one_dragon/_group.yml') : configOne(r => r.id === 'config:one_dragon.yml');
  const d = config.document;
  const apps = modern.length ? d.app_list : (d.app_order || []).map(id => ({ app_id: id, enabled: (d.app_run_list || []).includes(id) }));
  requireValue(Array.isArray(apps) && unique(apps.map(a => a.app_id)));
  for (const app of apps) {
    requireValue(typeof app.app_id === 'string' && typeof app.enabled === 'boolean');
    const known = ADAPTER.apps[app.app_id];
    behavior(plan, { id: config.id, document: app }, Object.keys(app).filter(k => !['app_id', 'enabled'].includes(k)),
      ['app_list', { by: 'app_id', value: app.app_id }]);
    addTask(plan, config.id, 'one_dragon/' + app.app_id, known || app.app_id, app.enabled,
      modern.length ? ['app_list', { by: 'app_id', value: app.app_id }, 'enabled'] : null,
      modern.length && app.app_id === 'email' ? 'safe' : 'unknown', known ? 'limited' : 'unsupported');
  }
  plan.diagnostics.push({ code: 'coverage_limited', message: 'Only exact registered outer application names are mapped. Group completion and nested operation failures do not imply application outcomes.' });
  return plan;
}
function observe(text, tasks, emit, result, line) {
  // Group completion can precede switching instances; only the outer one-dragon terminal ends the run.
  const root = text.match(/(?:^|\[INFO\]: |\[ERROR\]: )指令\[ 一条龙 \] 执行(成功|失败) 返回状态(?: .*)?$/);
  if (root) endRun(result, line, 'zzz.run.' + (root[1] === '成功' ? 'end' : 'abort'), root[1] === '失败');
  const match = text.match(/指令\[ (.+) \] 执行(成功|失败) 返回状态 /);
  if (match) {
    const found = tasks.filter(t => t.name === match[1] && t.detection !== 'unsupported');
    if (found.length === 1) emit(found[0], match[2] === '成功' ? 'succeeded' : 'failed', 'zzz.application.terminal');
    if (found.length) return;
  }
  // The group emits its skip reason in the current run; saved run_record timestamps are never evidence.
  const skip = text.match(/指令\[ 执行应用组 one_dragon \].*应用已完成 (.+)$/);
  if (skip) {
    const found = tasks.filter(t => t.name === skip[1] && t.detection !== 'unsupported');
    if (found.length === 1) emit(found[0], 'skipped', 'zzz.application.already_done', 'satisfied');
  }
}
