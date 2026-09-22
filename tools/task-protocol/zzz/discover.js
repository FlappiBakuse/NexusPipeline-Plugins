function discover() {
  const plan = createPlan();
  const modern = input.configResources.filter(r => r.id === 'config:one_dragon/_group.yml');
  const config = modern.length ? configOne(r => r.id === 'config:one_dragon/_group.yml') : configOne(r => r.id === 'config:one_dragon_app.yml');
  const d = config.document;
  requireValue(object(d));
  let apps;
  if (modern.length) apps = d.app_list === undefined ? [] : d.app_list;
  else {
    const order = d.app_order === undefined ? [] : d.app_order;
    const selected = d.app_run_list === undefined ? [] : d.app_run_list;
    requireValue(Array.isArray(order) && Array.isArray(selected) && unique(order) && unique(selected)
      && order.concat(selected).every(id => typeof id === 'string' && id.length > 0 && id.length <= 512));
    // Pinned GroupManager migrates only when _group.yml is absent. Registered default
    // apps missing from app_order are appended, retaining app_run_list selection.
    const registered = ADAPTER.defaultAppIds;
    const ordered = order.filter(id => registered.includes(id)).concat(registered.filter(id => !order.includes(id)));
    const unknown = order.concat(selected).filter((id, index, all) => !registered.includes(id) && all.indexOf(id) === index);
    apps = ordered.concat(unknown).map(id => ({ app_id: id, enabled: selected.includes(id) }));
    plan.diagnostics.push({ code: 'zzz.legacy_migration', message: 'Read-only projection of one_dragon_app.yml migration. Upstream creates _group.yml at launch; legacy selection is not patched for automatic retry.' });
  }
  requireValue(Array.isArray(apps) && unique(apps.map(a => a.app_id)));
  for (const app of apps) {
    requireValue(object(app) && typeof app.app_id === 'string' && app.app_id.length > 0
      && (app.enabled === undefined || typeof app.enabled === 'boolean'));
    const enabled = app.enabled === undefined ? false : app.enabled;
    const known = modern.length || ADAPTER.defaultAppIds.includes(app.app_id) ? ADAPTER.apps[app.app_id] : undefined;
    behavior(plan, { id: config.id, document: app }, Object.keys(app).filter(k => !['app_id', 'enabled'].includes(k)),
      ['app_list', { by: 'app_id', value: app.app_id }]);
    addTask(plan, config.id, 'one_dragon/' + app.app_id, known || app.app_id, enabled,
      modern.length && app.enabled !== undefined ? ['app_list', { by: 'app_id', value: app.app_id }, 'enabled'] : null,
      modern.length && app.app_id === 'email' ? 'safe' : 'unknown', known ? 'limited' : 'unsupported');
  }
  plan.diagnostics.push({ code: 'coverage_limited', message: 'Only exact registered outer application names are mapped. Group completion and nested operation failures do not imply application outcomes.' });
  return plan;
}
